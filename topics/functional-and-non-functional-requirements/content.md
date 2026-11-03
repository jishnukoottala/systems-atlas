lastReviewed: 2026-11-03

## Orientation

### Definition

A functional requirement states what a system must do: an observable behavior, for a named actor, under stated conditions. A non-functional requirement, more precisely a quality requirement, states how well the system must do it, as a measurable target over a defined window and load.

### Why it matters

Functional requirements determine which features exist. Quality requirements determine the architecture. A note-taking app at 100 requests per second with 99% availability and a note-taking app at 1,000,000 requests per second with 99.99% availability have the same features and almost nothing else in common. Most expensive design errors come from quality requirements that were never stated, stated without a number, or invented by the engineer because nobody asked the business. Principal engineers are valued for finding those gaps before they turn into a rebuild.

### Learning objectives

- Distinguish a behavior from a quality attribute, and split statements that mix the two.
- Rewrite a vague statement as a falsifiable one with metric, target, window, and load condition.
- Rank quality attributes and find which of them are architecture drivers.
- Run requirement elicitation in a 45-minute design interview without stalling.
- Connect each quality requirement to the evidence that will show whether it holds in production.

## Production scenario

A retailer asks for a "fast, highly available checkout" before a seasonal sale. Today it handles 150 orders per second at peak, and the sale forecast is 2,000. Two teams interpret the request. Team A targets 99.99% availability across all of checkout, including recommendations and the loyalty widget, and proposes an active-active multi-region rebuild costing about nine engineer-years. Team B asks the question Team A skipped: what has to stay available? The answer is narrow. A customer must be able to pay and receive an order confirmation. Recommendations may vanish. Loyalty points may post 30 minutes late. Inventory counts may be stale for 60 seconds on browse pages, but never at the commit step.

The final requirement reads: "`POST /orders` returns a final result with p99 server latency at or below 300 ms and at least 99.95% success, measured over 28 days and at up to 2,000 orders per second, excluding client-caused 4xx responses." Team B's design isolates that one path and costs a fraction of the rebuild. The features did not change. The sentence did, and the sentence chose the architecture.

## Mental model

### Analogy

Think of commissioning a bridge. Functional requirements say that it connects two banks and carries cars and pedestrians. Quality requirements say it carries 40-tonne trucks, stays open in 120 km/h wind, and lasts 75 years. Two bridges meeting the first list can differ tenfold in cost, because of the second list.

### Where the analogy breaks

A bridge has stable loads and physics that do not change after opening. Software load can grow 100-fold in a year, and quality requirements change as the business changes. A bridge also fails as a unit, while software fails partially: a system may be up for one tenant and down for another. So software requirements need to be scoped by user journey, and they must be revisited on a schedule. Treating them as a one-time contract is where the analogy misleads.

### Entities, state, flow, and invariants

- **Entities:** stakeholders, actors, user journeys, requirements, constraints, measurements.
- **State:** a requirement moves through proposed, agreed, verified, and retired or renegotiated.
- **Flow:** stakeholder intent becomes a stated requirement, which becomes a design driver, then a test or service-level indicator, then evidence.
- **Invariant 1:** every quality requirement has evidence that could prove it false.
- **Invariant 2:** every requirement has one accountable owner who can agree to changing it.
- **Invariant 3:** evidence from below the required load is not evidence.

## Foundations

### Concepts and terminology

| Term | Meaning | Example |
| --- | --- | --- |
| Functional requirement | Observable behavior | A rider can cancel a trip before pickup |
| Quality attribute | A property judged by degree | Latency, availability, durability, operability |
| Constraint | A non-negotiable limit on the solution space | Must run in the EU; team of six; launch by March |
| Assumption | Believed to be true, unverified | Reads outnumber writes 50 to 1 |
| Architecture driver | A requirement that, if changed, changes the structure | RPO of zero forces synchronous replication |
| Scenario | Stimulus, environment, response, and measure | At 2,000 rps with one zone lost, p99 stays under 500 ms |

The term "non-functional" is misleading, since these requirements are often the main reason a system exists. A payment system that loses a ledger entry fails its purpose. [[a2]] extends this vocabulary to constraints and drivers.

### First-principles explanation

Any computation has a behavior and a resource envelope. Behavior can be checked on one machine with one request. The envelope cannot: latency under load, survival of a failure, and durability across years only exist at scale or over time. Features usually compose: adding a feature rarely breaks another. Qualities interact: stronger consistency tends to raise latency, replication raises cost, and more tenants worsen isolation. So quality requirements are trade-off inputs, and they need to be ranked, because they cannot all be maximized together.

A statement is a requirement only if it is falsifiable. Use a five-part form: **scope** (which journey), **metric** (how it is measured and where), **target**, **window**, and **condition** (load and failure state). "The API must be fast" has none of these. "p99 server-side latency of `GET /feed` is at most 200 ms over 28 days, up to 50,000 rps, with one zone lost" has all five.

### Mathematics

Availability targets translate directly to allowed downtime:

| Target | Downtime per 30 days | Downtime per year |
| --- | --- | --- |
| 99% | 7.2 hours | 3.65 days |
| 99.9% | 43.2 minutes | 8.76 hours |
| 99.95% | 21.6 minutes | 4.38 hours |
| 99.99% | 4.32 minutes | 52.6 minutes |

