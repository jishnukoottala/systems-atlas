lastReviewed: 2026-11-03

## Orientation

### Definition

Concurrency is the number of requests in progress at one moment. Utilization is the fraction of time a resource is busy. Saturation is the amount of work waiting because that resource is fully occupied. A bottleneck is the resource that limits a system's throughput, which is the one that saturates first as load grows.

### Why it matters

These four terms are how you diagnose nearly every performance problem. Each one reveals something the others can't: a server at 40% average CPU may have one core pinned at 100%, and an idle database may be stalled on a single lock. Utilization tells you how close to the limit you are, and saturation tells you that you're past it. Knowing which resource limits you prevents the classic waste of scaling something that was never the constraint, and you can often compute the limit in advance from simple measured numbers.

### Learning objectives

- Distinguish concurrency, utilization, saturation, and errors, and measure each for a resource.
- Apply the utilization law and bottleneck bound to predict a system's maximum throughput.
- Use Little's Law to convert between rate, latency, and concurrency.
- Identify non-hardware bottlenecks such as locks, pools, and single-threaded loops.
- Protect a bottleneck with a concurrency limit and bounded queue.

## Production scenario

An order service at 450 requests per second starts timing out. Average CPU is 45% on web servers, 70% on application servers, and 34% on the database. Disk is at 90%, which draws attention, and the team orders faster disks. Nothing improves. Then someone measures a resource nobody charted: every order updates one row of a global counter, holding its lock for 2.5 ms. Since one lock serves one holder at a time, the maximum is 1 ÷ 0.0025 s = 400 updates per second. At 450 requests per second, that lock's utilization is 112.5%, so its queue grows forever.

Disk was close to its limit too, but the lock had already hit its own. The fix replaces the single counter with four sub-counters, which are summed when read. Lock capacity rises to 1,600 updates per second, and the bottleneck moves to disk at 500 per second, which is now worth upgrading. The operational analysis example in this lesson reproduces these numbers from measured demand alone, without a load test.

## Mental model

### Analogy

Picture a supermarket. Concurrency is how many customers are inside. Utilization is the fraction of time a checkout clerk is scanning. Saturation is the line at the checkouts. The bottleneck is whichever stage has the longest wait relative to its capacity. Opening more aisles doesn't help if there's one clerk. An empty shop with one clerk away on a break has low "CPU" and terrible service, just like a server waiting on a lock.

### Where the analogy breaks

You can see a line in a supermarket, but software queues are hidden in kernels, thread pools, locks, and network buffers, so many go unmeasured. Clerks also don't slow one another down as you add more, whereas extra software workers can contend and lower total output. Finally, a shopper in a long line usually waits, whereas a software client times out and retries, adding even more work to the line.

### Entities, state, flow, and invariants

- **Entities:** requests, resources, servers per resource, queues.
- **State:** busy servers, queue length, throughput.
- **Flow:** arrive, wait if all busy, get served, leave, possibly visiting several resources.
- **Invariant 1:** U = X × D. Utilization is throughput times service demand.
- **Invariant 2:** X ≤ 1 ÷ D_max. Throughput can't exceed what the largest demand allows.
- **Invariant 3:** L = X × R. Concurrency is throughput times response time.

## Foundations

### Concepts and terminology

| Term | Meaning | Example measurement |
| --- | --- | --- |
| Concurrency (L) | Requests in progress | In-flight gauge |
| Throughput (X) | Completions per second | Request counter rate |
| Service time (S) | Work per visit | Span duration excluding wait |
| Service demand (D) | Total work per request | CPU seconds per request |
| Utilization (U) | Fraction of time busy | CPU busy percentage |
| Saturation | Waiting work | Queue length, pool wait, run queue |
| Errors | Failed work | Rejections, timeouts |
| Bottleneck | First resource to saturate | Highest utilization, longest queue |

### First-principles explanation

Measure a system for a period, and three relationships must hold regardless of the arrival pattern, as they are bookkeeping identities. If a resource completes X requests per second, each taking D seconds of its time, then it is busy X × D of each second, which is the utilization law. Utilization can't exceed 100%, so X can't exceed 1 ÷ D. Therefore the resource with the biggest demand per server is the bottleneck, and it sets the cap on the whole system.

This is powerful, since you can find the bottleneck from measurements at low load. CPU per request, disk time per request, and lock hold time per request, along with server counts, predict the limit before you ever reach it. Behavior near the limit is the exception, as contention and cache effects can raise demand. So treat the result as an upper bound, and confirm it with a test. See [[a108]].

Below the bottleneck's limit, response time stays near the sum of demands. Above it, queues grow. The transition happens near a "knee" of concurrency, N* = (ΣD + Z) ÷ D_max, where Z is client think time. Past this knee, adding concurrency only adds waiting.

Average utilization misleads for three reasons. It averages across time, hiding bursts. It averages across servers or cores, hiding one busy instance or a single-threaded loop: one pinned core of 16 reads as 6.25%. And it hides logical resources entirely, such as locks and pools, which have no OS-level utilization metric. Saturation signals are usually more direct: any non-trivial queue on a resource means it's limiting something right now.

### Mathematics

