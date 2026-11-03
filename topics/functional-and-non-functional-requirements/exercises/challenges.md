# Challenges: Functional and non-functional requirements

## Concept: Classify and split

Classify each as functional, quality, or constraint, and split any that mix them: (a) "Users can export invoices quickly to PDF." (b) "Must run on the existing Oracle licence." (c) "Search must return relevant results."

**Hint.** Ask what a tester would need in order to fail it. Then ask whether the sentence limits the solution or describes behavior.

## Debugging: The passing test that proved nothing

A team reports that their 99.9% and 200 ms target is "verified" using a 10-minute load test at 300 rps on a staging system with an empty database. Production traffic peaks at 4,000 rps, with a 2 TB dataset. Find every reason the evidence is weak. Then run the Python checker with a spec that represents this case, and explain the verdict.

**Hint.** Compare conditions one at a time: load, duration, data size, topology, and failure state.

## Capacity: Price the failure condition

A service must hold 6,000 rps at a safe 500 rps per instance, with 25% headroom. Compare the instance count (a) with no failure condition, (b) surviving one of three zones, and (c) surviving one of two zones. Then state the sentence that you would show the budget owner.

**Hint.** Apply headroom first, then scale by zones ÷ (zones − 1).

## Design: Requirements for a ride-hailing MVP

You have 10 minutes with a product lead to scope a ride-hailing MVP for one city with 5,000 peak concurrent drivers. Write five functional requirements, explicit non-goals, and five ranked quality requirements in five-part form. Name the top two architecture drivers.

**Hint.** Location updates dominate writes and matching dominates contention. Ask which failure is worst: a double-assigned driver, or a slow map?

## Incident: The target nobody owned

At 02:00 a primary database fails. Failover loses 40 seconds of writes. The design document states "high durability". Finance reports 300 payments captured with no order record. Write the immediate response steps and three follow-up actions concerning requirements.

**Hint.** Immediate work concerns customers and data. Follow-up work concerns why 40 seconds was never judged acceptable or not.
