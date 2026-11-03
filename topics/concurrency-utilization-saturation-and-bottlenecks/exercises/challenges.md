# Challenges: Concurrency, utilization, saturation, and bottlenecks

## Concept: Name the signal

For each observation, say if it shows concurrency, utilization, saturation, or errors, and what you'd conclude: (a) load average is 40 on 8 cores, (b) 12 active of 20 connections, zero waiting, (c) pool wait averaging 300 ms, (d) disk 95% busy with a queue depth of 0.1.

**Hint.** Saturation means work is waiting. Being busy with no queue isn't yet a problem.

## Debugging: Low CPU, long latency

A Node.js service on an 8-core machine shows 13% CPU, and latency has climbed from 20 ms to 900 ms at the same request rate. What would you check, and in what order? What single number gives the fastest answer?

**Hint.** 13% of 8 cores is about what one busy core looks like.

## Capacity: Find the limit and size the fix

Measured demands: API CPU 12 ms on 24 cores, cache 1 ms on 4 cores, database CPU 10 ms on 16 cores, one global sequence lock at 3 ms, and storage at 8 ms across 8 volumes. Find X_max and the bottleneck. Then find the next one after you remove the lock with 8 partitions, and the new X_max.

**Hint.** Max rate = servers ÷ demand. Compute it for each.

## Design: Place the limits

A service calls a shared database and a slower partner API. Partner calls take 500 ms, and database calls 5 ms. At 1,000 requests per second, 10% call the partner, and all call the database. How would you size and arrange limits and pools? What happens if the partner slows to 5 s with one shared pool?

**Hint.** Use Little's Law for each dependency, and then for the slowdown case.

## Incident: Scale-out made things worse

At peak, autoscaling added 50% more application instances. Database CPU went from 60% to 95%, and throughput fell. Explain this with these concepts. What's your immediate action and your lasting fix?

**Hint.** Where was the bottleneck? How does each instance affect connections and concurrency at the database?
