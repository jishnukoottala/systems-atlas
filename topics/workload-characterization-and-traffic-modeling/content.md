lastReviewed: 2026-11-03

## Orientation

### Definition

Workload characterization is measuring how a system is actually used: request rates over time, the mix of operations, how traffic spreads across keys and tenants, how large the objects are, and how users' sessions behave. Traffic modeling turns those measurements into a forecast that can be used to size and test a design.

### Why it matters

Averages conceal almost everything that breaks production. A service averaging 1,000 requests per second may peak at 8,000 for 90 seconds, send 40% of its traffic to 0.1% of its keys, and serve a few objects 1,000 times larger than the median. Each of those features selects a different design: bursts call for queues or headroom, key skew calls for caching and hot-key handling, and size variance calls for separate paths for large objects. Without characterization, a load test can also pass while proving nothing, because it tests a workload that does not exist.

### Learning objectives

- Describe a workload in terms of rate, mix, distribution, size, and time correlation.
- Compute peak-to-mean ratio, read ratio, key skew, and size percentiles from a trace.
- Explain why averages mislead for heavy-tailed distributions.
- Recognize open and closed workloads and how each one behaves under overload.
- Turn a measured profile into a growth forecast and a realistic test.

## Production scenario

A photo-sharing service plans to shard its metadata store. The design uses a mean of 12,000 reads and 800 writes per second, hash-partitioned by photo ID across 32 shards, so each shard gets 400 requests per second. After launch, three shards regularly hit 90% CPU while the others stay at 15%.

A trace from the load balancer explains why. The peak-to-mean ratio is 3.4, because of a daily evening peak, and it reaches 11 during live events. The top 0.1% of photos receive 38% of reads, and a celebrity post can reach 40,000 reads per second by itself. Hash partitioning spreads keys evenly, but not load. Object sizes are bimodal: most metadata rows are near 400 bytes, but rows with long comment threads go past 1 MB, and those block the event loop for long stretches. None of this appeared in the mean, and two days of log analysis would have revealed all of it before the migration.

## Mental model

### Analogy

Consider planning a road network. Knowing that a city averages 50,000 trips per day tells you little. You need to know the rush-hour peak, which junctions get most of the traffic, the fraction of heavy trucks, and how a stadium event changes things. Traffic engineers count cars by junction, hour, and vehicle type for this reason.

### Where the analogy breaks

Drivers react to congestion by choosing another route or staying home, and many software clients do the reverse: they retry, adding load exactly when the system is slow. Software traffic can also jump 100-fold in minutes, and a single bot may send more than a city's worth of users. Roads don't have traffic spikes caused by one celebrity's post.

### Entities, state, flow, and invariants

- **Entities:** clients, sessions, requests, keys, tenants, objects, time windows.
- **State:** the current arrival rate, popularity ranking, and data size, all of which drift.
- **Flow:** raw logs, then a sample or a stream of counters, then a profile, then a model, then a forecast and test.
- **Invariant 1:** a profile states the window and population it came from.
- **Invariant 2:** a test workload reproduces the distribution, not only the mean.
- **Invariant 3:** forecasts carry a range and date, then get compared to what actually happened.

## Foundations

### Concepts and terminology

| Term | Meaning | Design consequence |
| --- | --- | --- |
| Peak-to-mean ratio | Highest short-window rate ÷ average rate | Headroom, autoscaling, queues |
| Read/write ratio | Mix of operations | Replicas, caching, storage engine |
| Skew | Unequal access across keys | Hot keys, cache value, partitioning |
| Zipf distribution | Frequency of rank r is proportional to 1 ÷ r^s | Small caches can catch much traffic |
| Heavy tail | Rare large values dominate the total | Averages mislead, separate large objects |
| Burstiness | Short-term clustering of arrivals | Queue sizing, more than rate alone suggests |
| Diurnal pattern | Daily cycle | Regional peaks, scaling schedules |
| Working set | Data touched in a window | Memory and cache sizing |
| Open workload | Arrivals do not depend on completions | Queues can grow without limit |
| Closed workload | Fixed clients wait for each response | Self-throttles, and hides overload |

### First-principles explanation

A workload is a joint distribution over who asks, for what, when, and how much. A single number compresses this and throws away the variation that governs system behavior. Queues form because of variation, not only because of the mean rate: even a system that has spare capacity on average will have queueing when requests clump, as covered in [[a8]].

Skew has opposite effects on different components. It helps caches, because a few keys account for most reads, and it hurts partitioning, because those keys land on a single shard. That's why you should measure instead of assuming "more skew is bad" or "more skew is good". The same applies to time: a 1-minute average can hide a 1-second burst that exhausts a connection pool.

The open or closed distinction matters enormously for testing. Most public web traffic is open-like: new users arrive regardless of how slow you are. A closed load generator with 100 threads backs off when the server slows, so it cannot produce the overload that real traffic does. See [[a109]].

### Mathematics

**Peak-to-mean:** PMR = peak rate ÷ mean rate. Always state the window. PMR at 1 s can far exceed PMR at 1 min.

