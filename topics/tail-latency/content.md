lastReviewed: 2026-11-03

## Orientation

### Definition

Tail latency is the behavior of the slowest part of a latency distribution, usually p99, p99.9, and beyond. Tail amplification is what happens when a request depends on many components: a rare slow event in any of them becomes a common slow event for the whole request.

### Why it matters

In a large system, the tail of one component becomes the median of the whole. If 1 leaf call in 100 is slow and a request waits for 100 leaves, then 63% of requests are slow. Those are not edge cases any more: they are what most of your users see. Tail latency also reveals conditions that averages hide, including garbage-collection pauses, lock contention, retries, background compaction, and noisy neighbors. Principal engineers need to know that tails often can't be engineered away component by component, so a system must be designed to tolerate them.

### Learning objectives

- Calculate how fan-out and sequential depth amplify tail latency.
- Name the common causes of tail events, and how to tell them apart.
- Evaluate hedging, partial results, and tied requests, including their load and correctness costs.
- Explain why hedging fails when slowness is correlated.
- Set per-component tail targets from a whole-request goal.

## Production scenario

A search service fans each query out to 100 index shards and waits for all of them. Every shard answers in about 10 ms, and it takes around 1,000 ms in 1% of calls, often during a background merge. The shard team reports, correctly, that shard p50 is 10 ms and that 99% of calls are fast. The search team reports, also correctly, that their median query takes 921 ms. Both are looking at the same 1%.

The team first tries to tune merges, which is slow and only partly works. They then send a hedge to another replica when a shard hasn't answered in 50 ms. Median query time falls from 921 ms to 59 ms, with only 1% extra leaf load. About 1.1% of queries are still slow, because sometimes both copies are unlucky. For those, the service stops at a deadline and returns results with a missing shard, marked as partial. Results are 99% complete on average and users rarely notice. These figures come from this lesson's simulation.

## Mental model

### Analogy

A dinner party of 100 guests can't start until everyone is seated. Each guest is on time 99% of the time. It sounds fine, but dinner starts late on 63% of evenings. You could not fix this by asking each guest to be slightly more punctual. What works is to not wait for all of them, or to invite a backup for anyone who's running late.

### Where the analogy breaks

Guests are independent, but servers often aren't. A shared disk, an overloaded host, or a deployment makes many slow at once, and in that case a backup is just as late. Also, a backup guest costs little, whereas a hedge consumes real capacity, which is dangerous when the system is already overloaded. Finally, a dinner that starts without a guest is still a dinner, but a request that skips a shard might give a wrong answer, depending on what it does.

### Entities, state, flow, and invariants

- **Entities:** the coordinator, leaf servers, replicas, in-flight copies, and deadlines.
- **State:** copies in flight, the remaining deadline, and the remaining hedge budget.
- **Flow:** fan out, wait, optionally hedge, take the first success, cancel losers, and merge.
- **Invariant 1:** a request waiting for all leaves is at least as slow as the slowest.
- **Invariant 2:** only idempotent, safe operations can be hedged. See [[o1]].
- **Invariant 3:** extra copies are bounded by a budget, so that mitigation cannot create overload.

## Foundations

### Concepts and terminology

| Term | Meaning |
| --- | --- |
| Fan-out | One request calling many leaves in parallel |
| Tail amplification | Rare leaf slowness becoming common at the request level |
| Hedged request | A second copy sent after a delay, with the first answer winning |
| Tied request | Two copies queued together, where one starting cancels the other |
| Partial result | Answering at a deadline with some leaves missing |
| Correlated slowness | Many components slow for one shared reason |
| Micro-partition | Many small partitions per machine, to make rebalancing easier |

### First-principles explanation

Waiting for all of k leaves takes the maximum of k values, and maxima are ruled by the tail. If each leaf is slow with probability p, a request avoids all slow leaves with probability (1 − p)^k. So as k grows, the chance of hitting at least one quickly approaches certainty. Depth has a similar effect, except sequential calls add rather than take the maximum.

Tails have many sources: resource sharing between tenants and between foreground and background work; queueing; garbage-collection pauses; TCP retransmission timeouts, which can add 200 ms or more; power and thermal throttling; lock contention; and cold caches after a deployment. Most are transient, and they happen at random to different machines, which is exactly why hedging works. Getting rid of every one of them is impractical, so systems tolerate them instead.

Hedging exploits independence. If 1% of calls are slow, and a second copy is independently slow 1% of the time, both are slow only 0.01% of the time. Crucially, hedges are only sent for calls still outstanding after the delay, so the extra load is about the probability of exceeding that delay.

Its limit is worth working through. With 100 leaves, each hedged leaf has a 0.01% chance of remaining slow, so 1 − 0.9999^100 ≈ 1% of requests still see a slow leaf. In this lesson's simulation, this leaves p95 at 62 ms and p99 at 850 ms. Hedging cut the slow fraction from 63% to 1.1%, but p99 sits right at that boundary, so it barely moved. Evaluate mitigations by the slow fraction as well as one percentile, or you may judge a big improvement as a failure.