Calculation: 30 days × 24 h × 60 min = 43,200 min, and 43,200 × 0.001 = 43.2 minutes for 99.9%. A 4.32-minute budget is shorter than most human paging and diagnosis loops, so 99.99% implies automated failover. That one number removes whole designs from consideration. [[a9]] covers how availability composes across dependencies.

### Complexity

Algorithmic complexity does not apply to a requirement, but elicitation has its own scaling. If n quality attributes interact pairwise, there are n(n−1)/2 potential conflicts: 8 attributes give 28 pairs. This is why ranking attributes beats trying to analyze every pair. The example linter below runs in O(r) time and space for r requirements.

## Mechanism

### Normal path

1. Identify actors and the top three to five journeys. Name who does what.
2. Write functional requirements as "actor can action object", and mark in-scope and out-of-scope items.
3. For each critical journey, ask about scale, latency, availability, durability, consistency, security, compliance, and cost.
4. Convert each answer to the five-part form. Where the business has no number, propose one and record it as an assumption.
5. Rank the attributes and name the top three as drivers. Ask directly: "If we can only have two, which two?"
6. Attach evidence to each one: a test before launch, and a service-level indicator after it.
7. Review on a schedule and whenever load or business context changes materially.

### State transitions

```mermaid state-lifecycle | Lifecycle of a quality requirement, from proposal to retirement | State diagram. A requirement starts proposed, becomes agreed once an owner accepts it, verified when evidence confirms it, and violated when measurement fails. A violated requirement is either fixed, returning to verified, or renegotiated, returning to proposed. Requirements end as retired.
stateDiagram-v2
    [*] --> Proposed: engineer or stakeholder drafts it
    Proposed --> Agreed: named owner accepts target and cost
    Agreed --> Verified: pre-launch test or SLI confirms it
    Verified --> Violated: measurement misses target
    Violated --> Verified: system fixed
    Violated --> Proposed: target renegotiated
    Verified --> Proposed: business context changes
    Verified --> Retired: journey removed
    Retired --> [*]
```

A violated requirement has two legitimate exits, and teams commonly forget the second. If a target is missed for a quarter and no one funds a fix, the honest action is renegotiation. Leaving the target in place makes it fiction, and fictional targets train people to ignore all targets.

### Concurrency behavior

Requirements have concurrency too. Several teams can change assumptions that a shared requirement depends on, such as a marketing team adding push notifications that double peak read load. Without a single owner and a change process, two teams will each believe they are within budget while jointly exceeding it. Treat shared capacity and error budgets as shared mutable state with an owner, and review changes against it.

### Ordering and consistency

Order matters during elicitation: scope first, then quality targets, then design. Designing before ranking qualities tends to anchor the group on the first idea. Requirements also need to be consistent with each other. "RPO of zero" and "p99 write latency under 10 ms across regions 80 ms apart" contradict each other: a cross-region synchronous acknowledgment costs at least one round trip of about 80 ms. Check for such contradictions using physics and arithmetic before debating solutions.

### Ownership of data and control

The product or business owner owns the value of a target and the cost they are willing to pay. Engineering owns feasibility and the cost estimate. SRE or the owning service team owns the measurement. Security and legal own compliance constraints. An engineer can propose a number, but only the accountable owner can accept the risk. Record this in the requirement and in an [[a13]] when it shapes architecture.

## Architecture

```mermaid context | Context: who supplies requirements and who consumes them | Flowchart. Business owners, customers, regulators, and operators feed the requirements record. The record feeds architecture design, tests, and service-level monitoring, whose production evidence returns to the record.
flowchart LR
    subgraph sources["Stakeholders: own risk"]
      B["Business owner: value, cost limit"]
      C["Customers: journeys"]
      R["Regulators and legal: constraints"]
      O["Operators: on-call limits"]
    end
    REQ["Requirements record (versioned in Git, owned per journey)"]
    B --> REQ
    C --> REQ
    R --> REQ
    O --> REQ
    REQ -->|"ranked drivers"| D["Architecture design and ADRs"]
    REQ -->|"acceptance scenarios"| T["Load and failure tests"]
    REQ -->|"SLI and SLO definitions"| M["Production monitoring"]
    M -->|"measured evidence"| REQ
```

Requirements here are a living record with a feedback loop, and that loop is the key feature of this diagram. Without the arrow from monitoring back to the record, targets are written once and slowly become false. Each stakeholder group owns a different kind of input: engineers do not own the risk appetite.

```mermaid component | Component view of the requirement linter and evidence checker | Flowchart. Requirement authors submit JSON over HTTP to an Express linter, which validates and applies rules. A CI job calls the Python evidence checker with measurements exported from a metrics store and gets a verdict per requirement.
flowchart LR
    A["Author or CI job"] -->|"HTTP POST /lint, JSON"| API["Express API: input validation"]
    API --> L["Lint rules: missing metric, target, window, load; vague words"]
    L -->|"findings, pass or fail"| A
    MS["Metrics export: JSON file"] -->|"measurements"| E["Python checker: Pydantic models"]
    S["Spec file in repository"] -->|"requirements"| E
    E -->|"verdict and exit code"| CI["CI gate"]
```