**Zipf share:** with s = 1 and N keys, the share of traffic to the top k keys ≈ ln(k) + 0.577, divided by ln(N) + 0.577. For N = 10,000,000 and k = 10,000: (9.21 + 0.58) ÷ (16.12 + 0.58) = 9.79 ÷ 16.70 ≈ 58.6%. So 0.1% of keys get about 59% of requests under this model.

**Coefficient of variation:** CV = standard deviation ÷ mean. CV near 1 is roughly Poisson-like in interarrival times, and larger values indicate burstiness.

**Growth:** with g% monthly growth, load at month m = L0 × (1 + g)^m. At 8% monthly, doubling takes ln 2 ÷ ln 1.08 ≈ 9 months.

### Complexity

An exact top-K over n requests and d distinct keys takes O(n) time and O(d) memory, which is infeasible for billions of keys. Space-Saving uses O(k) memory for k counters, with error bounded by n ÷ k. Exact percentiles require O(n log n) for sorting, and a histogram takes O(1) per sample at the cost of bucket-width error. A Count-Min sketch is another option, at O(w × d) memory. See [[a106]].

## Mechanism

### Normal path

1. Choose a source: load balancer logs are best for external traffic since they see failures too. Add database slow logs and per-service traces for internal views.
2. Choose a window that includes a full cycle: at least a week, plus known events.
3. Extract timestamp, operation, key or route, tenant, size, status, and latency.
4. Compute rate at several resolutions (1 s, 1 min, 1 h), operation mix, skew, sizes, and session behavior.
5. Segment by route, tenant, region, and client type. Aggregates may hide a dominant client.
6. Build the model: distributions and parameters plus growth assumptions with a range.
7. Validate by replaying or generating traffic and comparing the resulting profile and resource use with production.

### State transitions

```mermaid state-profile | Lifecycle of a workload model | State diagram. A model is drafted from a trace, validated against production, and used for forecasts. When drift is detected it becomes stale and gets remeasured. Unmeasured new features begin as assumed models.
stateDiagram-v2
    [*] --> Assumed: new feature with no traffic
    [*] --> Measured: trace of existing traffic
    Assumed --> Measured: first production data
    Measured --> Validated: replay matches production
    Validated --> InUse: drives sizing and tests
    InUse --> Stale: measured drift exceeds tolerance
    Stale --> Measured: new trace taken
```

A model starts either from data or from a stated assumption, and new features can only begin as assumptions. Validation is where most teams stop short: until a generated workload reproduces production resource use, you only have a hypothesis.

### Concurrency behavior

Request concurrency is itself part of the workload: a fan-out page load sends 30 near-simultaneous requests, and they arrive as a clump. Correlated clients do this at larger scale: mobile apps polling on the hour, cron jobs at midnight, and retries following a blip. Look for spikes aligned to clock boundaries in the per-second data. Adding jitter at clients is frequently the cheapest capacity increase available.

### Ordering and consistency

Logs from several machines arrive out of order and with clock differences, and analyses at 1-second resolution are sensitive to this. Sort by timestamp within a tolerance, or use one measurement point. Sampling also changes results: sample by key or session to keep correlations intact, because random request sampling loses session behavior and understates rare keys.

### Ownership of data and control

The team that owns the service owns its profile. Infrastructure owns aggregate capacity forecasts, which depend on those profiles. Product and marketing own information about future events, and need a route into forecasting. Logs containing user identifiers are subject to privacy controls, so whoever analyzes them must follow data-handling rules.

## Architecture

```mermaid context | Context: from production traffic to design decisions | Flowchart. Clients send traffic through a load balancer to services. Logs flow into a data lake. An analysis job produces a profile, which feeds capacity planning, design review, and load generation. Load generation targets a test environment. Product calendars also feed forecasts.
flowchart LR
    C["Clients"] -->|"HTTPS"| LB["Load balancer: access logs"]
    LB --> S["Services"]
    S --> DB["Datastores: slow logs"]
    LB -->|"log export"| L["Log store: restricted access"]
    DB -->|"log export"| L
    L --> A["Analysis job: anonymizes and aggregates"]
    A --> P["Workload profile: versioned"]
    MK["Product calendar: launches and events"] --> F["Forecast"]
    P --> F
    F --> CP["Capacity plan and design review"]
    P --> G["Load generator"]
    G -->|"replay or model"| T["Test environment"]
```

Taking data at the load balancer captures traffic the application never logged, including requests that timed out. The profile sits between raw logs and its consumers, so people working on capacity do not require direct access to sensitive logs. The product calendar arrow is the one that is usually missing, and that absence is why launches surprise capacity planners.

