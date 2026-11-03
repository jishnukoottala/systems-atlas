# Challenges: Throughput

## Concept: Name the unit and the limit

A system has a 10 Gbit/s link, an API tier doing 40,000 rps, and a database doing 6,000 queries per second. Each request runs 2 queries and returns 50 KB. What is the maximum request rate, and which resource sets it?

**Hint.** Convert every limit into requests per second.

## Debugging: Busy, yet useless

Your service shows 1,000 completions per second and 95% CPU, while client-side success has dropped to 3%. Reproduce this using the simulator, and explain the mechanism. What two changes would you make?

**Hint.** Run the sweep at 1,500 rps with and without `--queue-limit 50`, and compare goodput with throughput.

## Capacity: Batch or partition?

A hot row handles 1 write per 4 ms. You need 5,000 writes per second, with an added latency limit of 20 ms. A batch of size b costs 4 ms + 0.02 ms × b. Is batching enough? What batch size do you pick?

**Hint.** Throughput = b ÷ (4 + 0.02b) writes per millisecond. Fill time at 5,000 per second is b ÷ 5 ms.

## Design: An ingestion pipeline for 1 million events per second

Design ingestion of 1,000,000 events per second at 500 bytes each, written to object storage for analytics, tolerating up to 60 seconds of delay. Identify the bottleneck at each stage, the batching approach, and the behavior when downstream slows.

**Hint.** Calculate MB/s. Then ask what the 60-second tolerance lets you do. Think about what happens to the buffer when storage slows.

## Incident: Autoscaling made it worse

During a traffic spike, autoscaling doubled the fleet, and shortly after, the database hit its connection limit. All requests then started failing. Give your immediate response, the root cause, and two lasting fixes.

**Hint.** Multiply fleet size by pool size per instance. Compare with the database's connection limit.
