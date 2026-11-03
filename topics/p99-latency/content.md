lastReviewed: 2026-11-03

## Orientation

### Definition

The p99 latency is the value that 99% of requests finish within, for a stated population and time window. Put differently, 1 request in 100 is slower than it. It describes one point on the latency distribution and says nothing about how much slower the remaining 1% are.

### Why it matters

Averages describe a request almost nobody receives. A service where 98% of requests take 5 ms and 2% take 2 seconds has a mean near 45 ms, which matches no real experience. The p99 exposes the slow group. It also matters more than "1 in 100" suggests, since a user session or a fanned-out page makes many requests: with 100 requests, the chance that at least one exceeds p99 is 1 − 0.99^100 = 63%. A p99 is also easy to compute wrongly. Averaging across servers, using coarse histogram buckets, sampling too little, and choosing a long window can each give you a number that looks exact and is badly wrong.

### Learning objectives

- Compute a percentile correctly and state its population and window.
- Explain why percentiles cannot be averaged, while histograms can be merged.
- Estimate how many samples a stable p99 requires.
- Choose histogram buckets so that a reported p99 is trustworthy near your target.
- Decide when p99 is the right objective and when another measure is better.

## Production scenario

An API has 10 servers. The dashboard shows "p99: 180 ms", computed as the average of each server's p99, and the target is 300 ms, so everything looks fine. Support is nevertheless receiving complaints. One server has a failing disk, with a p99 of about 1,200 ms, while the other nine are near 65 ms. The true p99 for all requests, computed from combined data, is 649 ms: over twice the target and over three times what the dashboard said. These figures come from the Python example in this lesson.

The same team has a second problem. Their histogram's buckets jump from 100 ms to 1,000 ms, and interpolation inside such a wide bucket produces smooth, believable numbers that bear little relation to the data. After they switch to merged histograms with buckets concentrated around 300 ms, the bad server is obvious within a minute, and the alert fires as it should. Nothing about the system changed, only how it was measured.

## Mental model

### Analogy

Line up 100 runners by finish time. The p50 is the time of runner 50, and the p99 is the time of runner 99. The average depends on everyone, but the p99 only asks where a given position falls. If you have the finish lists of ten separate races, you can't find the overall runner-99 time by averaging each race's runner-99 time. You have to merge the lists, because one race might be much slower than the rest.

### Where the analogy breaks

Runners all start together and finish once, whereas requests overlap and interfere with each other, so a slow one can cause others to be slow. Also, nobody stores the complete finish list in production. Systems store a compressed summary, so the answer is an approximation whose error depends on the summary. Finally, a slow request that never finishes because it timed out may vanish from the list altogether, which makes the numbers look better.

### Entities, state, flow, and invariants

- **Entities:** samples, histograms, servers, time windows, percentile queries.
- **State:** a count for each bucket, per instance and interval.
- **Flow:** record a duration, increment a bucket, export the counts, merge across instances and time, then query.
- **Invariant 1:** a percentile has a stated population, window, and measurement point.
- **Invariant 2:** aggregate raw counts first and derive percentiles afterward, never the reverse.
- **Invariant 3:** failed and timed-out requests are counted, or their exclusion is stated.

## Foundations

### Concepts and terminology

| Term | Meaning |
| --- | --- |
| Percentile (pN) | Value that N% of samples are at or below |
| Nearest rank | The sample at sorted position ⌈q × n⌉ |
| Histogram | Counts in value ranges, or buckets |
| Bucket boundary error | Uncertainty from not knowing where in a bucket a value lies |
| Sketch | A compact summary such as t-digest or DDSketch, with bounded error |
| Mergeable | Two summaries can combine into one for the union of their data |
| Quantile | The same idea as percentile, on a scale of 0 to 1 |

### First-principles explanation

A percentile is a statement about rank, and rank depends on all the data together. If server A has a p99 of 65 ms and server B has 1,200 ms, the combined p99 could be anywhere from the lower to the higher value, depending on request counts and shapes. No formula recovers it from the two numbers, because the information has gone. Histograms keep the needed information: the counts add, so you can merge them across servers and over time, then compute the percentile.

Estimating a tail from a sample needs many samples. With n samples, only about n ÷ 100 of them lie beyond p99, and those few determine the estimate. With 100 samples, a single outlier determines the result. Also, what you see is a summary of a time window: a percentile over one hour can miss a five-minute failure that hits less than 1% of that hour's requests. In this lesson's example, an incident with a median of 2,012 ms leaves the hourly p99 at 41.7 ms, since it covers just 0.28% of requests.

### Mathematics

**Nearest rank:** p = sorted[⌈q × n⌉ − 1], using zero-based indexing.

**Requests exceeding p99 at least once**, across k independent requests: 1 − 0.99^k. For k = 10: 9.6%. For k = 100: 63.4%. For k = 500: 99.3%.