```mermaid component | Component view of the generator and two analyzers | Flowchart. The Python seeded generator writes NDJSON. The Python batch characterizer loads it all into memory. The TypeScript streaming profiler reads line by line, with a per-second counter, Space-Saving top-K summary, and size histogram.
flowchart LR
    G["Python generator: sine, burst, Zipf, lognormal"] -->|"NDJSON file"| F["trace.ndjson"]
    G --> B["Python characterize: exact, in memory"]
    F -->|"read line by line"| I["TypeScript Profiler.ingest"]
    I --> C1["Per-second counts"]
    I --> C2["Space-Saving top-K: 1,000 counters"]
    I --> C3["Size histogram: power-of-two buckets"]
    C1 --> O["Profile JSON"]
    C2 --> O
    C3 --> O
```

The two analyzers show the common trade-off: exact answers using memory proportional to input, or bounded memory with bounded error. Comparing both on the same file is a good way to see how close an approximation is. The lab has you do so.

```mermaid sequence | Sequence: refreshing a profile before a launch | Sequence diagram. A scheduled job queries log storage for a week of data, computes the profile, and compares it to the last version. On significant drift, it opens a ticket for the owner, who updates the forecast and runs a load test.
sequenceDiagram
    participant J as Scheduled job
    participant L as Log store
    participant P as Profile store
    participant O as Service owner
    participant T as Load test
    J->>L: Query 7 days of access logs
    L-->>J: Aggregated rate, mix, and key counts
    J->>P: Load last profile
    P-->>J: Prior version
    J->>J: Compute drift per metric
    J->>O: Ticket: peak-to-mean rose from 3.1 to 4.6
    O->>T: Run updated model at forecast peak
    T-->>O: Saturation at 78 percent of forecast
    O->>P: Publish new profile and capacity action
```

Refresh is automated, and the judgment is not. The job finds drift and the owner decides what it means. The load test uses the new shape, so it reveals a saturation point that the old profile would have missed.

```mermaid failure-path | Failure path: sized on the mean, broken by the distribution | Flowchart. Capacity is sized from a mean, and shards are hashed by key. A popular item overloads one shard, its latency rises, clients retry, and the overload spreads through shared connection pools. The fix is adding hot-key caching and load limits per key.
flowchart TD
    A["Sized on mean: 400 rps per shard"] --> B["Celebrity post: 40,000 rps on one key"]
    B --> C["One shard saturates"]
    C --> D["Latency rises, clients retry"]
    D --> E["Shared connection pools fill up"]
    E --> F["Unrelated requests fail"]
    C -->|"detected: per-shard CPU imbalance"| G["Add hot-key cache and per-key limits"]
    G --> H["Load is flattened and shard recovers"]
```

The important step is the jump from one shard to unrelated requests, through shared pools. Skew begins as a local problem and spreads through shared resources. The detection path relies on per-shard metrics: a fleet average would hide this entirely. See [[a60]].

## Trade-offs

### Advantages

- Targets design effort at what actually stresses the system.
- Makes load tests and capacity plans believable.
- Often reveals cheap fixes such as adding client jitter, or removing one abusive client.

### Costs

- Log retention and analysis cost money, and there are privacy obligations.
- Detailed profiles go stale, so they require ongoing refresh.
- Too much modeling produces false precision, especially with new products.

### Alternatives

- **Replay real traffic:** the highest fidelity, but it has privacy and state issues. See [[a194]].
- **Synthetic parametric model:** easy to scale and share, but misses correlations.
- **Benchmark standards like YCSB:** comparable across systems, but not your workload.
- **Reasoned estimates:** the only choice for new products. Replace them quickly.

### When to use it

Before sharding, choosing storage, setting autoscaling policies, running a load test, or negotiating committed capacity. Also after any significant product change.

### When not to use it

For a product with too little traffic to matter, a brief check of the logs is enough. For a brand-new product there is nothing to measure, so use estimates and plan a review after launch.

### Reconsider when

- Peak-to-mean or skew has drifted by more than an agreed tolerance, such as 25%.
- A new client type, region, or high-volume tenant appears.
- Test results and production resource use disagree.

## Capacity planning

### Inputs and assumptions

Measured: mean of 12,000 reads and 800 writes per second, a 1-minute PMR of 3.4, top 0.1% of keys getting 38% of reads, a cache hit rate of 85% on reads. Assumed: 8% monthly growth for 12 months and 900 reads per second per shard at safe utilization.

### Formula and units

- Future mean rate = current × (1 + monthly growth)^months, in requests per second.
- Peak rate = future mean × PMR, in requests per second.
- Database reads = peak reads × (1 − hit rate).
- Shards = database reads ÷ reads per shard.

### Intermediate calculations

- Growth factor: 1.08^12 = 2.52.
- Future mean reads: 12,000 × 2.52 = 30,240 per second.
- Peak reads: 30,240 × 3.4 = 102,816 per second.
- Database reads: 102,816 × 0.15 = 15,422 per second.
- Shards: 15,422 ÷ 900 = 17.1, rounded up to 18.
- Using the mean alone gives 30,240 × 0.15 ÷ 900 = 5.04, or 6 shards. That is three times too few.

### Headroom

Add 30% for forecast error: 18 ÷ 0.7 = 25.7, so 26 shards. Since shard counts are expensive to change, many teams round to a convenient power of two, here 32. Note also that a drop in hit rate from 85% to 75% raises database reads by 67%, from 15% to 25% of peak. So the cache's hit rate is itself a capacity assumption.

