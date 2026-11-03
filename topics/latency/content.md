lastReviewed: 2026-11-03

## Orientation

### Definition

Latency is the time between a cause and its effect: for a request, the time from when it is sent to when a response arrives. It always needs two qualifiers: where it is measured, and which part of the distribution you mean. "50 ms" means nothing until you say "p99, measured at the load balancer, including time to last byte."

### Why it matters

Latency is what users feel, and it is a capacity signal: it rises well before failure. It also composes unforgivingly. Each hop adds to it, and retries multiply it. Physics sets a floor no budget can buy back, since a round trip between New York and London takes at least roughly 56 ms in fiber on a direct path, and more on a real route. That floor decides whether cross-region synchronous writes are feasible at all. Distinguishing the delay you can remove from the delay you cannot is one of the most useful reflexes in design.

### Learning objectives

- Decompose a request's latency into propagation, transmission, processing, and queueing delay.
- Compute physical floors and round-trip costs for connection setup.
- Explain why latency rises sharply as utilization approaches saturation.
- Choose the correct measurement point and metric for a latency claim.
- Use sequential and parallel composition to find where time can actually be saved.

## Production scenario

A travel booking site has customers in Sydney and servers in Virginia. Search takes 3.2 seconds to display, and the team plans a database upgrade. A breakdown tells a different story. The distance is about 15,700 km, so with real routes the round trip is about 220 ms. A new connection costs three round trips before the first response byte: TCP, TLS 1.3, and the request itself, for 660 ms. The page makes 8 sequential API calls, each a round trip, for 1,760 ms. Server work totals only 300 ms, of which the database is 90 ms.

A faster database would save perhaps 50 ms of 3,200 ms. Instead, the team terminates TLS at a Sydney edge node and reuses connections to the origin, batches the eight calls into one, and caches search facets at the edge. Time to display falls under 900 ms, with no database change. The decomposition cost an afternoon, and the upgrade would have cost a quarter.

## Mental model

### Analogy

Sending a package has four sources of delay. The truck's travel time depends on distance (propagation). Loading many boxes takes time, depending on box count and door width (transmission). Sorting at the depot takes some time per box (processing). Waiting in line at the depot depends on how busy it is (queueing). A faster truck does not help if the depot line is the real delay, and more depots don't shorten the road.

### Where the analogy breaks

Trucks carry a whole load, while networks split data into packets, which may be lost and retransmitted, and congestion control limits how fast a sender may go. A "shipment" also frequently requires several trips, such as handshakes, before any goods move. Finally, in software, waiting clients often send duplicate requests when delayed, so a slow system gets busier, which no postal customer would cause.

### Entities, state, flow, and invariants

- **Entities:** client, network hops, proxies, service instances, queues, dependencies.
- **State:** connections (new or reused), queue depth, cache contents, garbage-collection state.
- **Flow:** DNS, TCP, TLS, request transmission, queueing, processing, dependency calls, response.
- **Invariant 1:** total latency is at least the sum of the physically required hops on the critical path.
- **Invariant 2:** sequential steps add, while parallel steps cost at least the slowest member.
- **Invariant 3:** a latency number has a location, percentile, and window, or it is not meaningful.

## Foundations

### Concepts and terminology

| Term | Meaning | Notes |
| --- | --- | --- |
| Propagation delay | Distance ÷ signal speed | About 5 µs per km in fiber |
| Transmission delay | Size ÷ bandwidth | 1 MB at 100 Mbit/s is 80 ms |
| Processing delay | CPU time on a node | Includes parsing and business logic |
| Queueing delay | Time waiting for a resource | The most variable component |
| RTT | Round-trip time | Client and server handshakes cost RTTs |
| TTFB | Time to first byte | Includes connection setup if new |
| Service time | Time being worked on | Excludes waiting |
| Response time | Service time plus queueing | What the client experiences |

Note the different terms for bandwidth and latency. Bandwidth is capacity per unit time, and latency is delay. A truck full of disks has huge bandwidth and terrible latency. See [[o91]].

### First-principles explanation

Light in fiber travels at about 200,000 km/s, or two-thirds of c. That's 200 km per millisecond, or 5 ms per 1,000 km one way. No software changes this. For small messages over long distances, propagation dominates. For large messages over slow links, transmission does. Within a data center, propagation is negligible, around 500 µs round trip or less, so queueing and processing dominate.

Queueing comes from variation. If requests arrive at random, then some wait even if the server is idle on average. As utilization ρ grows, the mean wait grows in proportion to ρ ÷ (1 − ρ). So going from 50% to 90% multiplies wait ninefold, and 90% to 99% multiplies it another elevenfold. This nonlinearity is the reason systems look fine right up until they don't, and why a small traffic increase can cause a large latency increase. See [[a8]].

Protocols add round trips. New TCP needs one RTT before sending a request. TLS 1.3 adds one, and TLS 1.2 adds two. QUIC combines transport and TLS in one RTT, and resumption can achieve zero. Connection reuse eliminates all of this, which is often the greatest single saving for long-distance traffic. See [[a27]] and [[o59]].

### Mathematics