### Mathematics

**Amplification:** P(request slow) = 1 − (1 − p)^k.

| Leaf slow probability p | k = 10 | k = 100 | k = 1,000 |
| --- | --- | --- | --- |
| 1% | 9.6% | 63.4% | 99.996% |
| 0.1% | 1.0% | 9.5% | 63.2% |
| 0.01% | 0.1% | 1.0% | 9.5% |

**Required leaf target:** for request-level slow fraction r, p = 1 − (1 − r)^(1/k). For r = 1% and k = 100: 1 − 0.99^0.01 ≈ 0.01%. So each leaf must meet its target at p99.99 for the request to meet it at p99.

**Hedged leaf:** p′ = p² if independent. At p = 1%: p′ = 0.01%.

**Hedge load:** extra load ≈ P(call exceeds hedge delay). Hedging at the leaf's p95 adds about 5%.

### Complexity

Fan-out to k leaves costs O(k) work per request and takes the maximum of k latencies. A hedge adds a constant factor of (1 + hedge rate). Tied requests add messages but little wasted work. The coordinator's merging is commonly O(k log k) or so. Reducing k, for example with index partitions that can be skipped, is often the highest-value change, as it improves both load and tail.

## Mechanism

### Normal path

1. The coordinator receives a request with a deadline.
2. It sends sub-requests to a replica of each needed shard.
3. It starts a hedge timer per sub-request, set near a high percentile of normal leaf latency.
4. If a leaf has not answered by the timer, and the budget allows it, it sends a copy to another replica.
5. The first success for each shard wins, and the other copy is cancelled.
6. At the deadline, the coordinator returns what it has, if partial results are acceptable, and marks the response.
7. Measurements feed back into which replicas to prefer and how to set the timer.

### State transitions

```mermaid state-subrequest | State of one sub-request with hedging | State diagram. A sub-request is pending until it answers, or the hedge timer fires. If hedge budget is available, it becomes hedged with two copies in flight. The first success wins and cancels the other. If the deadline passes, the shard is marked missing.
stateDiagram-v2
    [*] --> Pending: first copy sent
    Pending --> Answered: reply received
    Pending --> Hedged: timer fires and budget available
    Pending --> WaitingNoBudget: timer fires and budget empty
    Hedged --> Answered: first reply wins, loser cancelled
    Pending --> Missing: deadline passes
    Hedged --> Missing: deadline passes
    WaitingNoBudget --> Answered: reply received
    WaitingNoBudget --> Missing: deadline passes
    Answered --> [*]
    Missing --> [*]
```

The `WaitingNoBudget` state is the safety valve. In an overload, slow calls become common, so an unbudgeted hedger would send copies for nearly every call and double the load at the worst moment. The budget turns this into an ordinary wait.

### Concurrency behavior

Copies race, and the coordinator must handle a late answer after it has already moved on. Cancellation must propagate to actually save work, but many servers cannot stop an in-progress database query. Tied requests address this by queueing on two servers, with cross-cancellation when one begins. Concurrent hedges from many coordinators may converge on the same healthy replica, so choose replicas with care. See [[a39]].

### Ordering and consistency

Hedged reads may hit different replicas, which can return different versions. A later read can then see older data, violating monotonic reads. See [[a73]]. Writes generally can't be hedged safely without idempotency, because both copies might succeed. Partial results change the semantics of a response, so a search may tolerate a missing shard while an account balance never may.

### Ownership of data and control

The coordinator owns hedge policy, since it alone sees whole-request outcomes. Leaf teams own their leaf percentile targets, which should be derived from the whole-request goal. Product owns the decision about whether partial results are acceptable. Clients should know that a response was partial, for example through a response field.

## Architecture

```mermaid context | Context: fan-out request across replicated shards | Flowchart. A client calls a coordinator over HTTPS. The coordinator calls many shard groups over gRPC, each with two replicas. One replica is shown slow due to a background merge. Hedges go to another replica. Shard replicas own their index data, and each zone is a failure boundary.
flowchart LR
    C["Client"] -->|"HTTPS, 500 ms deadline"| CO["Coordinator: owns hedge policy"]
    subgraph s1["Shard 1: owns index partition"]
      R1A["Replica A"]
      R1B["Replica B"]
    end
    subgraph s2["Shard 2: owns index partition"]
      R2A["Replica A: slow, merging"]
      R2B["Replica B"]
    end
    CO -->|"gRPC"| R1A
    CO -->|"gRPC"| R2A
    CO -.->|"hedge after 50 ms"| R2B
    CO -.->|"cancel"| R2A
```

Solid arrows are first attempts and dashed arrows are the hedge and its cancellation. Since a hedge requires a second copy of the data, replication already paid for for durability is what makes tail mitigation possible. Placing replicas in different zones also reduces correlation.