**Utilization law:** U = X × D ÷ c, for c servers. At 300 requests per second with an app-tier demand of 25 ms over 16 cores: 300 × 0.025 ÷ 16 = 46.9%.

**Bottleneck bound:** X_max = min over resources of (c ÷ D).

| Resource | Demand | Servers | Max rate | Utilization at 450 rps |
| --- | --- | --- | --- | --- |
| Web CPU | 8 ms | 8 | 1,000 per second | 45.0% |
| App CPU | 25 ms | 16 | 640 per second | 70.3% |
| Database CPU | 6 ms | 8 | 1,333 per second | 33.8% |
| Database disk | 4 ms | 2 | 500 per second | 90.0% |
| Row lock | 2.5 ms | 1 | 400 per second | 112.5% |

**Response floor:** R ≥ ΣD = 8 + 25 + 6 + 4 + 2.5 = 45.5 ms.

**Knee:** N* = 45.5 ÷ 2.5 = 18.2 concurrent requests with zero think time. Beyond that, extra requests wait.

**Little's Law:** L = X × R. At 300 requests per second and 50 ms: 15 in flight. Check it: the knee is 18.2, which means that 300 requests per second sits below it. See [[a8]].

### Complexity

Operational analysis is O(r) for r resources. A concurrency limiter's acquire and release are O(1) amortized, although the example's `Array.shift` is O(q) for a queue of length q, which is fine for small bounded queues. Measurement overhead also matters: per-request timing adds little, but heavy lock profiling can distort what it measures.

## Mechanism

### Normal path

1. A request arrives, and concurrency rises by one.
2. If the resource has a free server, service starts.
3. Otherwise, it waits in a queue, which is saturation.
4. It uses each resource in turn: web CPU, app CPU, database, disk, and locks.
5. When done, it leaves, and concurrency falls by one.
6. As arrivals approach the bottleneck's rate, its queue grows quickly and response time climbs.
7. A limit in front of the bottleneck makes excess work wait outside it, or get rejected.

### State transitions

```mermaid state-resource | States of a resource as load increases | State diagram. A resource moves from idle to partly busy, then near saturation with short queues, and to saturated with a growing queue. If a queue limit exists, it rejects excess. If not, waiting grows until timeouts. When load falls, it drains back.
stateDiagram-v2
    [*] --> Idle
    Idle --> PartlyBusy: arrivals below capacity
    PartlyBusy --> NearSaturation: utilization above about 80 percent
    NearSaturation --> PartlyBusy: load falls
    NearSaturation --> Saturated: arrivals exceed capacity
    Saturated --> Rejecting: bounded queue is full
    Saturated --> TimingOut: unbounded queue grows
    Rejecting --> NearSaturation: load falls
    TimingOut --> NearSaturation: load removed and queue drained
```

Saturated resources go one of two ways. `Rejecting` is a controlled outcome, and recovers once load falls. `TimingOut` wastes capacity on requests that will never be useful. See [[o91]]. The 80% figure is an illustrative threshold, which varies with variability and server count.

### Concurrency behavior

Concurrency limits are often the right control, more so than rate limits, because concurrency reflects true load: a slow dependency raises concurrency for the same request rate. This is Little's Law in action: when response time doubles at a constant rate, concurrency doubles. Concurrency limiting therefore reacts automatically when a dependency slows down, with no need for a new rate setting. See [[a111]].

### Ordering and consistency

Queues impose order, and it matters who waits. First-in-first-out is fair, but under overload it serves the oldest requests, which are the most likely to have expired. Last-in-first-out and priority queues can preserve goodput for fresh or important work. Locks affect consistency too: reducing lock scope is the classic throughput gain, but it has to preserve the invariant that the lock protected. See [[o17]].

### Ownership of data and control

Each shared resource needs an owner who sets its limits. Without one, several teams can each stay "within their rate" while together overloading the same database. The owner of a limit also has to decide who gets rejected, which is a business question as well as a technical one. See [[a112]].

## Architecture

```mermaid context | Context: resources a request uses and where the queues hide | Flowchart. Clients reach a load balancer, then web and app servers, each with hidden queues in accept backlogs and thread pools. App servers use a connection pool to a database with CPU, disk, and row locks. A row lock is marked as the bottleneck, and a limiter protects it.
flowchart LR
    C["Clients"] -->|"HTTPS"| LB["Load balancer: accept queue"]
    LB --> W["Web tier: 8 cores"]
    W --> AP["App tier: 16 cores, thread pool queue"]
    AP --> LM["Concurrency limiter: bounded queue"]
    LM -->|"TCP, connection pool"| DB["Database, owns data: 8 cores"]
    DB --> DK["Disk: 2 volumes"]
    DB --> RL["BOTTLENECK: one row lock, 400 per second"]
```

Each arrow has a queue that may be invisible on standard dashboards. The bottleneck here is a logical resource that won't appear on an infrastructure graph. The limiter sits in front of the database, so excess work waits or gets rejected in a place where this is cheap, and the bottleneck's own queue stays short.