- Propagation (ms) = distance (km) × route factor ÷ 200 km per ms.
- Transmission (ms) = size (bytes) × 8 ÷ (bandwidth (Mbit/s) × 1,000).
- Queueing, M/D/1 mean wait = ρ ÷ (2(1 − ρ)) × service time.
- Queueing, M/M/1 mean wait = ρ ÷ (1 − ρ) × service time. Random service time doubles the M/D/1 wait.
- Time to first byte, new connection with TLS 1.3 = 3 × RTT, plus server time.

Example: 5,600 km × 1.4 ÷ 200 = 39.2 ms one way, or 78.4 ms RTT. New connection: 235 ms. Reused: 78 ms. M/D/1 with a 10 ms service time at 90% utilization: 0.9 ÷ 0.2 × 10 = 45 ms wait.

### Complexity

Latency is commonly a function of algorithmic complexity plus system behavior. An O(n) scan over 10,000 items at 10 ns each adds 100 µs, which is negligible next to one disk seek or round trip. The useful habit is comparing magnitudes:

| Operation | Rough order of magnitude |
| --- | --- |
| Main memory reference | 100 ns |
| Read 1 MB from memory | Tens of µs |
| Same-datacenter round trip | Up to about 500 µs |
| SSD random read | 100 µs |
| Disk seek | 10 ms |
| Intercontinental round trip | 100 to 200 ms |

These are approximate teaching values. Measure your own hardware, since they vary substantially.

## Mechanism

### Normal path

1. DNS resolution, if not cached: 0 to tens of milliseconds, sometimes more. See [[o61]].
2. TCP handshake: 1 RTT, unless reused.
3. TLS handshake: 1 RTT with TLS 1.3, unless resumed or reused.
4. Client transmits the request.
5. Propagation to the server, through any load balancers and proxies.
6. The request waits in queues: socket accept queue, thread pool, event loop.
7. Processing, and calls to dependencies, each repeating some of these steps.
8. Response transmission, limited by bandwidth and TCP congestion window. Large responses need several RTTs early in a connection.

### State transitions

```mermaid state-request | Request states and where latency accumulates | State diagram. A request moves from connecting to sending, queued, processing, and awaiting a dependency, then responding, ending as complete. It can time out in any waiting state. Connection reuse skips the connecting state.
stateDiagram-v2
    [*] --> Connecting: new connection, 1 to 3 RTT
    [*] --> Sending: reused connection
    Connecting --> Sending
    Sending --> Queued: arrives at server
    Queued --> Processing: worker becomes free
    Processing --> AwaitingDependency: downstream call
    AwaitingDependency --> Processing: reply received
    Processing --> Responding
    Responding --> [*]: last byte received
    Queued --> TimedOut: deadline passes
    AwaitingDependency --> TimedOut: deadline passes
    TimedOut --> [*]
```

Each state has its own remedy. Connecting time falls with reuse and edge termination. Queued time falls with capacity or load shedding. Processing falls through profiling, and waiting on dependencies falls through parallelism or caching. A breakdown tells you which remedy is even relevant.

### Concurrency behavior

Parallel calls cost as much as the slowest, not the sum, but they raise the probability of meeting a slow outlier. Concurrent requests contend for shared resources: connection pools, locks, CPU. Under contention, what looks like service time turns into queueing delay. On a single-threaded event loop, one slow synchronous task delays all others behind it. See [[a16]].

### Ordering and consistency

Latency trades off against consistency. A strongly consistent write across regions must wait for a remote acknowledgment, so it pays at least one inter-region RTT. Reading from a nearby replica is fast but may be stale. This relationship is what [[a71]] formalizes: even without a partition, you're choosing between latency and consistency. Physical ordering matters too: in a sequential chain, time saved at any step counts only if the step lies on the critical path. See [[a5]].

### Ownership of data and control

Client teams own connection reuse, payload size, and the number of calls. Edge and platform teams own CDNs, TLS termination, and routing. Service teams own processing and dependency calls. Data location is an ownership decision too: placing data far from its readers imposes a fixed cost that no later optimization can remove. Each hop needs an owner for its share of the budget.

## Architecture

```mermaid context | Context: path of a request from client to data and its latency contributors | Flowchart. A user connects over the internet through an edge node, then a private backbone to an origin load balancer, service, cache, and database. Each edge is labeled with typical delay source: long-distance propagation, connection setup, queueing, and storage. Trust boundary separates the public internet from the private network.
flowchart LR
    U["User device"] -->|"last mile: variable, 1 to 3 RTT setup"| E["Edge node: TLS terminates here"]
    subgraph private["Private network: operator-owned"]
      E -->|"backbone: reused connections"| LB["Origin load balancer"]
      LB -->|"HTTP, under 1 ms"| S["Service: queueing, CPU, GC"]
      S -->|"under 1 ms"| C["Cache: owns copies"]
      S -->|"1 to 10 ms"| D["Database: owns data, disk, locks"]
    end
```

Moving TLS termination close to the user shortens the handshake's round trips to the nearby edge, while the long haul uses already-open connections. The trust boundary sits at the edge, so traffic behind it needs its own protection. Time values shown are illustrative only and vary widely.

