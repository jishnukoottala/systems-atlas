# Solutions: Latency

## Concept: What dominates?

(a) Propagation: 18,500 × 1.4 ÷ 200 = 130 ms one way, while transmission is negligible. Fix: serve from nearby or reuse connections. (b) Transmission: 4 GB × 8 ÷ 1 Gbit/s = 32 s. Fix: more bandwidth, compression, or parallel transfers. (c) Queueing: at 97% utilization, wait is many times the service time. Fix: add capacity or shed load, since code tuning can't catch up with this.

**Common mistakes.** Answering "use a cache" for all three. Using 1 GB = 1,000 Mbit, which ignores the factor of 8.

## Debugging: The staircase trace

This is the N+1 pattern: 30 × 28 ms = 840 ms. The 40 ms gap may be queueing for a worker or a connection, or uninstrumented work. So check queue metrics. Fix: one batched query taking perhaps 40 ms, so about 100 ms in total, and a test that limits queries per request. Investigate the gap separately using pool wait metrics.

**Common mistakes.** Parallelizing 30 queries, which relieves latency but raises database load and pool pressure. Ignoring the gap.

## Capacity: How much does the wait target cost?

Let x = target ÷ 20 ms. Then ρ = 2x ÷ (1 + 2x). 5 ms: x = 0.25, ρ = 0.333, 16.7 requests per second per server, so 240 servers. 20 ms: x = 1, ρ = 0.667, 33.3 per second, 120 servers. 60 ms: x = 3, ρ = 0.857, 42.9 per second, 94 servers (93.3 rounded up). Halving servers from 240 to 120 costs just 15 ms of wait. Below that, returns shrink further.

**Common mistakes.** Assuming linear relationships. Forgetting that throughput per server is ρ ÷ service time.

## Design: A latency target for a global API

Reads: local replicas in each major region, with stale reads accepted where product allows. Writes: a single global primary fails for distant users, as 250 ms RTT plus processing and a new connection overruns the target. So home each user's data in their nearest region, with asynchronous replication elsewhere, and route writes to the home region. Tell the owner: writes from a traveling user may be slower; a user's writes in another region may be stale for a moment; strong global consistency on all writes can't meet 300 ms. See Cross-region replication and write ownership.

**Common mistakes.** Promising both worldwide strong consistency and low latency. Ignoring connection setup round trips.

## Incident: Fine by CPU, slow for users

Check real-user timing by region, and split it into DNS, connect, TLS, and TTFB. Check the new connection rate and whether the deployment changed idle timeouts, keep-alive, TLS configuration, an edge route, or DNS. A likely cause: an idle timeout or keep-alive change has forced new connections, adding two extra RTTs of more than 150 ms in total for European users. Roll back the change, and confirm connection reuse recovers. Follow up: add a reuse-ratio metric, plus regional real-user SLOs.

**Common mistakes.** Concluding there's no problem because server metrics are normal. Looking only at application changes.
