lastReviewed: 2026-11-03

## Orientation

### Definition

Back-of-the-envelope estimation is quick arithmetic that finds the rough size of a system, within about a factor of two to ten, using stated assumptions and round numbers. Its purpose is to rule designs in or out before anyone builds them.

### Why it matters

The first useful question about any design is whether it can work at all. A five-minute calculation can show that a single database is plenty, saving months of premature sharding, or that a proposed cache needs 40 TB of memory, killing a bad idea early. Knowing rough magnitudes also protects you in reviews: a wrong number in a design document usually gets noticed by the person who has done this arithmetic before. In interviews, it is what connects requirements to architecture. It's not about precision. It's about knowing which order of magnitude you are in, and which assumption matters.

### Learning objectives

- Convert daily activity into rates, peaks, and storage, with units at each step.
- Keep key reference numbers in memory: seconds per day, latency scales, and transfer rates.
- Size servers, memory, storage, and bandwidth, including headroom and failure capacity.
- Check an estimate with a second method and spot unit errors.
- Use an estimate to reject or accept a design.

## Production scenario

A team proposes a URL shortener with a Cassandra cluster, a Kafka pipeline, and a regional cache tier, estimated at 40 servers across three regions. Before approving it, a reviewer takes five minutes. With 100 million daily users, 0.1 creates and 10 redirects each per day, the system does 116 writes per second and 11,574 reads per second on average. At a 3 times peak, that's 347 writes and 34,722 reads per second. Each record is 500 bytes, so 5 years at 3 replicas is 27.4 TB, and with a 90% cache hit ratio, the database sees 3,472 reads per second.

This shows that the writes are small. A single modern relational primary can plausibly carry 347 writes per second, 27 TB fits a handful of shards, and the read load falls mostly on a cache. So the hard problem is global read latency, not write throughput, and Kafka isn't needed for the core path. The design shrinks by half. An estimate didn't prove anything, but it directed the discussion at the right problem. All figures are from this lesson's example.

## Mental model

### Analogy

Think about how a contractor sizes a job. They walk through a house and say "about 200 square meters, two weeks, and roughly a truckload of plaster". That's not a quote, but it's accurate enough to know whether the budget is viable and if a single van will do.

### Where the analogy breaks

Houses don't grow by 8% per month, and plaster doesn't have a heavy-tailed size distribution. Software's bad cases can also dominate: an average request may be cheap while 1% are hundreds of times as costly. So a software estimate must cover peak, skew, and failure, which is more than just volume. Unlike a contractor, you can also measure later at low cost, so replace estimates with measurements as soon as you can.

### Entities, state, flow, and invariants

- **Entities:** users, actions, requests, objects, bytes, servers.
- **State:** the assumptions list, and the current estimate.
- **Flow:** users to actions per day, to mean rate, to peak rate, then to servers, memory, storage, and bandwidth.
- **Invariant 1:** every number has a unit, and units cancel correctly.
- **Invariant 2:** every assumption is stated, so another person can change it.
- **Invariant 3:** every answer drives a decision. If it doesn't change anything, don't calculate it.

## Foundations

### Concepts and terminology

| Quantity | Useful round value |
| --- | --- |
| Seconds per day | 86,400, or about 100,000 for quick math |
| Seconds per year | About 31.5 million |
| 1 million requests per day | About 12 per second |
| 1 billion requests per day | About 12,000 per second |
| 1 Gbit/s | 125 MB/s |
| 1 TB over 1 Gbit/s | About 2.2 hours |
| 1 PB over 10 Gbit/s | About 9.3 days |
| Same-datacenter round trip | Around 0.5 ms |
| Cross-continent round trip | 100 to 200 ms |

Treat the capacity of a server as something to measure. Illustrative working figures: a stateless API server may handle hundreds to thousands of requests per second, a relational primary thousands of simple writes per second, and an in-memory cache hundreds of thousands of operations per second. These vary enormously, so they are starting points only.

### First-principles explanation

Every estimate is a chain of multiplications, in which units cancel like fractions. Users × actions per user per day gives actions per day. Divide by seconds per day, and you get actions per second. Multiply by bytes per action to get bytes per second. If the units at the end aren't what you wanted, there's an error. This cancellation check is the single most powerful error catcher. The TypeScript example turns it into compile-time enforcement.

Errors in a chain of multiplied factors combine, but not as badly as you'd fear: if each of five factors might be off by a factor of 1.5 in random directions, the product is usually within a factor of about 2 to 3. So rough estimates can be surprisingly useful. However, they fall apart with one badly wrong factor, such as a missed fan-out of 30 or a mistaken 10 times in a data size. So look for what dominates, and take the time to get that one right.

Peak, not mean, determines capacity. Storage depends on total writes and retention, and on replication. Memory usually depends on the working set. Bandwidth depends on peak and size. Each resource has its own driver, so one number never sizes a whole system. See [[a7]].