**Rank uncertainty:** the number of samples below the true p99 is binomial, with a standard deviation of √(n × q × (1 − q)). For n = 10,000: √99 ≈ 10 ranks, so a roughly 95% interval spans ranks 9,880 to 9,920. Translate those ranks into milliseconds using the local shape of the distribution.

**Measured stability**, from the example with a true p99 near 64 ms, showing the middle 90% of repeated estimates:

| Samples | Low estimate | High estimate |
| --- | --- | --- |
| 100 | 45.2 ms | 77.2 ms |
| 1,000 | 57.2 ms | 70.2 ms |
| 10,000 | 62.1 ms | 65.9 ms |

**Relative error of log-linear buckets:** with s sub-buckets per power of two, width ÷ value ≤ 1 ÷ s. For s = 16, that is 6.25%.

### Complexity

| Method | Record | Query | Memory | Mergeable |
| --- | --- | --- | --- | --- |
| Store and sort | O(1) | O(n log n) | O(n) | Yes, but impractical |
| Fixed histogram | O(log b) or O(b) | O(b) | O(b) | Yes |
| Log-linear histogram | O(1) | O(b log b) in this example | O(b) | Yes, with the same layout |
| Moving average | O(1) | O(1) | O(1) | Not usefully |

Here n is the sample count and b the bucket count. A wide value range needs few log-linear buckets: the test shows under 350 for values spanning 1 to 1,000,000.

## Mechanism

### Normal path

1. Measure duration at a defined point, such as the load balancer or a server middleware.
2. Find the bucket and increment its counter, including for failed requests.
3. Export cumulative counts per instance at a regular interval.
4. At query time, sum per-bucket counts across instances for the chosen window.
5. Find the bucket containing rank q × total, then report its bound or interpolate inside it.
6. Compare with the objective, and alert using burn rates rather than one noisy point. See [[a124]].

### State transitions

```mermaid state-sample | Path of one latency sample to a reported percentile | State diagram. A sample is measured, placed in a bucket, exported with the instance's counts, merged with other instances, and queried as a percentile. Requests that are killed before completing may never be measured. The diagram highlights this as a lost sample.
stateDiagram-v2
    [*] --> Measured: request finishes
    [*] --> Lost: process killed or client disconnected unrecorded
    Measured --> Bucketed: counter incremented
    Bucketed --> Exported: scrape or push
    Exported --> Merged: counts summed by bucket
    Merged --> Reported: quantile computed at query time
    Bucketed --> Lost: instance dies before export
    Reported --> [*]
    Lost --> [*]
```

The `Lost` state biases results in the flattering direction. Instances that crash are usually the slow ones, and their unexported counts disappear. Load-balancer measurement partly fixes this, as it records outcomes even when a backend dies.

### Concurrency behavior

Several threads record at once, so counters need atomic increments or per-thread shards that merge on read. Reading while writers run gives a slightly inconsistent snapshot, which is acceptable for monitoring. Node's single-threaded event loop avoids this issue in the example. Under high load, the recording path must stay cheap: a lock in the metrics library can itself add latency. See [[o81]].

### Ordering and consistency

Instances scrape at slightly different times, so a merged window is approximate, and for rates this is usually harmless. Counter resets on restarts must be handled when computing increases. Be careful with percentiles of percentiles: a dashboard taking the average or maximum of minute-level p99s over an hour is not the hour's p99. Roll-ups must keep the histogram, or the result is meaningless.

### Ownership of data and control

The service team owns instrumentation and bucket layout, since they know the target. The platform team owns the metrics store and its cardinality limits. SLO owners agree on the measurement point and the definition of the population, including whether errors and health checks count. See [[o107]].

## Architecture

```mermaid context | Context: where latency is measured and aggregated | Flowchart. Users reach a load balancer that records latency for requests, including backend failures, then application servers each keep their own histogram. A metrics store merges histograms and feeds dashboards and alerts. Real-user monitoring reports separately. Trust boundary separates client devices from the operator network.
flowchart LR
    subgraph client["Client devices: outside operator control"]
      U["Browser or app: real-user timing"]
    end
    subgraph op["Operator network"]
      LB["Load balancer: sees all outcomes"]
      A1["Server 1: owns its histogram"]
      A2["Server N: owns its histogram"]
      M["Metrics store: merges counts by bucket"]
      D["Dashboards and SLO alerts"]
    end
    U -->|"HTTPS"| LB
    LB --> A1
    LB --> A2
    A1 -->|"scrape: bucket counts"| M
    A2 -->|"scrape: bucket counts"| M
    LB -->|"export: bucket counts"| M
    U -->|"beacon: sampled timings"| M
    M --> D
```

Each measurement point answers a different question. Servers can break latency down by route but miss what happens before their handler runs. The load balancer sees failures and upstream queues. Real-user data includes the last mile, though it needs privacy review. The arrows carry bucket counts, not percentiles, as only counts can be merged.