```mermaid component | Component view of the phase timer and calculator | Flowchart. Requests reach Express route /feed, which uses PhaseTimer to wrap auth, db, ranking, and ads steps, producing a Server-Timing header and a JSON log line. Separately, a Python calculator models propagation, transmission, queueing, and handshake costs.
flowchart LR
    C["curl or browser"] -->|"HTTP GET /feed"| R["Express route"]
    R --> T["PhaseTimer.measure"]
    T --> A["auth phase"]
    T --> D["db phase"]
    T --> P["ranking and ads: sequential or parallel"]
    T -->|"Server-Timing header"| C
    T -->|"JSON log line"| L["Structured log"]
    I["Distance, bandwidth, size"] --> Q["Python calculator"]
    Q --> O["Propagation, transmission, queueing, handshake report"]
```

The TypeScript side measures time inside a running service, while the Python side predicts the time physics requires. Use both in practice. Prediction tells you the floor, and measurement tells you how far you are above it.

```mermaid sequence | Sequence: new connection compared with a reused connection | Sequence diagram. A client on a new connection does a TCP handshake, TLS handshake, then sends a request and receives a response, totaling three round trips. A later request on the same connection costs one round trip.
sequenceDiagram
    participant C as Client
    participant S as Server
    Note over C,S: New connection with TLS 1.3, 3 RTT to first byte
    C->>S: TCP SYN
    S-->>C: SYN-ACK (1 RTT)
    C->>S: TLS ClientHello with ACK
    S-->>C: TLS ServerHello and Finished (2 RTT)
    C->>S: HTTP request with TLS Finished
    S-->>C: First response byte (3 RTT)
    Note over C,S: Reused connection, 1 RTT to first byte
    C->>S: HTTP request
    S-->>C: First response byte (1 RTT)
```

At 200 ms RTT, the difference between these is 400 ms on each new connection. Since cold-start costs land on first impressions and on clients that reconnect often, connection reuse usually beats server-side tuning for distant clients. It also explains why a short idle timeout on a load balancer can raise user latency.

```mermaid failure-path | Failure path: rising utilization turns into a latency collapse | Flowchart. Traffic rises to high utilization, and queueing grows. Latency exceeds client timeouts, and clients retry, adding load. Effective utilization reaches 100 percent. Work completes for clients who have already given up, so goodput falls. Shedding excess load restores service.
flowchart TD
    A["Traffic reaches 90 percent utilization"] --> B["Queue wait grows non-linearly"]
    B --> C["Latency exceeds client timeout"]
    C --> D["Clients retry, adding load"]
    D --> E["Utilization reaches 100 percent"]
    E --> F["Servers work on requests whose clients already gave up"]
    F --> C
    E -->|"detected: queue age and saturation"| G["Shed load and cap retries"]
    G --> H["Queue drains and latency recovers"]
```

The loop from F back to C is the dangerous part, as the system can stay broken even after the original traffic rise has ended. That is a metastable failure. Scaling alone may not end it, so you need to shed load and cap retries. See [[a112]] and [[a110]].

## Trade-offs

### Advantages

Lower latency improves user experience and leaves more of the budget for retries and work. Faster requests also hold resources for less time, which improves capacity. Moving work to the edge can eliminate entire round trips.

### Costs

- Edge nodes, replicas, and caches add money, complexity, and consistency issues.
- Lower utilization to reduce queueing means paying for idle capacity.
- Parallel calls raise total load, and hedging can double it.
- Pursuing the last few milliseconds has quickly diminishing returns.

### Alternatives

Reducing latency is not always the right goal. **Perceived latency** can improve via progressive rendering and optimistic UI. **Asynchronous workflows** remove the need for a fast response altogether. See [[a40]]. **Better tail control** may matter more than a better median. See [[o93]].

### When to use it

Prioritize latency for interactive journeys, for time-critical systems such as trading and bidding, and at deep fan-out, where each millisecond multiplies. Use measured user or business impact where possible.

### When not to use it

Do not optimize batch work for latency when throughput matters instead, and don't add a cache or new region where the gain is imperceptible. Optimizing processing time is pointless if network round trips make up 90% of the total.

### Reconsider when

- Your user base moves to a new geography.
- A breakdown shows a different dominant component than last time.
- Utilization targets change, since less headroom means more queueing.
- Protocol or edge offerings change what round trips are necessary.

## Capacity planning

### Inputs and assumptions

Service time 10 ms with little variation, peak arrival rate 3,000 requests per second, a target mean wait of at most 5 ms. Assume random arrivals and an even split between servers, and treat each server as a single queue with one worker. These are simplifying assumptions, and real services have more workers.

### Formula and units

- Utilization ρ = arrival rate per server × service time in seconds.
- Mean wait (ms) = ρ ÷ (2(1 − ρ)) × service time (ms).
- Solve for the maximum ρ, then servers = total arrival rate × service time ÷ ρ.

### Intermediate calculations