```mermaid component | Component view of the limiter service and the operational analysis | Flowchart. An Express route uses a ConcurrencyLimiter with a slot counter and a bounded waiter list, returning 503 when full. A stats route reports concurrency, utilization, and saturation. The Python tool takes resource demands and reports utilization, bottleneck, and maximum throughput.
flowchart LR
    R["HTTP GET /query"] --> L["ConcurrencyLimiter.run"]
    L --> SL["Slots: limit 10"]
    L --> WQ["Waiters: limit 20"]
    WQ -->|"queue full"| E["HTTP 503 with Retry-After"]
    SL --> WK["Simulated database work"]
    L --> ST["GET /stats: in-flight, utilization, queued, rejected"]
    IN["Measured demands and server counts"] --> OA["Python: analyze"]
    OA --> RP["Utilization per resource, bottleneck, X max, knee"]
```

The Python tool predicts limits, and the TypeScript service enforces one and reports on it. Together they form the working cycle: compute the limit from demands, set the limiter just below it, and verify the prediction using its metrics.

```mermaid sequence | Sequence: a limiter under overload | Sequence diagram. Requests arrive at a limiter with two slots and a queue of one. The first two start. A third waits. A fourth is rejected at once with 503. When work finishes, the slot passes directly to the waiting request.
sequenceDiagram
    participant C as Clients
    participant L as Limiter, 2 slots, queue 1
    participant D as Database
    C->>L: Request 1
    L->>D: Start, 1 of 2 slots
    C->>L: Request 2
    L->>D: Start, 2 of 2 slots
    C->>L: Request 3
    Note over L: Waits in queue, saturation is 1
    C->>L: Request 4
    L-->>C: 503 Retry-After, queue is full
    D-->>L: Request 1 finished
    L->>D: Slot passes to request 3
    D-->>L: Request 2 finished
```

The rejection takes almost no resources, which is what makes it useful during overload. The database never sees more than its limit, so it keeps running at full throughput throughout. Clients need to treat a 503 with `Retry-After` as "try later", or retries will undo the protection.

```mermaid failure-path | Failure path: scaling the wrong resource | Flowchart. Timeouts begin. Disk shows 90 percent utilization, and it gets upgraded, with no effect. The lock is unmeasured and over 100 percent. Measuring lock wait finds the real limit. Splitting the counter moves the bottleneck to disk, and only then does the disk upgrade help.
flowchart TD
    A["Timeouts at 450 rps"] --> B["Dashboards: disk at 90 percent is the highest"]
    B --> C["Upgrade disk"]
    C --> D["No improvement"]
    D --> E["Measure lock wait, previously not charted"]
    E --> F["Row lock at 112.5 percent"]
    F --> G["Split counter into 4 sub-counters"]
    G --> H["Lock limit 1,600 per second"]
    H --> I["Bottleneck moves to disk at 500 per second"]
```

Highest-charted is not the same as highest. The team could only compare what they had measured, so unmeasured resources are the first thing to suspect when a fix doesn't help. The final step shows that fixing a bottleneck always reveals the next, and that's the cue to repeat the analysis.

## Trade-offs

### Advantages

- A small set of signals diagnoses most problems.
- Demand-based bounds give predictions without expensive tests.
- Concurrency limits adapt to slow dependencies automatically.

### Costs

- Measuring logical resources requires custom instrumentation.
- Running at low utilization to keep queues short costs money.
- Limits reject real users, so choosing them is a business decision.
- Fixed limits go stale as hardware and code change.

### Alternatives

- **Rate limiting:** better for fairness and quotas, but slower to respond to dependency slowdowns. See [[o2]].
- **Adaptive limits:** adjust to latency automatically, at the cost of stability tuning.
- **Autoscaling:** adds capacity where the tier can scale, and is too slow for bursts. See [[o82]].
- **Load testing alone:** finds limits empirically, at greater cost. Use it to confirm predictions.

### When to use it

For every performance investigation and capacity plan. Add concurrency limits around any shared resource whose overload would hurt others.

### When not to use it

Don't over-instrument a small internal service with no contention. Don't set a tight limit without measuring, as that creates errors that weren't there before. Don't rely on these identities outside steady state, for example in the seconds after a burst or a restart.

### Reconsider when

- A fix to the "bottleneck" has no effect.
- Demand per request changes after a code or schema change.
- CPU or disk looks healthy, but latency and queues are climbing.
- Hardware changes make old limits wrong.

## Capacity planning

### Inputs and assumptions

Measured demands from the table above. Target: 1,000 requests per second at 70% utilization or below. Assume demand stays constant up to that load, which you should verify.

### Formula and units

- Servers = rate (requests per second) × demand (seconds) ÷ target utilization.
- Max rate = servers ÷ demand (seconds).
- In flight = rate × response time (seconds).

### Intermediate calculations

- Web CPU: 1,000 × 0.008 ÷ 0.7 = 11.4, so 12 cores.
- App CPU: 1,000 × 0.025 ÷ 0.7 = 35.7, so 36 cores.
- Database CPU: 1,000 × 0.006 ÷ 0.7 = 8.6, so 9 cores.
- Disk: 1,000 × 0.004 ÷ 0.7 = 5.7, so 6 volumes.
- Row lock: 1,000 × 0.0025 ÷ 0.7 = 3.6, so 4 sub-counters.
- In flight at a 60 ms response: 1,000 × 0.06 = 60, which sets the connection pool's size.

### Headroom