```mermaid component | Component view of the hedging library and the simulation | Flowchart. TypeScript hedged function has a call function, a timer, a list of abort controllers, and a hedge budget. It returns the first success. The Python simulation has a leaf model, then fan-out, hedged, and partial strategies that produce percentile outcomes.
flowchart LR
    subgraph ts["TypeScript: hedged library"]
      F["hedged(call, options)"] --> T["Hedge timer"]
      T --> B["HedgeBudget: ratio and cap"]
      F --> AC["AbortController per copy"]
      AC --> W["First success resolves, losers aborted"]
    end
    subgraph py["Python: simulation"]
      L["Leaf model: fast or slow"] --> S1["fan_out"]
      L --> S2["hedged"]
      L --> S3["partial"]
      S1 --> O["Percentiles, slow fraction, load, completeness"]
      S2 --> O
      S3 --> O
    end
```

The TypeScript code is the mechanism and the Python code is the evaluation. The simulation's output includes extra load and completeness, as each mitigation has a price that a latency chart doesn't show.

```mermaid sequence | Sequence: a hedged call with cancellation | Sequence diagram. The coordinator sends a call to replica A, which stalls. After 50 ms, it checks the budget and sends a copy to replica B, which answers in 12 ms. The coordinator returns the result and cancels replica A.
sequenceDiagram
    participant C as Coordinator
    participant B as Hedge budget
    participant A1 as Replica A
    participant A2 as Replica B
    C->>A1: Search shard 2
    Note over A1: Stalled by a merge
    C->>B: Timer fired at 50 ms. Hedge allowed?
    B-->>C: Yes, one token used
    C->>A2: Same search
    A2-->>C: Result after 12 ms
    C->>A1: Cancel
    Note over C: Shard took 62 ms in place of 1,000 ms
```

The request's time is the hedge delay plus the second copy's time, so the delay sets the floor for rescued calls. Shorter delays rescue calls sooner but add load. Hence the common practice of setting the delay near the 95th percentile of normal latency.

```mermaid failure-path | Failure path: hedging amplifies overload | Flowchart. Load rises and leaf latency rises. Now most calls exceed the hedge timer. Without a budget, hedges double traffic and worsen the overload, in a loop. A hedge budget stops the loop, and hedges are disabled as load is shed.
flowchart TD
    A["Load rises, leaves slow down"] --> B["Most calls exceed the hedge delay"]
    B --> C{"Hedge budget in place?"}
    C -->|"no"| D["Traffic nearly doubles"]
    D --> E["Leaves slow further"]
    E --> B
    C -->|"yes"| F["Hedges capped at a small percentage"]
    F --> G["Load shedding handles the overload"]
```

Hedging assumes slowness is rare and independent, and overload breaks both of those assumptions. Without a budget, the tail mitigation becomes an amplifier, in much the same way as unbudgeted retries. See [[a110]].

## Trade-offs

### Advantages

- Tolerates causes that you don't control, such as hardware and neighbors.
- Very high return: in the simulation, 1% extra load cut slow requests from 63% to 1.1%.
- Partial results give a hard upper limit on latency.

### Costs

- Hedging consumes capacity and needs idempotent operations and working cancellation.
- Different replicas can return different data versions.
- Partial results require product acceptance and client awareness.
- Added code paths are themselves a source of bugs, and they complicate debugging.

### Alternatives

- **Removing causes:** isolate background work, tune garbage collection, and use dedicated resources. Worth doing, and limited by what you control.
- **Reducing fan-out:** skip shards that can't match, or use a two-tier index.
- **Better load balancing:** least-loaded or power-of-two-choices steers traffic away from slow servers.
- **Ejecting slow instances:** outlier detection removes persistently slow replicas.
- **Overprovisioning:** lowers queueing tail, at direct cost.

### When to use it

When fan-out is high, reads are idempotent, replicas exist, slowness is transient and uncorrelated, and users value latency more than the small extra load.

### When not to use it

Not for non-idempotent writes. Not for expensive requests where a hedge costs a lot. Not where cancellation doesn't work, as you'd pay for both copies. Not as a cover for a persistent problem, since a server that is always slow needs fixing or ejecting.

### Reconsider when

- The hedge rate grows, since hedging may be hiding a real degradation.
- Slowness has become correlated, and hedges have stopped winning. Track the win rate.
- Fan-out changes, which changes the target percentile for each leaf.

## Capacity planning

### Inputs and assumptions

Fan-out to 100 shards at 500 queries per second. Each replica safely serves 300 requests per second. Hedge delay is set at about p95, so extra load is 5%. Three zones with one replica per zone at most.

### Formula and units

- Per-shard load (requests per second) = queries per second × (1 + hedge rate), when each query touches each shard.
- Replicas per shard = per-shard load ÷ safe rate per replica ÷ (1 − headroom).
- Total leaf calls per second = queries per second × fan-out × (1 + hedge rate).

### Intermediate calculations

- Per-shard load: 500 × 1.05 = 525 requests per second.
- Replicas at exact capacity: 525 ÷ 300 = 1.75.
- Total leaf calls: 500 × 100 × 1.05 = 52,500 per second.
- Hedges sent: 2,500 per second, charged to shared network and CPU.

