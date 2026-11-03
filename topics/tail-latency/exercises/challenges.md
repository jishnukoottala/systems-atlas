# Challenges: Tail latency

## Concept: The team that met its target

Each of 20 services called in parallel meets "p99 under 100 ms". What share of whole requests take longer than 100 ms? What per-service percentile is required for the request to meet p99?

**Hint.** Use 1 − (1 − p)^k for the first. Rearrange for the second.

## Debugging: Hedging stopped helping

Six months ago, hedges won 70% of the time. Now they win 8%, while the hedge rate has doubled. What changed, and how do you find out?

**Hint.** When does a second copy not help? Compare leaf latency across replicas at the same moment.

## Capacity: Price a hedge policy

A service fans out to 50 shards at 2,000 queries per second. Hedge delay is at leaf p90. Each replica safely serves 2,500 requests per second. How many extra leaf calls per second does hedging add, and how many replicas per shard do you need with 25% headroom, before and after?

**Hint.** Hedging at p90 means about 10% of calls exceed the delay.

## Design: Tail tolerance for three products

Decide whether to use hedging, partial results, both, or neither for: (a) product search across 200 shards, (b) a bank account balance from 3 replicas, and (c) a recommendation widget using 40 models. Give reasons.

**Hint.** Ask two questions: can the operation run twice safely, and what does a missing piece mean?

## Incident: A deployment added 200 ms for a few requests

After a deployment, p50 is unchanged, p99 goes from 80 ms to 300 ms, and the slow requests are spread evenly across instances, at a rate of about one every few seconds per instance. What are your top hypotheses and how do you test them?

**Hint.** Periodic pauses that appear on each instance suggest something happening inside the process.
