lastReviewed: 2026-11-03

## Orientation

### Definition

Throughput is the rate at which a system completes work, measured in units per time: requests per second, messages per second, or bytes per second. Goodput is the part of that work that was actually useful: completed successfully, in time, and not duplicated.

### Why it matters

Throughput sets how much a system can do and therefore how much it costs per unit of work. It has a hard limit at the most constrained resource, called the bottleneck, and improving anything else accomplishes nothing. The gap between throughput and goodput is where many major outages live. A server can run flat out at its maximum rate while serving nobody, because every response arrives after the client has left. Dashboards show a busy, productive system during what users experience as a total outage.

### Learning objectives

- Differentiate throughput, goodput, capacity, and bandwidth, each with its correct unit.
- Find the bottleneck in a pipeline, and explain why other improvements do nothing.
- Explain why adding workers eventually stops helping, using Amdahl's Law and the Universal Scalability Law.
- Show why an unbounded queue destroys goodput during overload, and how bounding it helps.
- Describe when batching improves throughput and what it costs in latency.

## Production scenario

A payments company processes settlement files and handles 900 transactions per second at month end. Leadership asks for 3,000. The team doubles application servers from 40 to 80 and gets just 940 transactions per second. They double them again, and throughput *falls* to 880. Each transaction needs a row lock on a merchant balance, and a few large merchants receive most of the volume. Application servers were never the bottleneck: lock wait on those rows was, and more servers meant more contention.

The bottleneck analysis takes one afternoon. Transactions wait on locks for 70% of their duration. The fix keeps the servers at 40, batches balance updates per merchant, applying 200 ledger entries in one transaction, and partitions balances into sub-accounts for the largest merchants. Throughput reaches 3,400 per second. Doubling hardware cost a quarter's budget and made things worse, and a design change tripled the throughput at no extra hardware cost.

## Mental model

### Analogy

Picture a highway leading to a two-lane bridge. Traffic flow is limited by the bridge, however many lanes lead up to it. Widening the highway elsewhere only lengthens the queue before the bridge. Past a certain density, cars get in each other's way and flow actually *falls*, which is why jammed highways move fewer cars than busy ones moving freely.

### Where the analogy breaks

Cars physically occupy space, whereas software requests occupy abstract resources such as locks and connections, so a bottleneck may be invisible on any infrastructure graph. Drivers also don't abandon a trip halfway and leave a ghost car still using the bridge. Software requests do: a server may keep processing work whose client timed out. This wasted work has no road equivalent, and it is the main source of goodput collapse.

### Entities, state, flow, and invariants

- **Entities:** arrivals, queues, workers, shared resources such as locks and disks.
- **State:** queue length, in-flight count, and resource utilization.
- **Flow:** arrive, wait, get served, complete, with possible timeout and retry.
- **Invariant 1:** in steady state, throughput cannot exceed the capacity of the bottleneck.
- **Invariant 2:** in steady state, completions equal arrivals, otherwise a queue is growing or the system is rejecting work.
- **Invariant 3:** concurrency = throughput × response time, which is Little's Law. See [[a8]].

## Foundations

### Concepts and terminology

| Term | Meaning | Unit |
| --- | --- | --- |
| Throughput | Completed work per unit of time | Requests per second |
| Goodput | Useful completed work per unit of time | Successful, timely requests per second |
| Capacity | The maximum sustainable throughput | Requests per second at a stated latency |
| Bandwidth | A link's raw transfer rate | Bits per second |
| Offered load | The rate of arriving work | Requests per second |
| Bottleneck | The resource limiting throughput | Named resource |
| Contention | Waiting for a shared resource | Fraction of work that is serialized |
| Coherency | Keeping shared state in agreement | Cost grows with pairs of workers |

Bits and bytes cause frequent errors: 1 Gbit/s is 125 MB/s at most, and less after protocol overhead.

### First-principles explanation

For a pipeline of stages, the sustainable rate equals the smallest stage capacity. If an API can do 5,000 rps, a cache 50,000, and a database 1,200, the system does at most 1,200 for requests requiring the database. Doubling API servers changes nothing. Hence the first question in any throughput problem is "which resource is saturated?" See [[a6]].

Adding workers scales linearly only if they share nothing. Amdahl's Law says that a serial fraction σ limits speedup to 1 ÷ σ, however many workers you add. With 5% serialized, the limit is 20 times. The Universal Scalability Law adds a coherency cost that grows with pairs of workers, since each must stay consistent with others. This term makes throughput actually fall after a peak, matching the scenario above. Locks, cache-line invalidation, cluster gossip, and distributed coordination can all cause it.

Batching works because many operations have a large fixed cost and a small per-item cost: a disk flush, a network round trip, a transaction commit. Combining items pays the fixed cost once. If a commit costs 5 ms and each row costs 0.05 ms, one row per commit gets about 198 rows per second, while 100 rows per commit gets 10,000 rows per second. The cost is that each item waits for the batch to fill. See [[a107]].

### Mathematics

**Amdahl:** speedup(N) = 1 ÷ (σ + (1 − σ) ÷ N).

**USL:** X(N) = λN ÷ (1 + σ(N − 1) + κN(N − 1)), peaking at N = √((1 − σ) ÷ κ).