### Headroom

With 30% headroom: 525 ÷ 0.7 = 750 requests per second of capacity per shard, or 2.5 replicas, so 3. Tail latency is very sensitive to utilization, so tail-critical systems usually run with more headroom than the mean alone suggests. See [[o90]].

### Failure capacity

With 3 replicas in 3 zones, losing a zone leaves 600 requests per second against 525 of load: 87.5% utilization, where tails grow quickly. To keep 750 after losing a zone needs 750 × 3 ÷ 2 = 1,125, or 4 replicas. In the failure state, also reduce the hedge budget, because extra load is costliest then.

## Failure modes

:::failure Hedging amplifies overload
Trigger: Latency rises for everyone, so most calls exceed the hedge delay.
Symptoms: Leaf traffic jumps well above query traffic, and latency worsens.
Blast radius: All shards, since this is fleet-wide load growth.
Detection: Monitor the hedge rate relative to requests.
Mitigation: Reduce the budget to zero, and shed load.
Recovery: Re-enable hedging gradually, after queues drain.
Prevention: Enforce a hedge budget and test it under overload.
:::

:::failure Correlated slowness defeats hedging
Trigger: Replicas share a disk, host, or deployment, or load is high everywhere.
Symptoms: Hedge win rate falls, and tails stay long.
Blast radius: Affected shards, with cost going up and no benefit.
Detection: Track the rate at which hedges beat the original call.
Mitigation: Avoid replicas in the same failure domain.
Recovery: Fix the shared cause.
Prevention: Spread replicas across domains and stagger background work.
:::

:::failure Hedge on a non-idempotent operation
Trigger: A retry or hedge policy gets applied to a write.
Symptoms: Duplicate orders, double charges, and duplicate messages.
Blast radius: Customer data and money.
Detection: Reconcile duplicates, and audit the policy per route.
Mitigation: Disable hedging for the route immediately.
Recovery: Identify and repair duplicates.
Prevention: Make hedging opt-in per method, and require idempotency keys.
:::

:::failure Cancellation does not propagate
Trigger: The client aborts, but the server keeps working.
Symptoms: Hedging costs the full duplicate price, and server work exceeds what clients receive.
Blast radius: Capacity across the serving tier.
Detection: Compare server completions with client-accepted results.
Mitigation: Reduce the hedge rate.
Recovery: Pass cancellation or deadlines through all layers.
Prevention: Test cancellation end-to-end, including database calls.
:::

:::failure Persistent slow instance hidden by hedging
Trigger: One replica stays degraded, yet hedges rescue its requests.
Symptoms: Nice user latency, with a rising hedge rate targeted at one replica.
Blast radius: Lost capacity, and risk when the budget runs out.
Detection: Break down hedge rate per replica.
Mitigation: Eject the replica from rotation.
Recovery: Replace the instance.
Prevention: Use outlier detection and alert on per-replica deviations.
:::

## Security and privacy

### Threats

Attackers may cause tail events on purpose, such as sending costly queries that hit every shard, or crafting inputs that trigger worst-case behavior. Hedging then gives them amplification. Timing differences in tails can also reveal which shard holds data, or whether a record exists.

### Trust boundaries

Decide hedging and fan-out inside your trust boundary. Never let a client request options that control the hedge count or width. Treat client-supplied deadlines as capped hints.

### Authentication and authorization

Each copy of a request must carry the same authorization context. A hedge sent to another replica must not skip checks. Fan-out services should not hold broad credentials on behalf of every user if they can propagate an identity instead. See [[a135]].

### Tenant isolation

Tail events often come from noisy neighbors. Per-tenant concurrency limits and fair queueing shield others. Partial results must never mix one tenant's records into another's. Apply budgets per tenant, so one client's slow queries can't exhaust the hedge budget of everyone else.

### Sensitive data

Hedging sends sensitive payloads to more servers, and cancelled copies may still be logged. Treat every replica the same way as far as logging and retention go. Partial results in authorization-related queries are dangerous: a missing shard in a "deny list" lookup must fail closed, not return "not found".

### Abuse resistance

Limit fan-out for expensive query types, cap per-client concurrency, and reject requests whose estimated cost exceeds a threshold. Monitor for clients with unusually high hedge rates or partial-result rates.

## Observability

### Metrics

Track p50, p99, and p99.9 at the coordinator and per shard, slow-request fraction, hedge rate, hedge win rate, cancellation rate, budget exhaustion, partial-result rate, and average completeness. Export per-replica deviation from its group's median. See [[a120]].

### Logs

For slow requests, log which shard was slowest and whether a hedge was sent. For partial results, log missing shards. Sample successful logs to control volume.

### Traces

Tail-sampled traces are key here: capture traces for the slowest requests, because head sampling mostly misses them. Show hedges as sibling spans with a link and an attribute saying which won. See [[a121]].

### Dashboards