The 70% target is the headroom. A lower target means shorter queues and higher cost. Single-server resources, such as one lock or a single-threaded loop, need more margin than pooled resources, because a pool absorbs variation much better. So the 70% target may be too high for the lock.

### Failure capacity

With three zones, losing one raises per-zone load by 50%. So 36 app cores across three zones become 24, and utilization goes from 70% to 105%. For failure tolerance at 70%: 36 × 3 ÷ 2 = 54 cores. Alternatively, plan to run near 90% during a failure: 1,000 × 0.025 ÷ 0.9 = 27.8 cores surviving, or 42 total. State which you've chosen. The row lock's capacity doesn't change with zones, since it isn't horizontally spread.

## Failure modes

:::failure Unmeasured logical bottleneck
Trigger: A lock, pool, semaphore, or quota reaches its limit.
Symptoms: Throughput plateaus, latency climbs, and CPU, memory, and disk all look fine.
Blast radius: Everything that shares the resource.
Detection: Measure wait time on every lock and pool, and compute U = X × D for them.
Mitigation: Limit concurrency in front of it.
Recovery: Split or shorten the critical section.
Prevention: Export saturation metrics for every bounded resource.
:::

:::failure Averages hide a single-threaded limit
Trigger: A single-threaded process or event loop runs on a multi-core machine.
Symptoms: 6% average CPU on 16 cores, yet requests are queueing.
Blast radius: All requests handled by that process.
Detection: Check per-core and per-thread CPU, and event-loop lag.
Mitigation: Run more processes or offload blocking work.
Recovery: Fix the blocking work.
Prevention: Monitor event-loop lag and maximum per-thread CPU. See [[a17]].
:::

:::failure Connection pool exhaustion
Trigger: A slow dependency raises concurrency beyond the pool size.
Symptoms: Requests wait for connections, and the database itself looks idle.
Blast radius: All routes that share the pool.
Detection: Monitor pool wait time and active connections.
Mitigation: Shed load and shorten timeouts.
Recovery: Fix the slow query or dependency, then drain the waiters.
Prevention: Size pools using Little's Law, and separate pools per workload. See [[o4]].
:::

:::failure Limit set too low
Trigger: A concurrency limit is copied from elsewhere or based on old measurements.
Symptoms: 503 responses while the protected resource has plenty of capacity.
Blast radius: Users who get rejected unnecessarily.
Detection: Compare rejections against the utilization of the protected resource.
Mitigation: Raise the limit gradually, while watching latency.
Recovery: Set it from measured capacity.
Prevention: Derive limits from demand and revisit them, or use adaptive limits.
:::

:::failure Demand grows at high load
Trigger: Cache misses, lock contention, or thrashing raise cost per request as load rises.
Symptoms: Saturation arrives well before the predicted limit.
Blast radius: Capacity plans based on low-load measurements.
Detection: Compare demand per request at several load levels.
Mitigation: Run lower and investigate.
Recovery: Fix contention and re-measure.
Prevention: Load test at the planned level, as demand-based bounds are only upper limits.
:::

## Security and privacy

### Threats

Attackers find your bottleneck too. Sending requests that take a contended lock, or that have the highest demand, gets maximum damage from minimum traffic. Slow clients can hold connections to exhaust a concurrency limit, and metrics endpoints reveal your limits and current load, which helps attackers time their traffic.

### Trust boundaries

Protect shared resources with limits placed inside your trust boundary, so clients can't bypass them. Don't expose `/stats` publicly. Set read and write timeouts on untrusted connections, to prevent slow-client attacks from occupying slots.

### Authentication and authorization

Authentication can itself be the bottleneck. Password hashing is deliberately CPU-heavy, so a login flood can saturate the tier. Run it in a separate limited pool, and apply limits before expensive checks.

### Tenant isolation

A single global limit lets one tenant use all slots. Use per-tenant concurrency limits or fair queues, so that one tenant's slow queries reject only that tenant's traffic. See [[a139]].

### Sensitive data

Load and queue metrics rarely contain personal data, but labels might. Do not label saturation metrics with user identifiers. Rejection logs should use hashed or tiered tenant labels where appropriate.

### Abuse resistance

Make rejection cheaper than service, and reject before doing expensive parsing. Limit concurrency per client as well as globally. Monitor for clients that retry immediately after a 503 and ignore `Retry-After`.

## Observability

### Metrics

For every resource, including logical ones, use the USE method: utilization, saturation, and errors. Examples: CPU per core; run queue length; Linux pressure stall information; pool active count and wait time; lock wait time; queue depth and age; rejected counts. For every service, add request rate, errors, and duration. See [[a123]].

### Logs

Log rejections as a sampled counter, with the reason and limiter name. Log when limits change. Avoid per-rejection logging during overload, as it could add to the problem.

### Traces

Show waits as spans: `pool.wait`, `lock.wait`, and `queue.wait`. If these aren't instrumented, they appear as unexplained gaps. Comparing wait to work in a span shows whether a slow request was doing something or merely waiting.

### Dashboards

Build a resource table: utilization, saturation, and errors per resource, sorted by saturation. Add a load-versus-latency scatter plot, in which the knee appears directly. Add per-instance views, so that averages don't hide a single bad node.