Example: λ = 1,000 rps, σ = 0.05, κ = 0.0005. The peak is at √(0.95 ÷ 0.0005) = √1,900 ≈ 44 workers. X(44) = 44,000 ÷ (1 + 2.15 + 0.0005 × 44 × 43) = 44,000 ÷ (3.15 + 0.946) = 44,000 ÷ 4.096 ≈ 10,742 rps. Past that, adding workers reduces throughput.

**Little's Law:** L = λW. At 2,000 rps and 50 ms: L = 2,000 × 0.05 = 100 requests in flight. So 80 connections cap throughput at 80 ÷ 0.05 = 1,600 rps, no matter how fast everything else is.

**TCP limit:** throughput ≤ window size ÷ RTT. A 64 KB window at 100 ms RTT gives 640 KB/s, regardless of bandwidth. See [[a28]].

### Complexity

Throughput per worker is the inverse of service time, so reducing an operation from O(n) to O(log n) can change capacity by orders of magnitude where n is large. Lock contention behaves differently: it does not show up in big-O analysis, since it depends on concurrency rather than input size. Sharding removes the shared term by giving each partition its own lock, which is why it often beats optimizing code.

## Mechanism

### Normal path

1. Work arrives at some offered rate.
2. If a worker is free, service begins. Otherwise the work is queued.
3. As long as offered load stays below capacity, throughput matches offered load, and latency stays near service time.
4. Close to capacity, throughput still rises, but queues and latency grow quickly.
5. At capacity, throughput flattens, and the excess must either queue or be rejected.
6. Beyond it, one of two things happens. With a bounded queue, goodput stays near capacity. With an unbounded queue, wait time exceeds deadlines, and goodput collapses.

### State transitions

```mermaid state-load | System operating regions as offered load rises | State diagram. A system moves from underloaded, to near capacity, to overloaded. From overloaded, a bounded queue yields shedding with stable goodput, and an unbounded queue yields collapse. Collapse can persist after load falls, and recovery needs load removal.
stateDiagram-v2
    [*] --> Underloaded: throughput equals offered load
    Underloaded --> NearCapacity: load nears bottleneck
    NearCapacity --> Underloaded: load falls
    NearCapacity --> Shedding: overload with bounded queue
    NearCapacity --> Collapse: overload with unbounded queue
    Shedding --> NearCapacity: load falls
    Collapse --> Collapse: retries sustain the queue
    Collapse --> NearCapacity: load removed and queue drained
```

The notable difference between Shedding and Collapse is the exit. Shedding recovers as soon as load falls. Collapse can sustain itself through retries after the original cause has ended, and it often requires deliberate removal of load.

### Concurrency behavior

Throughput increases with concurrency until a shared resource saturates. Past that, more concurrency only lengthens queues, and it might degrade throughput through contention and context switching. Concurrency limits, connection pools and semaphores are therefore useful even when CPU is free, as they keep work outside the contended region. See [[o4]] and [[a111]].

### Ordering and consistency

Strict ordering reduces throughput, because ordered items can't be processed in parallel. Partition keys are the usual compromise: ordering within a key and parallelism across keys. A single very hot key caps throughput at what one consumer can do. See [[a89]]. Likewise, a stronger durability guarantee requires a flush or a remote acknowledgment for each commit, and batching commits is how databases keep throughput while preserving it.

### Ownership of data and control

Whoever owns the shared resource owns its capacity. When several services share one database, none can guarantee its own throughput without quotas or a designated capacity owner. Flow control is another ownership question: the consumer must be able to signal the producer. If nothing does, the queue in between absorbs the mismatch until it fails. See [[o41]].

## Architecture

```mermaid context | Context: a pipeline in which one resource limits overall throughput | Flowchart. Clients send requests through a load balancer to API servers, a connection pool, and a database with a hot row lock that is marked as the bottleneck at 1,200 per second. A cache handles some reads. The API runs at 5,000 per second, and the cache at 50,000 per second.
flowchart LR
    C["Clients: 3,000 rps offered"] -->|"HTTPS"| LB["Load balancer: 50,000 rps"]
    LB --> A["API servers: 5,000 rps"]
    A -->|"reads"| CA["Cache: 50,000 rps, holds copies"]
    A -->|"TCP, 80 connections"| P["Connection pool"]
    P --> D["Database, owns data: 1,200 writes per second"]
    D --> L["BOTTLENECK: row lock on hot balance"]
```

Every stage has its own limit, and the system's write rate equals the lowest figure on the path, here the lock. Doubling API servers leaves that number unchanged. Sometimes the limit is logical, such as a lock, and doesn't appear on CPU or disk graphs. All rates shown are illustrative.

```mermaid component | Component view of the simulator and scalability model | Flowchart. The Python simulator has a seeded arrival generator, a FIFO queue with optional limit, and a worker heap. Outputs are throughput, goodput, and rejection. The TypeScript tool takes load-test samples, fits sigma and kappa, and predicts peak concurrency.
flowchart LR
    subgraph py["Python: goodput simulation"]
      AR["Seeded arrivals"] --> Q["FIFO queue: optional limit"]
      Q --> W["Worker heap: 10 workers"]
      W --> R["Throughput, goodput, rejected"]
      Q -->|"queue is full"| REJ["Rejected early"]
    end
    subgraph ts["TypeScript: scaling model"]
      S["Load test samples: workers, rps"] --> FIT["Least-squares USL fit"]
      FIT --> PK["Peak concurrency and predictions"]
    end
```