Show a heat map of leaf latency, a shard-by-time slowness grid, and hedge rate on one axis with win rate on another. A vertical line in a grid means correlated slowness in one shard, and a horizontal line means a time-based, fleet-wide event.

### Alerts

Page on whole-request SLO burn. Send a ticket when the hedge rate is more than twice normal, when win rate falls below an agreed level, or when one replica deviates persistently. Rising hedge rates are an early warning that fast user latency is hiding degradation.

### SLO examples

- 99% of search requests finish within 200 ms over 28 days.
- 99.9% of responses are at least 95% complete.
- Hedges stay under 5% of leaf calls for 99% of minutes.

### Runbook actions

When tail latency rises: check whether it's one replica, one shard, or all. For one replica, eject it. For all, check utilization and hedge rate, set the budget to a low value if the system is overloaded, and shed load. Check recent deployments and background jobs such as merges and compaction.

## Implementation

### Architecture of the examples

TypeScript is a small `hedged` library with a demo: it manages copies, timers, cancellation, and a budget. Python is a seeded simulation comparing strategies across 20,000 requests, since a real cluster would be needed to do this with live traffic.

### Data structures

`hedged` keeps a list of `AbortController`s, one per copy. `HedgeBudget` is a token bucket that earns tokens per request rather than per second, so hedges are limited to a ratio of traffic. The Python `Outcome` reports percentiles plus `over_100ms_pct`, `extra_load_pct`, and `mean_completeness_pct`.

### Interfaces

`hedged(call, { hedgeAfterMs, maxCopies, budget })` returns `{ value, winner, copiesSent }`. `call` receives an `AbortSignal` and a replica number, so any client can adopt it. Python exposes `fan_out`, `hedged`, `partial`, and the two prediction functions.

### Error handling

A failed copy immediately triggers the next one, if allowed, since waiting would be pointless. If all copies fail, `AllCopiesFailed` carries every cause for diagnosis. Late results are ignored by a `settled` flag, so nothing can resolve twice.

### Concurrency considerations

JavaScript's single thread means that no locking protects `settled`, though callbacks interleave at `await` points, which the flag handles. `clearTimeout` stops stale hedge timers. The test confirms that aborting fires on the loser. A multi-threaded language would need an atomic first-wins step and explicit goroutine or task cleanup.

### Educational limitations

The simulation treats leaves as independent, which is the best case for hedging. There are no queues, so hedges don't slow anything down. Aborting in the demo only stops a local timer. Replica selection is simply by number.

### Production hardening

Use proxy or client-library hedging where available, make it opt-in per method, track win rate, adapt the delay from recent latency, propagate deadlines and cancellation, avoid same-domain replicas, and test under overload.

## Terminal lab

### Setup

```bash
cd topics/tail-latency/examples/python
uv sync --quiet
```

### Run

```bash
uv run python -m app.main | jq -c '.predicted_slow_fraction, (.results[] | {name,p50_ms,p95_ms,p99_ms,over_100ms_pct,extra_load_pct,mean_completeness_pct})'
```

Then see a hedge in action:

```bash
cd ../typescript && pnpm install --ignore-workspace --silent && pnpm --silent start
```

### Test

```bash
cd ../python && uv run pytest -q
```

```bash
cd ../typescript && pnpm test
```

### Expected output

Seeded results, measured on the review date:

```json
{"1":0.01,"10":0.096,"100":0.634}
{"name":"fan-out 1","p50_ms":10.0,"p95_ms":11.8,"p99_ms":817.1,"over_100ms_pct":1.07,"extra_load_pct":0.0,"mean_completeness_pct":100.0}
{"name":"fan-out 10","p50_ms":11.8,"p95_ms":989.7,"p99_ms":1155.6,"over_100ms_pct":9.51,"extra_load_pct":0.0,"mean_completeness_pct":100.0}
{"name":"fan-out 100","p50_ms":921.3,"p95_ms":1179.2,"p99_ms":1195.8,"over_100ms_pct":63.13,"extra_load_pct":0.0,"mean_completeness_pct":100.0}
{"name":"fan-out 100, hedge at 15 ms","p50_ms":24.2,"p95_ms":26.8,"p99_ms":826.5,"over_100ms_pct":1.12,"extra_load_pct":1.0,"mean_completeness_pct":100.0}
{"name":"fan-out 100, hedge at 50 ms","p50_ms":59.2,"p95_ms":61.8,"p99_ms":849.7,"over_100ms_pct":1.12,"extra_load_pct":1.0,"mean_completeness_pct":100.0}
{"name":"fan-out 100, partial at 50 ms","p50_ms":50.0,"p95_ms":50.0,"p99_ms":50.0,"over_100ms_pct":0.0,"extra_load_pct":0.0,"mean_completeness_pct":99.0}
```

Observed slow fractions match the formula: 1.07%, 9.51%, and 63.13% against predictions of 1%, 9.6%, and 63.4%. Hedging leaves p99 high since about 1.1% of requests still see both copies slow, which is exactly the 1% predicted. Check p95 and the slow fraction to see its real benefit. The hedging demo prints `"winner":1`, `"copiesSent":2`, `"cancelled":1`, and takes about 70 ms, not 500 ms.

