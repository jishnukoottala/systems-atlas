# Solutions: Functional and non-functional requirements

## Concept: Classify and split

(a) Mixed. Functional: "An account admin can export an invoice as PDF." Quality: "95% of exports finish within 5 seconds for invoices with up to 1,000 lines." (b) Constraint: it limits the solution space and isn't a behavior. Ask whether it is real and when the licence ends. (c) Functional-looking but untestable. Relevance needs a measure, like "normalized discounted cumulative gain at 10 of at least 0.7 on the labeled query set."

**Common mistakes.** Calling (b) a non-functional requirement and moving on, which loses the question of whether the constraint is real. Accepting "relevant" because it sounds obvious.

## Debugging: The passing test that proved nothing

Load is 7.5% of peak. Ten minutes cannot demonstrate a 28-day availability figure, and it misses leaks and compaction. An empty database hides index depth, cache misses, and bad query plans. Staging may differ in topology, and no failure was injected. In the checker, set `min_load_rps` to 4000 and `window_days` to 28 with a measurement of 300 rps and 1 day: the verdict is `inconclusive`. The correct report is "not yet shown", which is different from pass or fail.

**Common mistakes.** Treating the problem as only about load. Saying the target failed, when there simply is no evidence yet.

## Capacity: Price the failure condition

Base: 6,000 ÷ 500 = 12. With headroom: 12 ÷ 0.75 = 16. (a) 16 instances. (b) 16 × 3 ÷ 2 = 24. (c) 16 × 2 ÷ 1 = 32. Sentence: "Surviving a zone loss raises the fleet from 16 to 24 instances, which is 50% more. Using only two zones would make that 100% more."

**Common mistakes.** Adding one instance instead of a zone's worth. Dividing 6,000 by the failure-adjusted capacity without headroom. Quoting technical numbers with no cost.

## Design: Requirements for a ride-hailing MVP

Functional: a rider can request a trip; a rider sees an estimate before confirming; a driver receives and accepts offers; both see live location; a rider pays at trip end. Non-goals: scheduled rides, pooling, multiple cities. Quality: (1) a driver is never assigned to two active trips, checked by a continuous invariant audit; (2) p95 offer dispatch at most 2 s up to 500 requests per minute; (3) location ingest of 5,000 drivers every 4 s, so 1,250 writes per second with p99 freshness at most 8 s; (4) trip state is durable with RPO zero within a region; (5) 99.9% availability of request and accept journeys over 28 days. Drivers: assignment correctness and high-rate location ingest. These push you toward a strongly consistent assignment store and a separate store for ephemeral location.

**Common mistakes.** Giving a single availability figure. Omitting non-goals. Listing ten equally important qualities, since an unranked list makes no decision.

## Incident: The target nobody owned

Immediate: declare an incident and name a commander; stop further loss if the problem is ongoing; reconcile against the payment provider's records, since it holds the truth for those 300 charges; restore or refund; tell customers and finance. Follow-up: (1) state RPO per data class, with an owner in finance signing the payments number; (2) measure replication lag as an SLI and alert when it threatens the RPO; (3) review all tier-1 data stores for unquantified durability language and test failover to confirm actual loss.

**Common mistakes.** Blaming the database. Writing "improve durability" as the action item, which repeats the defect in new words. See Postmortems.
