# Challenges: Back-of-the-envelope capacity estimation

## Concept: Which resource limits this?

A photo service has 10M uploads per day at 2 MB each, 500M views per day at 200 KB each, and keeps everything for 10 years with 3 replicas. Calculate peak upload and view bandwidth at a peak ratio of 3, and total storage. Which is the hardest resource?

**Hint.** Work out bytes per second first, then multiply by 8.

## Debugging: Find the errors

A design document says: "5M users each send 40 messages per day: 200M per day, which is 2,300 per second. Each is 1 KB, so 2.3 MB/s, so 2.3 Mbit/s of bandwidth. Storage for 2 years: 2.3 MB × 365 × 2 = 1.7 GB." Find the errors and correct them.

**Hint.** Check units on every line. There are at least two errors. Look at the storage formula closely.

## Capacity: Size a timeline cache

A service has 50M daily users, each loading their timeline 20 times per day. A timeline is 800 ids at 8 bytes. Cache timelines for 20% of daily users. Compute cache memory and peak reads at a peak ratio of 4. If each cache node holds 64 GB of usable memory and serves 100,000 reads per second, how many nodes do you need, and which constraint decides?

**Hint.** Compute the node count separately for memory and throughput, and then take the larger.

## Design: Should this be sharded?

A SaaS app has 200,000 tenants, a 3 TB relational database that's growing at 40 GB per month, and a peak of 2,000 writes and 15,000 reads per second. The team wants to shard now. Using estimates, argue for or against this, and state which numbers you would measure to confirm.

**Hint.** Project storage and load forward over 2 years, compare with what a large single instance plus replicas offers, and consider the migration cost.

## Incident: The backfill that took the site down

A backfill rewrites 50 TB over a 10 Gbit/s link shared with production, which peaks at 6 Gbit/s. It was planned as "about 6 hours". What should the estimate have said? How would you run it safely?

**Hint.** 10 Gbit/s is 1.25 GB/s, and only the spare capacity is available.
