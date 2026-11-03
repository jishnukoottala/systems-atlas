lastReviewed: 2026-11-03

## Orientation

### Definition

A latency budget divides a user-facing latency target among the steps that make up a request. Critical-path analysis finds the sequence of steps that actually determines total time: the longest path through the request's call graph. Only time saved on that path shortens the request.

### Why it matters

Teams spend much of their performance effort on the wrong things. In a parallel stage, speeding up anything but the slowest branch saves nothing at all. Without budgets, every team adds "just 10 ms", and a product slowly misses its target with no one responsible. A budget makes latency a shared, allocated resource, gives each team a number it can own, and provides the basis for sensible timeouts. A critical-path view also tells you what's worth funding: it shows a precise saving before anyone has written any code.

### Learning objectives

- Build a call graph, then find its critical path and each step's slack.
- Predict the saving from speeding up a step, including when it is zero.
- Allocate a budget across steps, with reserves for retries and growth.
- Explain why percentile budgets don't simply add, and when correlation breaks your assumptions.
- Derive timeouts from a budget, and propagate deadlines.

## Production scenario

A checkout must return in 300 ms at p99, and it currently takes about 265 ms in the median trace with occasional misses. Three teams volunteer optimizations. The pricing team can cut pricing from 40 ms to 10 ms with a new cache, at a cost of two engineer-months. Critical-path analysis shows that pricing runs in parallel with fraud and inventory, and fraud takes 90 ms. Pricing has 50 ms of slack, so the project would save exactly 0 ms.

The fraud team offers to go from 90 ms to 40 ms. That's on the critical path, but inventory at 60 ms becomes the new longest branch once fraud drops below it, so the saving is 30 ms, not 50 ms. The largest step is payment at 120 ms, a third-party call which can't be sped up, though it might be moved after the response using an asynchronous confirmation. The team's plan changes completely, using only a call graph and some arithmetic. This lesson's TypeScript example computes these figures.

## Mental model

### Analogy

Think of preparing a dinner. The roast takes 90 minutes, the potatoes take 40, and the salad takes 10. All must be ready at once, so dinner takes 90 minutes. Buying a faster salad spinner doesn't serve dinner any sooner. That's the critical path: the roast. Once the roast is faster than the potatoes, they become the new thing you're waiting for. Budgeting says how long each dish may take if dinner has to be on the table by 7.

### Where the analogy breaks

Cooking times are predictable, while service latencies are distributions: the path that's critical changes from request to request, so one request's critical path may not match another's. Cooks can also watch a clock and adapt, while a service needs a deadline passed to it explicitly. A pot also doesn't get slower because others are cooking, whereas services often slow each other through shared resources.

### Entities, state, flow, and invariants

- **Entities:** steps, dependencies, budgets, deadlines, and traces.
- **State:** remaining budget as a request moves through the system.
- **Flow:** user target, allocation by step, per-call timeout, runtime deadline propagation, and measurement against budget.
- **Invariant 1:** request time equals the longest path through the graph.
- **Invariant 2:** a step with slack can slow down by that much with no effect on the request.
- **Invariant 3:** no call waits longer than the remaining budget.

## Foundations

### Concepts and terminology

| Term | Meaning |
| --- | --- |
| Call graph | Steps and dependencies for one request |
| Critical path | Longest route through the graph |
| Slack | How much a step can slow before it delays the whole |
| Earliest finish | Soonest a step can finish given its dependencies |
| Budget | Time allocated to a step |
| Reserve | Unallocated time, for retries, growth, and network |
| Deadline | An absolute time by which a request must finish |

### First-principles explanation