```mermaid component | Component view of the histogram service and percentile analysis | Flowchart. Express middleware records durations into a log-linear histogram, and an inspection route computes quantiles from it. A merge operation combines histograms. Separately, the Python analysis generates seeded data and compares averaged, bucketed, and windowed percentiles with the exact value.
flowchart LR
    R["HTTP GET /work"] --> MW["Express timing middleware"]
    MW -->|"record duration"| H["Log-linear histogram: Map of bucket to count"]
    H --> Q["quantile function"]
    Q -->|"JSON"| MR["GET /metrics/latency"]
    H2["Another instance's histogram"] -->|"merge: add counts"| H
    S["Seeded lognormal data"] --> P["Python analysis"]
    P --> O["Exact vs averaged vs bucketed vs windowed"]
```

The merge arrow is the most important one here. Because a histogram merges by adding counts, its percentile matches what a single histogram of all requests would report, and the tests confirm it.

```mermaid sequence | Sequence: computing a fleet p99 correctly | Sequence diagram. A dashboard asks the metrics store for a fleet p99. The store fetches bucket counts from each instance's data, sums them, finds the bucket that holds the 99th percentile rank, and returns a value with its bucket bounds.
sequenceDiagram
    participant D as Dashboard
    participant M as Metrics store
    participant S1 as Series, server 1
    participant S2 as Series, server 2
    D->>M: p99 for route over 5 minutes
    M->>S1: Bucket count increases
    S1-->>M: le10=900, le100=95, le1000=5
    M->>S2: Bucket count increases
    S2-->>M: le10=100, le100=300, le1000=600
    M->>M: Sum: le10=1000, le100=395, le1000=605
    M->>M: Rank 0.99 x 2000 = 1980 falls in le1000
    M-->>D: Between 100 and 1000 ms
```

Server 1 alone would report a p99 inside its last bucket, and server 2 is much worse. Summing counts weights each server by its traffic. Note the answer's honest form: "between 100 and 1,000 ms". A precise-looking interpolated number from such a bucket would be false precision.

```mermaid failure-path | Failure path: a degraded server hidden by averaged percentiles | Flowchart. One server degrades and its p99 reaches 1,227 ms. The dashboard averages per-server p99s and shows 180 ms, under target, so no alert fires and users complain. Merged histograms reveal a true p99 of 649 ms and the alert fires.
flowchart TD
    A["One of ten servers degrades"] --> B["Its p99 reaches 1,227 ms"]
    B --> C{"How is the fleet p99 computed?"}
    C -->|"average of per-server p99s"| D["Dashboard: 180 ms, below target"]
    D --> E["No alert, while users complain"]
    C -->|"merged histograms"| F["True p99: 649 ms, above target"]
    F --> G["Alert fires. Per-instance view isolates the server"]
```

The same telemetry leads to opposite outcomes, depending on one aggregation decision. This failure is silent, which is what makes it serious: a broken measurement looks exactly like a healthy system. The numbers are from this lesson's seeded example.

## Trade-offs

### Advantages

- Describes what the slow users actually experience, unlike a mean.
- Robust to a few extreme outliers, compared with a maximum.
- Widely understood, and works well as an SLO target.

### Costs

- Histograms take more metric series than a single average.
- Needs adequate traffic to be stable, so it is noisy on low-volume routes.
- Ignores everything past the 99th position: the worst 1% could be 500 ms or 30 s.
- Optimizing one percentile can move problems just beyond it.

### Alternatives

- **Threshold SLI:** "99% of requests under 300 ms" counts good requests. It's simple, it aggregates correctly, and only needs one bucket boundary at the target.
- **p99.9 or maximum:** for high-volume systems or pause detection. See [[o93]].
- **Latency heat map:** shows multiple modes, which percentiles conceal.
- **Sketches:** t-digest or DDSketch give accuracy across a wide range, at some implementation cost.

### When to use it

For user-facing and internal services with enough volume. As a rule of thumb, you want at least 1,000 samples in the evaluation window, more if the decision is important.

### When not to use it

Avoid p99 on routes with few requests, where a threshold ratio over a longer window is better. For batch jobs, track completion time per job. For bimodal traffic, split by route or cache status before computing percentiles, as a single number will describe neither group.

### Reconsider when

- The p99 and p50 move in different directions, indicating a mix change.
- Your target moves, so bucket boundaries must follow it.
- Fan-out increases, so a higher percentile now determines what users experience.

## Capacity planning

The capacity concern here is the telemetry cost of the percentile data itself.

### Inputs and assumptions

200 routes, 5 status classes, 12 histogram buckets, and 300 instances, scraped every 15 s. Assumed storage of about 2 bytes per sample after compression. This depends on your system, so measure it.

### Formula and units

- Series = routes × status classes × buckets × instances.
- Samples per second = series ÷ scrape interval in seconds.
- Storage per day (bytes) = samples per second × 86,400 s × bytes per sample.

### Intermediate calculations