### Failure capacity

If a cache node fails and hit rate drops to 60%, then database reads are 102,816 × 0.4 = 41,126 per second, needing 46 shards at safe load. Provisioning for this is costly, so the realistic alternatives are protecting the database through load shedding, with the failure budgeted, or keeping cache replicas warm. See [[a112]] and [[a104]].

## Failure modes

:::failure Sizing from the mean
Trigger: Capacity is calculated from daily average rate.
Symptoms: Saturation during predictable peaks, and normal metrics overnight.
Blast radius: The whole service during peaks, and its shared dependencies.
Detection: Graph rate at 1-second and 1-minute resolution, and compare with capacity.
Mitigation: Add capacity, rate-limit batch clients, and shift deferrable work off-peak.
Recovery: Re-plan using measured PMR.
Prevention: Require a peak figure and window in each capacity plan.
:::

:::failure Hidden key skew
Trigger: Hash partitioning is used under the assumption that uniform keys mean uniform load.
Symptoms: A few shards are near saturation while the fleet average looks healthy.
Blast radius: Users whose keys share that shard, and then others via shared pools.
Detection: Track per-partition load and top keys by access count.
Mitigation: Add a hot-key cache, per-key rate limits, or split the hot key.
Recovery: Rebalance and verify load spread by partition.
Prevention: Measure skew before choosing a partition scheme.
:::

:::failure Synchronized clients
Trigger: Clients poll or run jobs on clock boundaries, or retry together.
Symptoms: Sharp spikes at the top of the minute or hour, with a low mean.
Blast radius: Connection pools and any capacity sized for the mean.
Detection: Look at per-second traffic folded over the minute and the hour.
Mitigation: Throttle at the edge and shed excess requests.
Recovery: Ship client jitter and spread scheduled jobs.
Prevention: Mandate jitter in client libraries and job schedulers.
:::

:::failure Load test uses the wrong shape
Trigger: A closed-loop generator uses uniform keys and fixed small objects.
Symptoms: Tests pass, and production falls over at a fraction of tested load.
Blast radius: Launch, and false confidence in all related capacity plans.
Detection: Compare test CPU, cache hit rate, and key distribution with production.
Mitigation: Limit launch traffic while the test gets corrected.
Recovery: Rebuild the test with measured distributions, in open-loop mode.
Prevention: Validate generated workloads against production before relying on them.
:::

:::failure Profile hides a dominant client
Trigger: Aggregated numbers mix a single partner's batch job with user traffic.
Symptoms: Unexplained periodic peaks, and growth that does not match user numbers.
Blast radius: Whoever shares capacity with that client.
Detection: Segment by client identifier and compute top-client share.
Mitigation: Apply a quota for the client.
Recovery: Move batch traffic to a dedicated path or time window.
Prevention: Attribute all traffic to a client or tenant identifier. See [[o2]].
:::

## Security and privacy

### Threats

Access logs commonly contain IP addresses, user IDs, query strings, and sometimes tokens or email addresses in URLs. Bulk analysis copies that sensitive data into a place with broader access. Traffic data also reveals business information like customer sizes and launch timing.

### Trust boundaries

Treat raw logs as sensitive and aggregated profiles as less so. Separate them: restricted store for raw logs, with analysis jobs writing aggregates only. Never send raw production logs into a test environment without review.

### Authentication and authorization

Restrict raw-log queries to named roles, and log who queried what. Use service accounts for scheduled analysis with read access only to the needed tables and columns.

### Tenant isolation

Per-tenant profiles reveal one customer's activity, so do not share them with other customers. Keep per-tenant rates and quotas in the profile, as this data is how noisy neighbors are found. See [[a139]].

### Sensitive data

Scrub query strings and tokens at collection time. Hash keys with a secret salt when analysis requires only cardinality and frequency. Retain raw data for a stated period and expire it. Note that hashed identifiers can remain personal data under regulations such as GDPR. See [[a142]].

### Abuse resistance

A workload profile is also an abuse detector. Scrapers, credential stuffing, and enumeration show unusual key distributions, session lengths, and failure rates. Also take care that attackers cannot poison forecasts: exclude identified bot traffic from growth estimates, while keeping it for capacity estimates, as it still consumes resources.

## Observability

### Metrics

Use a rate counter by route, tenant, and status; a size histogram by route; per-partition load; cache hit rate; and top-K keys from a sketch. Avoid using raw keys as metric labels, because the cardinality would overwhelm the metrics system. See [[a120]].

### Logs

Standard fields: timestamp, route template rather than raw URL, status, duration, sizes, client class, hashed tenant ID. Keep templates low-cardinality. Log sampling must be recorded, so rates can be correctly estimated afterward.

### Traces

Traces reveal the fan-out ratio: how many internal calls each external request makes. This multiplier is a key parameter of a workload model and it often drifts as features grow.

### Dashboards