The two examples guard different moments. The linter runs before design, on the words. The checker runs after measurement, on the evidence. Keeping both shows that a requirement is checked twice: is it testable, and does it hold?

```mermaid sequence | Sequence: eliciting a requirement during a design review | Sequence diagram. An engineer asks a product owner what must stay up during a failure. The owner names checkout. The engineer proposes a target with cost, the owner accepts a lower number, and the engineer records it and creates an SLO.
sequenceDiagram
    participant E as Engineer
    participant P as Product owner
    participant R as Requirements record
    participant M as Monitoring
    E->>P: Which journey must survive a zone failure?
    P-->>E: Payment and order confirmation only
    E->>P: Proposal: 99.99 percent costs about 3x. 99.95 percent costs 1.3x
    P-->>E: Accept 99.95 percent. Revenue loss does not justify 3x
    E->>R: Record target, window, load, owner, and rationale
    R->>M: Create the SLI and SLO from the record
    M-->>R: Report compliance every 28 days
```

The important exchange is the third message: the target comes with a price. A question like "how available should it be?" always gets the answer "very". Asking with the cost attached gets a real decision. The cost multipliers shown are illustrative: you estimate them for your own system.

```mermaid failure-path | Failure path: a requirement that was never stated | Flowchart. An unstated durability requirement leads to asynchronous replication being chosen. A region failure loses recent writes, the loss is discovered by customers, and the team must reconstruct data, then renegotiate the requirement and redesign.
flowchart TD
    A["Durability never stated"] --> B["Team assumes async replication is acceptable"]
    B --> C{"Region fails with 8 s replication lag"}
    C -->|"failover promotes replica"| D["Last 8 s of orders lost"]
    D --> E["Customers report missing orders"]
    E --> F["Manual reconciliation against payment provider"]
    F --> G["RPO is finally stated. Architecture must change"]
    C -->|"lag near zero by luck"| H["No visible loss, so the gap stays hidden"]
    H --> C
```

The failure path has a delayed trigger, which makes it dangerous. The defect is a missing sentence that may stay invisible for years, as the loop on the right shows. Its cost grows with the data accumulated, and the fix arrives under the worst conditions.

## Trade-offs

### Advantages

- Stated targets remove whole classes of design from consideration early, which saves more time than any other activity in design.
- Falsifiable statements settle arguments, since opinions can be replaced by measurement.
- Ranked drivers make cost discussions possible with non-engineers.

### Costs

- Elicitation takes senior time and stakeholder attention.
- Numbers create accountability, and some organizations resist that.
- Precise numbers can look more certain than they are, so a guess needs to stay labeled as a guess.
- Maintained requirements need an owner and a review cadence.

### Alternatives

- **User stories only:** good for behavior, weak on quality, so often needs quality scenarios added.
- **Quality attribute scenarios:** a richer form with stimulus, environment, and response. Best for architecture reviews.
- **SLO-first:** start from user-visible indicators. Good for running services, weaker for a new domain with no baseline.
- **Formal specification:** strongest precision and suited to narrow, high-risk protocols. See [[a198]].

### When to use it

Always, at a depth proportional to the irreversibility of the decision. A storage engine or tenant-isolation model needs written, reviewed targets. An internal tool may need three sentences.

### When not to use it

Do not run a heavy process on an experiment whose goal is to learn if anyone wants it. Write down the target you are skipping and the signal that would require revisiting it. Do not specify qualities a system cannot influence, like client network latency outside your boundary.

### Reconsider when

- Load has grown by more than three times since the last review.
- A target has been missed for two consecutive windows, or exceeded by a wide margin at high cost.
- A new regulation, market, or tenant class appears.
- The owner of a journey changes.

## Capacity planning

Requirements are the input to capacity planning, so the calculation here converts a requirement into an implied capacity and availability design.

### Inputs and assumptions

- Peak target: 2,000 orders per second, stated in the requirement.
- Fan-out: each order makes about 6 internal calls (assumption, from tracing).
- Service capacity: about 400 requests per second per instance at acceptable latency (assumption, from load test).
- Three availability zones, with survival of one zone loss required.

### Formula and units

- Internal load (requests per second) = peak orders per second × fan-out.
- Instances needed = internal load ÷ safe per-instance capacity, per service tier.
- Failure-adjusted instances = instances × zones ÷ (zones − 1).

### Intermediate calculations

- Internal load: 2,000 × 6 = 12,000 rps across the tiers involved, averaging 2,000 rps per tier if the six calls go to six tiers.
- Per tier: 2,000 rps ÷ 400 rps per instance = 5 instances at exact capacity.
- Error budget for 99.95% over 28 days: 40,320 min × 0.0005 = 20.2 minutes.
- Failed orders allowed at peak: 2,000 × 0.0005 = 1 failed order per second at the budgeted rate.

### Headroom

Keep 30% headroom for forecast error and deployment churn: 5 ÷ 0.7 = 7.14, rounded up to 8 instances per tier. The figure of 30% is an illustrative default, and you should replace it with your own forecast error.

### Failure capacity

