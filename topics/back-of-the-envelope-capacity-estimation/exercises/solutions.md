# Solutions: Back-of-the-envelope capacity estimation

## Concept: Which resource limits this?

Uploads: 10M × 2 MB = 20 TB per day, or 231 MB/s mean, 694 MB/s peak, or 5.6 Gbit/s. Views: 500M × 200 KB = 100 TB per day, or 1.16 GB/s mean, 3.47 GB/s peak, or 27.8 Gbit/s. Storage: 20 TB × 3,650 × 3 = 219 PB. Storage is the dominant cost and drives the use of tiered object storage. Viewing bandwidth points to a CDN.

**Common mistakes.** Forgetting replication, or using the mean for bandwidth. Treating raw bandwidth as the problem when storage cost dominates.

## Debugging: Find the errors

Rate is correct: 200M ÷ 86,400 = 2,315 per second. Throughput of 2.3 MB/s is correct. Bandwidth is wrong: 2.3 MB/s × 8 = 18.5 Mbit/s. Storage is wrong: it multiplied a per-second rate by days. Correct: 200M × 1 KB = 200 GB per day, × 730 days = 146 TB, before replication, or 438 TB with 3 replicas. The error is a factor of about 85,000. Peak is missing also, at 3 times about 55 Mbit/s.

**Common mistakes.** Spotting only the bits-and-bytes error and missing the far larger one in storage. Forgetting that message fan-out and delivery aren't included.

## Capacity: Size a timeline cache

Timeline size: 800 × 8 B = 6.4 KB. Cached timelines: 10M. Memory: 10M × 6.4 KB = 64 GB, or 1 node. Reads: 50M × 20 = 1B per day, or 11,574 per second mean, 46,296 at peak, or less than 1 node. So 1 node suffices on paper for both. For availability, you'd use at least 3 replicated nodes. Neither memory nor throughput is the deciding constraint: availability is.

**Common mistakes.** Reporting only the math and forgetting availability. Missing that memory overhead makes 64 GB of data not fit in 64 GB exactly.

## Design: Should this be sharded?

In two years, storage reaches 3 TB + 960 GB ≈ 4 TB, which is within a large single instance's capability. Reads can go to replicas and a cache. Writes at 2,000 per second are plausible on modern hardware, depending on the row size and indexes. So the initial answer is don't shard yet. Measure: write saturation, lock contention, replication lag, largest-tenant share, and vacuum or compaction load. Do prepare: add tenant IDs on all tables so that sharding stays possible later. Re-evaluate when write capacity reaches about 50%.

**Common mistakes.** Stating "sharding is needed at scale" with no numbers. Forgetting the ongoing costs of sharding, like cross-shard queries.

## Incident: The backfill that took the site down

At full link speed: 50 TB ÷ 1.25 GB/s = 40,000 s, or 11.1 hours. So the planned 6 hours would be impossible even if production were idle. During peak, only 4 Gbit/s (500 MB/s) is free, and with safety at 2 Gbit/s, it takes 50 TB ÷ 250 MB/s = 200,000 s = 55.6 hours. Safe plan: throttle to a rate tied to measured production traffic, run off-peak when possible, add a kill switch, watch latency, and resume from checkpoints. See Online schema changes and large backfills.

**Common mistakes.** Blaming the network. Using full bandwidth with no margin for production, and having no way to pause the job.