- Required wait of 5 ms at 10 ms service: ρ ÷ (2(1 − ρ)) = 0.5, so ρ = 0.5.
- Each server takes 0.5 ÷ 0.010 s = 50 requests per second at that utilization.
- Servers: 3,000 ÷ 50 = 60.
- If 15 ms of wait were acceptable: ρ ÷ (2(1 − ρ)) = 1.5, so ρ = 0.75. Then each server handles 75 per second, for 40 servers.
- So the 10 ms latency saving costs 20 extra servers, or 50% more.

### Headroom

Latency targets already imply headroom, because they fix the safe utilization. Add a further margin for forecast error, such as 20%: 60 ÷ 0.8 = 75 servers. Illustrative figures should be replaced with measured values.

### Failure capacity

Losing one of three zones sends all load to 2 ÷ 3 of the servers. At 60 servers total, the remaining 40 each take 75 requests per second: ρ = 0.75, and the wait rises to 15 ms, which may still be tolerable, since latency degrades and nothing fails. To hold the 5 ms target during failure, you'd need 60 × 3 ÷ 2 = 90 servers. So you should state whether the latency target applies during failure, since that costs 50% more.

## Failure modes

:::failure Saturation-driven latency collapse
Trigger: Traffic or slow dependencies push utilization near 100%.
Symptoms: Latency climbs by orders of magnitude, followed by timeouts and retries.
Blast radius: The service, its callers, and resources they share.
Detection: Queue age, saturation metrics, and p99 divergence from the median.
Mitigation: Shed load, cap retries, and increase capacity.
Recovery: Let queues drain, and readmit traffic gradually.
Prevention: Set bounded queues, admission control, and capacity based on target wait.
:::

:::failure Connection churn
Trigger: A short idle timeout, disabled keep-alive, or a proxy that closes connections.
Symptoms: High TTFB for distant clients, plus elevated handshake CPU.
Blast radius: Every client of that path, mostly those far away.
Detection: Compare new connection rate with request rate, and connection time in client timing data.
Mitigation: Extend timeouts along the path so that upstream outlasts downstream.
Recovery: Roll out the configuration and verify reuse ratio.
Prevention: Monitor reuse ratio and test configuration changes.
:::

:::failure Hidden sequential calls
Trigger: A page or service calls dependencies in a chain, often through an N+1 loop.
Symptoms: Latency scales with item count, and traces show a staircase pattern.
Blast radius: One route initially, then the dependency under load.
Detection: Look at trace waterfall views and calls per request.
Mitigation: Batch or parallelize the calls.
Recovery: Deploy a batched endpoint or a join.
Prevention: Budget calls per request and test with realistic data. See [[o5]].
:::

:::failure Garbage-collection or runtime pauses
Trigger: Heap pressure or a long stop-the-world collection.
Symptoms: Sudden pauses that affect all requests on one instance, and periodic latency spikes.
Blast radius: Each affected instance, potentially more if load balancing does not react.
Detection: Runtime pause metrics correlated with latency by instance.
Mitigation: Remove the instance from rotation and reduce allocation pressure.
Recovery: Restart the instance, then tune or fix the leak.
Prevention: Profile allocations and set appropriate limits. See [[o80]].
:::

:::failure Misleading measurement
Trigger: Averages are used, or latency is measured only inside the application.
Symptoms: Dashboards look healthy while users complain.
Blast radius: Decision making. Real problems stay unaddressed for a long time.
Detection: Compare server, load balancer, and real-user measurements for the same route.
Mitigation: Add percentile metrics and client measurement.
Recovery: Rebase targets on the correct metric.
Prevention: Define each latency SLI with a location and percentile. See [[o92]].
:::

## Security and privacy

### Threats

Timing itself can leak information: differences in response time can reveal whether a username exists or whether a secret comparison failed early. The `Server-Timing` header can expose internal structure, so it should be limited in public responses. Attackers can also target slow routes for cheap denial of service, or hold connections open with slow request techniques.

### Trust boundaries

Clients control how fast they send and read. Protect servers from slow clients using timeouts at the edge. Internal timing details should not cross to the public internet without review.

### Authentication and authorization

Authentication adds latency, particularly when it needs remote calls on every request. Cache verification results carefully, within revocation requirements. Compare secrets in constant time, even though this is marginally slower, since speed here would be a vulnerability. Decide whether authorization fails closed if it can't respond within its budget.

### Tenant isolation

One tenant's heavy query can raise latency for others through shared queues. Isolate through per-tenant concurrency limits and report latency per tenant to detect it. See [[a139]].

### Sensitive data

Latency logs can include URLs with user identifiers or tokens. Log route templates instead. Real-user monitoring collects timing from personal devices, so it needs consent and minimization under applicable privacy law.

### Abuse resistance

Enforce header and body read timeouts, and limit concurrent connections per client. Find routes where the cost per request is highest, since an attacker will find them too, and add limits there.

## Observability

### Metrics

Use a latency histogram by route and status, measured at more than one location. Track queue depth and age, active connections, new connection rate, and DNS and TLS times where available. Separately track successful and failed latency: fast failures make averages look better. See [[a123]].

### Logs

Log total duration and phase durations in structured form, as the example does, with route template, status, and trace ID. Log slow requests in more detail, using a threshold or sampling to bound the volume.

### Traces