Losing one of three zones must leave 8 instances: 8 × 3 ÷ 2 = 12 instances per tier, with 4 per zone. Check it: losing a zone leaves 8. So a single sentence, "with one zone lost", raises instance count by 50%, and that cost should be shown to whoever accepts the target.

## Failure modes

:::failure Unmeasurable target
Trigger: A requirement says "fast" or "highly available" with no number.
Symptoms: Design debates go in circles, and every team thinks they have met it.
Blast radius: The whole project, through over-engineering or a missed launch.
Detection: Lint for missing metric, target, window, or load during review.
Mitigation: Propose a number, label it an assumption, and request sign-off by a date.
Recovery: Baseline current behavior and set the first target near it.
Prevention: Use a five-part template and block review if fields are empty.
:::

:::failure Availability scoped to the whole product
Trigger: One availability target covers every feature on the page.
Symptoms: Heavy cost; a recommendations outage counts as a checkout outage.
Blast radius: Budget and team capacity, and reliability of the journey that matters.
Detection: Ask what happens when each dependency is gone, and test by turning it off.
Mitigation: Split by journey and classify dependencies as critical or optional.
Recovery: Rewrite the targets per journey and degrade optional features gracefully.
Prevention: Require a scoped journey in every quality requirement.
:::

:::failure Contradictory requirements
Trigger: Targets conflict, such as zero RPO with 10 ms writes across regions 80 ms apart.
Symptoms: No design satisfies review, or a design quietly violates one target.
Blast radius: Design phase delays, or latent data loss later in production.
Detection: Check each pair of top drivers with physics and arithmetic.
Mitigation: Escalate the trade-off to the owner with the options priced.
Recovery: Renegotiate the lower-ranked target and record why.
Prevention: Rank attributes and review pairs among the top drivers.
:::

:::failure Evidence from the wrong conditions
Trigger: A load test at 20% of peak is reported as proving the target.
Symptoms: Launch-day saturation despite a passing test report.
Blast radius: The launch and anything sharing its dependencies.
Detection: Compare test load, duration, and failure state with the requirement's conditions.
Mitigation: Mark the result inconclusive and throttle launch traffic.
Recovery: Run a test at the stated load and fix the bottlenecks it reveals.
Prevention: Encode conditions in the requirement and check them automatically.
:::

:::failure Requirements decay
Trigger: Traffic or business context changes while targets stay the same.
Symptoms: Alerts are ignored, and engineers cannot say why a target exists.
Blast radius: Slow loss of trust across all reliability work.
Detection: Review the date on each requirement and its compliance history.
Mitigation: Hold a one-hour review with each journey owner.
Recovery: Retire or renegotiate stale targets.
Prevention: Schedule reviews at least annually and on load changes of three times or more.
:::

## Security and privacy

### Threats

Security requirements get stated as "the system must be secure", which is untestable. Name the threat instead: "A support agent cannot view a payment card number", or "A tenant cannot read another tenant's objects, verified by an automated cross-tenant test on every release." Omitted abuse cases are the common failure: requirements describe what legitimate users do, and attackers use the same features. See [[a130]].

### Trust boundaries

For each journey, state who is trusted with what: anonymous internet users, authenticated customers, internal staff, partner systems, and other services. Requirements about data crossing those boundaries are architecture drivers, as they determine encryption, tokens, and network layout.

### Authentication and authorization

State them as behaviors plus quality targets: "Only the account holder and support staff with an open ticket can read an order. Access decisions take at most 5 ms at p99 and fail closed." The last two words matter since they decide what happens during an authorization outage.

### Tenant isolation

For multi-tenant products, state isolation in two parts: data isolation ("no cross-tenant reads, ever") and performance isolation ("one tenant's burst may not raise another tenant's p99 by more than 10%"). The second is commonly left out and later becomes a noisy-neighbor incident.

### Sensitive data

Requirements records can expose sensitive information like security weaknesses or unannounced business plans. Keep them access-controlled where needed. State data classification, retention, deletion time, and residency as explicit requirements, because they constrain storage and backup design. See [[a142]].

### Abuse resistance

Add a misuse case for each key journey: "A single account cannot make more than 10 password-reset requests per hour." Put limits in the requirements so that rate limiting is designed in.

## Observability

### Metrics

Measure the requirement itself. For the sample target, use `orders_requests_total{status}` and a latency histogram `orders_request_duration_seconds`. Also track requirement health: percentage of quality requirements with a live SLI, and requirements missed for two or more windows.

### Logs

Log the decision evidence: load test identifier, conditions, and results. Application logs should contain the journey name so failures can be grouped by requirement.

### Traces

Tag root spans with the journey, for instance `journey=checkout`. Then a per-journey latency measurement can be derived from traces, and dependencies that do not belong in a critical path become visible.

### Dashboards

One page per journey: the target stated in words, current compliance, remaining error budget, load compared with the condition in the requirement, and the owner's name.

### Alerts

Alert on budget burn in the journey, not on each cause. Raise a non-paging ticket if load exceeds the requirement's stated condition, because the evidence no longer applies.

### SLO examples

- 99.95% of `POST /orders` non-4xx responses succeed over 28 days.
- 99% of `POST /orders` finish in at most 300 ms over 28 days, measured at the load balancer.
- 100% of quality requirements for tier-1 journeys have a live SLI, checked monthly. This one is a process objective.