- Per instance: 200 × 5 × 12 = 12,000 series.
- Fleet: 12,000 × 300 = 3,600,000 series.
- Samples: 3,600,000 ÷ 15 = 240,000 per second.
- Storage: 240,000 × 86,400 × 2 B ≈ 41.5 GB per day.
- After aggregating away the instance label for long-term storage: 12,000 series, 800 samples per second, and about 138 MB per day.

### Headroom

Allow 30% for growth in routes and instances, or about 54 GB per day of raw data. Keep per-instance data for a short period, such as 7 days, for debugging, and fleet aggregates for longer. Retention figures are illustrative.

### Failure capacity

During a zone loss or an autoscaling event, instance churn creates new series, because each new instance has a new label value. Replacing all 300 instances doubles active series temporarily, to 7.2 million. Size the metrics store for this, as monitoring needs to work best during failures. Also, metrics should not depend on the failing zone. See [[a120]].

## Failure modes

:::failure Percentiles averaged across instances
Trigger: A dashboard applies an average or maximum to per-instance p99 values.
Symptoms: The reported p99 does not match user reports or load-balancer data.
Blast radius: Every decision relying on that dashboard, including SLO reports.
Detection: Compare it with a p99 computed from merged histograms.
Mitigation: Replace the query with a histogram aggregation.
Recovery: Restate past SLO numbers if they were reported to customers.
Prevention: Export histograms only, and code-review dashboard queries.
:::

:::failure Buckets do not fit the target
Trigger: Default or very wide buckets surround the objective.
Symptoms: The p99 sits at or between fixed values, and small changes are invisible.
Blast radius: Alerts fire late or never for the affected route.
Detection: Compare with exact values from a trace or log sample.
Mitigation: Add a bucket boundary at the target immediately.
Recovery: Re-baseline, as historical comparisons across layouts are unsafe.
Prevention: Choose buckets by target or use exponential histograms.
:::

:::failure Timeouts and errors excluded
Trigger: Only successful requests are recorded, or timeouts have no duration recorded.
Symptoms: Latency improves during outages, since the slow requests have vanished.
Blast radius: Incident detection and SLO accuracy.
Detection: Check latency alongside error rate, and compare client and server counts.
Mitigation: Record failures, with their durations, using a status label.
Recovery: Fix instrumentation and restate reports.
Prevention: Measure at a layer that sees every outcome, and test it during fault injection.
:::

:::failure Too few samples
Trigger: An alert uses p99 on a low-volume route over a short window.
Symptoms: Noisy, flapping alerts driven by one or two requests.
Blast radius: On-call attention and trust in alerts.
Detection: Show request count beside p99, and flag windows with fewer than 1,000 samples.
Mitigation: Lengthen the window or aggregate similar routes.
Recovery: Replace the alert with a good-request ratio.
Prevention: Include a minimum sample count in alert rules.
:::

:::failure Coordinated omission in measurement
Trigger: A closed-loop test or client waits for each response, so stalls suppress new samples.
Symptoms: A long pause shows up as one slow sample, and p99 looks excellent.
Blast radius: False confidence before launch.
Detection: Compare with an open-loop generator with fixed arrival times.
Mitigation: Measure from intended send time.
Recovery: Rerun tests using a corrected tool.
Prevention: Use open-loop load generation. See [[a109]].
:::

## Security and privacy

### Threats

Metric labels can leak or explode. If a label takes values from user input, an attacker can create unlimited series and take down your metrics store, thus blinding your monitoring during an attack. Inspection endpoints like `/metrics/latency` reveal traffic volumes and internal route names.

### Trust boundaries

Keep metrics endpoints on an internal network or behind authentication, and do not serve them through the public load balancer. Treat real-user beacons as untrusted input, since anyone can send false timings and distort your numbers.

### Authentication and authorization

Scrape targets should authenticate the scraper when they carry anything sensitive. Restrict who can read per-tenant latency, and who can edit dashboards and alert rules. A silently edited query can hide an outage.

### Tenant isolation

A global p99 can hide a single tenant's bad experience. Measure latency per tenant class, and for your largest tenants individually. Avoid one label value per tenant when you have many: use a bounded set, or keep per-tenant data in logs instead.

### Sensitive data

Never put user IDs, emails, or raw URLs in metric labels, where they can't be easily deleted. Use route templates. Real-user monitoring may collect personal data, depending on jurisdiction, and needs review. See [[a144]].

### Abuse resistance

Normalize route labels server-side, and map unknown paths to one label so that scanners can't create new series. Set per-target series limits in the metrics system. Filter or tag known bot traffic, so attackers can't distort the percentile that drives your alerts.

## Observability

### Metrics

Use a latency histogram with labels for route template, method, and status class. Add request count beside it. Add metrics about the metrics pipeline: scrape failures, series count, and dropped samples.

### Logs

Log individual slow requests above a threshold with route, duration, and trace ID, so that a bad percentile can be traced to examples. Sample the logs to bound their volume.

### Traces

