# Challenges: Workload characterization and traffic modeling

## Concept: Same mean, different system

Two services each average 1,000 rps. Service A has a PMR of 1.2, reads are uniform across keys, and all objects are 1 KB. Service B has a PMR of 8, 1% of keys get half the reads, and sizes span 1 KB to 50 MB. What would you design differently for B?

**Hint.** Consider each difference on its own: time, keys, and size.

## Debugging: The hourly mystery

Your dashboard, which uses 5-minute averages, shows 40% CPU at all times, yet users report errors at the top of each hour. How would you find the cause, using only access logs and the Python tool?

**Hint.** Change the resolution. Then fold time by minute of hour.

## Capacity: Forecast the shard count

Current state: 20,000 reads per second mean, 1-minute PMR of 2.5, 90% hit rate, and 5% monthly growth. Each shard handles 1,000 reads per second safely. How many shards in 18 months, with 25% headroom? How many if the hit rate drops to 80%?

**Hint.** Growth factor is 1.05^18. Headroom means dividing by 0.75.

## Design: Characterize a system that does not exist yet

You are launching a collaborative whiteboard. No traffic exists. Write a workload model with parameters, what evidence backs each one, and how you would replace estimates with data in the first 30 days.

**Hint.** Consider sessions: the number of participants, the operations per second per participant, and how long a board lives.

## Incident: The traffic that was not users

At 14:10, traffic triples and the database saturates. The marketing team confirms no campaign is running. What do you do in the first 15 minutes, using traffic characterization?

**Hint.** Segment first. Then compare the shape of this traffic with normal traffic.