### Runbook actions

If compliance is missed: identify the affected journey, compare load against the stated condition, and check whether the miss came from a change, a dependency, or growth. If growth caused it, reopen the requirement with its owner. Avoid quietly lowering a target without the owner agreeing.

## Implementation

### Architecture of the examples

The TypeScript example is an Express service with `POST /lint`, split into `lint.ts` (pure rules) and `index.ts` (HTTP). The Python example is a command-line evidence checker, with no HTTP layer because the lesson is the evaluation itself. These two are different programs by design: they cover the "is it testable?" and "does it hold?" checks.

### Data structures

Both use small records: `Requirement` and `Finding` in TypeScript, and Pydantic `QualityRequirement`, `Measurement`, and `Result` in Python. Python verdicts are an explicit `Literal` union of `met`, `violated`, `inconclusive`, and `no-evidence`, since "not proven" and "disproven" need different responses.

### Interfaces

`POST /lint` takes a JSON array and returns `{ pass, requirements, findings }`. `GET /healthz` returns status. The Python tool reads `--file spec.json` and uses exit codes 0, 1, and 2 so that it can gate a CI job.

### Error handling

Express maps `ValidationError` to 422, malformed JSON to 400, and everything else to a logged 500 that leaks no internals. Python catches missing files, bad JSON, and schema failures, and returns exit code 2, which differs from the exit code 1 for unmet requirements.

### Concurrency considerations

Linting is pure and holds no shared state, so concurrent requests cannot interfere. Node handles them on one event loop, and the 256 KB body limit bounds the synchronous work per request. Python is a single-run process. The TypeScript service closes its server on `SIGTERM` to finish in-flight requests.

### Educational limitations

The vague-word rule is a simple pattern and will miss many cases. Neither tool judges whether a target is sensible. The Python checker takes a measured value as given and does not check how a percentile was computed.

### Production hardening

Store requirements in version control with owners, generate SLO configuration from them, pull real measurements from your metrics store, authenticate the service, and record a review date. Compute percentiles from histograms rather than averaging them.

## Terminal lab

### Setup

```bash
cd topics/functional-and-non-functional-requirements/examples/typescript
pnpm install --ignore-workspace
```

### Run

Start the linter in one terminal:

```bash
PORT=3000 pnpm start
```

In a second terminal, submit one vague and one falsifiable requirement:

```bash
curl -s localhost:3000/lint -H 'content-type: application/json' -d '[
 {"id":"Q1","kind":"quality","text":"Checkout must be fast"},
 {"id":"Q2","kind":"quality","text":"Checkout latency","metric":"p99 server latency","target":"<= 300 ms","window":"28 days","loadCondition":"up to 2000 rps"}
]' | jq '{pass, rules: [.findings[].rule]}'
```

Then run the evidence checker:

```bash
cd ../python
uv run python -m app.main; echo "exit code: $?"
```

### Test

```bash
cd ../typescript && pnpm test
```

```bash
cd ../python && uv run pytest -q
```

### Expected output

The curl command prints:

```json
{
  "pass": false,
  "rules": ["missing-metric", "missing-target", "missing-window", "missing-loadCondition", "vague-word"]
}
```

The checker prints `inconclusive` for `Q-LAT`, since the test ran at 400 rps against a 2,000 rps requirement. It prints `violated` for `Q-AVL` and `no-evidence` for `Q-RPO`, then `exit code: 1`. A good-looking 240 ms measurement still does not satisfy `Q-LAT`, and that is the point of the lab.

### Cleanup

Stop the server with Ctrl-C. Then remove the installed dependencies if you like:

```bash
rm -rf node_modules ../python/.venv
```

### Troubleshooting

- `ERR_UNKNOWN_FILE_EXTENSION ".ts"`: your Node.js is older than 23.6. Upgrade it.
- `EADDRINUSE`: choose another port, or find the holder with `lsof -i :3000`.
- `jq: command not found`: install jq, or remove the pipe.
- `requires-python` error: run `uv python install 3.12`.

## Practical challenges

:::challenge Concept | Classify and split
Classify each as functional, quality, or constraint, and split any that mix them: (a) "Users can export invoices quickly to PDF." (b) "Must run on the existing Oracle licence." (c) "Search must return relevant results."
>>> Hint
Ask what a tester would need in order to fail it. Then ask whether the sentence limits the solution or describes behavior.
>>> Solution
(a) Mixed. Functional: "An account admin can export an invoice as PDF." Quality: "95% of exports finish within 5 seconds for invoices with up to 1,000 lines." (b) Constraint: it limits the solution space and isn't a behavior. Ask whether it is real and when the licence ends. (c) Functional-looking but untestable. Relevance needs a measure, like "normalized discounted cumulative gain at 10 of at least 0.7 on the labeled query set."
>>> Common mistakes
Calling (b) a non-functional requirement and moving on, which loses the question of whether the constraint is real. Accepting "relevant" because it sounds obvious.
:::