The two examples answer different questions. The USL fit asks how far adding workers will carry you, and the simulation asks what happens when load exceeds the result. Together they describe capacity and overload behavior.

```mermaid sequence | Sequence: wasted work under an unbounded queue | Sequence diagram. A client sends a request that waits in a long queue. At its 200 ms deadline the client gives up and retries, adding another request. The server later processes the original request, whose result nobody receives, then the retry, which also waits.
sequenceDiagram
    participant C as Client
    participant Q as Queue
    participant W as Worker
    C->>Q: Request A
    Note over Q: Queue wait exceeds 200 ms
    C--xQ: Deadline passes, client gives up
    C->>Q: Retry A2 joins the back of the queue
    Q->>W: Start original A
    W-->>Q: A done, but nobody is waiting
    Note over W: Counted in throughput, not goodput
    Q->>W: Start A2, which is also late
```

This is how throughput stays high while goodput reaches zero. The fix has two parts: bound the queue, so that waiting stays below the deadline, and propagate deadlines, so that workers can drop expired work rather than do it. See [[a39]].

```mermaid failure-path | Failure path: scaling the wrong component | Flowchart. Throughput is short of the goal. The team adds servers, and contention on the hot lock grows. Throughput falls. Profiling reveals lock wait. Partitioning and batching remove the bottleneck, so throughput improves.
flowchart TD
    A["Throughput below target"] --> B["Add application servers"]
    B --> C["More concurrent transactions"]
    C --> D["Lock contention on hot row grows"]
    D --> E["Throughput falls while cost rises"]
    E --> B
    D -->|"profile shows 70 percent lock wait"| F["Batch updates and split hot accounts"]
    F --> G["Bottleneck moves. Measure again"]
```

The loop back to B represents what happens if nobody identifies the bottleneck. Notice that the good path ends with "bottleneck moves". Removing a bottleneck always reveals the next one, so capacity work is iterative and each step needs another measurement.

## Trade-offs

### Advantages

High throughput per unit of hardware reduces cost, leaves room for growth, and shortens backlogs. Batching, partitioning, and asynchronous processing often raise throughput dramatically compared with adding hardware.

### Costs

- Batching and queuing raise latency for each item.
- Partitioning adds operational complexity and loses cross-partition transactions.
- Running near capacity leaves little headroom, and it raises queueing delay.
- Bounded queues reject work on purpose, which requires clients to handle the rejection.

### Alternatives

- **Vertical scaling:** simple, often enough, and removes coordination costs up to a limit. See [[o84]].
- **Horizontal scaling:** effective if work has low contention. See [[o83]].
- **Reducing work:** caching, removing unneeded calls, and doing less per request.
- **Asynchronous processing:** decouples the rate of acceptance from the rate of processing.

### When to use it

Focus on throughput for batch pipelines, ingestion, month-end processes, and any system whose cost scales with volume. Use goodput as the headline measure for services with deadlines.

### When not to use it

Do not maximize throughput on interactive paths at latency's expense: a large batch window can ruin user experience. Do not tune below your actual load: an unused capacity gain is merely a cost.

### Reconsider when

- A load test shows that adding workers no longer increases throughput.
- Goodput and throughput diverge.
- The bottleneck has moved since your last analysis.
- The cost per unit of work is rising along with volume, which suggests contention.

## Capacity planning

### Inputs and assumptions

Target: 3,000 transactions per second at peak. A single-row commit costs 5 ms of a shard's serialized time. Batching can apply 200 entries in one commit, costing 15 ms in total. Each batch waits at most 50 ms to fill. Each application server handles 500 transactions per second (assumption from a load test).

### Formula and units

- Unbatched per-partition rate = 1 ÷ commit time, in transactions per second.
- Batched per-partition rate = batch size ÷ batch commit time.
- Partitions = target ÷ per-partition rate.
- Connections = throughput in commits per second × commit duration in seconds, from Little's Law.

### Intermediate calculations

- Unbatched: 1 ÷ 0.005 s = 200 per second for each hot row. 3,000 ÷ 200 = 15 partitions if work spreads evenly.
- Batched: 200 ÷ 0.015 s = 13,333 per second per partition, which is more than the target on one.
- Batches needed: 3,000 ÷ 200 = 15 batches per second at full size, with a 67 ms fill time at that rate. So the 50 ms limit triggers first, with 150 entries per batch and 20 batches per second.
- Utilization: 20 × 15 ms = 300 ms of commit time each second, or 30% of one partition's serialized time.
- App servers: 3,000 ÷ 500 = 6.

### Headroom

Run at 70% of capacity for latency and forecast error: 3,000 ÷ 0.7 = 4,286 per second to provision, or 9 application servers (8.57 rounded up). Since batching adds up to 50 ms, confirm it still meets the latency budget.

### Failure capacity

