# Solutions: Workload characterization and traffic modeling

## Concept: Same mean, different system

For the PMR of 8: autoscaling alone may be too slow, so add queues for deferrable work and headroom. For skew: a small cache captures much traffic, but hot keys need special handling so that they do not overload one partition. For size: send large objects via a separate path such as object storage and a CDN, since they would otherwise block workers and distort latency. Service A may be fine with a simple pool of instances and no cache at all.

**Common mistakes.** Giving only "add more servers". Treating skew as purely bad, when it is what makes caching effective.

## Debugging: The hourly mystery

Compute rate per second around the hour boundary: the 5-minute average hides a 20-second spike. Group by client type and route during those seconds, which likely shows a synchronized source such as app polling or a cron fleet. Confirm the peak-to-mean at 1 second. Fix through jitter, and protect the service using a per-client limit. Update dashboards to include a 1-second maximum.

**Common mistakes.** Adding capacity before finding the source. Blaming a dependency without segmenting the traffic.

## Capacity: Forecast the shard count

1.05^18 = 2.41. Mean: 48,130 per second. Peak: 120,325. At 90% hit rate: 12,033 database reads, 12.03 shards, ÷ 0.75 = 16.04, so 17 shards. At 80%: 24,065, ÷ 1,000 = 24.07, ÷ 0.75 = 32.1, so 33 shards. A 10-point hit-rate drop doubles the database load, so it nearly doubles shard count.

**Common mistakes.** Applying growth to the peak twice. Treating hit rate as fixed when it depends on data size and skew.

## Design: Characterize a system that does not exist yet

Parameters: concurrent boards; 3 participants per board on average with a heavy tail; 2 operations per second per active user; 100-byte ops; 45-minute sessions; 9 a.m. to 5 p.m. weekday peaks, PMR 4. Evidence: comparable product public figures if available, a beta group, and a stated guess otherwise, with low, base, and high values. Instrument participant counts, operation rates, and board sizes on day one. Compare at 7 and 30 days, and find the largest deviation. Also test the tail: a 500-person board has very different fan-out, since messages grow with the square of participants if every operation goes to everyone.

**Common mistakes.** Giving one point estimate. Modeling only the average board. Ignoring fan-out.

## Incident: The traffic that was not users

Declare an incident. Segment by route, client, IP range, user agent, and tenant. Check the retry rate, because this could be self-inflicted. Compare the key distribution: a scraper walks keys uniformly, which destroys cache hit rate and explains why the database suffers more than the traffic rise alone would suggest. If it is one source, apply a limit at the edge. If it is retries, reduce them with a client or gateway limit. Keep the sample for later analysis, and then add a dashboard for hit rate and top clients. See DDoS protection.

**Common mistakes.** Scaling up the database first. Assuming it is an attack before checking for your own retries.