:::challenge Debugging | The passing test that proved nothing
A team reports that their 99.9% and 200 ms target is "verified" using a 10-minute load test at 300 rps on a staging system with an empty database. Production traffic peaks at 4,000 rps, with a 2 TB dataset. Find every reason the evidence is weak. Then run the Python checker with a spec that represents this case, and explain the verdict.
>>> Hint
Compare conditions one at a time: load, duration, data size, topology, and failure state.
>>> Solution
Load is 7.5% of peak. Ten minutes cannot demonstrate a 28-day availability figure, and it misses leaks and compaction. An empty database hides index depth, cache misses, and bad query plans. Staging may differ in topology, and no failure was injected. In the checker, set `min_load_rps` to 4000 and `window_days` to 28 with a measurement of 300 rps and 1 day: the verdict is `inconclusive`. The correct report is "not yet shown", which is different from pass or fail.
>>> Common mistakes
Treating the problem as only about load. Saying the target failed, when there simply is no evidence yet.
:::

:::challenge Capacity | Price the failure condition
A service must hold 6,000 rps at a safe 500 rps per instance, with 25% headroom. Compare the instance count (a) with no failure condition, (b) surviving one of three zones, and (c) surviving one of two zones. Then state the sentence that you would show the budget owner.
>>> Hint
Apply headroom first, then scale by zones ÷ (zones − 1).
>>> Solution
Base: 6,000 ÷ 500 = 12. With headroom: 12 ÷ 0.75 = 16. (a) 16 instances. (b) 16 × 3 ÷ 2 = 24. (c) 16 × 2 ÷ 1 = 32. Sentence: "Surviving a zone loss raises the fleet from 16 to 24 instances, which is 50% more. Using only two zones would make that 100% more."
>>> Common mistakes
Adding one instance instead of a zone's worth. Dividing 6,000 by the failure-adjusted capacity without headroom. Quoting technical numbers with no cost.
:::

:::challenge Design | Requirements for a ride-hailing MVP
You have 10 minutes with a product lead to scope a ride-hailing MVP for one city with 5,000 peak concurrent drivers. Write five functional requirements, explicit non-goals, and five ranked quality requirements in five-part form. Name the top two architecture drivers.
>>> Hint
Location updates dominate writes and matching dominates contention. Ask which failure is worst: a double-assigned driver, or a slow map?
>>> Solution
Functional: a rider can request a trip; a rider sees an estimate before confirming; a driver receives and accepts offers; both see live location; a rider pays at trip end. Non-goals: scheduled rides, pooling, multiple cities. Quality: (1) a driver is never assigned to two active trips, checked by a continuous invariant audit; (2) p95 offer dispatch at most 2 s up to 500 requests per minute; (3) location ingest of 5,000 drivers every 4 s, so 1,250 writes per second with p99 freshness at most 8 s; (4) trip state is durable with RPO zero within a region; (5) 99.9% availability of request and accept journeys over 28 days. Drivers: assignment correctness and high-rate location ingest. These push you toward a strongly consistent assignment store and a separate store for ephemeral location.
>>> Common mistakes
Giving a single availability figure. Omitting non-goals. Listing ten equally important qualities, since an unranked list makes no decision.
:::

:::challenge Incident | The target nobody owned
At 02:00 a primary database fails. Failover loses 40 seconds of writes. The design document states "high durability". Finance reports 300 payments captured with no order record. Write the immediate response steps and three follow-up actions concerning requirements.
>>> Hint
Immediate work concerns customers and data. Follow-up work concerns why 40 seconds was never judged acceptable or not.
>>> Solution
Immediate: declare an incident and name a commander; stop further loss if the problem is ongoing; reconcile against the payment provider's records, since it holds the truth for those 300 charges; restore or refund; tell customers and finance. Follow-up: (1) state RPO per data class, with an owner in finance signing the payments number; (2) measure replication lag as an SLI and alert when it threatens the RPO; (3) review all tier-1 data stores for unquantified durability language and test failover to confirm actual loss.
>>> Common mistakes
Blaming the database. Writing "improve durability" as the action item, which repeats the defect in new words. See [[o111]].
:::

## Industry standards and trends

### Standards and specifications