Losing one of three zones: 9 × 3 ÷ 2 = 13.5, so 14 servers. If a ledger primary fails, writes pause during failover, so the backlog at 3,000 per second for 30 s reaches 90,000 entries. Draining this within 5 minutes requires 300 extra per second, an easy load at 13,333 per partition, so the batched design recovers quickly. Without batching, a 200-per-second hot row could never catch up.

## Failure modes

:::failure Goodput collapse under overload
Trigger: Offered load exceeds capacity, and queues are unbounded.
Symptoms: High CPU and steady throughput, while almost all requests time out.
Blast radius: All users of the service, and upstream callers who hold connections open.
Detection: Compare successful in-deadline requests with total completions, and watch queue age.
Mitigation: Bound queues, shed excess, and drop expired work.
Recovery: Reduce load until queues drain, then readmit gradually.
Prevention: Use admission control, deadlines, and retry budgets. See [[a112]].
:::

:::failure Retrograde scaling
Trigger: More workers increase contention or coordination costs.
Symptoms: Adding capacity lowers throughput, and lock wait or context switches rise.
Blast radius: Wasted spend, and possibly less capacity at the worst moment, such as during autoscaling.
Detection: Fit throughput against worker count, and profile lock contention.
Mitigation: Reduce concurrency at once using a limit.
Recovery: Partition shared state or batch writes to remove contention.
Prevention: Run scaling tests over several concurrency levels before relying on autoscaling.
:::

:::failure Hidden bottleneck in a pool or quota
Trigger: A connection pool, thread pool, file descriptor limit, or vendor quota caps the rate.
Symptoms: Throughput plateaus while CPU, memory, and disk all look free.
Blast radius: One service first, followed by its callers through backpressure.
Detection: Check pool wait time, Little's Law on in-flight work, and rate-limit responses.
Mitigation: Raise the limit, if the resource behind it has capacity.
Recovery: Resize, then find the next bottleneck.
Prevention: Export saturation metrics on every bounded resource. See [[a21]].
:::

:::failure Hot partition caps a parallel system
Trigger: Most traffic shares one partition key.
Symptoms: Total throughput stalls while most partitions idle, with one consumer lagging.
Blast radius: All messages in the hot partition, including unrelated ones sharing it.
Detection: Per-partition rate and lag.
Mitigation: Move or split the hot key, or apply limits to it.
Recovery: Repartition using a better key and drain the backlog.
Prevention: Choose keys based on measured skew. See [[a60]].
:::

:::failure Batch failure amplification
Trigger: One poison item fails a large batch, which retries in full.
Symptoms: Throughput drops to zero on one partition, with repeated identical errors.
Blast radius: All items in the batch, then everything behind it in order.
Detection: Monitor batch retry counts and partition lag.
Mitigation: Split the batch and isolate the failing item.
Recovery: Move the item to quarantine and resume.
Prevention: Use per-item error handling and a dead-letter path. See [[a92]].
:::

## Security and privacy

### Threats

Throughput limits are a target. A denial-of-service attacker aims at the most expensive operation, which is effectively your real capacity limit. A small number of slow or costly requests, such as complex searches, can do as much damage as a flood of cheap ones. Compression bombs and oversized payloads turn small requests into large amounts of work.

### Trust boundaries

Enforce rate and size limits at the first point that you control, before expensive work starts. Internal services need limits as well, since a buggy internal caller can do more damage than an external attacker.

### Authentication and authorization

Expensive cryptographic checks reduce throughput, and they can be abused by sending invalid credentials that must be verified. Cache verified results, rate-limit failures, and place cheap checks before expensive ones. When a limit depends on identity, authenticate first using an inexpensive method.

### Tenant isolation

Without isolation, one tenant's traffic consumes throughput meant for everyone. Use per-tenant quotas measured in resource cost, not just request count. Fair queueing prevents any one tenant from dominating a shared queue. See [[a139]].

### Sensitive data

Batching can mix different tenants' data in one payload or log line, so keep tenant identifiers per item and avoid logging batch contents. Encryption costs CPU, but don't remove it to gain throughput. Measure it first, since it's often far smaller than assumed.

### Abuse resistance

Limit by cost, reject oversized and over-complex requests early, and treat rejection as cheap. A rejected request should cost a tiny fraction of a served one. If it doesn't, rejecting offers no protection.

## Observability

### Metrics

Report throughput by route and outcome, goodput as successful requests within deadline, rejected rate, and utilization and saturation for each resource. Also report in-flight requests, pool wait time, queue depth and age, and batch size distribution. See [[a123]].

### Logs

Log rejected and expired work in sampled form with a reason, as high-volume logging during overload can itself cause harm. Batches should log size and outcome.

### Traces

Traces reveal lock waits and pool waits as gaps or spans. Use span links to represent batches, since one batch trace may relate to many request traces.

### Dashboards

Plot offered load, throughput, and goodput together. A separation between them is the clearest sign of overload. Add a chart of throughput against concurrency to spot retrograde scaling.

### Alerts

Page on goodput SLO burn, and on queue age over the deadline. Raise a ticket when peak utilization of a bottleneck stays above its planned level or when adding instances no longer increases throughput.

### SLO examples

- 99.9% of accepted requests complete successfully within their deadline over 28 days.
- Settlement backlog stays under 5 minutes at peak in 99% of month-end runs.
- Queue age remains under 100 ms for 99% of minutes.