### Cleanup

```bash
rm -rf .venv ../typescript/node_modules
```

### Troubleshooting

- The demo's `elapsedMs` varies by a few milliseconds due to timer resolution.
- The results match exactly only with the same seed and a compatible Python random generator.

## Practical challenges

:::challenge Concept | The team that met its target
Each of 20 services called in parallel meets "p99 under 100 ms". What share of whole requests take longer than 100 ms? What per-service percentile is required for the request to meet p99?
>>> Hint
Use 1 − (1 − p)^k for the first. Rearrange for the second.
>>> Solution
1 − 0.99^20 = 18.2% of requests are slower than 100 ms. For a request-level 1%: p = 1 − 0.99^(1/20) = 0.05%, so each service must meet the target at p99.95. Every service can be meeting its own objective while the product fails its target.
>>> Common mistakes
Assuming that p99 at each layer gives p99 overall. Forgetting that this assumes independence, and that correlated slowness changes the numbers.
:::

:::challenge Debugging | Hedging stopped helping
Six months ago, hedges won 70% of the time. Now they win 8%, while the hedge rate has doubled. What changed, and how do you find out?
>>> Hint
When does a second copy not help? Compare leaf latency across replicas at the same moment.
>>> Solution
Slowness has probably become correlated: both replicas are slow together. Candidate causes: higher utilization overall, shared storage, synchronized background work, or a slow shared dependency. Plot the latency of paired replica calls and check their correlation, and compare with utilization and deployment changes. A win rate of 8% means hedges are mostly wasted load, so reduce the hedge budget and fix the shared cause.
>>> Common mistakes
Reducing the delay, which makes more copies with no gain. Failing to track win rate at all.
:::

:::challenge Capacity | Price a hedge policy
A service fans out to 50 shards at 2,000 queries per second. Hedge delay is at leaf p90. Each replica safely serves 2,500 requests per second. How many extra leaf calls per second does hedging add, and how many replicas per shard do you need with 25% headroom, before and after?
>>> Hint
Hedging at p90 means about 10% of calls exceed the delay.
>>> Solution
Base leaf calls: 2,000 × 50 = 100,000 per second, and hedges add 10,000. Per-shard load: 2,000 before and 2,200 after. Replicas with headroom: 2,000 ÷ 0.75 ÷ 2,500 = 1.07, so 2 before. 2,200 ÷ 0.75 ÷ 2,500 = 1.17, so still 2 after. Both need 2 replicas after rounding, so the shared network and CPU costs are what grow. Moving the delay to p95 halves that cost.
>>> Common mistakes
Assuming hedging at p90 means sending hedges for all requests. Using requests rather than leaf calls when counting load.
:::

:::challenge Design | Tail tolerance for three products
Decide whether to use hedging, partial results, both, or neither for: (a) product search across 200 shards, (b) a bank account balance from 3 replicas, and (c) a recommendation widget using 40 models. Give reasons.
>>> Hint
Ask two questions: can the operation run twice safely, and what does a missing piece mean?
>>> Solution
(a) Both. Reads are idempotent, a missing shard modestly reduces recall, and the response can be marked partial. (b) Hedging is possible for reads if version checks prevent stale values, but partial results don't apply, since a balance can't be partly correct. Consistency requirements come first. (c) Partial results with no hedging: models are expensive, so a hedge costs a lot, and the widget can be fine with fewer candidates, or disappear altogether. Use a strict deadline.
>>> Common mistakes
Applying the same policy to all three. Ignoring how expensive a hedge would be for model inference.
:::

:::challenge Incident | A deployment added 200 ms for a few requests
After a deployment, p50 is unchanged, p99 goes from 80 ms to 300 ms, and the slow requests are spread evenly across instances, at a rate of about one every few seconds per instance. What are your top hypotheses and how do you test them?
>>> Hint
Periodic pauses that appear on each instance suggest something happening inside the process.
>>> Solution
Top hypothesis: garbage-collection pauses from increased allocation or a smaller heap. Check GC pause metrics against slow-request timestamps. Others: a periodic task blocking an event loop, a new synchronous log write, and connection churn, with TCP retransmission. Compare with a canary, or roll back to confirm. Roll back first if SLO burn is serious, then diagnose. Follow-up: add a runtime pause metric and event-loop lag, and a canary comparison on p99. See [[o80]].
>>> Common mistakes
Adding instances, which doesn't reduce pauses. Looking only at p50, where this is invisible.
:::

## Industry standards and trends

### Standards and specifications

There's no formal standard for tail mitigation. The [gRPC retry and hedging design](https://github.com/grpc/proposal/blob/master/A6-client-retries.md), a project proposal, defines hedging policy and throttling, including the idempotency caveat. [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293.html), August 2022, defines TCP, whose retransmission timeouts are a common cause of tail events.

### Established practice