- [ISO/IEC/IEEE 29148, requirements engineering](https://www.iso.org/standard/72089.html), 2018. Characteristics of good requirements and processes. Formal standard, and access to the text is paid.
- [ISO/IEC 25010, product quality model](https://www.iso.org/standard/78176.html), 2023. A formal taxonomy of quality characteristics, useful as a completeness checklist.
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html), March 1997, with [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174.html), May 2017. These define MUST, SHOULD, and MAY in specifications. Teams often borrow them as a convention, but these are IETF documents and do not mandate this use elsewhere.

### Established practice

- SLO-based targets are described in [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/), a chapter of Google's *Site Reliability Engineering*, 2016. It is an influential published practice, not a formal standard.
- The [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html), a living document, provides review questions organized by pillar. It is vendor guidance.

### Managed-service options

Requirement tracking does not need specialized software for most teams. Markdown files in Git work well. Regulated industries use requirements-management tools with audit trails. SLO tracking is offered by major cloud monitoring products and observability vendors, which should be compared on how they calculate compliance windows.

### Emerging approaches

Declaring SLOs as code in repositories, and generating alerts from those files, is increasingly common. [OpenSLO](https://github.com/OpenSLO/OpenSLO) is one vendor-neutral specification effort, though adoption is uneven and it should not be regarded as an established standard. Using large language models to draft requirements and find contradictions is an emerging practice: treat output as a prompt for review, since a model cannot accept risk on an owner's behalf. These are inference from public activity, without adoption data.

### Recent changes

ISO/IEC 25010 was revised in 2023, adding safety as a top-level characteristic and renaming several existing characteristics. Check the current edition when citing it.

### Adoption constraints

Formal standards cost money to read and suit regulated contexts more than small teams. Templates get ignored unless they block something, so tie them to a review or CI gate, and avoid applying the full process to reversible experiments.

## Interview preparation

:::q Foundational | What is the difference between functional and non-functional requirements?
**Strong answer.** Functional requirements describe behavior for an actor. Quality requirements describe degree: latency, availability, durability, cost, under stated load and window. Features can often be added later, whereas qualities usually determine the structure, so they deserve more attention early on.

**Why it is asked.** It checks whether you see that qualities drive architecture, and it is a lead-in to scoping.

**Weak-answer warning signs.** Reciting definitions with no consequence, or calling every quality "scalability".

**Follow-up.** Give a case where changing one quality target changes the design, with no feature change.
:::

:::q Foundational | What makes a requirement testable?
**Strong answer.** It must be possible to name the evidence that would prove it false. I use scope, metric, target, window, and condition. "p99 of `GET /feed` at most 200 ms over 28 days at 50,000 rps" qualifies, and "feed loads fast" does not.

**Why it is asked.** Precision is a basic habit of senior designers.

**Weak-answer warning signs.** Giving a target with no window or load condition.

**Follow-up.** Where exactly would you measure that latency, and why does the location matter?
:::

:::q Foundational | How do you start a design interview?
**Strong answer.** I spend about five minutes confirming users, the top journeys, and non-goals, then scale and top quality targets. I state assumptions out loud, then say which two or three drivers will shape the design, and check them with the interviewer.

**Why it is asked.** Candidates who skip this solve the wrong problem.

**Weak-answer warning signs.** Drawing boxes at once, or spending 20 minutes on questions with no decisions.

**Follow-up.** The interviewer says "you decide the scale". What do you do next?
:::

:::q Senior | How do you handle a stakeholder demanding "five nines"?
**Strong answer.** I translate it to about 5 minutes of downtime per year, then compare with the deployment, failover, and dependency reality. I price two or three options, and ask which journey needs it and what an outage actually costs. Usually one narrow path gets a higher target than the rest.

**Why it is asked.** Tests whether you can push back with numbers and without obstruction.

**Weak-answer warning signs.** Agreeing without pricing, or refusing without alternatives.

**Follow-up.** Their dependency only offers 99.9%. What can you promise?
:::

:::q Senior | Two quality targets conflict. What do you do?
**Strong answer.** First prove the conflict with arithmetic, such as a round-trip time against a write-latency target. Then rank them with the owner, price each resolution, and record the decision and when to revisit it. Sometimes scoping resolves it: strong durability for payments, weaker for analytics.

**Why it is asked.** Most real design work is trade-offs among qualities.

**Weak-answer warning signs.** Choosing silently, or assuming a new technology removes the conflict.

**Follow-up.** How do you record this so a new engineer understands it two years later?
:::

:::q Senior | How do you decide which requirements are architecture drivers?
**Strong answer.** A driver is a requirement whose change would change structure, and that is both important and hard. I look for those requiring a different data store, replication model, or topology, and I test by asking what we would build at ten times less and ten times more.

**Why it is asked.** Separating signal from a long list is a staff-level skill.

**Weak-answer warning signs.** Treating all listed requirements as equally important.

**Follow-up.** Name a requirement that sounds important but is rarely a driver.
:::

:::q Senior | How do you verify a quality requirement before launch?
**Strong answer.** I match the conditions: production-like data size, stated peak with headroom, sustained duration, and an injected failure such as a zone loss. Anything less is reported as partial evidence. After launch, the SLI takes over as the continuing evidence.

**Why it is asked.** It separates people who have launched at scale from those who have not.

**Weak-answer warning signs.** Calling a short staging test "proof", or ignoring data size.

**Follow-up.** How would you verify a durability target like eleven nines?
:::

:::q Staff | The product team has no idea what target to set. How do you proceed?
**Strong answer.** I measure the current baseline and use data on user behavior, such as abandonment at different latencies. I propose a number near the baseline, label it an assumption, and set a review date. A provisional target with an owner beats waiting for a perfect one.

**Why it is asked.** Real stakeholders rarely come with numbers.

**Weak-answer warning signs.** Waiting for product input, or copying numbers from another company.

**Follow-up.** How do you prevent a provisional number from becoming permanent?
:::

:::q Staff | How would you make requirements survive across several teams?
**Strong answer.** I would assign journey-level owners, keep records in version control, generate SLOs from those records, and allocate latency and error budgets to dependencies. Teams changing shared load would need to check against that budget. The process has to connect to something that blocks, such as launch review.

**Why it is asked.** It tests moving from individual to organizational mechanisms.

**Weak-answer warning signs.** Proposing a wiki page with no enforcement.

**Follow-up.** Who resolves a dispute when two teams claim the same latency budget?
:::

:::q Staff | When is it right to lower a target?
**Strong answer.** When evidence shows users do not benefit from it, or the cost beats the value, or it has been missed for several windows with no funding to fix it. Lowering it is a decision made by the owner, which is recorded. An unfunded target is misleading, and it trains everyone to ignore targets.

**Why it is asked.** It reveals whether you view targets as business decisions.

**Weak-answer warning signs.** Believing targets may only go up, or quietly editing them.

**Follow-up.** What would you check before lowering an availability target on a paid product with an SLA?
:::

:::q Principal | Your company's architecture review keeps rejecting designs late. How do you fix it through requirements?
**Strong answer.** Late rejection usually means drivers surfaced late. I would introduce an early, lightweight driver review of one page: top journeys, ranked qualities, irreversible decisions, and open assumptions. I would measure rework and time to decision, and reserve full review for irreversible choices. I would also build a library of tiered default targets so teams do not start from zero.

**Why it is asked.** Principals improve the decision system rather than single decisions.

**Weak-answer warning signs.** Adding more review stages or more templates, with no measure of outcome.

**Follow-up.** How do you avoid this becoming process for its own sake?
:::

:::q Principal | An executive asks why reliability work costs so much when "the requirement has not changed". How do you respond?
**Strong answer.** The sentence may not have changed, but its conditions have. Load, data, dependencies, and team count all grew, and I would show that in cost per journey at each scale. I would give options: keep the target at this cost, lower it for a stated business exposure, or narrow the scope. Then the executive makes a risk decision instead of receiving a technical explanation.

**Why it is asked.** It tests executive communication and making risk decisions visible. See [[a206]].

**Weak-answer warning signs.** Defending with jargon, or treating cost questions as an attack.

**Follow-up.** The executive selects the cheapest option. What do you do if you disagree?
:::

## Review

### Key takeaways

- Features decide what exists, and qualities decide the structure.
- A quality requirement needs scope, metric, target, window, and condition.
- Rank qualities: an unranked list decides nothing.
- Present targets with their cost, so the owner can make a real decision.
- Evidence gathered below the stated conditions is "not proven", not "passed".
- A target that is missed and unfunded should be renegotiated in the open.

### Decision checklist

- [ ] Have I named actors, top journeys, and non-goals?
- [ ] Is each quality target scoped to a journey?
- [ ] Have I checked the top drivers against each other with arithmetic?
- [ ] Is every guess labeled as an assumption with a review date?
- [ ] Does a named owner accept each target and its cost?

### Production-readiness checklist

- [ ] Each tier-1 journey has an SLI and an SLO generated from the requirement.
- [ ] Load tests matched the stated load, data size, duration, and failure condition.
- [ ] Failure capacity for the stated failure has been provisioned.
- [ ] Data retention, deletion, and residency are stated and implemented.
- [ ] A review date and an owner are recorded.

### Glossary

- **Architecture driver:** a requirement whose change would change the structure.
- **Constraint:** a fixed limit on the solution space.
- **Falsifiable:** capable of being proven false by evidence.
- **Journey:** an end-to-end task that matters to a user.
- **RPO:** recovery point objective, the maximum acceptable data loss measured in time. See [[a162]].
- **SLI and SLO:** a service-level indicator is a measurement, and an objective is its target. See [[o107]].

### Quiz

:::quiz Which statement is a complete quality requirement?
- The API must have low latency under heavy load.
- p99 latency should be 200 ms.
- *p99 server latency of `GET /feed` is at most 200 ms over 28 days at up to 50,000 rps.
- `GET /feed` returns the user's newest posts.
The third has scope, metric, target, window, and condition. The second lacks scope, window, and load, and the fourth is functional.
:::

:::quiz A load test at 400 rps shows 240 ms against a 300 ms target that applies at 2,000 rps. What is the verdict?
- Met, since 240 is below 300.
- Violated, since load was too low.
- *Inconclusive, because the evidence was not gathered under the stated condition.
- Met, if extrapolated linearly.
Latency is typically non-linear as utilization rises, so low-load results neither prove nor disprove the target at the higher load.
:::

:::quiz How much downtime does 99.99% allow in 30 days?
- 43.2 minutes
- 21.6 minutes
- *4.32 minutes
- 26 seconds
43,200 minutes × 0.0001 = 4.32 minutes, too short for most human-driven recovery. So this target implies automated failover.
:::

:::quiz Why is "must run in the EU" different from a quality requirement?
- It is not important.
- It is a functional requirement.
- *It is a constraint: it limits the solution space and is not judged by degree.
- It can always be negotiated.
A constraint narrows options rather than measuring behavior. It may still be questioned, but only with its owner.
:::

:::quiz A service needs 16 instances with headroom and must survive one of three zones. How many are needed in total?
- 17
- 20
- *24
- 48
16 × 3 ÷ 2 = 24, which gives 8 per zone. After losing a zone, 16 remain.
:::

### Further study

Continue with [[a2]] to separate constraints and assumptions from requirements, then [[a12]] to rank and decide among options. Use [[o107]] to turn these targets into operating objectives, and [[a9]] to compute what your dependencies allow.