### Runbook actions

If goodput drops: compare offered load with historical capacity, and find the saturated resource. Shed non-critical traffic. If retries amplify load, limit them. Confirm expired work is being dropped. Only add instances if the bottleneck really is the instance tier.

## Implementation

### Architecture of the examples

Python is a seeded discrete-event simulator of a 10-worker pool with a capacity of 1,000 requests per second. TypeScript fits the USL to load-test results. Both are offline tools. Simulated time makes overload behavior repeatable, and it lets a 30-second run complete in well under a second.

### Data structures

The simulator uses a `deque` for FIFO waiting and a min-heap of finish times for workers, which gives O(log w) per event with w workers. `Result` separates throughput, goodput, and rejection, since merging those would hide the lesson. The USL fit uses closed-form normal equations for two parameters.

### Interfaces

`simulate(offered_rps, Config)` returns `Result`. Run `python -m app.main [--queue-limit N]` to print a load sweep as JSON lines. TypeScript exports `uslThroughput`, `uslPeak`, and `fitUsl`, and `pnpm start [samples.json]` runs a fit.

### Error handling

Invalid rates and worker counts raise explicit errors. The fit requires a baseline at n = 1 and two more samples, because a fit from too little data would look authoritative while being meaningless.

### Concurrency considerations

Neither tool uses real concurrency. The simulator advances a virtual clock, so results depend only on the seed, and tests never flake. That's a deliberate choice: testing overload behavior with real timers tends to be slow and unreliable. See [[a191]].

### Educational limitations

The simulation has no retries, no dropped expired work, and a single queue, so it may understate real collapse. The USL is an empirical model: it describes data, and it does not explain causes. The TypeScript sample data is invented for teaching and isn't from any real system.

### Production hardening

Measure real systems at several concurrency levels. Add deadline propagation and expired-work dropping, per-tenant fairness, and adaptive concurrency limits. Validate the fitted model against a new measurement before basing a purchase on it.

## Terminal lab

### Setup

```bash
cd topics/throughput/examples/python
uv sync --quiet
```

### Run

Sweep the offered load with an unbounded queue:

```bash
uv run python -m app.main | jq -c '{offered_rps, throughput_rps, goodput_rps, mean_response_ms}'
```

Now repeat with a queue bounded to 50 requests:

```bash
uv run python -m app.main --queue-limit 50 | jq -c '{offered_rps, throughput_rps, goodput_rps, rejected_rps, mean_response_ms}'
```

Fit the scalability model:

```bash
cd ../typescript && pnpm install --ignore-workspace --silent && pnpm --silent start
```

To check a connection-limited throughput on a real system, compare in-flight requests with the Little's Law value. This counts established connections on a port:

```bash
lsof -nP -iTCP:3000 -sTCP:ESTABLISHED | wc -l
```

### Test

```bash
cd ../python && uv run pytest -q
```

```bash
cd ../typescript && pnpm test
```

### Expected output

Measured on the review date, with capacity at 1,000 requests per second. Without a queue limit:

```json
{"offered_rps":950.0,"throughput_rps":949.6,"goodput_rps":949.6,"mean_response_ms":22.3}
{"offered_rps":1100.0,"throughput_rps":998.8,"goodput_rps":60.0,"mean_response_ms":1547.7}
{"offered_rps":1500.0,"throughput_rps":999.5,"goodput_rps":21.0,"mean_response_ms":5140.0}
{"offered_rps":3000.0,"throughput_rps":1003.0,"goodput_rps":8.6,"mean_response_ms":9943.4}
```

With `--queue-limit 50`:

```json
{"offered_rps":950.0,"throughput_rps":951.2,"goodput_rps":951.2,"rejected_rps":2.7,"mean_response_ms":23.8}
{"offered_rps":1100.0,"throughput_rps":997.6,"goodput_rps":997.6,"rejected_rps":106.2,"mean_response_ms":50.1}
{"offered_rps":1500.0,"throughput_rps":999.5,"goodput_rps":999.5,"rejected_rps":505.7,"mean_response_ms":57.9}
{"offered_rps":3000.0,"throughput_rps":1003.0,"goodput_rps":1003.0,"rejected_rps":2001.6,"mean_response_ms":59.2}
```

Throughput is the same in both runs. A 10% overload takes goodput from about 950 down to 60 without a limit, and rejecting just 106 requests per second keeps it near 1,000. The USL fit prints `sigma` 0.0324, `kappa` 0.00105, and a peak near 30 workers. Predicted throughput peaks around 10,035 rps at 32 workers and falls to 5,512 at 128. The input data is invented for this lesson.

### Cleanup

```bash
rm -rf ../python/.venv node_modules
```

### Troubleshooting

- `command not found: uv`: install uv or use another Python 3.12+ environment.
- `lsof` prints only a header when nothing is listening on the port. This is expected if no server is running.
- To fit your own data, include a measurement at `n` = 1, or else the fit is rejected.

## Practical challenges