Sample slow requests preferentially, as head sampling at 1% keeps few from the tail. Exemplars link a histogram bucket to a trace ID, moving you from "p99 is high" straight to an actual slow request. See [[a121]].

### Dashboards

Show p50, p90, p99, and p99.9 on one graph, plus count. Add a heat map to reveal multiple modes, and a per-instance view to spot single bad servers. Display the target as a line.

### Alerts

Alert on the ratio of requests slower than the target, using multi-window burn rates, instead of on an instantaneous p99. A ratio is cheap to compute, aggregates correctly, and handles low traffic better.

### SLO examples

- 99% of `GET /search` requests complete within 300 ms at the load balancer, over 28 days.
- 99.9% of `POST /orders` finish within 1 s over 28 days, including failures at their full duration.
- A ratio form is preferred: count of requests at or below 300 ms, divided by all requests.

### Runbook actions

When p99 rises: check whether p50 rose too (a general slowdown) or only the tail (a subset). Split by instance, route, and status. If it is one instance, drain it. If it is one route, inspect slow traces. Check request count first, since low volume can make a number meaningless.

## Implementation

### Architecture of the examples

The TypeScript example is an Express service with a timing middleware and a log-linear `Histogram` class, using an inspection route. The Python example is a seeded analysis comparing exact percentiles with the common wrong methods. The TypeScript side shows how to measure correctly, and the Python side shows how measurement goes wrong.

### Data structures

`Histogram` maps a bucket index to a count. The index combines a value's power of two with one of 16 linear sub-buckets, bounding relative error at 6.25%. A `Map` keeps only non-empty buckets, so memory depends on the range seen and not on the number of samples.

### Interfaces

`record(ms)`, `merge(other)`, and `quantile(q)`, plus `GET /work`, `GET /healthz`, and `GET /metrics/latency`. In Python: `percentile`, `average_of_p99s`, `p99_spread`, `bucket_p99`, and `window_effect`.

### Error handling

`record` rejects negative and non-finite values, since a bad clock must not silently corrupt a histogram. `merge` rejects mismatched layouts. `quantile` throws on an empty histogram, because a reported 0 ms would look like excellent performance. The route handles the empty case by reporting just a count of zero.

### Concurrency considerations

Node runs `record` on one thread, so no synchronization is needed. In a multi-threaded runtime you would use striped atomic counters. The middleware records on `finish`, which misses clients that disconnect early. A production version would also listen for `close`.

### Educational limitations

There are no time windows: the histogram accumulates forever. It reports bucket upper bounds and does no interpolation. `curl` in a loop is closed-loop, so it understates queueing. Lognormal data is a simplification.

### Production hardening

Use a maintained library such as an OpenTelemetry exponential histogram or HdrHistogram, add rotating windows, export to your metrics system, capture aborted requests, and attach exemplars.

## Terminal lab

### Setup

```bash
cd topics/p99-latency/examples/typescript
pnpm install --ignore-workspace
```

### Run

Start the service:

```bash
PORT=3000 pnpm start
```

In another terminal, send 500 requests and read the percentiles:

```bash
for i in $(seq 1 500); do curl -s localhost:3000/work >/dev/null; done
curl -s localhost:3000/metrics/latency | jq -c .
```

Then run the analysis:

```bash
cd ../python && uv run python -m app.main | jq -c '.average_of_p99s, .stability[], .bucket_effect, .window_effect'
```

### Test

```bash
cd ../typescript && pnpm test
```

```bash
cd ../python && uv run pytest -q
```

### Expected output

In the service, about 2% of requests take the 200 ms path, so p50 stays near 6 ms, and p99 lands just above 200 ms. Exact values vary because the slow path is random. The analysis output is seeded, and measured on the review date as:

```json
{"mean_of_p99s_ms":180.3,"max_of_p99s_ms":1227.2,"true_pooled_p99_ms":649.1,"true_pooled_p50_ms":21.4}
{"samples":100,"low_5pct_ms":45.2,"high_95pct_ms":77.2}
{"samples":1000,"low_5pct_ms":57.2,"high_95pct_ms":70.2}
{"samples":10000,"low_5pct_ms":62.1,"high_95pct_ms":65.9}
{"exact_p99_ms":64.3,"coarse_buckets_p99_ms":99.1,"default_like_buckets_p99_ms":85.7,"fine_buckets_p99_ms":64.4}
{"hour_p99_ms":41.7,"incident_window_p50_ms":2011.8,"incident_share_pct":0.28}
```

Read those lines as four separate warnings. The averaged p99 is 3.6 times too low, 100 samples leave a wide range, buckets move the answer from 64 ms to 99 ms, and a 2-second incident is invisible in the hourly p99.

### Cleanup

Stop the service with Ctrl-C, then:

```bash
rm -rf ../typescript/node_modules .venv
```

### Troubleshooting

- `{"count":0}` from the metrics route: send traffic to `/work` first.
- Percentile values look too high: an event loop busy with other work adds to all measurements.
- The analysis takes a few seconds, since it sorts over a million values.