### Mathematics

For the URL shortener:

- Mean writes = 100,000,000 × 0.1 ÷ 86,400 = 115.7 per second.
- Mean reads = 100,000,000 × 10 ÷ 86,400 = 11,574 per second.
- Peak = mean × 3: 347 writes and 34,722 reads per second.
- Daily data = 10,000,000 × 500 B = 5 GB.
- Raw = 5 GB × 365 × 5 = 9.1 TB. With replication = 27.4 TB.
- Peak egress = 34,722 × 500 B × 8 = 139 Mbit/s.
- Cache = 1,000,000,000 reads per day × 0.2 × 500 B = 100 GB.

**Dimensional check:** (req/day) ÷ (s/day) = req/s. (req/s) × (B/req) × (bit/B) = bit/s.

**Sanity check by a second route:** 27.4 TB ÷ 3 replicas ÷ 500 B = 18.25 billion records, and 100,000,000 × 0.1 × 365 × 5 = 18.25 billion. They agree.

### Complexity

An estimate costs minutes. Its calculation grows linearly with the number of factors. The Python tool is O(s) for s steps. Estimation's real complexity is in the interactions: the cost of adding one more assumption is small, but each makes the result harder to check. Keep to the five or so factors that dominate.

## Mechanism

### Normal path

1. State the question: what decision is this for?
2. List assumptions with round numbers, and mark the ones you are unsure of.
3. Compute mean rates by operation, then peak.
4. Apply amplification: fan-out, replication, and cache hit ratios.
5. Compute storage from writes, size, and retention, then replication and overhead.
6. Compute bandwidth and memory.
7. Convert to servers using measured or stated per-server capacity, then add headroom and failure capacity.
8. Check with a second route, and read the results for what they imply about the design.

### State transitions

```mermaid state-estimate | Life of an estimate from guess to measurement | State diagram. An estimate starts as a rough guess, gets reviewed and challenged, is used to choose a design, is then compared with load-test numbers, and is finally replaced by production measurement, which feeds later estimates.
stateDiagram-v2
    [*] --> Rough: assumptions stated
    Rough --> Reviewed: second route and peer check
    Reviewed --> Rough: assumption challenged
    Reviewed --> Used: drives a design decision
    Used --> Tested: load test supplies per-server numbers
    Tested --> Measured: production traffic replaces estimates
    Measured --> Rough: next feature or growth estimate
```

An estimate has value when it is replaced. Teams that keep a launch-time estimate in a capacity plan long after launch are effectively ignoring data they already have.

### Concurrency behavior

Convert rates into concurrency, using Little's Law: in-flight = rate × duration. 34,722 reads per second at 20 ms means 694 concurrent requests. So 100 worker threads per server implies at least 7 servers for concurrency, however little CPU they use. Connections, threads, and memory per connection may each be the limit before CPU. See [[a8]].

### Ordering and consistency

Consistency requirements multiply costs. Three synchronous replicas turn one logical write into three physical writes, and quorums add latency. Ordering requirements restrict parallelism, which changes how many workers a queue needs. Include these multipliers in the estimate.

### Ownership of data and control

The person who proposes a design owns its estimate. Each team should own the per-server numbers for its tier, based on load tests. Product owns growth assumptions. Sharing the assumptions along with the result lets anyone challenge the part that they know best.

## Architecture

```mermaid context | Context: how an estimate connects requirements and design | Flowchart. Requirements, product forecasts, and measured traffic feed the estimate. The estimate outputs rates, storage, memory, bandwidth, and server counts. These feed a design decision, cost estimate, and load test targets. Load test results return as per-server capacity.
flowchart LR
    R["Requirements: users, retention"] --> E["Estimate: assumptions visible"]
    P["Product forecast"] --> E
    T["Traffic measurements"] --> E
    E --> O["Rates, storage, memory, bandwidth, servers"]
    O --> D["Design decision"]
    O --> C["Cost estimate"]
    O --> L["Load test targets"]
    L -->|"measured per-server capacity"| E
```

The return arrow from load tests improves the estimate's weakest input. On a first pass, per-server capacity is a guess, and it's what most often proves wrong. Early, cheap benchmarks of the riskiest component pay off quickly.

```mermaid component | Component view of the estimator and unit-safe library | Flowchart. A client posts a JSON workload to FastAPI, which validates with Pydantic and runs the estimate function, returning steps with formulas and units. Separately, the TypeScript library uses branded types so unit mismatches fail at compile time.
flowchart LR
    C["curl or CI job"] -->|"HTTP POST /estimate, JSON"| F["FastAPI route"]
    F --> V["Pydantic Workload: validation"]
    V --> ES["estimate function"]
    ES --> ST["Steps: name, formula, value, unit"]
    ST -->|"JSON"| C
    TSC["TypeScript compiler"] --> BR["Branded types: Bytes, PerSecond, BitsPerSecond"]
    BR -->|"mismatch is a compile error"| X["Unit errors rejected before run"]
```

