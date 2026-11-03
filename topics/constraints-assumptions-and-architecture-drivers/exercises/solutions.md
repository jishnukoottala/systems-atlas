# Solutions: Constraints, assumptions, and architecture drivers

## Concept: Sort the kickoff notes

(a) Soft constraint: ask the platform team what happens if another broker is used, and who carries the operational cost. (b) Hard constraint if confirmed by legal: verify the exact wording, as it may be broader or narrower than stated. (c) Assumption: measure it. (d) An untestable requirement: rewrite it, for example "a new on-call engineer can complete a failover using the runbook in under 15 minutes."

**Common mistakes.** Treating all "must" statements as hard. Accepting (c) because it sounds common.

## Debugging: The design that kept getting more expensive

Count reads by key over a representative window, sort, and compute the cumulative share at 20% of distinct keys. If it is now 45%, for example, the assumption is refuted: likely personalization or a long-tail feature changed the access pattern. Register the refutation, then reopen the cache decision: it may need a larger tier, a different admission policy, or caching at a different layer. Add the skew measurement to the dashboard. See Cache admission and eviction algorithms.

**Common mistakes.** Only resizing the cache. Looking at one hour rather than a whole cycle of traffic.

## Capacity: Find the assumption that matters

Base: 138.9 mean per second × 3 = 416.7, ÷ 200 = 2.08, so 3 nodes. Users: 1 million gives 0.69, so 1 node; 8 million gives 5.56, so 6 nodes; spread 5. Messages: 2 gives 1.04, so 2; 10 gives 5.21, so 6; spread 4. Peak: 2 gives 1.39, so 2; 5 gives 3.47, so 4; spread 2. User count has the widest swing, and no single input crosses 8 nodes. But two at once can: 8,000,000 × 10 ÷ 86,400 × 3 ÷ 200 = 13.9, so 14 nodes. So check combined cases too, since one-at-a-time analysis hides them.

**Common mistakes.** Stopping at the single-input result. Forgetting to divide by 86,400.

## Design: Drivers for a video-conference recording feature

Constraints: consent and retention rules in each jurisdiction, confirmed by legal; contractual data residency. Assumptions: 10% of meetings get recorded; average 45 minutes at 2 Mbit/s; 80% of views happen within a week. Drivers: storage volume (10x means tiering and a different cost model), processing latency requirement (ten times faster means real-time pipelines rather than batch), and per-tenant residency (ten times as many regions changes deployment topology). Data: 45 min × 60 × 2 Mbit/s ÷ 8 = 675 MB per recording.

**Common mistakes.** Naming features as drivers. Leaving out legal constraints until the end. Giving drivers that would not change the diagram.

## Incident: Refuted during an outage

During: declare the incident, cap outbound calls below the actual limit, shed or queue non-critical calls, and degrade the feature. Contact the vendor and request an increase. Afterwards: find where 500 came from (probably a sales conversation or old documentation), get limits in writing, record the assumption with an owner, test limits in a sandbox where allowed, watch `429` rate and quota use as metrics, and review other vendor assumptions the same way. See Rate limiting and Backpressure.

**Common mistakes.** Only adding retries, which worsens the overload. Calling this a vendor failure when your design assumed an unverified number.