## Practical challenges

:::challenge Concept | Which number is right?
Server A handled 90,000 requests with a p99 of 50 ms. Server B handled 10,000 with a p99 of 800 ms. What can you say about the combined p99 from these numbers alone? What would you need in order to compute it?
>>> Hint
Find which ranks matter. The combined p99 leaves 1,000 requests above it.
>>> Solution
You can only bound it. A has 900 requests over 50 ms, and B has 100 requests over 800 ms. Exactly 1,000 requests lie above the combined p99, so it depends on how the rest of B is distributed. If nearly all of B is above 50 ms, the combined value is well above 50 ms, and it can't exceed 800 ms in this case. The average, 425 ms, and the weighted average, 125 ms, have no justification. You need histograms from both servers.
>>> Common mistakes
Computing a traffic-weighted average and calling it correct, because it looks more careful. It is still wrong.
:::

:::challenge Debugging | Latency improved during the outage
During an outage, your error rate hits 40% and your p99 falls from 300 ms to 90 ms. Find two possible explanations, and how you would confirm which applies.
>>> Hint
Think about which requests are no longer in the population.
>>> Solution
Explanation 1: timed-out or failed requests are excluded from the histogram, so what remains are healthy fast requests. Confirm by checking whether the histogram counts match total requests, and whether the status label includes failures. Explanation 2: failures are fast, such as immediate 503 responses from a broken dependency, and they are pulling down the distribution. Confirm by splitting latency by status class. Report success latency and failure latency separately, and count timeouts at their full duration.
>>> Common mistakes
Concluding that the system was faster. Looking at a latency graph without the error rate next to it.
:::

:::challenge Capacity | Reduce the cost of histograms
You have 500 routes, 4 status classes, 20 buckets, and 1,000 instances, scraped every 30 s at an assumed 2 bytes per sample. Find series and storage per day. Then propose changes reducing it by at least 95% for long-term storage, while still supporting fleet SLOs.
>>> Hint
Which label multiplies the most, and which questions actually require it?
>>> Solution
Series: 500 × 4 × 20 × 1,000 = 40,000,000. Samples: 1,333,333 per second. Storage: 1,333,333 × 86,400 × 2 B ≈ 230 GB per day. Aggregating away the instance label for long-term retention gives 40,000 series, a 99.9% reduction, at about 230 MB per day. Keep instance-level data for only a few days and for high-traffic routes. Reduce buckets to about 10 around each target if needed.
>>> Common mistakes
Dropping histogram buckets and storing per-instance percentiles, which ruins the ability to merge. Removing the status label, which mixes fast failures with successes.
:::

:::challenge Design | A latency SLO for a low-traffic admin API
An admin API receives 50 requests per hour. A manager wants "p99 under 500 ms, alert within 5 minutes". Explain what is wrong, then design what you would do instead.
>>> Hint
Count how many samples exist in 5 minutes, and how many of them would determine a p99.
>>> Solution
Five minutes contains about 4 requests, so a p99 would simply be the maximum of those. Instead: define a threshold SLI, the proportion of requests under 500 ms, evaluated over 28 days; that's about 33,600 requests, giving a meaningful ratio. For quick detection, use synthetic probes every minute, and alert when several in a row fail. Log every slow request. Page only if the workflow matters enough, since admin tools may tolerate a next-day response.
>>> Common mistakes
Applying a high-traffic template. Alerting on one slow request. Lowering the bar without telling stakeholders why the original request can't work.
:::

:::challenge Incident | Dashboards green, customers angry
A large customer reports timeouts for the last 3 hours. Your overall p99 meets its target. Describe your investigation using histograms, traces, and logs, and name the lasting fixes.
>>> Hint
A global percentile allows 1% of traffic to fail completely, and one customer can be under that 1%.
>>> Solution
If that customer is under 1% of traffic, all of its requests can be slow with no change to the global p99. Filter load-balancer logs by the customer's identifier and compute its percentiles and error rate. Look at routes, shard, or region specific to it, and sample its traces. A likely cause is a hot shard or a large-tenant query. Mitigate for that customer first, and update them. Lasting fixes: per-tenant-class SLIs, explicit SLIs for top customers, alerting on proportion of tenants affected, and per-shard views.
>>> Common mistakes
Telling the customer the metrics look fine. Adding one metric label per tenant, which could overwhelm the metrics system.
:::

## Industry standards and trends

### Standards and specifications