### Alerts

Page on user-visible SLO burn. Warn on queue age, sustained saturation, and rising rejections. Avoid CPU threshold pages, since high CPU with short queues is efficient and low CPU with long queues is a real problem.

### SLO examples

- Queue wait on `db-limiter` stays below 20 ms for 99% of minutes.
- Under 0.1% of requests are rejected by concurrency limits over 28 days.
- Bottleneck utilization stays at or below 70% at daily peak, reviewed monthly.

### Runbook actions

Look for saturation first, sorted across all resources. If a logical resource is saturated, reduce pressure before scaling. If CPU saturates, check whether the tier can scale without moving load to the database. After any fix, re-measure, since the bottleneck will have moved.

## Implementation

### Architecture of the examples

TypeScript provides an Express service with a `ConcurrencyLimiter` around simulated database work, plus a `/stats` route. Python applies operational laws to demand data to predict limits. The Express layer is justified here, since real concurrent HTTP traffic is the thing being controlled.

### Data structures

The limiter has a slot count and a `waiters` array of resolver functions. Utilization is measured as slot-time: on each change, it adds `inFlight × elapsed` to a running total, then divides by `elapsed × limit`. Python's `Resource` computes effective demand as demand ÷ servers.

### Interfaces

`limiter.run(work)` runs work under the limit, or throws `QueueFullError`. `limiter.stats()` returns a snapshot. `GET /query` returns 200 or 503 with `Retry-After`. Python exposes `analyze(resources, rps)` and `required_servers(resources, rps, target)`.

### Error handling

`release` runs in a `finally` block, so a failed task can't leak its slot, and a test confirms it. A full queue produces a typed error mapped to 503, not a 500, since overload is an expected condition. Invalid limits are rejected at construction.

### Concurrency considerations

Node's single thread makes the counters safe with no atomics, but the `await` points still interleave. On release, the slot passes directly to the next waiter, with no decrement and increment, so a new arrival can't jump the queue in that gap. In Go or Rust, this logic would require a semaphore or channel, and there is some subtlety around cancelling a queued waiter. This example does not support cancelling while queued.

### Educational limitations

There's no queue timeout, so a waiter can wait as long as the queue takes to drain. The limit is fixed. Work is a sleep, so CPU contention never appears. Operational analysis assumes constant demand, so treat the result as a bound.

### Production hardening

Add queue timeouts tied to deadlines, cancellation, per-tenant fairness, adaptive limits, histograms for wait time, and priorities. Measure real lock and pool waits with your database and runtime's built-in instrumentation.

## Terminal lab

### Setup

```bash
cd topics/concurrency-utilization-saturation-and-bottlenecks/examples/typescript
pnpm install --ignore-workspace
```

### Run

Start the service, which has a limit of 10 slots, a queue of 20, and 100 ms of work:

```bash
PORT=3000 pnpm start
```

In another terminal, send 60 requests at once, then read the stats:

```bash
seq 1 60 | xargs -P 60 -I{} curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/query | sort | uniq -c
```

```bash
curl -s localhost:3000/stats | jq -c .
```

Now predict a real system's limit:

```bash
cd ../python && uv run python -m app.main | jq -c '.at_300_rps | {bottleneck,max_throughput_rps,min_response_ms,knee_concurrency}'
```

```bash
uv run python -m app.main | jq -c '.at_450_rps.rows[] | {name,utilization_pct,status}'
```

On Linux, look at real saturation signals:

```bash
vmstat 1 5
```

```bash
cat /proc/pressure/cpu
```

### Test

```bash
cd ../typescript && pnpm test
```

```bash
cd ../python && uv run pytest -q
```

### Expected output

Measured on the review date. With 60 requests at once, 10 run and 20 queue, and the other 30 are rejected:

```text
  30 200
  30 503
```

After two such rounds, the stats read:

```json
{"inFlight":0,"limit":10,"queued":0,"queueLimit":20,"utilization":0.17,"completed":60,"rejected":60,"meanWaitMs":90.4}
```

Utilization of 0.17 shows that the service was idle between bursts, so an average over time hid a total overload. That's the lesson's point in one number. The mean wait is near 100 ms, since the three groups of ten waited 0, 100, and 200 ms. Your split may vary slightly if your machine launches curl slowly. The analysis prints:

```json
{"bottleneck":"db_row_lock","max_throughput_rps":400.0,"min_response_ms":45.5,"knee_concurrency":18.2}
{"name":"web_cpu","utilization_pct":45.0,"status":"ok"}
{"name":"app_cpu","utilization_pct":70.3,"status":"ok"}
{"name":"db_cpu","utilization_pct":33.8,"status":"ok"}
{"name":"db_disk","utilization_pct":90.0,"status":"near saturation"}
{"name":"db_row_lock","utilization_pct":112.5,"status":"saturated"}
```

### Cleanup

Stop the service with Ctrl-C, then:

```bash
rm -rf ../typescript/node_modules .venv
```

### Troubleshooting

- `/proc/pressure` exists only on Linux kernels with pressure stall information enabled. On macOS, use `vm_stat` and `iostat`.
- Fewer 503 responses than expected: curl is starting too slowly to create overlap, so raise the count to 200.
- `EADDRINUSE`: change `PORT`, or find the holder using `lsof -i :3000`.