Returning every step means that a reviewer can find the wrong line and not just distrust the bottom line. In a design review, that's the difference between an argument and a correction.

```mermaid sequence | Sequence: estimating during a design interview | Sequence diagram. A candidate states users and action assumptions, and the interviewer confirms. The candidate computes rates and storage aloud, then states the implication: reads dominate and storage fits a few shards. The interviewer changes an assumption and the candidate adjusts.
sequenceDiagram
    participant C as Candidate
    participant I as Interviewer
    C->>I: I'll assume 100M daily users, 10 reads, 0.1 writes
    I-->>C: Reasonable
    C->>C: 1B reads per day is about 12K per second, 36K at peak
    C->>C: 10M writes per day times 500 B is 5 GB per day
    C->>I: So 27 TB in 5 years with 3 replicas. Reads dominate
    C->>I: A cache matters most. A few shards are enough
    I-->>C: What if links were 100x more popular?
    C->>I: Reads become 3.6M per second, and the cache becomes the bottleneck
```

The important message is the fifth one: "so". A number that doesn't change the design isn't worth saying out loud. The last exchange shows why stated assumptions matter: they let you recompute in seconds rather than starting over.

```mermaid failure-path | Failure path: a unit error reaches production | Flowchart. An estimate treats 1 Gbit/s as 1 GB/s. A backfill is scheduled for 3 hours but needs 24 hours and saturates the network. Production traffic is hurt. A second-route check or unit-typed calculation would catch it at review.
flowchart TD
    A["Design says link is 10 GB/s, but it is 10 Gbit/s"] --> B["Backfill planned: 100 TB in 3 hours"]
    B --> C["Actual time at full link: 22 hours"]
    C --> D["Backfill saturates link during peak"]
    D --> E["Production latency rises"]
    A -.->|"caught by unit check at review"| F["Throttle and schedule over several nights"]
```

A factor of 8 went unnoticed because both numbers looked plausible. Calculation: 100 TB ÷ 1.25 GB/s = 80,000 s = 22.2 hours, compared with 2.8 hours under the wrong unit. The dashed route is the five-minute check that would have prevented this.

## Trade-offs

### Advantages

- Very cheap compared with building or testing.
- Exposes the assumption that matters most.
- Gives a shared language for reviewing designs.
- Works before any traffic exists.

### Costs

- Can give false confidence if an assumption is badly wrong.
- Ignores non-linear effects such as contention and tail behavior.
- Round numbers can hide important details in cost-sensitive designs.

### Alternatives

- **Spreadsheet model:** better for sensitivity analysis. See [[a2]].
- **Load test:** real numbers, higher cost. See [[a108]].
- **Queueing simulation:** captures variance. See [[a8]].
- **Prototype benchmark:** tests one risky number directly, and it's often the best next step.

### When to use it

At the beginning of any design, in reviews, in interviews, and any time someone cites a number that seems surprising.

### When not to use it

Don't use an estimate as a final capacity plan for an important launch, and don't use one to compare designs that differ by 20%, since that's inside its error. When production data exists, use it.

### Reconsider when

- A load test contradicts per-server assumptions.
- Traffic mix or object sizes change.
- A result lands near a design threshold, in which case measure rather than estimate.

## Capacity planning

### Inputs and assumptions

From the scenario: 100M daily users, 0.1 writes and 10 reads each, 500-byte objects, a peak-to-mean ratio of 3, 5-year retention, 3 replicas, 90% hit ratio, a 20% working set, and 5,000 requests per second per server. Every value here is an assumption.

### Formula and units

- Peak total (req/s) = (reads + writes per user per day) × DAU ÷ 86,400 s × peak ratio.
- Servers = peak total ÷ per-server capacity.
- Stored bytes = writes per day × bytes × 365 × years × replicas.

### Intermediate calculations

- Peak total: 34,722 + 347 = 35,069 requests per second.
- At capacity: 35,069 ÷ 5,000 = 7.01 servers.
- With 30% headroom: 7.01 ÷ 0.7 = 10.02.
- Surviving one of three zones: 10.02 × 3 ÷ 2 = 15.03, rounded up to 16.

### Headroom

Thirty percent is a placeholder for forecast error and deployment churn. In practice, derive headroom from forecast accuracy and the latency target, because a stricter target means lower safe utilization. See [[o90]].

### Failure capacity

Losing one of three zones leaves two-thirds of capacity, so scale by 3 ÷ 2. For a cache, also ask what happens if the cache fails: a hit ratio falling from 90% to 0% takes database reads from 3,472 to 34,722 per second, ten times more. The cache is therefore load-bearing, and you need a plan for this. See [[a104]].