Show one workload page per service: rate at two resolutions, a week-over-week overlay, operation mix, top clients, partition imbalance (maximum ÷ mean), and profile drift compared with the plan.

### Alerts

Page on symptoms like saturation, not on workload shifts themselves. Send tickets on drift: "maximum partition load has exceeded twice the mean for an hour", or "traffic exceeds the planned peak by 20%".

### SLO examples

- Profiles for tier-1 services are refreshed within 30 days.
- Maximum-to-mean partition load stays under 2.0 for 99% of hours.
- Forecast error at 3 months stays within 25% for tier-1 services.

### Runbook actions

On an unexplained traffic rise: segment by route, client, and region, check for a single source, check retry rate, and compare with the launch calendar. If it is a single client, apply a quota. If it is organic, scale and update the forecast.

## Implementation

### Architecture of the examples

Python generates a seeded synthetic trace and computes an exact in-memory profile. TypeScript reads the same trace as a stream using bounded state. Using a real `readline` stream shows how you would handle logs too big to load. No HTTP layer is included because these are offline tools.

### Data structures

`SpaceSaving` keeps k counters. When full, it evicts the minimum and inherits its count, guaranteeing that any key with frequency above n ÷ k stays present. The size histogram uses power-of-two buckets, so the result is an upper bound. The Python generator precomputes a cumulative table and uses binary search for Zipf sampling.

### Interfaces

`python -m app.main [--seed N] [--zipf S] [--export PATH]` prints a profile and optionally writes NDJSON. `pnpm start <trace.ndjson>` prints a streaming profile. The `Profiler.ingest` method takes one raw line, so it could consume from any source.

### Error handling

Malformed lines are counted in `skipped` rather than crashing the run, since real logs always contain a few of them, and the count is reported so that high skip rates are visible. An empty trace raises an error because reporting zeros would look like a valid measurement.

### Concurrency considerations

The stream processes one line at a time, and `for await` applies backpressure so a large file does not fill memory. To parallelize this, you would partition the file, build a profile for each part, and merge. Counts and histograms merge easily, while Space-Saving merges only approximately.

### Educational limitations

The synthetic trace has independent keys and sizes, unlike real traffic. The per-second map grows with duration; production code would use a fixed window. The Poisson sampling is a normal approximation. Python keeps every request in memory, which is fine at this scale only.

### Production hardening

Run analysis in a data warehouse or stream processor, add client and tenant dimensions, scrub sensitive fields, version profiles, compare with the previous version automatically, and validate them against production resource use.

## Terminal lab

### Setup

```bash
cd topics/workload-characterization-and-traffic-modeling/examples/python
uv sync --quiet
```

### Run

Characterize the default skewed trace, and write it out:

```bash
uv run python -m app.main --export /tmp/trace.ndjson | jq '{mean_rps, peak_rps, peak_to_mean, read_ratio, top_1pct_key_share, size_p50, size_p99}'
```

Compare with uniform keys:

```bash
uv run python -m app.main --zipf 0 | jq '{top_1pct_key_share}'
```

Profile the same file using the bounded-memory analyzer:

```bash
cd ../typescript && pnpm install --ignore-workspace --silent && pnpm --silent start /tmp/trace.ndjson | jq '{meanRps, peakRps, peakToMean, readRatio, topKeys: .topKeys[:2], sizeP99UpperBound}'
```

Try it on your own logs. This extracts per-second peak from a common access-log format:

```bash
awk '{print $4}' access.log | sort | uniq -c | sort -rn | head -5
```

### Test

```bash
cd ../python && uv run pytest -q
```

```bash
cd ../typescript && pnpm test
```

### Expected output

Measured with the default seed on the review date: about 192,000 requests, a mean of 53.3 rps, a peak of 273 rps, a peak-to-mean ratio of 5.12, and a read ratio of 0.90. The top 1% of keys get 52.6% of the traffic, while `--zipf 0` drops that to 1.7%. The median size is about 3,000 bytes and p99 about 30,000 bytes, so the tail is ten times the median. The TypeScript profile agrees on rates and read ratio, and its `sizeP99UpperBound` of 32,768 is the next power of two above the exact p99. Your exact values may differ slightly with another Python version.

### Cleanup

```bash
rm -f /tmp/trace.ndjson && rm -rf node_modules ../python/.venv
```

### Troubleshooting

- The `access.log` command fails if you have no such file, and it assumes the timestamp is in field 4.
- `No valid trace lines`: run the export step first and check the file path.
- The generator takes a few seconds, since it creates about 192,000 records as validated models.

## Practical challenges

:::challenge Concept | Same mean, different system
Two services each average 1,000 rps. Service A has a PMR of 1.2, reads are uniform across keys, and all objects are 1 KB. Service B has a PMR of 8, 1% of keys get half the reads, and sizes span 1 KB to 50 MB. What would you design differently for B?
>>> Hint
Consider each difference on its own: time, keys, and size.
>>> Solution
For the PMR of 8: autoscaling alone may be too slow, so add queues for deferrable work and headroom. For skew: a small cache captures much traffic, but hot keys need special handling so that they do not overload one partition. For size: send large objects via a separate path such as object storage and a CDN, since they would otherwise block workers and distort latency. Service A may be fine with a simple pool of instances and no cache at all.
>>> Common mistakes
Giving only "add more servers". Treating skew as purely bad, when it is what makes caching effective.
:::