Traces show the waterfall: which spans are sequential, which overlap, and where gaps between spans indicate queueing or uninstrumented work. A gap inside a parent span is often the most informative thing on the page. See [[o103]].

### Dashboards

Show p50, p95, and p99 together at the load balancer, with a breakdown by phase and instance. Show utilization on the same time axis, as seeing latency rise along with utilization separates queueing from a code regression.

### Alerts

Alert on user-visible SLO burn instead of raw thresholds. Create a warning when queue age climbs, because it comes before user impact. See [[a124]].

### SLO examples

- 99% of `GET /search` requests finish within 400 ms at the load balancer over 28 days.
- 75% of real-user page loads reach largest contentful paint within 2.5 s, per region.
- 99.9% of internal `auth` calls finish within 20 ms.

### Runbook actions

On a latency alert: check whether it affects all instances or one, compare with recent deployments, and look at utilization and queue age. If it is one instance, remove it. If it is load, shed or scale. If it is a dependency, look at its traces and consider its fallback.

## Implementation

### Architecture of the examples

The TypeScript example is an Express service that wraps phases in `PhaseTimer` and reports them with `Server-Timing`. A `mode=parallel` query shows the effect of composition. The Python example is a calculator that models what physics and queueing require, with no HTTP layer since it would add nothing.

### Data structures

`PhaseTimer` holds an ordered list of `Phase` records. It takes an injectable clock, so tests are deterministic and need no real delays. Python uses a Pydantic `Hop` for inputs, with utilization restricted to below 1 because the formula diverges there, and `Breakdown` for outputs.

### Interfaces

`GET /feed?mode=sequential|parallel` returns total time and phase names, plus the header. `GET /healthz` reports liveness. Python functions `propagation_ms`, `transmission_ms`, `md1_queueing_ms`, and `rtts_to_first_byte` can be used individually.

### Error handling

`measure` records a phase in `finally`, so failed phases are timed too. Slow failures are important signals, and dropping them would bias results. Route errors go to a logging error handler with no internal details in the response.

### Concurrency considerations

`Promise.all` runs ranking and ads concurrently. Since Node runs these timers on a single event loop, a CPU-heavy synchronous task would delay every in-flight phase. The timer is per-request, so concurrent requests do not share measurement state.

### Educational limitations

Delays are simulated by timers, so nothing here shows real contention. The measurement is inside the process, so it misses the accept queue and the network. The M/D/1 formula is a simple model, and a multi-worker service queues differently.

### Production hardening

Use OpenTelemetry spans rather than manual timers, record histograms, cover client-side measurement, remove detailed `Server-Timing` from public responses, and add deadlines so that requests stop when their budget is spent.

## Terminal lab

### Setup

```bash
cd topics/latency/examples/typescript
pnpm install --ignore-workspace
```

### Run

Start the service:

```bash
PORT=3000 pnpm start
```

In another terminal, compare the two modes:

```bash
curl -s localhost:3000/feed | jq -c '{mode, totalMs}'
```

```bash
curl -s 'localhost:3000/feed?mode=parallel' | jq -c '{mode, totalMs}'
```

Use curl's timing variables to split up real connection time for a site you may test:

```bash
curl -so /dev/null -w 'dns %{time_namelookup}  tcp %{time_connect}  tls %{time_appconnect}  ttfb %{time_starttransfer}  total %{time_total}\n' https://www.rfc-editor.org/
```

Then calculate the physical floor:

```bash
cd ../python && uv run python -m app.main | jq -c '{rtt_floor_ms, first_byte_new_tls13_ms, first_byte_reused_ms, queueing_ms_at_utilization}'
```

### Test

```bash
cd ../typescript && pnpm test
```

```bash
cd ../python && uv run pytest -q
```

### Expected output

Sequential mode reports a `totalMs` of around 100 and parallel about 70, because ads and ranking overlap, so the parallel step costs 45 ms and not 75 ms. Timer resolution will add a few milliseconds. The Python tool prints:

```json
{"rtt_floor_ms":78.4,"first_byte_new_tls13_ms":235.2,"first_byte_reused_ms":78.4,"queueing_ms_at_utilization":{"0.5":5.0,"0.8":20.0,"0.9":45.0,"0.95":95.0,"0.99":495.0}}
```

Going from 90% to 99% utilization raises the wait 11 times, for a 10% increase in traffic.

### Cleanup

Stop the server with Ctrl-C, then:

```bash
rm -rf ../typescript/node_modules .venv
```

### Troubleshooting

- The curl timing values are cumulative from the start of the request. Subtract adjacent values to get each phase.
- `EADDRINUSE`: another process is holding the port. Find it with `lsof -i :3000`.
- `time_appconnect` is zero for plain HTTP, because TLS is not used.

## Practical challenges