## Failure modes

:::failure Bits and bytes confused
Trigger: Bandwidth in bits gets compared with data sizes in bytes.
Symptoms: Transfers take 8 times longer than planned, and links saturate.
Blast radius: Migrations, backups, and traffic sharing the link.
Detection: Write units on every line and compare with a real transfer.
Mitigation: Throttle the transfer and reschedule it.
Recovery: Redo the plan using correct numbers.
Prevention: Use unit-typed calculations and peer review.
:::

:::failure Mean used in place of peak
Trigger: Servers are sized by daily average.
Symptoms: Saturation at predictable daily peaks.
Blast radius: Whole service during peak hours.
Detection: Compare with hourly traffic and measured peak-to-mean ratio.
Mitigation: Scale up and defer non-critical work.
Recovery: Re-plan using measured peak.
Prevention: Require a stated peak ratio. See [[a3]].
:::

:::failure Hidden multiplier ignored
Trigger: Fan-out, replication, retries, or indexes are left out.
Symptoms: Actual load or storage is many times the estimate.
Blast radius: Dependencies receiving the extra load, and budget.
Detection: Compare traced calls per request and actual storage with the plan.
Mitigation: Add capacity and reduce fan-out where possible.
Recovery: Correct the model and re-derive plans.
Prevention: Include a multiplier checklist in each estimate.
:::

:::failure Per-server capacity was a guess
Trigger: A blog figure or default stands in for your workload.
Symptoms: The system saturates far below the expected rate.
Blast radius: Launch, and every plan using that number.
Detection: Benchmark the riskiest component early.
Mitigation: Limit launch traffic.
Recovery: Measure and resize.
Prevention: Label guesses, and replace them with load-test results. See [[a108]].
:::

:::failure False precision
Trigger: A rough estimate gets reported as "4,387 servers" and turned into a commitment.
Symptoms: Long-term budgets built on unverified assumptions.
Blast radius: Budget and credibility.
Detection: Ask for the range and for the assumptions behind it.
Mitigation: Restate it as a range, with named uncertainties.
Recovery: Refine it using measurements before committing.
Prevention: Round results, and always give low and high cases.
:::

## Security and privacy

### Threats

Estimates usually cover only legitimate traffic. Add abuse: bots, scraping, and credential stuffing can dominate some systems. A URL shortener can be used to host phishing links, so write volume may be driven by abusers. Estimate the cost of a denial-of-service attack on your most expensive route too. See [[o54]].

### Trust boundaries

Security controls have a cost that belongs in the estimate: a web application firewall adds a hop, TLS termination uses CPU, and audit logs add storage. Estimate per boundary crossing.

### Authentication and authorization

Authorization checks multiply traffic to identity services. At 35,000 requests per second, one uncached check per request means 35,000 requests per second to the authorization service. Estimate that explicitly, along with its cache hit ratio.

### Tenant isolation

Estimates based on average tenants fail when one tenant is 1,000 times larger. Estimate the largest tenant separately, and decide whether it gets dedicated capacity. See [[a180]].

### Sensitive data

Retention drives storage, and retention also has a legal side. Don't assume that keeping everything is free or allowed. Deletion, encryption overhead, and regional duplication for residency can all change the numbers. See [[a142]].

### Abuse resistance

Add a line for abuse in each estimate. For example, assume 10% extra traffic from automated clients, then compare that with the rate limits you plan to enforce. Limits themselves need capacity, as counters must be stored and checked.

## Observability

### Metrics

After launch, compare each estimated number with its measured counterpart: requests per second by operation, peak-to-mean ratio, object size, storage growth, cache hit ratio, and per-server saturation.

### Logs

Keep the estimate with the design record, including its assumptions. Log object sizes, or sample them, so that average and tail sizes can be measured.

### Traces

Use traces to measure the fan-out multiplier that estimates usually have to guess. Track it over time by route.

### Dashboards

An "estimate versus actual" view shows predicted and measured values, the ratio between them, and the date. This builds organizational calibration, and makes bad assumptions easy to find.

### Alerts

Send a ticket if actual load exceeds the plan by 25%, or if storage growth would exhaust capacity within your procurement lead time. Forecast-based alerts should not page anyone.

### SLO examples

- Capacity forecasts for tier-1 services are within 25% of actual at 3 months.
- At least 30 days of notice before forecast storage exhaustion.
- Peak utilization of the bottleneck resource stays under the planned level for 99% of days.

### Runbook actions

If actuals exceed the estimate: find which assumption broke, check for abuse or retries, adjust capacity, and update the model. If actuals fall far short, consider scaling down and record why.

## Implementation

### Architecture of the examples

Python exposes the estimator through FastAPI, because a shared service or CI job can use it directly, and it also offers a command-line report. TypeScript takes a different angle: branded types prevent unit errors at compile time, a strength Python's runtime approach doesn't have.