## Practical challenges

:::challenge Concept | Name the signal
For each observation, say if it shows concurrency, utilization, saturation, or errors, and what you'd conclude: (a) load average is 40 on 8 cores, (b) 12 active of 20 connections, zero waiting, (c) pool wait averaging 300 ms, (d) disk 95% busy with a queue depth of 0.1.
>>> Hint
Saturation means work is waiting. Being busy with no queue isn't yet a problem.
>>> Solution
(a) Saturation of runnable or blocked tasks, as many wait, though on Linux, load average also includes uninterruptible I/O, so check further. (b) Concurrency with room to spare: fine. (c) Saturation of the pool: either it's too small or queries are slow. (d) High utilization with almost no queue: it's busy but not limiting, and for devices with internal parallelism such as SSDs, "100% busy" doesn't even mean full.
>>> Common mistakes
Treating every high percentage as a problem. Reading load average as purely CPU on Linux.
:::

:::challenge Debugging | Low CPU, long latency
A Node.js service on an 8-core machine shows 13% CPU, and latency has climbed from 20 ms to 900 ms at the same request rate. What would you check, and in what order? What single number gives the fastest answer?
>>> Hint
13% of 8 cores is about what one busy core looks like.
>>> Solution
One core at 100% across 8 cores is 12.5%, so the event loop is probably pinned. The fastest number is event-loop lag or per-thread CPU. Then take a CPU profile to find the blocking function, such as a synchronous JSON parse of a large payload, a slow regular expression, or synchronous crypto. Fix: offload to a worker, stream, or run more processes. If per-thread CPU is low, check waits on connection pools and downstream services instead. See [[a24]].
>>> Common mistakes
Concluding from 13% that CPU isn't the problem. Adding more machines before profiling.
:::

:::challenge Capacity | Find the limit and size the fix
Measured demands: API CPU 12 ms on 24 cores, cache 1 ms on 4 cores, database CPU 10 ms on 16 cores, one global sequence lock at 3 ms, and storage at 8 ms across 8 volumes. Find X_max and the bottleneck. Then find the next one after you remove the lock with 8 partitions, and the new X_max.
>>> Hint
Max rate = servers ÷ demand. Compute it for each.
>>> Solution
API: 24 ÷ 0.012 = 2,000. Cache: 4 ÷ 0.001 = 4,000. Database CPU: 16 ÷ 0.010 = 1,600. Lock: 1 ÷ 0.003 = 333. Storage: 8 ÷ 0.008 = 1,000. So X_max = 333 per second, set by the lock. After 8 partitions, the lock gives 2,667, and storage at 1,000 becomes the bottleneck, so X_max = 1,000. A tripling, from removing one lock. To go beyond, add storage.
>>> Common mistakes
Forgetting to divide by server count. Stopping after fixing the first bottleneck, without computing the next one.
:::

:::challenge Design | Place the limits
A service calls a shared database and a slower partner API. Partner calls take 500 ms, and database calls 5 ms. At 1,000 requests per second, 10% call the partner, and all call the database. How would you size and arrange limits and pools? What happens if the partner slows to 5 s with one shared pool?
>>> Hint
Use Little's Law for each dependency, and then for the slowdown case.
>>> Solution
Database: 1,000 × 0.005 = 5 in flight, so a pool of perhaps 20. Partner: 100 per second × 0.5 s = 50 in flight, so a limit of perhaps 75. With a slowdown to 5 s: 100 × 5 = 500 in flight. In one shared pool or thread pool, partner calls would take all the slots, and database calls would starve, taking everything down. Separate limits (bulkheads) cap partner work at 75, rejecting the rest, while database traffic remains healthy. Add a short timeout and a circuit breaker. See [[a111]] and [[o15]].
>>> Common mistakes
Sizing for normal conditions only. Using one pool since it's simple, so that a slow partner takes down unrelated features.
:::

:::challenge Incident | Scale-out made things worse
At peak, autoscaling added 50% more application instances. Database CPU went from 60% to 95%, and throughput fell. Explain this with these concepts. What's your immediate action and your lasting fix?
>>> Hint
Where was the bottleneck? How does each instance affect connections and concurrency at the database?
>>> Solution
The application tier wasn't the bottleneck. More instances meant more concurrent queries and more connections at the database, beyond its knee, raising contention and context switching, so demand per query rose and throughput dropped. Immediately: reduce concurrency at the database by capping instances, lowering per-instance pools, or enabling a shared connection proxy, then shed optional traffic. Lasting fix: limit total database concurrency with a proxy, tie autoscaling limits to database capacity, and alert on database saturation in scaling decisions.
>>> Common mistakes
Scaling the database first without looking at concurrency. Treating autoscaling as safe by default.
:::

## Industry standards and trends

### Standards and specifications

