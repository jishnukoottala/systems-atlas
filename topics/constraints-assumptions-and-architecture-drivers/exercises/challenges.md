# Challenges: Constraints, assumptions, and architecture drivers

## Concept: Sort the kickoff notes

Classify each one and name the next action: (a) "We have to use Kafka because the platform team runs it." (b) "Data for German customers must stay in the EU." (c) "Peak traffic is about 3x mean." (d) "The system should be easy to operate."

**Hint.** Ask who could change it, and what evidence would disprove it.

## Debugging: The design that kept getting more expensive

A team's cache keeps growing, and hit rate has dropped from 92% to 61% in a year, although read traffic is flat. Their design says "80% of reads go to 20% of keys". Use a logged key sample to test that belief. What do you measure, and what do you do if the skew has flattened?

**Hint.** Compute the share of reads going to the top 20% of keys. Compare it with the design value and check what changed in the product.

## Capacity: Find the assumption that matters

Users: 1 to 8 million, base 3 million. Each sends 2 to 10 messages per day, base 4. Peak ratio: 2 to 5, base 3. Each node takes 200 messages per second. Which input has the widest swing? Would the limit of 8 nodes be crossed?

**Hint.** At base: 3,000,000 × 4 ÷ 86,400 × 3 ÷ 200. Vary one input at a time and round up.

## Design: Drivers for a video-conference recording feature

Recording is being added to a 500,000-user conferencing product, with recordings stored for 90 days. List two hard constraints that you would verify, three assumptions, and three drivers. For each driver, explain the ten-times test.

**Hint.** Think about consent law, storage volume, and whether processing happens during or after the meeting.

## Incident: Refuted during an outage

A vendor rate-limits you at 100 requests per second during the year's largest sale, and your design assumed 500. Requests pile up and threads exhaust. What do you do during the incident, and which follow-up actions address the assumption rather than just the symptom?

**Hint.** Protect your own system first. Then trace how 500 got into your documents.
