# Solutions: Latency budgets and critical-path analysis

## Concept: Where do you save time?

Total: 10 + 50 + 20 = 80 ms. B to 40: path is 70, saves 10. B to 20: C at 30 becomes longest, so the total is 60, saving 20, not 30. C to 10: saves 0, as C isn't critical. D to 10: saves 10, since D is on every path.

**Common mistakes.** Assuming B to 20 saves 30. Thinking that speeding up C matters because it's slow in absolute terms.

## Debugging: The critical path that moved

The critical path over all traces differs from that of slow traces. Slow traces may be dominated by ranking, or by a specific slow subset. Filter traces at or above p99 and recompute critical-path contribution. Also, cutting p50 wouldn't help if its tail stayed the same. Report the step's own p99, and its share of slow-trace critical paths. Work should target what dominates slow requests.

**Common mistakes.** Using average traces to make decisions about tail targets. Concluding that the optimization was measured incorrectly.

## Capacity: Design the timeouts

Sum: 350 ms. Available after reserve: 425 ms, leaving 75 ms to distribute. Budgets could be A 25, B 95, C 180, D 125. D at normal: 1,000 × 0.1 s = 100 calls. Fixed 2 s: 2,000 calls during a stall. Deadline-derived: at most the remaining budget, here 500 − 300 (time used so far by others, at their budget) = 200 ms, or 200 calls. That's a tenfold reduction in worst-case pool use.

**Common mistakes.** Setting all timeouts at the overall target, so they stack up. Forgetting to keep some reserve.

## Design: Shorten a checkout

Accept the order after reserving inventory and basic fraud checks, and capture payment asynchronously, telling the customer "order received". Path: gateway 5, auth 10, cart 25, parallel stage at 60 (with fraud's deep model made asynchronous and a fast model at 30), write 15, for 115 ms. Effect on guarantees: the customer may later get a "payment failed" message, requiring a compensating flow, so you need a saga and clear messaging. Deep fraud decisions arrive late, so some orders get cancelled. Product must approve these. See Saga patterns.

**Common mistakes.** Removing fraud checks outright. Ignoring the failed-payment path, or hiding from product that it is a change in user experience.

## Incident: The 800 ms retry

The likely culprit is a client-side retry or connection wait, with a default timeout around 800 ms, perhaps after a dropped connection. Cart's call fails or stalls, and then retries with success, so the downstream service sees only the fast retry. Check client retry and timeout configuration, connection-pool wait, and any recent network or deployment changes. Short term: lower the timeout to the budget, and fix the cause of dropped connections. Later: instrument each retry attempt as a span, and propagate deadlines, so a retry gets only the remaining budget.

**Common mistakes.** Trusting each service's own healthy metrics. Assuming the gap is meaningless, when it's the strongest clue.
