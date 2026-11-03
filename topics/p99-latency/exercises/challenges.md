# Challenges: P99 latency

## Concept: Which number is right?

Server A handled 90,000 requests with a p99 of 50 ms. Server B handled 10,000 with a p99 of 800 ms. What can you say about the combined p99 from these numbers alone? What would you need in order to compute it?

**Hint.** Find which ranks matter. The combined p99 leaves 1,000 requests above it.

## Debugging: Latency improved during the outage

During an outage, your error rate hits 40% and your p99 falls from 300 ms to 90 ms. Find two possible explanations, and how you would confirm which applies.

**Hint.** Think about which requests are no longer in the population.

## Capacity: Reduce the cost of histograms

You have 500 routes, 4 status classes, 20 buckets, and 1,000 instances, scraped every 30 s at an assumed 2 bytes per sample. Find series and storage per day. Then propose changes reducing it by at least 95% for long-term storage, while still supporting fleet SLOs.

**Hint.** Which label multiplies the most, and which questions actually require it?

## Design: A latency SLO for a low-traffic admin API

An admin API receives 50 requests per hour. A manager wants "p99 under 500 ms, alert within 5 minutes". Explain what is wrong, then design what you would do instead.

**Hint.** Count how many samples exist in 5 minutes, and how many of them would determine a p99.

## Incident: Dashboards green, customers angry

A large customer reports timeouts for the last 3 hours. Your overall p99 meets its target. Describe your investigation using histograms, traces, and logs, and name the lasting fixes.

**Hint.** A global percentile allows 1% of traffic to fail completely, and one customer can be under that 1%.
