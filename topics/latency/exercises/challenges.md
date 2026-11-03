# Challenges: Latency

## Concept: What dominates?

For each case, name the dominant delay and one effective fix: (a) a 2 KB API response from Tokyo to São Paulo, (b) a 4 GB file between two machines on a 1 Gbit/s link in one data center, (c) a 5 KB response within a data center at 97% CPU.

**Hint.** Compute the numbers. Distances are about 18,500 km for (a).

## Debugging: The staircase trace

A trace shows `GET /orders` at 900 ms, with 30 consecutive 28 ms database spans, plus a 40 ms gap before the first span. Explain each visible feature, then give the fix and the expected result.

**Hint.** Thirty sequential spans of equal size suggest a loop. A gap is time spent somewhere uninstrumented.

## Capacity: How much does the wait target cost?

Service time is 20 ms with low variance. Peak traffic is 4,000 requests per second. Using M/D/1 and one queue per server, compare server counts for mean waits of 5 ms, 20 ms, and 60 ms.

**Hint.** Set ρ ÷ (2(1 − ρ)) × 20 equal to the target, and solve for ρ.

## Design: A latency target for a global API

You must offer p99 under 150 ms for reads, and under 300 ms for writes, worldwide. Regions are 80 to 250 ms apart. Sketch the data placement, what's achievable physically, and what you would tell the product owner.

**Hint.** Compare 300 ms with the RTT between the farthest regions. Then ask if each user's data really needs a global home.

## Incident: Fine by CPU, slow for users

Users in Europe report slowness since a deployment an hour ago, while p99 at the US load balancer is unchanged, and CPU is flat. What do you check and in what order? What change could cause this?

**Hint.** The server's view can't see time spent before the request arrives. Think of connections.