[The Tail at Scale](https://research.google/pubs/the-tail-at-scale/), Dean and Barroso, *Communications of the ACM*, 2013, introduced much of the vocabulary here, including hedged and tied requests. Findings there are specific to the systems studied, so measure your own. [Envoy's HTTP routing documentation](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/http/http_routing) describes proxy-level hedging. Outlier ejection and least-request load balancing are also established proxy features.

### Managed-service options

Service meshes and some cloud load balancers support outlier detection, and some support hedging. Managed databases offer read replicas, which may or may not allow hedged reads. Check how each charges, since duplicate requests can double the bill.

### Emerging approaches

Low-pause garbage collectors, such as [ZGC](https://openjdk.org/projects/zgc/), reduce one common cause. LLM inference has a distinct tail problem, where a single long request can occupy a GPU batch slot, so hedging is costly and admission control matters more. This last point is an inference from public systems, without a settled practice.

### Recent changes

No significant standards change was identified at the review date. gRPC hedging support differs across language implementations, so check yours.

### Adoption constraints

Hedging needs idempotent operations, replicas, and working cancellation. Metered or per-request-priced dependencies make duplicates directly costly. Measure the win rate before rolling out widely.

## Interview preparation

:::q Foundational | What is tail latency?
**Strong answer.** The slowest part of the distribution, such as p99 and p99.9. It matters since it affects real users, especially when one request touches many components. It often has different causes than the median does.

**Why it is asked.** It's a basic concept for anything operating at scale.

**Weak-answer warning signs.** Treating it as just random noise to ignore.

**Follow-up.** Name three causes of tail events that aren't in your application code.
:::

:::q Foundational | Why does fan-out make tail latency worse?
**Strong answer.** A request that waits for all leaves is as slow as the slowest. If each has a 1% slow chance, then at 100 leaves 1 − 0.99^100 = 63% of requests hit at least one.

**Why it is asked.** The calculation is a quick indicator of real understanding.

**Weak-answer warning signs.** Believing parallelism makes this better without any cost.

**Follow-up.** What is the effect of sequential calls, by comparison?
:::

:::q Foundational | What is a hedged request?
**Strong answer.** After a short delay, you send a second copy to another replica and take the first answer, cancelling the other. Because the delay is high, only a few percent of calls get a second copy, so the load cost is small.

**Why it is asked.** It's the classic mitigation, and it's often misremembered as a plain retry.

**Weak-answer warning signs.** Confusing it with sending every request twice.

**Follow-up.** How do you pick the delay?
:::

:::q Senior | When does hedging not work?
**Strong answer.** When slowness is correlated, for example under fleet-wide overload or with a shared dependency, the second copy is equally slow. It's also unsafe for non-idempotent operations, and wasteful if cancellation doesn't reach the server. I would use a budget, and track win rate to verify that it helps.

**Why it is asked.** It tests whether you know a technique's limits.

**Weak-answer warning signs.** Presenting hedging as free.

**Follow-up.** How would you detect correlated slowness?
:::

:::q Senior | What is the difference between a hedge and a retry?
**Strong answer.** A retry occurs after failure or timeout, replacing the attempt. A hedge happens while the first is still running, and both race. Hedges target latency, and retries target errors. Both add load and both need budgets.

**Why it is asked.** Clear terms matter for correct policy.

**Weak-answer warning signs.** Using the terms interchangeably.

**Follow-up.** What happens if you have both retries and hedges in several layers?
:::

:::q Senior | Hedging took 63% of requests down to about 1% slow, but p99 barely changed. Why?
**Strong answer.** With 100 leaves and 0.01% per hedged leaf, about 1% of requests still have both copies slow, which sits right at p99. So p99 is the wrong lens for this: the improvement appears in p50, p95, and the slow fraction. To improve p99 further I'd use more copies, partial results, or fewer leaves.

**Why it is asked.** It tests whether you understand your own measurements.

**Weak-answer warning signs.** Concluding that hedging failed.

**Follow-up.** What would a third copy cost and achieve?
:::

:::q Senior | How do you reduce tails caused by background work?
**Strong answer.** Separate it from foreground work: rate-limit compaction, run it in separate pools or at lower priority, and stagger it across replicas, so that at most one replica in a group is busy. A coordinator may also avoid replicas known to be busy.

**Why it is asked.** Interference from background jobs is one of the most common causes of tail latency.

**Weak-answer warning signs.** Only suggesting more hardware.

**Follow-up.** What trade-off comes with slowing compaction? See read amplification.
:::

:::q Staff | How would you set latency targets for leaf services?
**Strong answer.** Work back from the request-level goal. With fan-out k and whole-request slow fraction r, each leaf needs a slow fraction of about r ÷ k, adjusted for mitigations. At 100 leaves, a p99 goal requires leaves to meet it at p99.99 without hedging, or much less with it. I'd agree this between teams and reconsider if fan-out changes.

**Why it is asked.** Cross-team targets are staff-level work.

**Weak-answer warning signs.** Giving each team the same p99 as the overall product.

**Follow-up.** One team says p99.99 is impossible. What are your options?
:::

:::q Staff | When would you accept partial results?
**Strong answer.** When a missing piece degrades quality and not correctness, as in search or recommendations. The response is marked partial, completeness is monitored, and critical pieces, like authorization or ads with billing rules, must not be skipped. Product owners should sign off on the completeness target.

**Why it is asked.** It joins product and technical choices.

**Weak-answer warning signs.** Never considering it, or applying it to balances and permissions.

**Follow-up.** How do you detect a shard that's silently always missing?
:::

:::q Staff | Tail latency rose but all components report healthy. How do you investigate?
**Strong answer.** I would start from tail-sampled traces to see where slow requests spend their time, including gaps in spans. Then I'd look for correlation in time and location. Look at TCP retransmits, GC pauses, CPU throttling, and noisy neighbors, each of which may lie outside normal component dashboards.

**Why it is asked.** Real tail problems often sit between components.

**Weak-answer warning signs.** Only looking at averages or a single service.

**Follow-up.** CPU throttling shows up only in container metrics. Why might average CPU look fine?
:::

:::q Principal | How do you decide how much to invest in tail latency?
**Strong answer.** I'd tie it to business value and to fan-out. I would look at slow-request impact on conversion or task completion, the number of backends per request, and cost. Often the cheapest step is reducing fan-out or adding a budgeted hedge, not improving each component. Then I'd set a target by journey and stop where further spending doesn't produce measurable results.

**Why it is asked.** Principals prioritize, rather than chasing nines for their own sake.

**Weak-answer warning signs.** "Lower is always better".

**Follow-up.** How would you measure the business effect?
:::

:::q Principal | Should the platform provide hedging as a default for all services?
**Strong answer.** Not on by default. It's dangerous for non-idempotent methods and costly on expensive ones. I would provide it as an opt-in per method through the shared client or mesh, with mandatory budgets, cancellation support, standard metrics, and documentation. Automatic per-method idempotency annotations can enable safe defaults for reads over time.

**Why it is asked.** Platform defaults have company-wide blast radius.

**Weak-answer warning signs.** Rolling out globally because of good results for one service.

**Follow-up.** How would you protect a shared dependency from many clients' hedges at once?
:::

## Review

### Key takeaways

- P(request slow) = 1 − (1 − p)^k, so fan-out turns rare into common.
- Tails come from sharing, pauses, retransmits, and background work, and can't be removed entirely.
- Hedging exploits independence, at a small load cost.
- Budget hedges, since overload breaks their assumptions.
- Judge mitigations using slow fraction and multiple percentiles, not just p99.
- Partial results bound latency, where a missing piece doesn't break correctness.

### Decision checklist

- [ ] What is the fan-out, and what does it require from each leaf?
- [ ] Are slow events independent across replicas?
- [ ] Is the operation idempotent?
- [ ] Does cancellation reach the server?
- [ ] Is a partial result acceptable to the product?

### Production-readiness checklist

- [ ] Hedges are opt-in per method, and budgeted.
- [ ] Hedge rate and win rate are monitored.
- [ ] Per-replica outliers are detected and ejected.
- [ ] Background work is isolated and staggered.
- [ ] Slow requests get tail-sampled traces.

### Glossary

- **Tail amplification:** rare slowness turning common through fan-out.
- **Hedged request:** a delayed duplicate, where the first answer wins.
- **Tied request:** duplicates that cancel each other when one starts work.
- **Win rate:** the share of hedges finishing before the original.
- **Tail sampling:** deciding to keep a trace after seeing its outcome.
- **Outlier ejection:** removing an unusually slow or failing instance from rotation.

### Quiz

:::quiz With 1% slow leaves and a fan-out of 100, what share of requests are slow?
- 1%
- 10%
- *63%
- 100%
1 − 0.99^100 ≈ 63.4%, and the simulation measured 63.13%.
:::

:::quiz A hedge at the leaf's p95 adds about how much load?
- 95%
- 50%
- *5%
- 0%
Only calls still running after the delay get a second copy, or about 5% of them.
:::

:::quiz Which situation most weakens hedging?
- High fan-out
- Idempotent reads
- *Fleet-wide overload making all replicas slow
- Replicas in separate zones
Hedging depends on independence. Overload makes the second copy slow as well, and adds load.
:::

:::quiz Which operation should never be hedged without extra protection?
- A product search
- A cached profile read
- *A payment capture
- A health check
It isn't idempotent, so both copies could succeed. It would need an idempotency key at minimum.
:::

:::quiz What's the most useful metric to show that hedging still works?
- CPU usage
- *Hedge win rate
- Mean latency
- Instance count
If the hedges stop winning, slowness may be correlated, and hedging only adds load.
:::

### Further study

Continue with [[a5]] to allocate time across a request, [[a39]] to propagate deadlines, and [[a110]] for budgeting extra load. [[a113]] extends partial results into a general approach to degradation.