[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), June 2022, defines 503 and `Retry-After`, which signal overload. [Linux pressure stall information](https://docs.kernel.org/accounting/psi.html), in kernel documentation, standardizes saturation signals on Linux. These operational laws come from research, in particular [The Operational Analysis of Queueing Network Models](https://doi.org/10.1145/356733.356735), Denning and Buzen, 1978.

### Established practice

[The USE Method](https://www.brendangregg.com/usemethod.html), by Brendan Gregg, gives a checklist for each resource. The [Four Golden Signals](https://sre.google/sre-book/monitoring-distributed-systems/), in *Site Reliability Engineering*, 2016, includes saturation. These are widely used conventions, not formal standards.

### Managed-service options

Managed databases expose connection counts, and often wait-event data. Connection proxies from cloud vendors limit concurrency toward a database. Serverless platforms have per-function concurrency settings that behave as limits. Check what happens when you reach each one, since it might queue or reject.

### Emerging approaches

Adaptive concurrency limits, such as Netflix's open-source [concurrency-limits](https://github.com/Netflix/concurrency-limits) library, adjust limits from measured latency. eBPF tools measure off-CPU time and lock waits with low overhead. GPU workloads are now common bottlenecks whose utilization metric can mislead, since a busy indicator doesn't reveal how fully the device is used. Evaluate each against your own workload.

### Recent changes

Pressure stall information is widely available in current Linux distributions and is used by container tools. Check your kernel version and configuration. No standards change was identified at the review date.

### Adoption constraints

Rejecting traffic needs clients that back off, and many don't. Adaptive limiters need careful evaluation for stability. Logical resources require instrumentation in application code, which takes ongoing effort.

## Interview preparation

:::q Foundational | What is the difference between utilization and saturation?
**Strong answer.** Utilization is how busy a resource is. Saturation is how much work is waiting for it. A resource can be 95% busy with no queue, which is efficient, or show low average use with long queues, due to bursts or a lock. Saturation is usually the more direct signal of a problem.

**Why it is asked.** It's fundamental to reading any dashboard.

**Weak-answer warning signs.** Treating the two as the same.

**Follow-up.** Give a saturation metric for CPU, for disk, and for a thread pool.
:::

:::q Foundational | What is a bottleneck?
**Strong answer.** The resource that limits throughput, which saturates first as load rises. Improving anything else doesn't raise throughput. Fixing it moves the bottleneck elsewhere, so this is iterative.

**Why it is asked.** It's the first concept in performance work.

**Weak-answer warning signs.** Only considering CPU, memory, and disk.

**Follow-up.** Name a bottleneck that doesn't show up in infrastructure metrics.
:::

:::q Foundational | Use Little's Law: 500 requests per second at 40 ms. How many are in flight?
**Strong answer.** L = X × R = 500 × 0.04 = 20. If latency doubles at the same rate, concurrency doubles to 40, which may exhaust a pool. That's why slow dependencies cause pool problems.

**Why it is asked.** It's a simple check on quantitative reasoning.

**Weak-answer warning signs.** Forgetting to convert milliseconds to seconds.

**Follow-up.** What does this say about a pool of 25 connections?
:::

:::q Senior | How can a server have low CPU and be overloaded?
**Strong answer.** A single-threaded process pins one core, which averages low on many cores. Or requests wait on a lock, connection pool, disk, or downstream service, consuming no CPU. I would check per-thread CPU, event-loop lag, and off-CPU or pool wait time.

**Why it is asked.** It reveals real diagnostic experience.

**Weak-answer warning signs.** Concluding that low CPU means there's capacity.

**Follow-up.** How would you measure off-CPU time?
:::

:::q Senior | How would you predict a system's maximum throughput without a load test?
**Strong answer.** Measure service demand per request per resource, including logical ones such as locks. Maximum throughput is the minimum of servers ÷ demand. That's an upper bound, as contention can raise demand at load, so I would confirm it with a test.

**Why it is asked.** Few people know this powerful, cheap technique.

**Weak-answer warning signs.** Only saying "run a load test".

**Follow-up.** What makes demand change with load?
:::

:::q Senior | Why might you limit concurrency instead of rate?
**Strong answer.** Concurrency reflects actual pressure on a resource. If a dependency slows, the same rate produces more in flight, so a rate limit lets overload through, while a concurrency limit reacts without reconfiguration. I'd use rate limits for fairness and quotas and concurrency limits for protection.

**Why it is asked.** It distinguishes two controls that are often confused.

**Weak-answer warning signs.** Believing rate limits cover everything.

**Follow-up.** How do you choose the limit's value?
:::

:::q Senior | What target utilization would you run at?
**Strong answer.** It depends on variability, pooling, and latency targets. A large pool of servers can run high with short waits, while a single lock or thread can't. I'd derive it from the wait target and test it, and set the failure case separately, since losing a zone raises utilization by half.

**Why it is asked.** It shows you avoid rules of thumb where they don't apply.

**Weak-answer warning signs.** A single universal number.

**Follow-up.** Why do pooled servers tolerate higher utilization than dedicated ones?
:::

:::q Staff | Adding instances made throughput fall. Explain, and say what you'd do.
**Strong answer.** The instances weren't the bottleneck. More of them raised concurrency against a shared resource, pushing it beyond its knee, with more contention. I would limit total concurrency at that resource, for example through a proxy, cap autoscaling to what downstream can handle, then address the shared resource by partitioning, batching, or caching.

**Why it is asked.** Autoscaling-induced failures are common in production.

**Weak-answer warning signs.** Assuming horizontal scaling always helps.

**Follow-up.** How would you make autoscaling aware of database capacity?
:::

:::q Staff | How do you size connection pools across a fleet?
**Strong answer.** Compute needed concurrency: rate × query time. Then divide the database's safe total concurrency across instances, leaving room for autoscaling and deployment overlap. Pools multiply by instance count, so a harmless-looking 50 can become 5,000. Often a shared proxy is safest, and short queues help bound waiting.

**Why it is asked.** It's a frequent cause of real outages.

**Weak-answer warning signs.** Choosing a pool size in isolation.

**Follow-up.** What happens to connection count during a rolling deployment?
:::

:::q Staff | How would you find a bottleneck in a system you've never seen?
**Strong answer.** I would walk the USE method through every resource on the request path, starting with those that show saturation. Then I'd read traces of slow requests for waiting versus working. Then a load-versus-latency plot, to find the knee, and see what saturates there. I'd also ask what nobody is measuring.

**Why it is asked.** It tests a repeatable method, under uncertainty.

**Weak-answer warning signs.** Guessing based on familiar technology.

**Follow-up.** Everything looks fine at current load. How do you find the next bottleneck?
:::

:::q Principal | How do you decide whether to remove a bottleneck or live with it?
**Strong answer.** Compare the forecast with the limit: how long before we reach it, and what's the business effect? Then compare the cost of each option: more capacity, a design change, demand reduction, or a deliberate cap with rejection. Sometimes a known limit, well protected, is the right choice for a while.

**Why it is asked.** Principals decide what not to fix.

**Weak-answer warning signs.** Treating every bottleneck as something to eliminate now.

**Follow-up.** How do you ensure that a known limit stays visible over the years?
:::

:::q Principal | Multiple teams share a database that's nearing its limit. How do you organize capacity?
**Strong answer.** Make it an owned resource, with per-consumer attribution using demand, not requests. Give teams quotas and a clear escalation path. Then invest in removing the largest consumers' demand, or give them separate stores. The key change is that sharing becomes explicit, so one team's launch can't quietly take another team's capacity.

**Why it is asked.** It's a shared-resource governance problem, not a tuning problem.

**Weak-answer warning signs.** Offering only technical fixes.

**Follow-up.** How would you price or allocate quota fairly?
:::

## Review

### Key takeaways

- Concurrency is how many are in progress, utilization is how busy, and saturation is how much is waiting.
- U = X × D, and X ≤ c ÷ D, so demand measurements predict limits.
- L = X × R links rate, latency, and concurrency.
- Averages hide bursts, single-threaded limits, and logical resources.
- Limit concurrency in front of a bottleneck, and reject the excess cheaply.
- Fixing a bottleneck reveals the next one, so measure again.

### Decision checklist

- [ ] Which resources are on the path, including locks and pools?
- [ ] What is each resource's demand and server count?
- [ ] Which one has the lowest maximum rate?
- [ ] Is any queue growing right now?
- [ ] What's the next bottleneck after this fix?

### Production-readiness checklist

- [ ] Every bounded resource exports utilization and saturation.
- [ ] Slow traces separate waiting from working.
- [ ] Limits and queues are bounded, and they reject cheaply.
- [ ] Autoscaling maximums respect downstream limits.
- [ ] Failure capacity has been computed per resource.

### Glossary

- **Service demand:** total time a request needs from a resource.
- **Knee:** the concurrency beyond which waiting grows.
- **USE method:** a check of utilization, saturation, and errors for every resource.
- **Off-CPU time:** time a thread spends blocked or waiting.
- **Bulkhead:** isolating resources so that one failure can't drain all capacity.
- **Pressure stall information:** a Linux metric reporting time lost waiting on a resource.

### Quiz

:::quiz A single lock has a hold time of 2.5 ms. What is its maximum rate?
- 2,500 per second
- 1,000 per second
- *400 per second
- 40 per second
1 ÷ 0.0025 s = 400 per second, however many servers call it.
:::

:::quiz One core is pinned on a 16-core machine. What does average CPU show?
- 100%
- 50%
- *About 6%
- 0%
1 ÷ 16 = 6.25%, which is why average CPU can hide a single-threaded limit.
:::

:::quiz At 1,000 requests per second and 60 ms, how many requests are in flight?
- 6
- *60
- 600
- 1,000
L = 1,000 × 0.06 = 60.
:::

:::quiz Disk is at 90% and a row lock at 112.5%. What should you fix first?
- The disk, because it's a hardware metric.
- *The lock, because it is past its limit and sets current throughput.
- Neither, since both are under 200%.
- CPU, by default.
The lock caps throughput at 400 per second. Upgrading the disk wouldn't help until the lock moves.
:::

:::quiz Why can a concurrency limit react better to a slow dependency than a rate limit?
- It uses less memory.
- It's always stricter.
- *In-flight work rises automatically when latency rises, at the same request rate.
- It removes the need for timeouts.
Little's Law means slower responses raise concurrency. The limit responds with no reconfiguration, while a rate limit wouldn't notice.
:::

### Further study

Go on to [[a8]] for how waits grow near saturation, [[a24]] for measuring these resources with profilers, and [[a123]] for monitoring methods. [[a112]] covers what to do when saturation arrives anyway.