### Data structures

`Workload` validates inputs, and `Step` records name, formula, value, and unit. A list of steps is the main output, since showing work is the point. In TypeScript, `Bytes`, `PerSecond`, and `BitsPerSecond` are numbers at runtime with a compile-time brand, so they have no overhead.

### Interfaces

`POST /estimate` accepts a workload and returns `{ steps, summary }`. `GET /healthz` reports health. `python -m app.main` prints a table for the sample. TypeScript exports constructors such as `mb` and `gbps`, plus conversions such as `transferTime`.

### Error handling

Pydantic turns invalid values into HTTP 422 with field details, and a validator rejects workloads with no traffic. TypeScript rejects negative values at runtime with `EstimateError`, and rejects unit mix-ups at compile time. A test uses `@ts-expect-error`, so `tsc` fails if the type protection ever stops working.

### Concurrency considerations

`estimate` is a pure function that shares no state, so FastAPI can serve it concurrently without locks. It is CPU-only and quick, and `def` routes run in a thread pool, so it doesn't block the event loop.

### Educational limitations

The model has one storage class and one server tier, with no write amplification, index overhead, or compression. Peak ratio is one number for all operations. Per-server capacity is an input, and the tool can't validate it.

### Production hardening

Add authentication if exposed, include per-tier capacity and overhead factors, run low, base, and high cases, version the assumptions, and compare with actual metrics automatically.

## Terminal lab

### Setup

```bash
cd topics/back-of-the-envelope-capacity-estimation/examples/python
uv sync --quiet
```

### Run

Print the sample estimate:

```bash
uv run python -m app.main
```

Start the API, then in a second terminal try a change: multiply users tenfold, and compare what changes:

```bash
uv run uvicorn app.main:app --port 8000
```

```bash
curl -s localhost:8000/estimate -H 'content-type: application/json' -d '{"daily_active_users":1000000000,"writes_per_user_per_day":0.1,"reads_per_user_per_day":10,"object_size_bytes":500,"response_size_bytes":500,"cache_hit_ratio":0.9,"rps_per_server":5000}' | jq .summary
```

See how invalid input is reported:

```bash
curl -s localhost:8000/estimate -H 'content-type: application/json' -d '{"daily_active_users":-1}' | jq '.detail[0] | {loc, msg}'
```

Run the unit-safe report:

```bash
cd ../typescript && pnpm install --ignore-workspace --silent && pnpm --silent start
```

### Test

```bash
cd ../python && uv run pytest -q
```

```bash
cd ../typescript && pnpm run check && pnpm test
```

### Expected output

The sample report contains these lines, measured on the review date:

```text
mean writes                     115.7 req/s
mean reads                   11,574.1 req/s
peak reads                   34,722.2 req/s
peak database reads           3,472.2 req/s
new data per day                     5.0 GB
replicated storage                  27.4 TB
cache memory                       100.0 GB
servers at capacity             7.0 servers
surviving one zone             15.0 servers
```

The TypeScript report prints 5.8 k uploads per second, 92.6 Gbit/s of upload bandwidth, 365 PB per year, 2.2 hours for 1 TB over 1 Gbit/s, and 9.3 days for 1 PB over 10 Gbit/s.

While writing this lesson, the author's own first test asserted 274 TB instead of 27.4 TB, and the test failed. A tenfold slip like that looks reasonable on paper, which is why every estimate needs a second route.

### Cleanup

Stop uvicorn with Ctrl-C, then:

```bash
rm -rf .venv ../typescript/node_modules
```

### Troubleshooting

- `Address already in use`: choose another port with `--port`.
- 422 from the API: read `.detail`, which names the invalid field.
- If you see a deprecation warning from `TestClient` during tests, it comes from a dependency and doesn't affect results.

## Practical challenges

:::challenge Concept | Which resource limits this?
A photo service has 10M uploads per day at 2 MB each, 500M views per day at 200 KB each, and keeps everything for 10 years with 3 replicas. Calculate peak upload and view bandwidth at a peak ratio of 3, and total storage. Which is the hardest resource?
>>> Hint
Work out bytes per second first, then multiply by 8.
>>> Solution
Uploads: 10M × 2 MB = 20 TB per day, or 231 MB/s mean, 694 MB/s peak, or 5.6 Gbit/s. Views: 500M × 200 KB = 100 TB per day, or 1.16 GB/s mean, 3.47 GB/s peak, or 27.8 Gbit/s. Storage: 20 TB × 3,650 × 3 = 219 PB. Storage is the dominant cost and drives the use of tiered object storage. Viewing bandwidth points to a CDN.
>>> Common mistakes
Forgetting replication, or using the mean for bandwidth. Treating raw bandwidth as the problem when storage cost dominates.
:::

