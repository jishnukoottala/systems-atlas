# Solutions: Throughput

## Concept: Name the unit and the limit

Link: 10 Gbit/s = 1.25 GB/s, and ÷ 50 KB = 25,000 rps. API: 40,000 rps. Database: 6,000 ÷ 2 = 3,000 rps. So the limit is 3,000 rps, and the database sets it. Caching half the queries would raise it to 6,000 rps, and the next limit remains a long way off.

**Common mistakes.** Comparing raw numbers without converting them. Treating 10 Gbit/s as 10 GB/s.

## Debugging: Busy, yet useless

Unbounded at 1,500 rps, throughput stays near 1,000, but response time grows steadily, as the queue grows by 500 requests each second. Soon wait exceeds the 200 ms deadline, so goodput falls to about 21 requests per second, roughly 2% of throughput. With a limit of 50, queue wait is at most about 50 ms, so nearly all accepted work finishes in time, and goodput stays close to 1,000 while the rest get quick rejections. Change one: bound the queue relative to the deadline. Change two: propagate deadlines and drop expired work.

**Common mistakes.** Adding servers before recognizing that completions were wasted. Believing rejecting requests reduces useful output: here it increases it massively.

## Capacity: Batch or partition?

Without batching: 250 per second, so 20 partitions would be needed. At b = 50: cost is 5 ms, for 10,000 per second. Fill time is 10 ms, under the 20 ms limit. Utilization: 100 batches per second × 5 ms = 50%. So b = 50 works on one row. At b = 100: fill takes 20 ms, right at the limit, and cost is 6 ms, for 16,667 per second, so there's little reason to go larger. Choose b near 50, and flush on a 10 ms timer for quiet periods.

**Common mistakes.** Forgetting the flush timer, so a low-traffic item waits forever. Forgetting that added latency includes both fill and commit time.

## Design: An ingestion pipeline for 1 million events per second

Volume: 500 MB/s, or 43.2 TB per day before compression. Stateless collectors take events, and a partitioned log buffers them, with partition count from per-partition throughput. For example, at 10 MB/s per partition, 50 partitions at capacity, about 75 with headroom. Writers batch into files every 60 s or at a size such as 256 MB, compressed and columnar. If storage slows, the log absorbs the backlog: retention of 24 hours is 43.2 TB times replication. Writers lag and catch up with spare parallelism. Collectors must reject or sample if the log itself saturates. Monitor consumer lag in seconds. Small-file count is a throughput concern for the query side.

**Common mistakes.** Writing each event to object storage individually. Ignoring replication in sizing. Having no plan for sustained downstream slowdown.

## Incident: Autoscaling made it worse

Cause: 100 instances × 20 connections each = 2,000, beyond the database limit. Scaling the stateless tier moved pressure onto the actual bottleneck, and connection setup itself added load. Response: stop autoscaling, roll the fleet back to a safe number or reduce per-instance pool size, shed non-critical traffic, and confirm the database recovers. Lasting fixes: a connection proxy or multiplexing layer; scaling limits derived from database capacity; and concurrency limits per instance so that excess gets rejected at the top. Add a load test covering scale-out. See Connection pooling and Autoscaling.

**Common mistakes.** Raising the database connection limit alone, which risks memory exhaustion and more contention. Treating autoscaling as universally safe.