:::challenge Concept | Name the unit and the limit
A system has a 10 Gbit/s link, an API tier doing 40,000 rps, and a database doing 6,000 queries per second. Each request runs 2 queries and returns 50 KB. What is the maximum request rate, and which resource sets it?
>>> Hint
Convert every limit into requests per second.
>>> Solution
Link: 10 Gbit/s = 1.25 GB/s, and ÷ 50 KB = 25,000 rps. API: 40,000 rps. Database: 6,000 ÷ 2 = 3,000 rps. So the limit is 3,000 rps, and the database sets it. Caching half the queries would raise it to 6,000 rps, and the next limit remains a long way off.
>>> Common mistakes
Comparing raw numbers without converting them. Treating 10 Gbit/s as 10 GB/s.
:::

:::challenge Debugging | Busy, yet useless
Your service shows 1,000 completions per second and 95% CPU, while client-side success has dropped to 3%. Reproduce this using the simulator, and explain the mechanism. What two changes would you make?
>>> Hint
Run the sweep at 1,500 rps with and without `--queue-limit 50`, and compare goodput with throughput.
>>> Solution
Unbounded at 1,500 rps, throughput stays near 1,000, but response time grows steadily, as the queue grows by 500 requests each second. Soon wait exceeds the 200 ms deadline, so goodput falls to about 21 requests per second, roughly 2% of throughput. With a limit of 50, queue wait is at most about 50 ms, so nearly all accepted work finishes in time, and goodput stays close to 1,000 while the rest get quick rejections. Change one: bound the queue relative to the deadline. Change two: propagate deadlines and drop expired work.
>>> Common mistakes
Adding servers before recognizing that completions were wasted. Believing rejecting requests reduces useful output: here it increases it massively.
:::

:::challenge Capacity | Batch or partition?
A hot row handles 1 write per 4 ms. You need 5,000 writes per second, with an added latency limit of 20 ms. A batch of size b costs 4 ms + 0.02 ms × b. Is batching enough? What batch size do you pick?
>>> Hint
Throughput = b ÷ (4 + 0.02b) writes per millisecond. Fill time at 5,000 per second is b ÷ 5 ms.
>>> Solution
Without batching: 250 per second, so 20 partitions would be needed. At b = 50: cost is 5 ms, for 10,000 per second. Fill time is 10 ms, under the 20 ms limit. Utilization: 100 batches per second × 5 ms = 50%. So b = 50 works on one row. At b = 100: fill takes 20 ms, right at the limit, and cost is 6 ms, for 16,667 per second, so there's little reason to go larger. Choose b near 50, and flush on a 10 ms timer for quiet periods.
>>> Common mistakes
Forgetting the flush timer, so a low-traffic item waits forever. Forgetting that added latency includes both fill and commit time.
:::

:::challenge Design | An ingestion pipeline for 1 million events per second
Design ingestion of 1,000,000 events per second at 500 bytes each, written to object storage for analytics, tolerating up to 60 seconds of delay. Identify the bottleneck at each stage, the batching approach, and the behavior when downstream slows.
>>> Hint
Calculate MB/s. Then ask what the 60-second tolerance lets you do. Think about what happens to the buffer when storage slows.
>>> Solution
Volume: 500 MB/s, or 43.2 TB per day before compression. Stateless collectors take events, and a partitioned log buffers them, with partition count from per-partition throughput. For example, at 10 MB/s per partition, 50 partitions at capacity, about 75 with headroom. Writers batch into files every 60 s or at a size such as 256 MB, compressed and columnar. If storage slows, the log absorbs the backlog: retention of 24 hours is 43.2 TB times replication. Writers lag and catch up with spare parallelism. Collectors must reject or sample if the log itself saturates. Monitor consumer lag in seconds. Small-file count is a throughput concern for the query side.
>>> Common mistakes
Writing each event to object storage individually. Ignoring replication in sizing. Having no plan for sustained downstream slowdown.
:::

:::challenge Incident | Autoscaling made it worse
During a traffic spike, autoscaling doubled the fleet, and shortly after, the database hit its connection limit. All requests then started failing. Give your immediate response, the root cause, and two lasting fixes.
>>> Hint
Multiply fleet size by pool size per instance. Compare with the database's connection limit.
>>> Solution
Cause: 100 instances × 20 connections each = 2,000, beyond the database limit. Scaling the stateless tier moved pressure onto the actual bottleneck, and connection setup itself added load. Response: stop autoscaling, roll the fleet back to a safe number or reduce per-instance pool size, shed non-critical traffic, and confirm the database recovers. Lasting fixes: a connection proxy or multiplexing layer; scaling limits derived from database capacity; and concurrency limits per instance so that excess gets rejected at the top. Add a load test covering scale-out. See [[o4]] and [[o82]].
>>> Common mistakes
Raising the database connection limit alone, which risks memory exhaustion and more contention. Treating autoscaling as universally safe.
:::

## Industry standards and trends

### Standards and specifications

