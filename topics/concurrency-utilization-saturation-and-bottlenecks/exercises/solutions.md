# Solutions: Concurrency, utilization, saturation, and bottlenecks

## Concept: Name the signal

(a) Saturation of runnable or blocked tasks, as many wait, though on Linux, load average also includes uninterruptible I/O, so check further. (b) Concurrency with room to spare: fine. (c) Saturation of the pool: either it's too small or queries are slow. (d) High utilization with almost no queue: it's busy but not limiting, and for devices with internal parallelism such as SSDs, "100% busy" doesn't even mean full.

**Common mistakes.** Treating every high percentage as a problem. Reading load average as purely CPU on Linux.

## Debugging: Low CPU, long latency

One core at 100% across 8 cores is 12.5%, so the event loop is probably pinned. The fastest number is event-loop lag or per-thread CPU. Then take a CPU profile to find the blocking function, such as a synchronous JSON parse of a large payload, a slow regular expression, or synchronous crypto. Fix: offload to a worker, stream, or run more processes. If per-thread CPU is low, check waits on connection pools and downstream services instead. See CPU, heap, lock-contention, and I/O profiling.

**Common mistakes.** Concluding from 13% that CPU isn't the problem. Adding more machines before profiling.

## Capacity: Find the limit and size the fix

API: 24 ÷ 0.012 = 2,000. Cache: 4 ÷ 0.001 = 4,000. Database CPU: 16 ÷ 0.010 = 1,600. Lock: 1 ÷ 0.003 = 333. Storage: 8 ÷ 0.008 = 1,000. So X_max = 333 per second, set by the lock. After 8 partitions, the lock gives 2,667, and storage at 1,000 becomes the bottleneck, so X_max = 1,000. A tripling, from removing one lock. To go beyond, add storage.

**Common mistakes.** Forgetting to divide by server count. Stopping after fixing the first bottleneck, without computing the next one.

## Design: Place the limits

Database: 1,000 × 0.005 = 5 in flight, so a pool of perhaps 20. Partner: 100 per second × 0.5 s = 50 in flight, so a limit of perhaps 75. With a slowdown to 5 s: 100 × 5 = 500 in flight. In one shared pool or thread pool, partner calls would take all the slots, and database calls would starve, taking everything down. Separate limits (bulkheads) cap partner work at 75, rejecting the rest, while database traffic remains healthy. Add a short timeout and a circuit breaker. See Bulkheads and isolation pools and Circuit breakers.

**Common mistakes.** Sizing for normal conditions only. Using one pool since it's simple, so that a slow partner takes down unrelated features.

## Incident: Scale-out made things worse

The application tier wasn't the bottleneck. More instances meant more concurrent queries and more connections at the database, beyond its knee, raising contention and context switching, so demand per query rose and throughput dropped. Immediately: reduce concurrency at the database by capping instances, lowering per-instance pools, or enabling a shared connection proxy, then shed optional traffic. Lasting fix: limit total database concurrency with a proxy, tie autoscaling limits to database capacity, and alert on database saturation in scaling decisions.

**Common mistakes.** Scaling the database first without looking at concurrency. Treating autoscaling as safe by default.
