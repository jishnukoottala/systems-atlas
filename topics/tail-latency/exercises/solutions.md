# Solutions: Tail latency

## Concept: The team that met its target

1 − 0.99^20 = 18.2% of requests are slower than 100 ms. For a request-level 1%: p = 1 − 0.99^(1/20) = 0.05%, so each service must meet the target at p99.95. Every service can be meeting its own objective while the product fails its target.

**Common mistakes.** Assuming that p99 at each layer gives p99 overall. Forgetting that this assumes independence, and that correlated slowness changes the numbers.

## Debugging: Hedging stopped helping

Slowness has probably become correlated: both replicas are slow together. Candidate causes: higher utilization overall, shared storage, synchronized background work, or a slow shared dependency. Plot the latency of paired replica calls and check their correlation, and compare with utilization and deployment changes. A win rate of 8% means hedges are mostly wasted load, so reduce the hedge budget and fix the shared cause.

**Common mistakes.** Reducing the delay, which makes more copies with no gain. Failing to track win rate at all.

## Capacity: Price a hedge policy

Base leaf calls: 2,000 × 50 = 100,000 per second, and hedges add 10,000. Per-shard load: 2,000 before and 2,200 after. Replicas with headroom: 2,000 ÷ 0.75 ÷ 2,500 = 1.07, so 2 before. 2,200 ÷ 0.75 ÷ 2,500 = 1.17, so still 2 after. Both need 2 replicas after rounding, so the shared network and CPU costs are what grow. Moving the delay to p95 halves that cost.

**Common mistakes.** Assuming hedging at p90 means sending hedges for all requests. Using requests rather than leaf calls when counting load.

## Design: Tail tolerance for three products

(a) Both. Reads are idempotent, a missing shard modestly reduces recall, and the response can be marked partial. (b) Hedging is possible for reads if version checks prevent stale values, but partial results don't apply, since a balance can't be partly correct. Consistency requirements come first. (c) Partial results with no hedging: models are expensive, so a hedge costs a lot, and the widget can be fine with fewer candidates, or disappear altogether. Use a strict deadline.

**Common mistakes.** Applying the same policy to all three. Ignoring how expensive a hedge would be for model inference.

## Incident: A deployment added 200 ms for a few requests

Top hypothesis: garbage-collection pauses from increased allocation or a smaller heap. Check GC pause metrics against slow-request timestamps. Others: a periodic task blocking an event loop, a new synchronous log write, and connection churn, with TCP retransmission. Compare with a canary, or roll back to confirm. Roll back first if SLO burn is serious, then diagnose. Follow-up: add a runtime pause metric and event-loop lag, and a canary comparison on p99. See Garbage collection.

**Common mistakes.** Adding instances, which doesn't reduce pauses. Looking only at p50, where this is invisible.