:::challenge Debugging | The hourly mystery
Your dashboard, which uses 5-minute averages, shows 40% CPU at all times, yet users report errors at the top of each hour. How would you find the cause, using only access logs and the Python tool?
>>> Hint
Change the resolution. Then fold time by minute of hour.
>>> Solution
Compute rate per second around the hour boundary: the 5-minute average hides a 20-second spike. Group by client type and route during those seconds, which likely shows a synchronized source such as app polling or a cron fleet. Confirm the peak-to-mean at 1 second. Fix through jitter, and protect the service using a per-client limit. Update dashboards to include a 1-second maximum.
>>> Common mistakes
Adding capacity before finding the source. Blaming a dependency without segmenting the traffic.
:::

:::challenge Capacity | Forecast the shard count
Current state: 20,000 reads per second mean, 1-minute PMR of 2.5, 90% hit rate, and 5% monthly growth. Each shard handles 1,000 reads per second safely. How many shards in 18 months, with 25% headroom? How many if the hit rate drops to 80%?
>>> Hint
Growth factor is 1.05^18. Headroom means dividing by 0.75.
>>> Solution
1.05^18 = 2.41. Mean: 48,130 per second. Peak: 120,325. At 90% hit rate: 12,033 database reads, 12.03 shards, ÷ 0.75 = 16.04, so 17 shards. At 80%: 24,065, ÷ 1,000 = 24.07, ÷ 0.75 = 32.1, so 33 shards. A 10-point hit-rate drop doubles the database load, so it nearly doubles shard count.
>>> Common mistakes
Applying growth to the peak twice. Treating hit rate as fixed when it depends on data size and skew.
:::

:::challenge Design | Characterize a system that does not exist yet
You are launching a collaborative whiteboard. No traffic exists. Write a workload model with parameters, what evidence backs each one, and how you would replace estimates with data in the first 30 days.
>>> Hint
Consider sessions: the number of participants, the operations per second per participant, and how long a board lives.
>>> Solution
Parameters: concurrent boards; 3 participants per board on average with a heavy tail; 2 operations per second per active user; 100-byte ops; 45-minute sessions; 9 a.m. to 5 p.m. weekday peaks, PMR 4. Evidence: comparable product public figures if available, a beta group, and a stated guess otherwise, with low, base, and high values. Instrument participant counts, operation rates, and board sizes on day one. Compare at 7 and 30 days, and find the largest deviation. Also test the tail: a 500-person board has very different fan-out, since messages grow with the square of participants if every operation goes to everyone.
>>> Common mistakes
Giving one point estimate. Modeling only the average board. Ignoring fan-out.
:::

:::challenge Incident | The traffic that was not users
At 14:10, traffic triples and the database saturates. The marketing team confirms no campaign is running. What do you do in the first 15 minutes, using traffic characterization?
>>> Hint
Segment first. Then compare the shape of this traffic with normal traffic.
>>> Solution
Declare an incident. Segment by route, client, IP range, user agent, and tenant. Check the retry rate, because this could be self-inflicted. Compare the key distribution: a scraper walks keys uniformly, which destroys cache hit rate and explains why the database suffers more than the traffic rise alone would suggest. If it is one source, apply a limit at the edge. If it is retries, reduce them with a client or gateway limit. Keep the sample for later analysis, and then add a dashboard for hit rate and top clients. See [[o54]].
>>> Common mistakes
Scaling up the database first. Assuming it is an attack before checking for your own retries.
:::

## Industry standards and trends

### Standards and specifications