:::challenge Concept | What dominates?
For each case, name the dominant delay and one effective fix: (a) a 2 KB API response from Tokyo to São Paulo, (b) a 4 GB file between two machines on a 1 Gbit/s link in one data center, (c) a 5 KB response within a data center at 97% CPU.
>>> Hint
Compute the numbers. Distances are about 18,500 km for (a).
>>> Solution
(a) Propagation: 18,500 × 1.4 ÷ 200 = 130 ms one way, while transmission is negligible. Fix: serve from nearby or reuse connections. (b) Transmission: 4 GB × 8 ÷ 1 Gbit/s = 32 s. Fix: more bandwidth, compression, or parallel transfers. (c) Queueing: at 97% utilization, wait is many times the service time. Fix: add capacity or shed load, since code tuning can't catch up with this.
>>> Common mistakes
Answering "use a cache" for all three. Using 1 GB = 1,000 Mbit, which ignores the factor of 8.
:::

:::challenge Debugging | The staircase trace
A trace shows `GET /orders` at 900 ms, with 30 consecutive 28 ms database spans, plus a 40 ms gap before the first span. Explain each visible feature, then give the fix and the expected result.
>>> Hint
Thirty sequential spans of equal size suggest a loop. A gap is time spent somewhere uninstrumented.
>>> Solution
This is the N+1 pattern: 30 × 28 ms = 840 ms. The 40 ms gap may be queueing for a worker or a connection, or uninstrumented work. So check queue metrics. Fix: one batched query taking perhaps 40 ms, so about 100 ms in total, and a test that limits queries per request. Investigate the gap separately using pool wait metrics.
>>> Common mistakes
Parallelizing 30 queries, which relieves latency but raises database load and pool pressure. Ignoring the gap.
:::

:::challenge Capacity | How much does the wait target cost?
Service time is 20 ms with low variance. Peak traffic is 4,000 requests per second. Using M/D/1 and one queue per server, compare server counts for mean waits of 5 ms, 20 ms, and 60 ms.
>>> Hint
Set ρ ÷ (2(1 − ρ)) × 20 equal to the target, and solve for ρ.
>>> Solution
Let x = target ÷ 20 ms. Then ρ = 2x ÷ (1 + 2x). 5 ms: x = 0.25, ρ = 0.333, 16.7 requests per second per server, so 240 servers. 20 ms: x = 1, ρ = 0.667, 33.3 per second, 120 servers. 60 ms: x = 3, ρ = 0.857, 42.9 per second, 94 servers (93.3 rounded up). Halving servers from 240 to 120 costs just 15 ms of wait. Below that, returns shrink further.
>>> Common mistakes
Assuming linear relationships. Forgetting that throughput per server is ρ ÷ service time.
:::

:::challenge Design | A latency target for a global API
You must offer p99 under 150 ms for reads, and under 300 ms for writes, worldwide. Regions are 80 to 250 ms apart. Sketch the data placement, what's achievable physically, and what you would tell the product owner.
>>> Hint
Compare 300 ms with the RTT between the farthest regions. Then ask if each user's data really needs a global home.
>>> Solution
Reads: local replicas in each major region, with stale reads accepted where product allows. Writes: a single global primary fails for distant users, as 250 ms RTT plus processing and a new connection overruns the target. So home each user's data in their nearest region, with asynchronous replication elsewhere, and route writes to the home region. Tell the owner: writes from a traveling user may be slower; a user's writes in another region may be stale for a moment; strong global consistency on all writes can't meet 300 ms. See [[a161]].
>>> Common mistakes
Promising both worldwide strong consistency and low latency. Ignoring connection setup round trips.
:::

:::challenge Incident | Fine by CPU, slow for users
Users in Europe report slowness since a deployment an hour ago, while p99 at the US load balancer is unchanged, and CPU is flat. What do you check and in what order? What change could cause this?
>>> Hint
The server's view can't see time spent before the request arrives. Think of connections.
>>> Solution
Check real-user timing by region, and split it into DNS, connect, TLS, and TTFB. Check the new connection rate and whether the deployment changed idle timeouts, keep-alive, TLS configuration, an edge route, or DNS. A likely cause: an idle timeout or keep-alive change has forced new connections, adding two extra RTTs of more than 150 ms in total for European users. Roll back the change, and confirm connection reuse recovers. Follow up: add a reuse-ratio metric, plus regional real-user SLOs.
>>> Common mistakes
Concluding there's no problem because server metrics are normal. Looking only at application changes.
:::

## Industry standards and trends

### Standards and specifications