:::challenge Debugging | Find the errors
A design document says: "5M users each send 40 messages per day: 200M per day, which is 2,300 per second. Each is 1 KB, so 2.3 MB/s, so 2.3 Mbit/s of bandwidth. Storage for 2 years: 2.3 MB × 365 × 2 = 1.7 GB." Find the errors and correct them.
>>> Hint
Check units on every line. There are at least two errors. Look at the storage formula closely.
>>> Solution
Rate is correct: 200M ÷ 86,400 = 2,315 per second. Throughput of 2.3 MB/s is correct. Bandwidth is wrong: 2.3 MB/s × 8 = 18.5 Mbit/s. Storage is wrong: it multiplied a per-second rate by days. Correct: 200M × 1 KB = 200 GB per day, × 730 days = 146 TB, before replication, or 438 TB with 3 replicas. The error is a factor of about 85,000. Peak is missing also, at 3 times about 55 Mbit/s.
>>> Common mistakes
Spotting only the bits-and-bytes error and missing the far larger one in storage. Forgetting that message fan-out and delivery aren't included.
:::

:::challenge Capacity | Size a timeline cache
A service has 50M daily users, each loading their timeline 20 times per day. A timeline is 800 ids at 8 bytes. Cache timelines for 20% of daily users. Compute cache memory and peak reads at a peak ratio of 4. If each cache node holds 64 GB of usable memory and serves 100,000 reads per second, how many nodes do you need, and which constraint decides?
>>> Hint
Compute the node count separately for memory and throughput, and then take the larger.
>>> Solution
Timeline size: 800 × 8 B = 6.4 KB. Cached timelines: 10M. Memory: 10M × 6.4 KB = 64 GB, or 1 node. Reads: 50M × 20 = 1B per day, or 11,574 per second mean, 46,296 at peak, or less than 1 node. So 1 node suffices on paper for both. For availability, you'd use at least 3 replicated nodes. Neither memory nor throughput is the deciding constraint: availability is.
>>> Common mistakes
Reporting only the math and forgetting availability. Missing that memory overhead makes 64 GB of data not fit in 64 GB exactly.
:::

:::challenge Design | Should this be sharded?
A SaaS app has 200,000 tenants, a 3 TB relational database that's growing at 40 GB per month, and a peak of 2,000 writes and 15,000 reads per second. The team wants to shard now. Using estimates, argue for or against this, and state which numbers you would measure to confirm.
>>> Hint
Project storage and load forward over 2 years, compare with what a large single instance plus replicas offers, and consider the migration cost.
>>> Solution
In two years, storage reaches 3 TB + 960 GB ≈ 4 TB, which is within a large single instance's capability. Reads can go to replicas and a cache. Writes at 2,000 per second are plausible on modern hardware, depending on the row size and indexes. So the initial answer is don't shard yet. Measure: write saturation, lock contention, replication lag, largest-tenant share, and vacuum or compaction load. Do prepare: add tenant IDs on all tables so that sharding stays possible later. Re-evaluate when write capacity reaches about 50%.
>>> Common mistakes
Stating "sharding is needed at scale" with no numbers. Forgetting the ongoing costs of sharding, like cross-shard queries.
:::

:::challenge Incident | The backfill that took the site down
A backfill rewrites 50 TB over a 10 Gbit/s link shared with production, which peaks at 6 Gbit/s. It was planned as "about 6 hours". What should the estimate have said? How would you run it safely?
>>> Hint
10 Gbit/s is 1.25 GB/s, and only the spare capacity is available.
>>> Solution
At full link speed: 50 TB ÷ 1.25 GB/s = 40,000 s, or 11.1 hours. So the planned 6 hours would be impossible even if production were idle. During peak, only 4 Gbit/s (500 MB/s) is free, and with safety at 2 Gbit/s, it takes 50 TB ÷ 250 MB/s = 200,000 s = 55.6 hours. Safe plan: throttle to a rate tied to measured production traffic, run off-peak when possible, add a kill switch, watch latency, and resume from checkpoints. See [[a61]].
>>> Common mistakes
Blaming the network. Using full bandwidth with no margin for production, and having no way to pause the job.
:::

## Industry standards and trends

### Standards and specifications