Few formal standards exist for workload modeling. For measurement mechanics, see [W3C Trace Context](https://www.w3.org/TR/trace-context/), November 2021, for correlating requests, and [OpenTelemetry semantic conventions for HTTP](https://opentelemetry.io/docs/specs/semconv/http/), a living specification for field names. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), June 2022, defines the HTTP semantics such logs record.

### Established practice

Research that shaped common practice includes [YCSB](https://doi.org/10.1145/1807128.1807152), Cooper et al., 2010, a benchmark framework with skewed key distributions; [Workload Analysis of a Large-Scale Key-Value Store](https://doi.org/10.1145/2254756.2254766), Atikoglu et al., 2012, based on real Memcached traces; and [Wide Area Traffic: The Failure of Poisson Modeling](https://doi.org/10.1109/90.392383), Paxson and Floyd, 1995. Findings in those papers are specific to the systems they studied, so measure your own.

### Managed-service options

Cloud load balancers export access logs to object storage, which can be queried using warehouse engines. Observability vendors provide aggregations, usually sampled. Check how sampling affects tails and rare keys before you rely on them.

### Emerging approaches

eBPF-based collection captures traffic data without application changes. AI workloads are changing assumptions, since requests may run for minutes and cost depends on token counts rather than on request counts, so rate alone describes them poorly. This is an observation from public systems, without a settled modeling standard.

### Recent changes

OpenTelemetry's HTTP semantic conventions were declared stable in 2023, making field names more consistent across tools. Verify the version in use by your instrumentation.

### Adoption constraints

Log retention costs and privacy rules limit how much raw data you can keep. Sampling reduces cost and damages tail analysis. Start with load-balancer logs, since they need no code changes.

## Interview preparation

:::q Foundational | Why are averages misleading for capacity planning?
**Strong answer.** Systems fail at peaks and on skewed resources. A 1,000 rps mean could involve 8,000 rps peaks with most traffic on a few keys, and queueing depends on variation too. I state rates at a stated window, along with PMR and skew.

**Why it is asked.** It is a basic signal of production experience.

**Weak-answer warning signs.** Using daily average as capacity, or multiplying by a generic factor with no reasoning.

**Follow-up.** How does the window you choose change PMR?
:::

:::q Foundational | What is a read/write ratio used for?
**Strong answer.** It determines whether replicas and caches help, and which storage engine fits. At 100 to 1, read scaling dominates. At 1 to 10, like telemetry, writes need batching and partitioning. Ratios need checking per route, since aggregate figures can mislead.

**Why it is asked.** It is usually among the first design questions.

**Weak-answer warning signs.** Reciting a ratio with no design consequence.

**Follow-up.** How would a write-heavy path change your storage choice?
:::

:::q Foundational | What is key skew?
**Strong answer.** Some keys get far more traffic than others, often following a Zipf-like pattern. This helps caching since few keys cover most reads, but it harms partitioning because hot keys overload one shard.

**Why it is asked.** It leads into caching and sharding discussions.

**Weak-answer warning signs.** Thinking hash partitioning fully removes hot spots.

**Follow-up.** How do you detect a hot key without tracking all keys?
:::

:::q Senior | What is the difference between open and closed workloads, and why does it matter?
**Strong answer.** In an open workload, arrivals do not depend on completions. In a closed one, a fixed set of clients wait for each response. A closed test slows itself when the server slows, so it hides overload and tail problems that real open traffic would create. That is related to coordinated omission.

**Why it is asked.** It distinguishes real load-testing experience.

**Weak-answer warning signs.** Never having heard the distinction, or trusting thread-based results at face value.

**Follow-up.** Is a mobile app's traffic open or closed? Why might it be mixed?
:::

:::q Senior | What data would you collect for a workload profile, and from where?
**Strong answer.** Rates at several resolutions, operation mix, key and tenant skew, size distributions, session length, and fan-out. The load balancer is good for external truth, including failures. Traces give fan-out, and datastore logs give query shape. I would cover at least a full weekly cycle.

**Why it is asked.** It reveals whether you can actually do the measurement.

**Weak-answer warning signs.** Relying on application logs only, which miss timeouts and rejected requests.

**Follow-up.** How do you sample without destroying the signal?
:::

:::q Senior | How do you estimate top keys in a stream with billions of events?
**Strong answer.** I would use a bounded summary: Space-Saving with k counters has error at most n ÷ k, or a Count-Min sketch with a heap. I would run these per node and merge, accepting some approximation, then check accuracy against an exact count on a sample.

**Why it is asked.** It connects statistics to practical data structures.

**Weak-answer warning signs.** Proposing an exact hash map of all keys at that scale.

**Follow-up.** How would you merge summaries from 100 nodes?
:::

:::q Senior | A load test passes at twice peak, but production fails at normal peak. What do you check?
**Strong answer.** I compare the shapes: key distribution, cache hit rate, data size, object sizes, open versus closed generation, and background jobs. I check resource use in test against production at the same rate. Usually the generator is uniform and cache-friendly in the wrong way, or data is too small.

**Why it is asked.** It is a common real-world failure.

**Weak-answer warning signs.** Blaming the test environment in general, with no specific comparison.

**Follow-up.** How would you validate the new test?
:::

:::q Staff | How would you forecast capacity for a product with seasonal peaks and launches?
**Strong answer.** I would separate baseline trend from seasonality and known events, using two or more years of history where it exists. Then I would add planned launches from a product calendar, with ranges. I would track forecast error and use it to set headroom. Decisions depend on lead times: hardware commitments need a longer horizon than autoscaling.

**Why it is asked.** Staff engineers own multi-quarter capacity decisions.

**Weak-answer warning signs.** Using a single growth rate and no error tracking.

**Follow-up.** How does the forecast change your purchase of committed capacity?
:::

:::q Staff | How do you find and handle a dominant tenant in a multi-tenant system?
**Strong answer.** I attribute traffic and resource cost to a tenant, then look at the share of the top tenants. If one drives a large share, I may set quotas, dedicate capacity, or put that tenant in its own cell. I also check its usage against its contract, since this is a commercial conversation too.

**Why it is asked.** Tenant skew is a common cause of cross-customer outages.

**Weak-answer warning signs.** Treating tenants as uniform, or applying a global limit that penalizes everyone.

**Follow-up.** How do you measure cost per tenant when resources are shared?
:::

:::q Staff | Fan-out has been growing. Why is it a problem, and how would you notice?
**Strong answer.** Each external request becoming more internal calls multiplies load on shared services and worsens tail latency, since a request waits for its slowest call. Sampled traces show calls per request by route over time. I would set a budget for each critical route, and review growth in design reviews.

**Why it is asked.** Internal amplification is often invisible until it causes failures.

**Weak-answer warning signs.** Only monitoring external request rates.

**Follow-up.** Fan-out doubled but external traffic did not change. Who owns the fix?
:::

:::q Principal | How would you build workload modeling into the organization?
**Strong answer.** Make a profile a standard artifact of tier-1 services, produced automatically from load balancer logs, and required for capacity requests and launch reviews. Give product a route to provide events to the forecast, measure forecast error, and publish it per team. I would keep the required part small and let teams go deeper where it pays.

**Why it is asked.** It tests turning a practice into a system.

**Weak-answer warning signs.** Proposing one heroic central analysis, or a heavy process for all services.

**Follow-up.** How would you show this investment is worthwhile?
:::

:::q Principal | Modeling says you need 50% more capacity, costing millions. Leadership doubts the forecast. How do you handle it?
**Strong answer.** I would show past forecast accuracy, the range rather than a point, and what each decision costs if wrong in each direction: under-provisioned during a peak or stranded capacity. I would look at cheaper alternatives such as cutting fan-out, removing abusive traffic, or staging purchases against leading indicators. Then I would let leadership pick the risk, with a checkpoint date.

**Why it is asked.** Principals connect technical models to business decisions under uncertainty.

**Weak-answer warning signs.** Defending the model as if it were fact, or giving no options.

**Follow-up.** Actual growth comes in 30% below forecast. What do you do with this result?
:::

## Review

### Key takeaways

- Describe workloads by rate, mix, distribution, size, and time.
- State a window with every rate. PMR at 1 second differs greatly from PMR at 1 minute.
- Skew helps caches and hurts partitions.
- Heavy tails make averages misleading.
- Closed-loop tests hide overload that open traffic causes.
- A model is unproven until generated traffic reproduces production resource use.

### Decision checklist

- [ ] Does the data cover a full weekly cycle and known events?
- [ ] Have I segmented by route, tenant, region, and client?
- [ ] Do I know PMR at two or more resolutions?
- [ ] Do I know top-key share and per-partition imbalance?
- [ ] Do forecasts include a range and a calendar of events?

### Production-readiness checklist

- [ ] Rate, size, and partition metrics exist per route.
- [ ] Traffic can be attributed to a client or tenant.
- [ ] Clients use jitter and scheduled jobs are spread out.
- [ ] Load tests are validated against production resource use.
- [ ] Sensitive fields are scrubbed before analysis.

### Glossary

- **PMR:** peak-to-mean ratio, for a stated window.
- **Zipf:** a distribution in which frequency falls as a power of rank.
- **Heavy tail:** rare large values account for a significant share of the total.
- **Working set:** the data accessed in a window.
- **Open workload:** arrivals independent of completions.
- **Fan-out:** internal calls per external request.

### Quiz

:::quiz Hash partitioning distributes keys evenly. What does this guarantee about load?
- Load will be even.
- Load will be even after a rebalance.
- *Nothing about load, because keys can differ greatly in traffic.
- Reads will be even but writes will not be.
Hashing spreads keys, not requests. A single popular key can saturate a partition.
:::

:::quiz Why does a closed-loop load generator hide overload?
- It sends too many requests.
- It uses too few keys.
- *Its clients wait for responses, so its arrival rate falls as the server slows.
- It does not record errors.
Real open traffic keeps arriving when the server slows, so queues grow. A closed test reduces its own pressure.
:::

:::quiz With a mean of 30,000 rps, a PMR of 3.4, and an 85% hit rate, what is the peak database read rate?
- 4,500
- *15,300
- 25,500
- 102,000
30,000 × 3.4 = 102,000, and 102,000 × 0.15 = 15,300 reads per second to the database.
:::

:::quiz Which tool suits finding top keys in billions of events using bounded memory?
- An exact hash map.
- Sorting the log.
- *A Space-Saving summary.
- A daily average.
Space-Saving uses a fixed number of counters and bounds its error by n ÷ k.
:::

:::quiz A dashboard with 5-minute averages shows 40% CPU, yet errors appear at the top of each hour. What is the most likely explanation?
- The dashboard is broken.
- *Short synchronized spikes are hidden by the averaging window.
- CPU does not matter.
- Traffic is uniform.
Averaging over 5 minutes hides a 20-second burst. Look at per-second data, folded by minute of the hour.
:::

### Further study

Continue with [[a4]] to convert a profile into capacity, [[a8]] for how variation creates queues, and [[a60]] for handling the hot keys this lesson reveals. [[a109]] covers making tests reproduce these shapes faithfully.