- [RFC 7679](https://www.rfc-editor.org/rfc/rfc7679.html), January 2016, and [RFC 2681](https://www.rfc-editor.org/rfc/rfc2681.html), September 1999, define one-way and round-trip delay metrics for IP networks.
- [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446.html), August 2018, TLS 1.3, which reduced the full handshake to one RTT.
- [RFC 9000](https://www.rfc-editor.org/rfc/rfc9000.html), May 2021, QUIC, which combines transport and cryptographic setup.
- [W3C Server Timing](https://www.w3.org/TR/server-timing/), a W3C working draft, defines the header used in this lesson.
- [W3C Navigation Timing Level 2](https://www.w3.org/TR/navigation-timing-2/) defines browser timing measurements.

### Established practice

[The Tail at Scale](https://research.google/pubs/the-tail-at-scale/), Dean and Barroso, 2013, is the widely cited paper on latency variability in large fan-out systems. [Web Vitals](https://web.dev/articles/vitals), Google guidance, updated periodically, is a common set of field metrics for page experience. It's vendor guidance and not a formal standard, though it's influential.

### Managed-service options

CDNs and global accelerators terminate connections near users. Real-user monitoring products report field latency, and cloud load balancers publish latency metrics. Compare where each one starts and stops its clock.

### Emerging approaches

HTTP/3 deployment continues to grow, particularly for mobile clients on lossy networks. Edge compute moves logic close to users, though the benefit disappears if every request must still return to a distant database. LLM streaming has changed the common measure to time to first token and tokens per second. These are observations from public products, and they are not settled standards.

### Recent changes

Interaction to Next Paint replaced First Input Delay as a Core Web Vital in March 2024. Check current thresholds in the guidance above, since they may change.

### Adoption constraints

Corporate networks or middleboxes may block UDP, which requires a fallback from QUIC to TCP. Edge deployment has data-residency implications, and client-side measurement needs privacy review.

## Interview preparation

:::q Foundational | What are the main components of network latency?
**Strong answer.** Propagation from distance, transmission from size over bandwidth, processing at each node, and queueing while waiting for a resource. Each has a different remedy. Propagation only falls with proximity, and queueing falls by adding capacity or reducing load.

**Why it is asked.** It checks whether you can reason from first principles.

**Weak-answer warning signs.** Treating bandwidth and latency as the same thing.

**Follow-up.** Which one dominates on a same-rack call, and why?
:::

:::q Foundational | What is the difference between latency and throughput?
**Strong answer.** Latency is how long one operation takes, and throughput is how many complete per unit of time. They're related but independent: batching can raise throughput while raising latency, and a slow large pipe has high throughput with high latency.

**Why it is asked.** The terms get confused constantly.

**Weak-answer warning signs.** Saying one is simply the inverse of the other.

**Follow-up.** Give a change that improves one and harms the other.
:::

:::q Foundational | Why does a new HTTPS connection cost so much more than a reused one?
**Strong answer.** TCP takes one RTT and TLS 1.3 another, before the request's own RTT. So first byte takes three RTTs against one on a reused connection. At 200 ms RTT, that's 400 ms extra before the server does anything.

**Why it is asked.** It reveals an understanding of protocol costs.

**Weak-answer warning signs.** Not considering handshakes, or having no idea how many round trips are required.

**Follow-up.** How do QUIC and session resumption change this?
:::

:::q Senior | Why does latency rise sharply as utilization approaches 100%?
**Strong answer.** Queueing delay is proportional to ρ ÷ (1 − ρ). Variation creates waiting even under capacity, and spare capacity to clear backlogs disappears as ρ rises. So moving from 90% to 99% utilization multiplies waiting by 11. That's why teams set utilization targets by latency goal, not by cost alone.

**Why it is asked.** Fundamental to capacity and overload reasoning.

**Weak-answer warning signs.** Assuming linear degradation.

**Follow-up.** How would you decide on a target utilization?
:::

:::q Senior | A page takes 3 seconds. How do you find where the time goes?
**Strong answer.** Start from real-user data split by DNS, connect, TLS, TTFB, and render. Then use traces for the server part, looking at the waterfall for sequential calls and gaps. Compare across regions. Only after this do I choose a fix, since the answer is commonly round trips, not code.

**Why it is asked.** Tests systematic diagnosis.

**Weak-answer warning signs.** Jumping to caching or database tuning.

**Follow-up.** TTFB is 2 seconds. What's next?
:::

:::q Senior | When does parallelizing calls not help?
**Strong answer.** When the slowest call dominates, parallelism saves only the others' time. It raises peak load and pool usage. With many parallel calls, the odds of hitting a slow outlier rise too, so tail latency could worsen. It also doesn't help on shared bottlenecks such as one database.

**Why it is asked.** Parallelism is a frequent reflexive answer.

**Weak-answer warning signs.** Saying parallel is always faster.

**Follow-up.** How would you protect a dependency from parallel fan-out?
:::

:::q Senior | Where should latency be measured?
**Strong answer.** At several places, as each misses something. Inside the application misses accept queues and network. The load balancer catches server-side queueing and failures. Real-user measurement catches the last mile and rendering. SLOs usually sit at the load balancer or client, since that's closest to user experience.

**Why it is asked.** Many dashboards measure in the most flattering place.

**Weak-answer warning signs.** Only measuring application handler time.

**Follow-up.** Why can the two measurements disagree, even for the same request?
:::

:::q Staff | How would you reduce latency for users on another continent without moving the database?
**Strong answer.** I would terminate TLS at a nearby edge to save handshake round trips, keep long-lived connections from the edge to origin, and batch client calls into fewer round trips. I would cache read-heavy content at the edge and keep payloads small. Reads could use a local replica if staleness is acceptable. Then I would measure which of these actually moved real-user latency.

**Why it is asked.** It exercises reasoning across layers.

**Weak-answer warning signs.** Only offering "multi-region".

**Follow-up.** Edge caching is impossible since responses are personalized. What's left?
:::

:::q Staff | Would you run a latency-sensitive service at 40% or 80% utilization?
**Strong answer.** It depends on the target and variance. I would derive it: with service time and desired wait, queueing theory gives a maximum utilization, then I'd validate through a load test. With many workers per queue, higher utilization is possible at the same wait. I would show the cost of each option and factor in failure capacity.

**Why it is asked.** It tests cost and latency judgment.

**Weak-answer warning signs.** Giving a universal number.

**Follow-up.** Why does a large pooled server tolerate higher utilization than several small ones?
:::

:::q Staff | Latency regressed by 5 ms per release for a year. How do you prevent slow degradation?
**Strong answer.** Add latency budgets per journey and continuous performance tests that compare against a fixed baseline, not the prior release. Track long-term trends on the same dashboard, and give each team ownership of its share of the budget. Then regressions become visible decisions.

**Why it is asked.** Slow degradation escapes alerting.

**Weak-answer warning signs.** Relying on alerts tied to thresholds.

**Follow-up.** How would you handle noise in performance tests?
:::

:::q Principal | How do you decide whether a latency investment is worth it?
**Strong answer.** I would relate it to outcomes: run a controlled experiment, adding artificial delay where safe, or analyze conversion by latency percentile. I would estimate the benefit and compare it to engineering and running cost and to alternatives. Many latency targets are set by habit, so I would ask what happens to the business at 100 ms slower.

**Why it is asked.** Principals tie engineering to value.

**Weak-answer warning signs.** Citing famous company statistics as if they apply universally.

**Follow-up.** The experiment shows no effect on conversion. What now?
:::

:::q Principal | A team proposes synchronous cross-region replication for durability. How do you evaluate its latency consequences?
**Strong answer.** I would compute the floor first: every write gains at least one inter-region RTT, plus tail effects, and connection pools hold that longer, which reduces capacity. Then I would compare data classes: maybe only the ledger needs this. I would look at alternatives such as nearby synchronous replicas in a metro area, and show the RPO, latency, and cost of each. The decision then belongs to the data's owner.

**Why it is asked.** It connects physics, durability, and business risk.

**Weak-answer warning signs.** Approving or rejecting without the numbers.

**Follow-up.** How does holding connections longer affect throughput? Use Little's Law.
:::

## Review

### Key takeaways

- Latency = propagation + transmission + processing + queueing.
- Physics sets a floor of about 5 ms per 1,000 km one way in fiber.
- A new TLS 1.3 connection takes 3 RTTs to first byte, and a reused one takes 1.
- Queueing grows as ρ ÷ (1 − ρ), so saturation hits suddenly.
- Decompose before you optimize. The dominant part is often not your code.
- Always state location, percentile, and window.

### Decision checklist

- [ ] Do I have a breakdown of the time, not just a total?
- [ ] Have I calculated the physical floor for this path?
- [ ] Does the optimization target the critical path?
- [ ] What is the target utilization, given the target wait?
- [ ] Does the latency target apply during failure?

### Production-readiness checklist

- [ ] Latency histograms exist per route, at the load balancer.
- [ ] Real-user timing is collected by region.
- [ ] Connection reuse is monitored.
- [ ] Queue age and saturation are monitored.
- [ ] Deadlines and bounded queues prevent runaway waiting.

### Glossary

- **RTT:** round-trip time.
- **TTFB:** time to first byte.
- **Service time:** the time spent actively working on a request.
- **Response time:** service time plus waiting.
- **Utilization (ρ):** the fraction of time a resource is busy.
- **Critical path:** the sequence of steps that determines total time.
- **Metastable failure:** an overload that sustains itself after the trigger is gone.

### Quiz

:::quiz A 1 MB response on a 100 Mbit/s link takes how long to transmit?
- 1 ms
- 10 ms
- *80 ms
- 800 ms
1,000,000 bytes × 8 = 8,000,000 bits. Dividing by 100,000,000 bits per second gives 0.08 s.
:::

:::quiz What is the time to first byte on a new TLS 1.3 connection with an RTT of 100 ms, ignoring server time?
- 100 ms
- 200 ms
- *300 ms
- 400 ms
One RTT for TCP, one for TLS 1.3, and one for the request and response.
:::

:::quiz In M/D/1 with a 10 ms service time, what is the mean wait at 90% utilization?
- 9 ms
- 10 ms
- *45 ms
- 90 ms
0.9 ÷ (2 × 0.1) × 10 ms = 45 ms.
:::

:::quiz Two parallel calls take 30 ms and 45 ms. What do they add to request time?
- 30 ms
- *45 ms
- 75 ms
- 37.5 ms
Parallel steps cost as much as the slowest member.
:::

:::quiz CPU is flat and server p99 is unchanged, but European users report slowness after a deployment. What is the most useful next step?
- Conclude nothing is wrong.
- Upgrade the database.
- *Check real-user timing by region, split by connect and TLS, and check connection reuse.
- Add more servers.
Server-side measurements can't see time before a request arrives, and a timeout or keep-alive change can add several RTTs.
:::

### Further study

Go on to [[o91]] for throughput, [[o92]] and [[o93]] for percentiles and the tail, and [[a5]] to allocate time across a critical path. [[a8]] goes deeper into queueing, and [[a27]] goes deeper into connections.
