# Solutions: P99 latency

## Concept: Which number is right?

You can only bound it. A has 900 requests over 50 ms, and B has 100 requests over 800 ms. Exactly 1,000 requests lie above the combined p99, so it depends on how the rest of B is distributed. If nearly all of B is above 50 ms, the combined value is well above 50 ms, and it can't exceed 800 ms in this case. The average, 425 ms, and the weighted average, 125 ms, have no justification. You need histograms from both servers.

**Common mistakes.** Computing a traffic-weighted average and calling it correct, because it looks more careful. It is still wrong.

## Debugging: Latency improved during the outage

Explanation 1: timed-out or failed requests are excluded from the histogram, so what remains are healthy fast requests. Confirm by checking whether the histogram counts match total requests, and whether the status label includes failures. Explanation 2: failures are fast, such as immediate 503 responses from a broken dependency, and they are pulling down the distribution. Confirm by splitting latency by status class. Report success latency and failure latency separately, and count timeouts at their full duration.

**Common mistakes.** Concluding that the system was faster. Looking at a latency graph without the error rate next to it.

## Capacity: Reduce the cost of histograms

Series: 500 × 4 × 20 × 1,000 = 40,000,000. Samples: 1,333,333 per second. Storage: 1,333,333 × 86,400 × 2 B ≈ 230 GB per day. Aggregating away the instance label for long-term retention gives 40,000 series, a 99.9% reduction, at about 230 MB per day. Keep instance-level data for only a few days and for high-traffic routes. Reduce buckets to about 10 around each target if needed.

**Common mistakes.** Dropping histogram buckets and storing per-instance percentiles, which ruins the ability to merge. Removing the status label, which mixes fast failures with successes.

## Design: A latency SLO for a low-traffic admin API

Five minutes contains about 4 requests, so a p99 would simply be the maximum of those. Instead: define a threshold SLI, the proportion of requests under 500 ms, evaluated over 28 days; that's about 33,600 requests, giving a meaningful ratio. For quick detection, use synthetic probes every minute, and alert when several in a row fail. Log every slow request. Page only if the workflow matters enough, since admin tools may tolerate a next-day response.

**Common mistakes.** Applying a high-traffic template. Alerting on one slow request. Lowering the bar without telling stakeholders why the original request can't work.

## Incident: Dashboards green, customers angry

If that customer is under 1% of traffic, all of its requests can be slow with no change to the global p99. Filter load-balancer logs by the customer's identifier and compute its percentiles and error rate. Look at routes, shard, or region specific to it, and sample its traces. A likely cause is a hot shard or a large-tenant query. Mitigate for that customer first, and update them. Lasting fixes: per-tenant-class SLIs, explicit SLIs for top customers, alerting on proportion of tenants affected, and per-shard views.

**Common mistakes.** Telling the customer the metrics look fine. Adding one metric label per tenant, which could overwhelm the metrics system.