Sequential steps add and parallel steps take their maximum, so request duration is the longest path. Compute it with a forward pass (each step's earliest finish equals its duration plus the latest dependency's finish) and a backward pass (the latest finish that doesn't delay the total). Slack is their difference. Steps with zero slack form the critical path. This is the classic Critical Path Method, developed for project scheduling in the 1950s, and it applies directly to requests.

There's a catch that matters a great deal. Reducing a critical step only saves time until another path becomes longest. So savings are capped by the gap to the next-longest path. In the example, fraud leads inventory by 30 ms, so that's the most a fraud optimization alone can save.

Budgets face a second catch: percentiles don't add. If delays are independent, it's unlikely that several steps are slow together, so the true p99 of a sum is less than the sum of p99s. In the Python example, the p99s total 451.9 ms, while the sequential p99 is only 311.2 ms. But if steps slow down together, due to a shared host or network, the p99 reaches 559.3 ms, above the naive sum. So a sum of p99s is neither a safe upper bound nor a good estimate. Measure the end-to-end percentile using traces, and treat per-step budgets as allocations for accountability.

### Mathematics

**Forward pass:** EF(s) = duration(s) + max(EF(d)) over all dependencies d.

**Backward pass:** LF(s) = min(LF(t) − duration(t)) over all successors t, with LF = total for steps that have no successors.

**Slack:** LF(s) − EF(s).

**Checkout worked example:** cart finishes at 5 + 10 + 25 = 40 ms. Then inventory finishes at 100, pricing at 80, and fraud at 130. Payment starts at 130 and finishes at 250, and writing the order finishes at 265. Pricing slack: 130 − 80 = 50 ms. Inventory slack: 30 ms.

**Measured percentile combination**, from a 100,000-trial simulation:

| Combination | p99 |
| --- | --- |
| Sum of each dependency's own p99 | 451.9 ms |
| Sequential, independent | 311.2 ms |
| Sequential, correlated slowdowns | 559.3 ms |
| Parallel, all four | 206.0 ms |
| Slowest member's own p99 | 202.2 ms |

**Timeout from budget:** remaining = deadline − now − reserve for the rest of the path.

### Complexity

The forward and backward passes visit every step and edge, so an efficient version is O(V + E). The example scans successors linearly for clarity, giving O(V × (V + E)) in the worst case, which is fine for a few dozen steps. Monte Carlo costs O(n × V) for n trials. Across real traces, critical paths must be computed per trace, then aggregated.

## Mechanism

### Normal path

1. Choose a journey and target: `POST /checkout`, p99 300 ms.
2. Build the call graph from traces, not from memory or diagrams.
3. Compute critical paths across many sampled traces, since the critical path varies.
4. Set aside a reserve, commonly 10% to 20%, for network hops and growth.
5. Allocate the rest to steps, based on what each can achieve.
6. Derive timeouts from allocations, and propagate a deadline along the path.
7. Report each team's use of its budget, then review changes to the budget.

### State transitions

```mermaid state-deadline | Remaining budget as a request moves along the path | State diagram. A request starts with a full budget. Each step consumes some. When enough remains the next call proceeds. If little remains, the service degrades by skipping optional work. If nothing remains, it fails fast rather than doing work that would be wasted.
stateDiagram-v2
    [*] --> BudgetFull: request received
    BudgetFull --> Spending: step begins
    Spending --> BudgetRemains: step finished, time left
    BudgetRemains --> Spending: next step begins
    BudgetRemains --> Degraded: too little left for optional step
    Degraded --> Spending: required step continues
    Spending --> FailedFast: deadline reached
    BudgetRemains --> Done: path complete
    Done --> [*]
    FailedFast --> [*]
```

The `Degraded` state is what makes budgets useful at runtime. With only 20 ms left, a service can skip recommendations and still complete the essential work. Without a deadline in hand, it can't know to do that. See [[a39]].

### Concurrency behavior

Parallelizing a sequential chain shortens the path, but only if the steps are truly independent. It also raises concurrent load, connection use, and the odds of meeting a slow outlier. When parallel branches share a resource, such as one database, they queue, and the apparent parallelism is partly fiction. Traces reveal this as spans that overlap on paper while their durations grow. See [[o93]].

### Ordering and consistency

Some steps have to be ordered: inventory reservation must precede payment capture to avoid charging for items you can't ship. That's a correctness constraint, so it limits how much parallelization is possible. When reviewing a graph, ask of each dependency edge if it reflects a data dependency, a correctness rule, or just the order someone wrote the code in. The last kind is often free to remove.

### Ownership of data and control

The journey owner owns the overall target and allocation. Each service team owns its budget and may trade it through negotiation. The platform team owns the deadline propagation mechanism. Budget owners should be named, or budgets decay. Third-party calls need special treatment, since you own the timeout but not the latency.

## Architecture

```mermaid context | Context: a checkout journey and where its budget goes | Flowchart. A client calls a gateway, then auth, then cart. Cart triggers inventory, pricing, and fraud in parallel. Those feed into payment, an external provider beyond a trust boundary, then an order write. Each service owns its data, and labels show the budget per step.
flowchart LR
    C["Client"] -->|"HTTPS, target p99 300 ms"| G["Gateway: 5 ms"]
    G --> A["Auth: 10 ms"]
    A --> CA["Cart: 25 ms, owns carts"]
    CA -->|"gRPC, parallel"| I["Inventory: 60 ms, owns stock"]
    CA -->|"gRPC, parallel"| P["Pricing: 40 ms"]
    CA -->|"gRPC, parallel"| F["Fraud: 90 ms, on critical path"]
    I --> PAY
    P --> PAY
    F --> PAY
    subgraph ext["External provider: outside our control"]
      PAY["Payment: 120 ms"]
    end
    PAY --> W["Order write: 15 ms, owns orders"]
```

Fraud determines when payment can begin, so it, not inventory or pricing, lies on the critical path. The external boundary around payment means the 40% of the budget that it takes isn't in your control, which suggests a different design question: must the customer wait for payment capture at all?

```mermaid component | Component view of the analyzer and simulation | Flowchart. The TypeScript analyzer validates and sorts steps, runs forward and backward passes, and outputs the critical path, slack, and what-if savings. The Python simulator samples dependency distributions for sequential, parallel, correlated, and deadline cases.
flowchart LR
    subgraph ts["TypeScript: fixed durations"]
      S["Step list"] --> TO["topoSort: rejects cycles"]
      TO --> FB["Forward and backward passes"]
      FB --> CP["Critical path and slack"]
      FB --> WI["whatIf: saving from a change"]
    end
    subgraph py["Python: distributions"]
      D["Dependency distributions"] --> MC["Monte Carlo: 100,000 trials"]
      MC --> R["Sum vs independent vs correlated vs parallel"]
      MC --> DL["Deadline: success rate and time spent"]
    end
```

The two examples address different questions. Fixed durations are clear for reasoning about structure, while distributions show what really happens to percentiles. Use the first to find what to work on, and the second to avoid over-trusting budget arithmetic.

```mermaid sequence | Sequence: deadline propagation along the path | Sequence diagram. A gateway sets a deadline of 300 ms. Each service receives the remaining time, subtracts its own usage, and forwards the rest. Fraud has too little time left for its deep model, so it uses a fast model. Payment has its timeout set from what remains.
sequenceDiagram
    participant G as Gateway
    participant C as Cart
    participant F as Fraud
    participant P as Payment provider
    G->>C: Deadline: 295 ms remaining
    C->>F: Deadline: 255 ms remaining
    Note over F: Enough time for the full model
    F-->>C: Score after 90 ms
    C->>P: Remaining 165 ms, reserve 15 ms for write
    P-->>C: Authorized after 120 ms
    C-->>G: Complete with 30 ms to spare
```

The budget is passed as a value, so each hop can make local decisions. Timeouts for the final dependency are derived from what's actually left, after reserving time for later steps, and not from a static configuration value that's unaware of what has already happened.

```mermaid failure-path | Failure path: fixed timeouts and retries overrun the budget | Flowchart. Each service has a fixed one second timeout. Payment stalls, and cart retries twice. The client gave up at 300 ms, but work continues for up to 3 seconds. Connection pools fill. A propagated deadline stops the work when the client has gone.
flowchart TD
    A["Static 1 s timeout at every hop"] --> B["Payment stalls"]
    B --> C["Cart waits 1 s, then retries twice"]
    C --> D["3 s of work for a 300 ms target"]
    D --> E["Client already gave up"]
    E --> F["Connection pool fills with dead work"]
    F --> G["Unrelated requests fail"]
    B -.->|"with propagated deadline"| H["Stops at remaining budget"]
    H -.-> I["Fails fast and frees the connection"]
```

Static timeouts are chosen without knowing the journey, so they frequently add up to several times the user's patience. The dashed route shows the fix. Note that 1,000 ms timeouts at a 2,000 requests-per-second rate means up to 2,000 calls in flight, compared with 240 in normal conditions (2,000 × 0.12 s). That's why pools fill so quickly. See [[o10]].

## Trade-offs

### Advantages

- Directs effort to changes that help, and prevents those that can't.
- Turns a shared target into something each team can own.
- Provides a principled basis for timeouts.
- Prevents slow decay from many small additions.

### Costs

- Requires tracing, and upkeep as graphs change.
- Budgets can cause arguments between teams.
- Allocations are an accounting tool, as percentiles don't add up exactly.
- A strict budget might discourage useful features if it's not negotiable.

### Alternatives

- **End-to-end SLO only:** simple, and leaves no one accountable when it degrades.
- **Performance regression tests:** catch slow growth, and complement budgets.
- **Asynchronous design:** remove a step from the critical path altogether. See [[a175]].
- **Sampling profiler:** better within a process, while critical paths work across services.

### When to use it

For interactive journeys with several services, for strict SLAs, and whenever a new dependency is proposed for a critical journey.

### When not to use it

Don't budget a simple service with one dependency, or batch jobs where total throughput is what matters. Avoid budgeting for exploratory features, where the user value isn't yet proven.

### Reconsider when

- The critical path shifts between steps in traces.
- A journey's fan-out or dependencies change.
- A team has been consuming over its budget for two windows.
- The external provider's latency changes.

## Capacity planning

### Inputs and assumptions

2,000 checkouts per second at peak, a 300 ms p99 target, and the budget in the scenario. Assume a 10 ms cross-zone penalty during zone failure and a 200-connection limit per provider client pool.

### Formula and units

- Concurrent calls = rate (requests per second) × duration (seconds), from Little's Law.
- Reserve (ms) = target − sum of the critical path.
- Worst in-flight = rate × timeout.

### Intermediate calculations

- Critical path: 5 + 10 + 25 + 90 + 120 + 15 = 265 ms.
- Reserve: 300 − 265 = 35 ms, or 11.7%.
- Payment concurrency: 2,000 × 0.120 s = 240 calls in flight.
- At a 1 s timeout during a stall: 2,000 × 1 s = 2,000 calls in flight.
- At a budget-derived 165 ms timeout: 2,000 × 0.165 s = 330 calls in flight.

### Headroom

The 200-connection pool is already short of the normal 240. At 30% headroom: 240 ÷ 0.7 = 343 connections, which also just covers the 330 worst case when using deadlines. A static 1 s timeout would need about 2,000 connections, making the deadline the cheaper and safer choice.

### Failure capacity

If a zone fails and calls become cross-zone at 2 ms per hop, then 6 hops add 12 ms, which is under the 35 ms reserve. One retry of a 90 ms fraud call would not fit in it, so retries on the critical path need another budget source, such as dropping an optional step. Payment latency doubling to 240 ms breaks the target by itself, so you need a plan for this: fail fast, or complete asynchronously.

## Failure modes

:::failure Optimizing off the critical path
Trigger: A team speeds up a step with slack.
Symptoms: The work ships and end-to-end latency doesn't change.
Blast radius: Wasted engineering time, and lost trust in performance work.
Detection: Run a what-if on the call graph before starting.
Mitigation: Stop the project or redirect it.
Recovery: Reassess using traces.
Prevention: Require critical-path evidence for latency projects.
:::

:::failure Budget creep
Trigger: Each change adds a small cost, and nobody owns the total.
Symptoms: Slow, steady latency growth, and no single regression to blame.
Blast radius: The whole journey and eventually its SLO.
Detection: Track long-term per-step trends against budget.
Mitigation: Require removal of an equal cost before adding more.
Recovery: Run a focused reduction project.
Prevention: Assign owners, and gate new critical-path dependencies in review.
:::

:::failure Timeouts longer than the budget
Trigger: Default or static timeouts ignore the journey's target.
Symptoms: Work continues long after clients leave, and pools fill during stalls.
Blast radius: Shared pools and unrelated routes.
Detection: Compare timeout configuration with journey budgets.
Mitigation: Lower timeouts on the affected calls.
Recovery: Drain stuck calls and restart if needed.
Prevention: Derive timeouts from deadlines. See [[a39]].
:::

:::failure Assuming percentiles add
Trigger: A plan treats a sum of p99s as the total p99.
Symptoms: Overinvestment where steps are independent, or surprise misses when they correlate.
Blast radius: Budgets and SLO accuracy.
Detection: Compare the budget arithmetic with traced end-to-end percentiles.
Mitigation: Use measured end-to-end p99 as the authority.
Recovery: Rework the allocation from traces.
Prevention: Treat allocations as accountability tools, and simulate when in doubt.
:::

:::failure Third-party step consumes the budget
Trigger: An external provider slows down with no warning.
Symptoms: End-to-end misses, with all internal teams within budget.
Blast radius: The journey, and pools tied up in those calls.
Detection: Track provider latency and timeouts as a dependency.
Mitigation: Fail over to a second provider, or move to asynchronous processing.
Recovery: Reopen capacity once provider latency recovers.
Prevention: Design so that the customer does not wait for external steps where possible.
:::

## Security and privacy

### Threats

Budgets can pressure teams into removing security steps, which is a risk to watch for directly. A client-supplied deadline can also be abused: a very long deadline holds resources, and a very short one wastes work. An attacker who controls a slow upstream, such as a webhook target, can use up your budget. See [[o46]].

### Trust boundaries

Never trust a client's deadline as is. Cap it at the edge, then propagate your own. Treat partner calls as outside your control and give them strict timeouts.

### Authentication and authorization

Auth steps should have a budget rather than be skipped. Decide explicitly whether a timeout in authorization fails open or closed: for most actions, it should fail closed. Cache results within their revocation requirements to reduce critical-path time safely.

### Tenant isolation

A heavy tenant can make each step slower for everyone. Track budget use per tenant class, and isolate noisy traffic so that one tenant's slow queries don't consume another tenant's budget. See [[a139]].

### Sensitive data

Traces used for critical-path analysis can include identifiers, query text, and payment details, so scrub attributes and restrict access. Don't put card numbers or tokens in span attributes.

### Abuse resistance

Skipping optional steps under time pressure must not skip checks: fraud checks in the critical path could be bypassed if an attacker can force a low budget. Mark such steps as mandatory, so that a request fails rather than proceeding without them.

## Observability

### Metrics

Use a per-step latency histogram labeled by journey, end-to-end journey latency, deadline-exceeded counts by hop, degraded-response counts, and budget consumption, which is the step's p99 divided by its allocation.

### Logs

When a deadline is exceeded, log the remaining budget on entry at each hop and the step that used it up. Log what was skipped in degraded responses.

### Traces

Traces are the source of truth for this topic. Compute the critical path per trace and aggregate: "fraud was on the critical path in 72% of traces, and contributed an average of 88 ms." See [[o103]].

### Dashboards

Show a stacked view of budget per step against the target, a trend line per step, and how often each step is on the critical path. This shows drift before it breaches the SLO.

### Alerts

Page on the journey SLO. Send tickets to the owning team when a step exceeds its budget for several days. Avoid paging on per-step budget, as budgets are accounting and don't directly measure user impact.

### SLO examples

- 99% of `POST /checkout` requests finish within 300 ms over 28 days.
- The fraud step's p99 stays within 90 ms, reviewed weekly.
- Under 0.1% of checkouts end with a deadline-exceeded response.

### Runbook actions

When the journey misses its target: open slow traces, find the step that most often sits on the critical path, compare it with its budget, and check for recent changes in that step. If it's a third party, follow the degradation plan.

## Implementation

### Architecture of the examples

TypeScript computes critical paths and what-if savings for a fixed graph. Python simulates distributions to show how percentiles combine and how deadlines bound work. Neither has an HTTP layer since both are analysis tools. In production, their input would come from your tracing system.

### Data structures

`Step` holds an ID, a duration, and dependencies. `analyze` uses depth-first topological sorting with visiting and done states, which also catches cycles. Maps keep earliest and latest finish per step. Python uses Pydantic for `Dependency` and a small frozen dataclass holding the random generator.

### Interfaces

`analyze(steps)` returns `{ totalMs, criticalPath, steps }`, and `whatIf(steps, id, newDurationMs)` returns before, after, and saved. Python's `sequential`, `parallel`, `correlated_sequential`, and `with_deadline` each return summary data.

### Error handling

`GraphError` covers duplicate IDs, unknown dependencies, cycles, and an empty graph. A cycle error names the path. Negative durations are rejected, including `NaN`, through the check `!(duration >= 0)`, which a plain `< 0` test would miss.

### Concurrency considerations

The analyzer is a pure function, so it needs no synchronization. The Python simulation models parallel execution by taking a maximum, and doesn't actually run anything concurrently. A real implementation would have to use cancellation to stop remaining branches once the deadline passes.

### Educational limitations

Fixed durations hide variation. The graph has one shape, whereas real requests branch on cache hits and conditions, so one trace's critical path can differ from another's. The correlated model uses a single shared slowdown.

### Production hardening

Compute critical paths from trace data per route, aggregate over many traces, include network gaps as steps, propagate deadlines with gRPC or a header, and publish budget dashboards.

## Terminal lab

### Setup

```bash
cd topics/latency-budgets-and-critical-path-analysis/examples/typescript
pnpm install --ignore-workspace
```

### Run

```bash
pnpm --silent start
```

Then run the simulation:

```bash
cd ../python && uv run python -m app.main | jq -c .
```

### Test

```bash
cd ../typescript && pnpm test
```

```bash
cd ../python && uv run pytest -q
```

### Expected output

Measured on the review date:

```json
{"totalMs":265,"criticalPath":["gateway","auth","cart","fraud","payment","write-order"]}
{"id":"inventory","finish":100,"slack":30}
{"id":"pricing","finish":80,"slack":50}
{"optimizePricingTo10":{"before":265,"after":265,"savedMs":0}}
{"optimizeFraudTo40":{"before":265,"after":235,"savedMs":30}}
```

Pricing saves nothing, and a 50 ms improvement to fraud yields only 30 ms, as inventory takes over. The simulation prints:

```json
{"per_dependency_p99_ms":{"auth":25.4,"profile":96.1,"pricing":128.2,"inventory":202.2},"sum_of_p99s_ms":451.9,"sequential_independent":{"p50_ms":141.3,"p99_ms":311.2},"sequential_correlated":{"p50_ms":142.7,"p99_ms":559.3},"parallel":{"p50_ms":63.4,"p99_ms":206.0},"deadline_300ms":{"success_pct":98.7,"max_spent_ms":300},"deadline_200ms":{"success_pct":86.0,"max_spent_ms":200}}
```

Notice that correlation barely changes p50, moving it from 141.3 to 142.7 ms, but it nearly doubles p99.

### Cleanup

```bash
rm -rf ../typescript/node_modules .venv
```

### Troubleshooting

- `Cycle:` errors name the loop in your graph, so remove one edge from it.
- Numbers differ slightly on a different Python version if the random generator's behavior changes.

## Practical challenges

:::challenge Concept | Where do you save time?
Graph: A takes 10 ms, then B (50 ms) and C (30 ms) run in parallel, then D takes 20 ms. What's the total? What does each of these save: B to 40, B to 20, C to 10, D to 10?
>>> Hint
Find the longest path, then note when another path takes over.
>>> Solution
Total: 10 + 50 + 20 = 80 ms. B to 40: path is 70, saves 10. B to 20: C at 30 becomes longest, so the total is 60, saving 20, not 30. C to 10: saves 0, as C isn't critical. D to 10: saves 10, since D is on every path.
>>> Common mistakes
Assuming B to 20 saves 30. Thinking that speeding up C matters because it's slow in absolute terms.
:::

:::challenge Debugging | The critical path that moved
Traces show that the search service's critical path is index lookup in 60% of requests and ranking in 35%. A team cut index lookup's p50 by half, yet the journey's p99 didn't change. Why might that be? How would you check?
>>> Hint
A p50 improvement and a p99 outcome concern different requests. Filter to the slow traces.
>>> Solution
The critical path over all traces differs from that of slow traces. Slow traces may be dominated by ranking, or by a specific slow subset. Filter traces at or above p99 and recompute critical-path contribution. Also, cutting p50 wouldn't help if its tail stayed the same. Report the step's own p99, and its share of slow-trace critical paths. Work should target what dominates slow requests.
>>> Common mistakes
Using average traces to make decisions about tail targets. Concluding that the optimization was measured incorrectly.
:::

:::challenge Capacity | Design the timeouts
Target: 500 ms overall at a 1,000 requests-per-second peak. Path: A (20 ms), B (80 ms), C (150 ms), D (external, 100 ms). Reserve 15%. Set a budget per step, and find the worst-case concurrent calls to D using a fixed 2 s timeout versus a deadline-derived timeout.
>>> Hint
Allocate proportionally from 425 ms. D's concurrency is rate × timeout.
>>> Solution
Sum: 350 ms. Available after reserve: 425 ms, leaving 75 ms to distribute. Budgets could be A 25, B 95, C 180, D 125. D at normal: 1,000 × 0.1 s = 100 calls. Fixed 2 s: 2,000 calls during a stall. Deadline-derived: at most the remaining budget, here 500 − 300 (time used so far by others, at their budget) = 200 ms, or 200 calls. That's a tenfold reduction in worst-case pool use.
>>> Common mistakes
Setting all timeouts at the overall target, so they stack up. Forgetting to keep some reserve.
:::

:::challenge Design | Shorten a checkout
Using the checkout graph in this lesson, propose design changes to reach a 150 ms p99 for the customer-visible response. Say which steps stay synchronous, and what guarantee each change affects.
>>> Hint
Payment is 120 ms and external. Ask what the customer truly needs to know before seeing a response.
>>> Solution
Accept the order after reserving inventory and basic fraud checks, and capture payment asynchronously, telling the customer "order received". Path: gateway 5, auth 10, cart 25, parallel stage at 60 (with fraud's deep model made asynchronous and a fast model at 30), write 15, for 115 ms. Effect on guarantees: the customer may later get a "payment failed" message, requiring a compensating flow, so you need a saga and clear messaging. Deep fraud decisions arrive late, so some orders get cancelled. Product must approve these. See [[o36]].
>>> Common mistakes
Removing fraud checks outright. Ignoring the failed-payment path, or hiding from product that it is a change in user experience.
:::

:::challenge Incident | The 800 ms retry
Checkout's p99 jumped from 280 ms to 900 ms, and each service reports normal latency. Traces show one 800 ms gap in slow requests, inside the cart span. What's happening? What do you change now and later?
>>> Hint
A gap within a span is time not spent in any child span. Think about what might wait 800 ms and then quietly retry.
>>> Solution
The likely culprit is a client-side retry or connection wait, with a default timeout around 800 ms, perhaps after a dropped connection. Cart's call fails or stalls, and then retries with success, so the downstream service sees only the fast retry. Check client retry and timeout configuration, connection-pool wait, and any recent network or deployment changes. Short term: lower the timeout to the budget, and fix the cause of dropped connections. Later: instrument each retry attempt as a span, and propagate deadlines, so a retry gets only the remaining budget.
>>> Common mistakes
Trusting each service's own healthy metrics. Assuming the gap is meaningless, when it's the strongest clue.
:::

## Industry standards and trends

### Standards and specifications

[W3C Trace Context](https://www.w3.org/TR/trace-context/), November 2021, standardizes trace propagation, which makes critical-path analysis across services possible. [gRPC deadlines](https://grpc.io/docs/guides/deadlines/) are part of that project's documentation, and they describe how deadlines propagate. HTTP has no standard header for deadlines: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), June 2022, doesn't define one, so HTTP services use their own conventions.

### Established practice

[Dapper](https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/), Sigelman et al., 2010, shaped modern tracing. [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/), from the Amazon Builders' Library, discusses setting timeouts from measured latency. [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/), 2013, is the standard reference on variability. These are published practices, not formal standards.

### Managed-service options

Observability vendors offer trace waterfalls, and some calculate critical paths automatically. Service meshes can enforce per-route timeouts. Check whether a mesh's timeouts are coordinated with application retries.

### Emerging approaches

Automated critical-path extraction from production traces is increasingly available in open-source and commercial tools. Adaptive deadlines and retries based on remaining budget are also used in some systems. Adoption data is limited, so treat this as an observation and not an established practice.

### Recent changes

OpenTelemetry has become a common source for trace data across vendors, which lowers the cost of this kind of analysis. No formal standard change was identified at the review date.

### Adoption constraints

This depends on trace coverage: a single uninstrumented hop appears as a gap. Budgets also require cross-team agreement. Sampling can miss rare slow paths, so keep slow traces preferentially.

## Interview preparation

:::q Foundational | What is a critical path?
**Strong answer.** The longest route through a request's dependency graph. It determines total time, so speeding up anything else saves nothing. A parallel stage contributes just its slowest branch.

**Why it is asked.** It's the core idea behind effective latency work.

**Weak-answer warning signs.** Adding up all steps, including parallel ones.

**Follow-up.** How would you find it in production?
:::

:::q Foundational | What is a latency budget?
**Strong answer.** Dividing a journey's target among its steps, with a reserve. Each team owns a number, and new dependencies have to fit. It keeps the target from eroding through many small additions.

**Why it is asked.** It checks that you can turn a target into ownership.

**Weak-answer warning signs.** Treating it as a one-time calculation.

**Follow-up.** What happens when two teams both need more?
:::

:::q Foundational | If two parallel calls take 40 and 90 ms, what happens when you make the 40 ms one take 10 ms?
**Strong answer.** The request gets no faster, because it still waits for the 90 ms call. The 40 ms call had 50 ms of slack. It might still reduce load, but it won't reduce latency.

**Why it is asked.** It's a quick test of whether you apply the idea.

**Weak-answer warning signs.** Reporting a 30 ms saving.

**Follow-up.** What if the 90 ms call were reduced to 30 ms?
:::

:::q Senior | Can you add up per-step p99s to get the total p99?
**Strong answer.** No. If delays are independent, the sum overstates it, since steps are rarely slow together. In my simulation, 452 ms for the sum against 311 ms actual. If delays are correlated, it can understate: 559 ms. I would measure end-to-end from traces, and use per-step numbers only for accountability.

**Why it is asked.** It's a common mistake even among experienced engineers.

**Weak-answer warning signs.** Treating the sum as a safe upper bound.

**Follow-up.** What causes correlation in practice?
:::

:::q Senior | How would you set timeouts for a chain of services?
**Strong answer.** From the budget and measured latency, with a timeout slightly above the dependency's high percentile, and below what the caller can afford. Better still, I would propagate a deadline, so each hop knows the remaining time. Outer timeouts must exceed inner ones, or work gets wasted.

**Why it is asked.** Bad timeouts cause cascading failures.

**Weak-answer warning signs.** A uniform default everywhere.

**Follow-up.** How do retries fit into this?
:::

:::q Senior | How do you find the critical path in a live system?
**Strong answer.** Compute it per trace, going back from the last-finishing span, then aggregate over many traces by route and percentile. Focus on slow traces, since their critical path is what matters for tail targets. Gaps in a trace indicate queueing or missing instrumentation.

**Why it is asked.** It moves from concept to practical execution.

**Weak-answer warning signs.** Reading one trace and generalizing from it.

**Follow-up.** Sampling keeps 1% of traces. How does this affect the analysis?
:::

:::q Senior | A new feature adds 40 ms, and you have 35 ms of reserve. What do you do?
**Strong answer.** I would look at whether it must be on the critical path: maybe it can run in parallel, asynchronously, or be cached. Otherwise I'd find matching savings elsewhere, or make a visible decision to change the target, with the owner. I wouldn't simply let it slip through.

**Why it is asked.** Budgets only matter when they constrain something.

**Weak-answer warning signs.** Automatically approving or rejecting.

**Follow-up.** Who makes the final call?
:::

:::q Staff | How would you introduce latency budgets across several teams?
**Strong answer.** Start with one critical journey and real trace data. Agree on the target with its owner, allocate based on current use plus a reserve, and publish a dashboard. Make the budget part of design review for that journey only. Expand after showing results. I would keep budgets negotiable, so teams can trade.

**Why it is asked.** It's as much organizational as technical.

**Weak-answer warning signs.** A company-wide mandate from the start.

**Follow-up.** A team misses its budget for months. What do you do?
:::

:::q Staff | How do you handle a third-party step that dominates the path?
**Strong answer.** You can't speed it up, so I'd change its position: move it off the critical path using asynchronous processing, cache what can be cached, use a second provider, or set strict timeouts and a degradation plan. I would raise contract terms too, if it matters enough. Any of these has product implications that must be agreed upon.

**Why it is asked.** Real journeys depend on what you don't control.

**Weak-answer warning signs.** Only monitoring it.

**Follow-up.** What user experience change would asynchronous payment require?
:::

:::q Staff | How would you know that a parallelization project is worth doing?
**Strong answer.** Run a what-if on the graph using actual data. The saving is capped by the next-longest path. Then I'd consider the costs: more concurrent load, more pool use, and a higher chance of slow outliers. If the steps share a bottleneck, parallelism gives less than it appears to.

**Why it is asked.** Parallelizing is often proposed with no analysis.

**Weak-answer warning signs.** Assuming parallel always wins.

**Follow-up.** What does shared-database contention look like in a trace?
:::

:::q Principal | How do you decide the target itself?
**Strong answer.** From user and business data, not convention. I would test conversion or task completion at different latencies, then compare against what the architecture permits. For example, payment alone may consume 40% of the budget. If the cost of the target exceeds its value, change it. If the value is high, restructure the journey.

**Why it is asked.** Principals question the premise as well as the plan.

**Weak-answer warning signs.** Accepting any number handed down.

**Follow-up.** How do you set a target for a new product with no data?
:::

:::q Principal | An executive asks why you won't fund the pricing team's optimization, when pricing "is slow". How do you explain it?
**Strong answer.** Plainly: "Customers wait for the slowest of three parallel checks. Pricing finishes 50 ms before the slowest. So speeding it up won't change what customers experience. Moving payment off the wait would save 120 ms, so I recommend funding that." I'd bring a simple diagram and offer a cheap experiment to prove it.

**Why it is asked.** It tests clear, evidence-based communication.

**Weak-answer warning signs.** Using scheduling jargon, or leaving out an alternative.

**Follow-up.** The pricing team disagrees publicly. How do you handle it?
:::

## Review

### Key takeaways

- Sequential steps add, and parallel steps take the maximum.
- Only the critical path shortens a request, and savings are capped by the next-longest path.
- Slack tells you what not to optimize.
- Percentile budgets don't add: the sum may overstate or understate.
- Timeouts should come from the remaining budget, using propagated deadlines.
- Moving a step off the path often beats making it faster.

### Decision checklist

- [ ] Is the call graph from traces, not memory?
- [ ] Is this step on the critical path for slow requests?
- [ ] What is the saving, given the next-longest path?
- [ ] Do timeouts fit within the budget, including retries?
- [ ] Does each budget have an owner?

### Production-readiness checklist

- [ ] The journey has an end-to-end SLO.
- [ ] Deadlines propagate across services.
- [ ] Per-step budgets and trends are on a dashboard.
- [ ] External steps have timeouts and a degradation plan.
- [ ] Mandatory steps can't be skipped under time pressure.

### Glossary

- **Critical path:** the longest route through a request's graph.
- **Slack:** how far a step can slow without delaying the total.
- **Reserve:** deliberately unallocated budget.
- **Deadline:** an absolute time limit that's passed along a request.
- **Earliest finish:** the soonest a step can be done, given its dependencies.

### Quiz

:::quiz What does speeding up a step with 50 ms of slack by 30 ms save end-to-end?
- 30 ms
- 50 ms
- 20 ms
- *0 ms
It isn't on the critical path, so the request still waits for another step.
:::

:::quiz Fraud (90 ms) leads inventory (60 ms) in a parallel stage. What does cutting fraud to 40 ms save?
- 50 ms
- *30 ms
- 40 ms
- 0 ms
Inventory takes over at 60 ms, so the stage goes from 90 to 60 ms.
:::

:::quiz Dependencies' own p99s total 452 ms. When independent and sequential, the request's p99 is most likely...
- exactly 452 ms.
- *lower than 452 ms.
- higher than 452 ms.
- unrelated to these.
Several slow events rarely coincide when independent. The simulation measured 311 ms, though correlation can push it above 452 ms.
:::

:::quiz At 2,000 requests per second, how many in-flight calls can a 1 s timeout produce during a stall?
- 200
- 240
- *2,000
- 20,000
Little's Law: 2,000 × 1 s = 2,000, which is far more than the normal 240.
:::

:::quiz What's the best source for a call graph?
- The original design document
- A team's memory
- *Production traces
- A load balancer's configuration
Traces show what actually runs, including conditionals and later additions.
:::

### Further study

Next, read [[a39]] for deadline propagation, [[o10]] for timeouts, and [[o93]] for variability in fan-out. [[a175]] shows how to take a step out of the critical path with asynchronous design.
