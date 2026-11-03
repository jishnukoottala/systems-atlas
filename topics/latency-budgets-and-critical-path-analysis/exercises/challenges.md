# Challenges: Latency budgets and critical-path analysis

## Concept: Where do you save time?

Graph: A takes 10 ms, then B (50 ms) and C (30 ms) run in parallel, then D takes 20 ms. What's the total? What does each of these save: B to 40, B to 20, C to 10, D to 10?

**Hint.** Find the longest path, then note when another path takes over.

## Debugging: The critical path that moved

Traces show that the search service's critical path is index lookup in 60% of requests and ranking in 35%. A team cut index lookup's p50 by half, yet the journey's p99 didn't change. Why might that be? How would you check?

**Hint.** A p50 improvement and a p99 outcome concern different requests. Filter to the slow traces.

## Capacity: Design the timeouts

Target: 500 ms overall at a 1,000 requests-per-second peak. Path: A (20 ms), B (80 ms), C (150 ms), D (external, 100 ms). Reserve 15%. Set a budget per step, and find the worst-case concurrent calls to D using a fixed 2 s timeout versus a deadline-derived timeout.

**Hint.** Allocate proportionally from 425 ms. D's concurrency is rate × timeout.

## Design: Shorten a checkout

Using the checkout graph in this lesson, propose design changes to reach a 150 ms p99 for the customer-visible response. Say which steps stay synchronous, and what guarantee each change affects.

**Hint.** Payment is 120 ms and external. Ask what the customer truly needs to know before seeing a response.

## Incident: The 800 ms retry

Checkout's p99 jumped from 280 ms to 900 ms, and each service reports normal latency. Traces show one 800 ms gap in slow requests, inside the cart span. What's happening? What do you change now and later?

**Hint.** A gap within a span is time not spent in any child span. Think about what might wait 800 ms and then quietly retry.