[SI prefixes from NIST](https://www.nist.gov/pml/owm/metric-si-prefixes) and [binary prefixes](https://physics.nist.gov/cuu/Units/binary.html) define MB and MiB, a 4.9% difference at mega scale and 12.6% at peta scale. This lesson uses decimal units. Most vendors bill storage in one or the other, so read carefully.

### Established practice

[Non-Abstract Large System Design](https://sre.google/workbook/non-abstract-design/), from *The Site Reliability Workbook*, 2018, walks through estimating real hardware from requirements. [Interactive Latency Numbers](https://colin-scott.github.io/personal_website/research/interactive_latency.html), maintained by Colin Scott, gives year-adjusted latency estimates, whose later values are extrapolations and not measurements.

### Managed-service options

Cloud pricing calculators convert estimates to cost, and they're vendor tools, so they don't validate assumptions. Managed services change your unit from servers to quota units, so read how each service defines its capacity unit.

### Emerging approaches

Language models can produce fast estimates, and they also make unit and arithmetic errors that look plausible. Treat any such output as a draft, then check it using a second route. For AI systems, estimate in tokens and GPU time rather than in requests, as these differ greatly by request. This is an observation from current practice, with no established standard.

### Recent changes

Hardware figures shift steadily, particularly for NVMe and network speeds, so memorized numbers from older lists can be off by an order of magnitude. Re-baseline with your own benchmarks.

### Adoption constraints

Round numbers can be misused as commitments, so separate estimates from budgets. Sharing assumptions openly requires a culture where being corrected is normal.

## Interview preparation

:::q Foundational | How do you convert daily users into requests per second?
**Strong answer.** Daily users × actions per user ÷ 86,400, using about 100,000 for quick math. Then multiply by a peak ratio. 100M users at 10 actions each is 1B per day, or about 12,000 per second mean, and around 36,000 at a 3 times peak.

**Why it is asked.** It's the first step of almost every estimate.

**Weak-answer warning signs.** Stopping at the mean, or being unable to do this without a calculator.

**Follow-up.** What determines the peak ratio?
:::

:::q Foundational | How much storage does a service need?
**Strong answer.** Writes per day × size × retention × replication, plus overhead for indexes. I would state assumptions and check by computing total record count separately. Then I'd decide on tiering if most data is rarely read.

**Why it is asked.** It checks that you remember replication and retention.

**Weak-answer warning signs.** Forgetting replication or indexes.

**Follow-up.** What is a typical index overhead, and how would you find out for your system?
:::

:::q Foundational | What is the difference between Gbit/s and GB/s, and why does it matter?
**Strong answer.** A byte is 8 bits, so 1 Gbit/s is 125 MB/s. It matters because links are quoted in bits and files in bytes, and confusing them gives an error of 8 times. 1 TB takes 2.2 hours over 1 Gbit/s, not 17 minutes.

**Why it is asked.** It's a very frequent error in practice.

**Weak-answer warning signs.** Hesitation over the conversion.

**Follow-up.** What practical overhead reduces real throughput further?
:::

:::q Senior | How do you decide what to estimate?
**Strong answer.** Whatever could change a decision. I work out which resources could be a bottleneck and check those first. If storage is obviously small, I say so and move on. I'd rather spend time on the one assumption that decides the architecture.

**Why it is asked.** Interviewers want judgment, and not arithmetic for its own sake.

**Weak-answer warning signs.** Calculating everything in equal detail, with no conclusion.

**Follow-up.** Give an example where the estimate changed your design.
:::

:::q Senior | How do you know if an estimate is right?
**Strong answer.** Use a second method, such as total records against storage, or per-server against fleet. Compare with known systems of similar size. Check units. Then replace the riskiest number with a benchmark, and later with production data.

**Why it is asked.** Checking is what separates estimation from guessing.

**Weak-answer warning signs.** Never revisiting numbers.

**Follow-up.** Your two methods differ by 10 times. What do you do?
:::

:::q Senior | What multipliers do people forget?
**Strong answer.** Fan-out, replication, write amplification, retries, indexes, cache misses after a restart, and overhead for TLS or serialization. Each can be several times on its own. I keep a checklist, and I use traces to measure fan-out.

**Why it is asked.** These are what make real load differ from expected.

**Weak-answer warning signs.** Reasoning only from user-level actions.

**Follow-up.** How does a cache failure change database load?
:::

:::q Senior | How do you estimate the number of servers without knowing per-server capacity?
**Strong answer.** I state a working assumption, compute a range with low and high values, and identify what the range implies. Then I'd propose a quick benchmark. I also use concurrency: rate × duration gives in-flight requests, which can limit you before CPU does.

**Why it is asked.** It reveals how you handle missing information.

**Weak-answer warning signs.** Quoting a memorized figure as fact.

**Follow-up.** Which is more likely to run out first for a slow-dependency service: CPU or threads?
:::

:::q Staff | How do you estimate the cost of a design?
**Strong answer.** Multiply each resource by a unit price: compute, memory, storage tier, and especially egress, which people often forget. Then add operational cost. I'd express it per request or per user, since that scales. I would state a range, and I would look at the largest line first.

**Why it is asked.** Cost is a core design constraint at this level.

**Weak-answer warning signs.** Ignoring egress or people's time.

**Follow-up.** Egress dominates. What design options reduce it?
:::

:::q Staff | When is an estimate not good enough?
**Strong answer.** When the result is near a threshold, when a decision is expensive to reverse, or when the system has non-linear behavior such as contention. In those cases I measure with a prototype or a load test. Comparing two designs within 20% of each other needs more than arithmetic.

**Why it is asked.** It tests awareness of the tool's limits.

**Weak-answer warning signs.** Overconfidence in arithmetic alone.

**Follow-up.** What would you measure in a one-week prototype?
:::

:::q Staff | How would you improve estimation across your organization?
**Strong answer.** Keep estimates in design records and compare them with actual numbers later. Publish benchmark figures for shared components, and provide a template with a multiplier checklist. Over time, teams calibrate, and the review can focus on the assumptions and not the arithmetic.

**Why it is asked.** It moves from personal skill to organizational capability.

**Weak-answer warning signs.** Expecting everybody to be good at it unaided.

**Follow-up.** What would a useful table of internal benchmarks contain?
:::

:::q Principal | Leadership wants a multi-year infrastructure budget from early estimates. How do you respond?
**Strong answer.** I would provide ranges with named assumptions and the business events that move them, and show which decisions are needed now versus later. I would stage commitments tied to measured milestones, and be explicit about which numbers are measured and which are guesses. This turns a false single number into a managed risk.

**Why it is asked.** Principals translate technical uncertainty into funding decisions.

**Weak-answer warning signs.** Giving one number, or refusing to give any.

**Follow-up.** Finance insists on one number. What do you give them?
:::

:::q Principal | A respected engineer's estimate looks wrong, in a review full of people. How do you handle it?
**Strong answer.** I would ask about the assumption rather than attack the conclusion: "What are we assuming for fan-out?" Then compute together, or use a second route. If it's a real issue, it comes out as a shared finding. The aim is a correct decision, and a culture in which numbers can be challenged safely.

**Why it is asked.** Technical accuracy and influence go together at this level.

**Weak-answer warning signs.** Staying quiet, or trying to win publicly.

**Follow-up.** The discussion goes beyond the time available. How do you close it?
:::

## Review

### Key takeaways

- Each estimate exists to serve a decision.
- Write units on every line, and let them cancel.
- Use peak for capacity, retention and replicas for storage, and the working set for memory.
- Remember the multipliers: fan-out, replication, retries, and indexes.
- Check using a second route, because tenfold errors look reasonable.
- Replace estimates with measurements as soon as you can.

### Decision checklist

- [ ] What decision does this estimate serve?
- [ ] Are all assumptions stated, and the uncertain ones marked?
- [ ] Have I included peak, multipliers, headroom, and failure?
- [ ] Have I checked it a second way?
- [ ] What does it imply about the design?

### Production-readiness checklist

- [ ] Per-server capacity comes from a load test.
- [ ] Estimated and actual numbers are compared on a dashboard.
- [ ] Storage exhaustion has a forecast and lead time.
- [ ] Cache failure load has been calculated and planned for.
- [ ] Large transfers are throttled and have a kill switch.

### Glossary

- **Peak-to-mean ratio:** the highest rate divided by the average rate.
- **Fan-out:** internal calls per external request.
- **Working set:** the data accessed within a period.
- **Dimensional analysis:** checking that units cancel correctly.
- **Headroom:** spare capacity for forecast error and churn.

### Quiz

:::quiz About how many requests per second is 1 billion per day?
- 1,200
- *12,000
- 120,000
- 1,200,000
1,000,000,000 ÷ 86,400 ≈ 11,574, or about 12,000.
:::

:::quiz How long does 1 TB take over a 1 Gbit/s link at full speed?
- 17 minutes
- 1 hour
- *2.2 hours
- 8 hours
1 Gbit/s is 125 MB/s, and 1,000,000 MB ÷ 125 MB/s = 8,000 s.
:::

:::quiz Writes are 10M per day at 500 bytes, kept for 5 years, with 3 replicas. What is total storage?
- 2.7 TB
- *27.4 TB
- 274 TB
- 2.7 PB
5 GB × 1,825 days = 9.1 TB, and × 3 = 27.4 TB. The third option is an easy tenfold slip.
:::

:::quiz With a 90% hit ratio and 35,000 reads per second at peak, how much load falls on the database if the cache fails completely?
- 3,500 reads per second
- 7,000 reads per second
- *35,000 reads per second
- It's unchanged.
Ten times normal, which is why a cache this effective is load-bearing.
:::

:::quiz Which is the best next step when a capacity estimate lands right at a design threshold?
- Round it up and ship.
- Take the average of two guesses.
- *Measure the deciding number with a benchmark or prototype.
- Ignore the threshold.
Estimates are too rough to decide close cases. Measure the factor that matters.
:::

### Further study

Continue with [[a7]] for the details of storage and bandwidth, [[a6]] for finding bottlenecks, and [[a8]] for queueing. [[a200]] turns these resource figures into money.