- [RFC 2544](https://www.rfc-editor.org/rfc/rfc2544.html), March 1999, describes a benchmarking method for network devices, including throughput with zero loss.
- [RFC 6349](https://www.rfc-editor.org/rfc/rfc6349.html), August 2011, describes a framework for TCP throughput testing.
- [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293.html), August 2022, is the current TCP specification.

These cover network measurement. There is no general standard for application throughput, so state your method.

### Established practice

The USL is described in Neil Gunther's [USL work](http://www.perfdynamics.com/Manifesto/USLscalability.html). Goodput and overload handling are discussed in [Handling Overload](https://sre.google/sre-book/handling-overload/) and [Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/), chapters of *Site Reliability Engineering*, 2016. These are influential published practices, not standards.

### Managed-service options

Managed queues and streams, serverless databases, and managed load balancers all have quotas that define your limit. Treat each published quota as a bottleneck candidate and confirm whether burst and sustained limits differ. Provisioned capacity generally trades cost for predictable throughput.

### Emerging approaches

Adaptive concurrency limits, which adjust limits automatically from observed latency, are used in several service proxies and libraries. io_uring improves I/O throughput on Linux by reducing system-call overhead, though its security history has led some environments to restrict it. For GPU inference, batching and token throughput matter more than request rate. These observations rest on public projects and should be checked against your own workload.

### Recent changes

No major standards change was identified in this review. In practice, processor core counts continue to rise, so contention and memory-locality limits increasingly matter more than raw CPU speed. See [[a20]].

### Adoption constraints

Rejecting traffic requires clients that handle rejection well, and many do not. Batching demands idempotent retries and per-item error handling. Measuring goodput depends on knowing the client's deadline, which needs propagation across services.

## Interview preparation

:::q Foundational | What is the difference between throughput and bandwidth?
**Strong answer.** Bandwidth is the maximum data rate of a link. Throughput is what's actually achieved end-to-end. It can be far lower due to protocol overhead, window limits, or a bottleneck elsewhere. Goodput removes overhead and useless work too.

**Why it is asked.** Precise terms lead to correct capacity math.

**Weak-answer warning signs.** Mixing up bits and bytes, or treating the terms as synonyms.

**Follow-up.** What limits TCP throughput on a long-distance link with lots of bandwidth?
:::

:::q Foundational | What is a bottleneck, and how do you find it?
**Strong answer.** The resource that limits overall throughput. I look for the one that's saturated: high utilization or growing queue. It may be logical, such as a lock or pool. Improving anything else does nothing, and fixing it moves the bottleneck elsewhere.

**Why it is asked.** It is the core of performance reasoning.

**Weak-answer warning signs.** Only checking CPU.

**Follow-up.** CPU, memory, and disk are all at 30% and throughput has plateaued. What next?
:::

:::q Foundational | Why does batching raise throughput?
**Strong answer.** It shares a fixed cost, like a commit or round trip, across many items. So cost per item falls. The price is added latency while the batch fills, and a failure may affect the whole batch, so I set a size limit and a time limit.

**Why it is asked.** Batching is one of the most common design tools.

**Weak-answer warning signs.** Forgetting the latency cost or flush timer.

**Follow-up.** When might batching reduce throughput?
:::

:::q Senior | What is goodput, and why does it matter during overload?
**Strong answer.** Useful work completed: successful and within deadline. In overload with unbounded queues, servers keep working on requests whose clients have left, so throughput stays high and goodput falls near zero. I would monitor goodput directly, bound queues, and drop expired work.

**Why it is asked.** It separates people who have seen real overload.

**Weak-answer warning signs.** Believing a busy server is a productive one.

**Follow-up.** How do you size a queue given a deadline?
:::

:::q Senior | Why could adding servers reduce throughput?
**Strong answer.** Contention and coherency. Amdahl's Law gives a limit from the serialized part, and the USL adds a pairwise cost that makes throughput decline past a peak. Hot locks, shared connections, and cluster coordination are typical causes. I would measure throughput against workers, then remove the shared resource.

**Why it is asked.** It challenges the assumption that horizontal scaling always helps.

**Weak-answer warning signs.** Having no explanation, or attributing it to bad luck.

**Follow-up.** How would you tell contention apart from coherency in real measurements?
:::

:::q Senior | How does Little's Law help with throughput problems?
**Strong answer.** L = λW links in-flight work, throughput, and response time. If a pool has 80 connections and each query takes 50 ms, the limit is 1,600 per second. It also shows that when latency doubles, you need double the concurrency at the same throughput, which is how slow dependencies exhaust pools.

**Why it is asked.** It shows quantitative reasoning.

**Weak-answer warning signs.** Knowing the formula but not applying it.

**Follow-up.** Apply this to a thread pool calling a slow dependency.
:::

:::q Senior | How do you get ordering and high throughput together?
**Strong answer.** Partition by key, so that order holds within a key and parallelism exists across keys. Throughput is then limited by the hottest key, so I would measure skew and choose a key accordingly. Where possible, I would make consumers tolerate reordering, with sequence numbers or idempotent updates.

**Why it is asked.** It is a basic streaming design problem.

**Weak-answer warning signs.** Demanding global order without considering its cost.

**Follow-up.** One customer produces 40% of events. What do you do?
:::

:::q Staff | You need 10 times the throughput. How do you approach it?
**Strong answer.** I would measure first: find the bottleneck at the current load and a scaling curve. Then I would consider reducing work first, then batching and caching, then partitioning. I'd also plan the sequence, because each fix reveals the next bottleneck. I would estimate the cost per unit at each step and check for a cheaper path, such as vertical scaling.

**Why it is asked.** It tests structured, economical thinking.

**Weak-answer warning signs.** Immediately proposing a rewrite or a sharded system.

**Follow-up.** The measured bottleneck is a third-party API with a fixed quota. What are your options?
:::

:::q Staff | How would you design a system to stay productive under overload?
**Strong answer.** Admission control at the front, bounded queues with wait below the deadline, deadline propagation and dropping of expired work, retry budgets, and priority so critical traffic survives. I would also make rejection very cheap and test all of it at multiples of capacity.

**Why it is asked.** It is a direct test of resilience design.

**Weak-answer warning signs.** Relying only on autoscaling, which is too slow for this.

**Follow-up.** What is the right response code, and how should clients react?
:::

:::q Staff | How do you run a meaningful scalability test?
**Strong answer.** I measure throughput and latency across a range of concurrency, including past the peak, using an open-loop generator, production-sized data, and realistic skew. I fit a model, such as USL, to find contention. I hold each step long enough for a steady state, and I record which resource saturates at each level.

**Why it is asked.** Bad tests lead to expensive wrong decisions.

**Weak-answer warning signs.** One test at one load level, or stopping before saturation.

**Follow-up.** How would you test the point where it gets worse safely in production?
:::

:::q Principal | Several teams share a database that has hit its limit. How do you decide what to do?
**Strong answer.** I'd attribute load per team, then look at unit cost and growth forecast. Options include quotas, removing wasteful queries, caching, functional partitioning, and moving a workload to its own store. I would sequence them by benefit and risk, and make capacity ownership explicit, since unowned shared capacity will fill up again.

**Why it is asked.** This mixes technical analysis with organizational design.

**Weak-answer warning signs.** A purely technical answer with no ownership.

**Follow-up.** One team refuses to change, saying they are the biggest revenue source. How do you handle this?
:::

:::q Principal | How would you explain a throughput investment to executives?
**Strong answer.** In business terms: "Month-end settlement reaches its ceiling within two quarters. Past that, payouts are late." I would show the forecast against the limit, cost per transaction now and after, and options with risks. I would leave out the internals unless they asked, and I would commit to a measurable outcome.

**Why it is asked.** Principals need funding for invisible work.

**Weak-answer warning signs.** Leading with lock contention or USL parameters.

**Follow-up.** They ask if you can buy your way out with more hardware. What do you say?
:::

## Review

### Key takeaways

- Throughput is limited by the bottleneck, and everything else is irrelevant until it moves.
- Goodput, not throughput, measures useful work.
- With unbounded queues, overload can leave throughput high and goodput near zero.
- Bounded queues reject work on purpose, and this raises useful output.
- Contention caps speedup, and coherency can make throughput fall as workers increase.
- Batching spreads fixed costs at the price of added latency.

### Decision checklist

- [ ] Have I named and measured the bottleneck?
- [ ] Am I using goodput for services with deadlines?
- [ ] Have I converted every limit to the same unit?
- [ ] Have I checked in-flight limits using Little's Law?
- [ ] Does a scaling test show that more workers really help?

### Production-readiness checklist

- [ ] All queues are bounded, and waiting is less than the deadline.
- [ ] Every bounded resource exports a saturation metric.
- [ ] Expired work gets dropped.
- [ ] Retries are limited by a budget.
- [ ] Autoscaling maximums account for downstream limits.

### Glossary

- **Bottleneck:** the resource that limits total throughput.
- **Goodput:** useful work completed per unit of time.
- **Offered load:** the rate at which work arrives.
- **Contention:** waiting on a shared resource.
- **Coherency cost:** the cost of keeping workers' state in agreement.
- **Retrograde scaling:** throughput falling as concurrency rises.

### Quiz

:::quiz A pipeline's stages handle 5,000, 50,000, and 1,200 requests per second. What is the most it can sustain if all requests touch all stages?
- 56,200
- 18,733
- 5,000
- *1,200
The slowest stage sets the limit, in this case 1,200.
:::

:::quiz With 80 connections and a query time of 50 ms, what is the maximum query rate?
- 400 per second
- *1,600 per second
- 4,000 per second
- 8,000 per second
Little's Law: throughput = 80 ÷ 0.05 s = 1,600 per second.
:::

:::quiz Why does a bounded queue raise goodput during overload?
- It speeds up workers.
- It reduces the number of retries to zero.
- *It keeps queue wait below the deadline, so accepted work finishes on time.
- It raises capacity.
Capacity is unchanged, but servers stop working on requests that would have expired.
:::

:::quiz With σ = 0.05, what is Amdahl's maximum speedup?
- 5 times
- *20 times
- 50 times
- It has no limit.
The limit is 1 ÷ σ = 20, regardless of worker count.
:::

:::quiz What does it mean when adding workers lowers throughput?
- The load balancer has failed.
- *Coherency costs, such as lock contention or coordination, now exceed the benefit.
- The test is always wrong.
- The system has become idle.
The USL predicts this after a peak, and the remedy is reducing shared state or limiting concurrency.
:::

### Further study

Go on to [[o92]] and [[a6]] for how to read saturation, then [[a8]] for queue math. [[a107]] covers batching in depth, and [[a112]] covers staying productive under overload.