The [OpenTelemetry metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/), a living specification, defines explicit-bucket and exponential histograms. The exponential form gives bounded relative error without manual bucket selection. There is no single standard for percentile calculation: tools differ in interpolation, so note the method. [RFC 7679](https://www.rfc-editor.org/rfc/rfc7679.html), January 2016, covers delay percentiles in network measurement.

### Established practice

Prometheus's [Histograms and summaries](https://prometheus.io/docs/practices/histograms/) documentation explains why summaries generally can't be aggregated and how bucket choice affects error. [HdrHistogram](http://hdrhistogram.org/) is a widely used log-linear implementation. [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/), from *Site Reliability Engineering*, 2016, recommends percentiles rather than averages. These are project documentation and published practice, not formal standards.

### Managed-service options

Cloud monitoring and observability vendors offer histogram and sketch types. Read how each computes percentiles, whether they merge correctly across dimensions, and what their sampling does to tails.

### Emerging approaches

Native or exponential histograms reduce series counts and bucket-tuning work, and adoption is growing in Prometheus and OpenTelemetry. Mergeable sketches such as [DDSketch](https://arxiv.org/abs/1908.10693), Masson et al., 2019, offer relative-error guarantees. Check support in your full metrics pipeline before depending on either.

### Recent changes

Prometheus 3.0, released in 2024, continued developing native histograms. Verify their current status in your version, because the details have been changing.

### Adoption constraints

Switching histogram types can break existing dashboards and historical comparison. Exemplars and exponential histograms require support from every component between application and dashboard.

## Interview preparation

:::q Foundational | What does p99 mean?
**Strong answer.** 99% of requests in a stated window finish within that time, so 1 in 100 are slower. It says nothing about how much slower they are. I would state the measurement point and window as well.

**Why it is asked.** It's a basic term that many people use loosely.

**Weak-answer warning signs.** Calling it the "average of the slowest", or leaving out the window.

**Follow-up.** A page makes 50 requests. How often does a user see at least one p99-level request?
:::

:::q Foundational | Why is p99 better than the average?
**Strong answer.** Latency distributions are skewed, so an average can match no real request, and it hides a slow group. p99 reveals the slow group directly. I would still look at several percentiles together, since p99 doesn't describe everything.

**Why it is asked.** It checks a basic monitoring principle.

**Weak-answer warning signs.** Saying p99 is always the only metric needed.

**Follow-up.** When is the mean still useful?
:::

:::q Foundational | Can you average p99s from several servers?
**Strong answer.** No. A percentile depends on rank across all data, which the individual numbers don't preserve. Export histograms, sum counts per bucket, and then compute the percentile.

**Why it is asked.** It's a very common production mistake.

**Weak-answer warning signs.** Suggesting a weighted average as a fix.

**Follow-up.** How does a histogram lose accuracy, and how can you control that?
:::

:::q Senior | How many samples do you need for a reliable p99?
**Strong answer.** Only about n ÷ 100 samples lie beyond the p99, so the estimate rests on those. As a rule of thumb, at least 1,000 total gives 10 tail samples, and more for important decisions. I would quantify it by bootstrap or binomial ranks. Low-traffic routes should use a ratio SLI over a longer window.

**Why it is asked.** It shows statistical maturity.

**Weak-answer warning signs.** Not realizing that sample count matters.

**Follow-up.** How does this change for p99.9?
:::

:::q Senior | How do you choose histogram buckets?
**Strong answer.** Put boundaries around the target, since accuracy there matters most, and cover the range up to the timeout. Exponential spacing gives bounded relative error. If the target is a threshold, an exact boundary at it gives a precise ratio. Newer exponential histograms avoid much of this manual work.

**Why it is asked.** It's practical knowledge from running real systems.

**Weak-answer warning signs.** Accepting defaults without checking them.

**Follow-up.** What changes if you need to compare before and after a layout change?
:::

:::q Senior | Summary or histogram metrics? What's the trade-off?
**Strong answer.** A client-side summary calculates quantiles accurately on each instance but can't be aggregated across instances. A histogram has bucket error but merges freely. For a fleet, I would nearly always choose histograms, or mergeable sketches.

**Why it is asked.** This directly affects monitoring correctness.

**Weak-answer warning signs.** Not knowing the aggregation limit.

**Follow-up.** When would you still use a summary?
:::

:::q Senior | p50 is flat, and p99 doubled. What might be happening?
**Strong answer.** A subset is slower: one instance, shard, route, or cache-miss path, or perhaps garbage-collection pauses. I would split by those dimensions and inspect slow traces. If both had moved, I'd suspect a general slowdown or capacity problem instead.

**Why it is asked.** It tests diagnostic reasoning.

**Weak-answer warning signs.** Adding capacity immediately.

**Follow-up.** What would a heat map show you that percentiles don't?
:::

:::q Staff | Would you set an SLO on p99 or on the proportion of requests under a threshold?
**Strong answer.** Usually the proportion. It's a count of good and total requests, so it aggregates correctly, gives a direct error budget, and handles low traffic better. I'd still display p99 for diagnosis. The threshold needs a bucket boundary at the target.

**Why it is asked.** It reveals practical SLO experience.

**Weak-answer warning signs.** Treating them as the same thing.

**Follow-up.** How do you pick the threshold?
:::

:::q Staff | A global p99 meets its objective, but a key customer is suffering. How do you redesign the measurement?
**Strong answer.** A global percentile allows a small customer's traffic to be entirely bad. I would add SLIs by customer tier and for the largest customers, measure the share of tenants within target, and keep per-tenant detail in logs to control cardinality. Contract SLAs may also need their own measurement.

**Why it is asked.** Aggregates hiding real pain is a common staff-level issue.

**Weak-answer warning signs.** Adding a tenant label for all tenants with no thought to cost.

**Follow-up.** How do you report this to account managers?
:::

:::q Staff | How would you check that a metrics pipeline reports latency correctly?
**Strong answer.** Inject known delays and confirm the reported percentile, compare against logs or a load balancer for the same window, test during a failure to confirm timeouts are counted, and alert on dropped samples and scrape failures. Measurement deserves tests as much as the service does.

**Why it is asked.** Silent measurement bugs mislead whole organizations.

**Weak-answer warning signs.** Trusting a dashboard because it has decimal places.

**Follow-up.** How often would you run this check?
:::

:::q Principal | Teams across the company report latency in incompatible ways. What would you do?
**Strong answer.** I would define a small standard: measurement points, population, histogram type, and SLI form, delivered through shared libraries and defaults so it takes no extra effort. I would migrate tier-1 services first, verify old and new agree or explain why they don't, and restate numbers honestly where they change. I wouldn't mandate everything at once.

**Why it is asked.** It's standardization work with a real political cost, as numbers will get worse on paper.

**Weak-answer warning signs.** Issuing a policy with no tooling or migration plan.

**Follow-up.** A team's reported p99 triples after the migration. How do you handle that conversation?
:::

:::q Principal | An executive asks for a single latency number for the company. How do you respond?
**Strong answer.** I would offer something meaningful instead: the percentage of key user journeys meeting their targets, tracked over time, by region. A single company p99 mixes unlike things, and it could improve while important journeys get worse. I would give one clear headline, backed by a journey-level breakdown.

**Why it is asked.** It tests turning technical accuracy into useful executive communication.

**Weak-answer warning signs.** Either supplying a meaningless number or refusing outright.

**Follow-up.** How do you stop this number from being gamed?
:::

## Review

### Key takeaways

- p99 means position 99 of 100, for a stated population, window, and measurement point.
- Never average percentiles. Merge histograms, then compute.
- Buckets determine accuracy, so place them around the target.
- Few samples give unstable tails, and long windows hide short incidents.
- Include failures and timeouts, or say clearly that they're excluded.
- A threshold ratio is often a better SLI than a percentile.

### Decision checklist

- [ ] Are the population, window, and measurement point stated?
- [ ] Does the query merge histograms before computing?
- [ ] Is a bucket boundary near the target?
- [ ] Are there enough samples in the window?
- [ ] Are failures and timeouts counted?

### Production-readiness checklist

- [ ] Histograms exist per route at the load balancer or server.
- [ ] Route labels are normalized, to protect cardinality.
- [ ] Alerts use ratios and burn rates.
- [ ] Slow requests link to traces.
- [ ] The pipeline has been tested using injected delay.

### Glossary

- **Nearest rank:** a percentile method that picks an actual sample at a computed position.
- **Mergeable:** summaries can be combined without loss beyond their stated error.
- **Exemplar:** a sample trace ID attached to a metric bucket.
- **Heat map:** a time plot of latency density across buckets.
- **Coordinated omission:** a measurement error in which stalls suppress samples.

### Quiz

:::quiz You have per-server p99 values and request counts. How can you compute the fleet p99 exactly?
- Average them.
- Weight the average by request count.
- Take the maximum.
- *You cannot. You need the histograms or raw samples.
Percentile values don't preserve the information needed. Only merged counts or raw data can do this.
:::

:::quiz A page makes 100 independent requests. What is the chance at least one exceeds the p99?
- 1%
- 10%
- *63%
- 99%
1 − 0.99^100 ≈ 63.4%, which is why p99 matters more than it sounds.
:::

:::quiz Your p99 falls during an outage, while the error rate rises. What is the most likely explanation?
- The system got faster.
- *Failures are either excluded or very fast, which changes the population.
- Histograms always improve under load.
- The window is too short.
Compare latency by status, and count timeouts at their full duration.
:::

:::quiz With 100 samples, how many lie beyond the p99?
- About 50
- About 10
- *About 1
- None
One sample largely determines the estimate, which explains the wide range in the stability table.
:::

:::quiz Why is "percentage of requests under 300 ms" often a better SLI than p99?
- It is always lower.
- *It aggregates correctly from counts and gives a direct error budget.
- It needs no measurement.
- It removes the tail.
Good and total counts add across servers and windows, and they map directly to a budget.
:::

### Further study

Next, read [[o93]] for what happens beyond p99, [[a120]] for histogram design at scale, and [[a124]] for alerting on these numbers. [[a109]] explains how load tests can corrupt percentile measurements.
