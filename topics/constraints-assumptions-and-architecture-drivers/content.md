lastReviewed: 2026-11-03

## Orientation

### Definition

A constraint is a fixed limit on the solution space. An assumption is something believed true but not yet verified. An architecture driver is a requirement, constraint, or assumption that, if it changed, would change the structure of the system. Separating the three tells you what you can negotiate, what you must test, and what deserves your design attention.

### Why it matters

Most failed architectures were reasonable given their beliefs, and those beliefs turned out to be wrong. A team that writes "reads outnumber writes 50 to 1" as a fact builds read replicas and a cache, then learns that a new feature made writes dominant. Written as an assumption with an owner and a date, the same sentence would have triggered a check. Experienced engineers also ask whether a constraint is real, since many supposed constraints are merely old decisions that nobody re-examined.

### Learning objectives

- Classify statements as requirement, constraint, or assumption, and explain why it matters.
- Challenge a constraint by finding its owner and its actual cost.
- Identify drivers by testing what would change the structure.
- Use sensitivity analysis to decide which assumptions to verify first.
- Keep a register so assumptions turn into evidence, not folklore.

## Production scenario

A logistics company plans a tracking platform for 40,000 vehicles reporting location every 10 seconds. The kickoff document says: "must use the corporate Oracle cluster, launch in Q3, read-heavy workload, vehicles always online". Each item sounds like a fact. When questioned, they turn out to be four different things.

The Oracle mandate came from a licensing decision made six years ago, and the licence renews in 14 months, so the mandate is a negotiable constraint with a known owner. Q3 is a contractual date with penalties, which is a hard constraint. "Read-heavy" is an unverified assumption, and arithmetic refutes it: 40,000 ÷ 10 s is 4,000 writes per second, compared with a forecast of 300 dashboard reads per second. "Always online" is false: vehicles cross dead zones for up to 20 minutes, so devices must buffer and upload out of order. Two of the four would have produced the wrong architecture. Catching them took one meeting and one line of arithmetic.

## Mental model

### Analogy

Planning a building on a plot. Constraints are the plot boundary and zoning law. Assumptions are what you believe about the ground before anyone has drilled a borehole. Drivers are the factors that shape the foundation: if the ground is clay and not rock, the whole structure changes, while the paint color changes nothing.

### Where the analogy breaks

Geology does not change after you survey it, while software assumptions decay continuously as traffic, teams, and markets shift. Software constraints are also more negotiable than zoning law, since many were set by people still employed down the hall. So unlike a survey done once, assumptions need review dates, and constraints deserve questioning.

### Entities, state, flow, and invariants

- **Entities:** statements, owners, evidence, decisions that depend on statements.
- **State:** an assumption is unverified, confirmed, or refuted. A constraint is active, challenged, or lifted.
- **Flow:** a statement is classified, its impact is estimated, cheap checks run first, and the outcome flows to decisions that rest on it.
- **Invariant 1:** every assumption has an owner and a verify-by date.
- **Invariant 2:** no decision rests on a refuted assumption without being reopened.
- **Invariant 3:** every constraint names who can lift it.

## Foundations

### Concepts and terminology

| Term | Test | Action |
| --- | --- | --- |
| Requirement | Would users or the business notice if it were missing? | Agree on and measure it. See [[a1]] |
| Hard constraint | Does breaking it cause legal, contractual, or physical failure? | Design within it |
| Soft constraint | Is it a policy or an earlier decision somebody could change? | Price it, then ask its owner |
| Assumption | Could evidence show that it is false? | Verify, in order of impact |
| Driver | Would changing it change the structure? | Spend design time here |
| Quality attribute scenario | Stimulus, environment, response, and measure | Use it to test a driver |

### First-principles explanation

A design is a function from beliefs to structure. Accuracy of belief therefore bounds the accuracy of design. Beliefs differ in two respects: how uncertain they are, and how much the design would change if they were wrong. Both matter, and the product of the two sets the order of work. A very uncertain belief with no design impact can stay uncertain. A nearly certain belief with huge impact deserves a cheap check.

Drivers are a small subset. Consider two applications: a read-heavy catalog and a write-heavy telemetry system. Both have dozens of requirements, but only a few determine whether the store is a B-tree or an LSM tree, or whether you partition. To test a candidate driver, ask "if this were ten times larger or smaller, would we draw a different diagram?" If not, it may be important, but it does not drive architecture.

### Mathematics

Risk exposure is commonly estimated as probability × impact. With the sensitivity method in this lesson, compute the output at each input's low and high bound with the others held at base:

- spread(x) = |output(x low) − output(x high)|
- Rank inputs by spread. A bar chart of the result is called a tornado chart.
- A key test: does the range of the output cross a design threshold? An input with a smaller spread that crosses a threshold matters more than a larger spread that doesn't.

Worked example: nodes = DAU × requests per user ÷ 86,400 s × peak ratio ÷ rps per node. With 5,000,000 DAU, 30 requests, ratio 3, and 1,000 rps per node, peak is 5,208 rps, needing 6 nodes. Varying DAU from 2,000,000 to 20,000,000 gives 3 to 21 nodes, which crosses a 16-node limit. The other inputs stay under the limit. So DAU is what to investigate first.

### Complexity

The one-at-a-time analysis costs 2n model evaluations for n inputs. A full grid costs 3^n at three levels per input, which explains why teams don't do it by hand: 10 inputs need 59,049 evaluations. Checking a register is O(a) in the number of assumptions a.

## Mechanism

### Normal path

1. List every statement from the brief, without filtering.
2. Classify each as requirement, hard constraint, soft constraint, or assumption. Reject "fact" as a category unless it has evidence attached.
3. For each constraint, find the owner and ask what would happen if it were removed.
4. For each assumption, estimate impact and assign an owner and a date.
5. Run sensitivity analysis on the numeric assumptions, and verify the highest-impact items first.
6. Name three to five drivers. Check each with the ten-times test.
7. Link decisions to the statements they rest on, so that refuting one reopens the others.

### State transitions

```mermaid state-assumption | State of an assumption from recording to resolution | State diagram. An assumption begins unverified. Evidence moves it to confirmed or refuted. Passing its date without evidence moves it to overdue. Refuted assumptions reopen dependent decisions. Confirmed assumptions return to unverified when conditions change.
stateDiagram-v2
    [*] --> Unverified: recorded with owner and date
    Unverified --> Confirmed: evidence supports it
    Unverified --> Refuted: evidence contradicts it
    Unverified --> Overdue: date passes with no evidence
    Overdue --> Confirmed: evidence supports it
    Overdue --> Refuted: evidence contradicts it
    Confirmed --> Unverified: conditions change
    Refuted --> DecisionsReopened: dependent decisions reviewed
    DecisionsReopened --> [*]
```

The transition from confirmed back to unverified is the one most teams leave out. A traffic mix confirmed last year has become a belief again if the product has changed since.

### Concurrency behavior

Several teams may rely on one assumption at once and each may change it. Marketing runs a campaign, a mobile team adds polling, and each one's change looks small. Treat shared assumptions like shared mutable state: one owner, visible changes, and a way to notify dependents. The example register records `dependents` for this reason.

### Ordering and consistency

Hard constraints come first, because they eliminate options cheaply. Sort assumptions by impact × uncertainty ÷ cost to check. Be sure that the statements agree with each other. The tracking scenario above had "read-heavy" and "40,000 vehicles every 10 seconds" in the same document, and they contradict each other once you do the arithmetic.

### Ownership of data and control

The assumption's owner is the person best placed to verify it, often outside engineering. A constraint is owned by whoever can lift it: legal, finance, or a platform team. The architect owns the register and the link to decisions, without necessarily owning the answers. See [[a13]] for recording the outcome.

## Architecture

```mermaid context | Context: where drivers come from and what they shape | Flowchart. Business, legal, finance, and the team's skills supply statements to a classification step. Those split into hard constraints, soft constraints, assumptions, and requirements. Drivers selected from these shape architecture decisions.
flowchart LR
    B["Business brief"] --> C["Classify each statement"]
    L["Legal and compliance"] --> C
    F["Finance and vendors"] --> C
    T["Team skills and existing systems"] --> C
    C --> H["Hard constraints"]
    C --> S["Soft constraints: owner, cost"]
    C --> A["Assumptions: owner, date"]
    C --> R["Requirements: targets"]
    H --> D["Architecture drivers (top 3 to 5)"]
    S --> D
    A --> D
    R --> D
    D -->|"shape"| X["Architecture decisions and ADRs"]
```

Everything flows through classification, as that is where false facts get caught. Drivers can come from any category. They aren't simply the top of the requirements list: a team's lack of Kubernetes experience can be a driver as legitimate as a latency target.

```mermaid component | Component view of the register and sensitivity tools | Flowchart. A JSON register in Git is read by the TypeScript checker, which gates CI. A numeric model reads ranges in the Python sensitivity tool, and its ranked swings tell the owner what to verify first, updating the register.
flowchart LR
    REG["register.json in Git: owned by the architect"] -->|"read"| TS["TypeScript checker: parse and assess"]
    TS -->|"exit code 0, 1, or 2"| CI["CI gate"]
    TS -->|"JSON log lines"| LOG["Build log"]
    IN["Numeric ranges"] --> PY["Python sensitivity: 2n model runs"]
    PY -->|"ranked swings, threshold crossings"| O["Assumption owners"]
    O -->|"evidence updates status"| REG
```

The checker enforces discipline and the sensitivity tool sets priority. The loop runs through people: the tools do not produce evidence, they only show who needs to find some, and when.

```mermaid sequence | Sequence: challenging a constraint | Sequence diagram. An architect asks a platform owner about a mandated database. The owner says the reason was licensing, which ends soon. The architect prices both options, and finance and the owner agree to lift the mandate for one workload, which is recorded in an ADR.
sequenceDiagram
    participant A as Architect
    participant O as Platform owner
    participant F as Finance
    participant D as ADR
    A->>O: Why is the shared Oracle cluster mandatory?
    O-->>A: Licence cost, and a small DBA team
    A->>F: Option A costs X in licences. Option B costs Y in operations
    F-->>A: Licence renews in 14 months and is not fixed
    A->>O: Can telemetry use another store, if your team does not run it?
    O-->>A: Yes, if the owning team carries on-call
    A->>D: Record the lifted constraint, conditions, and owner
```

Note the shape of the request. The architect does not argue against the rule: they find the reason behind it and meet that reason in another way. The DBA team's concern was operational load, and accepting on-call resolved it. This is usually the fastest route past a soft constraint.

```mermaid failure-path | Failure path: an assumption believed to be fact | Flowchart. A read-heavy belief leads to replicas and caching. A new feature makes writes dominate, the single primary saturates, and an emergency sharding project starts. A register with a date would have triggered a check before saturation.
flowchart TD
    A["Read-heavy stated as fact"] --> B["Design: one primary, replicas, caching"]
    B --> C["New feature: writes grow 20x"]
    C --> D["Primary write saturation"]
    D --> E["Replication lag and failed writes"]
    E --> F["Emergency sharding under load"]
    A -.->|"recorded with owner and date"| G["Quarterly check of the write ratio"]
    G -.->|"early warning"| H["Planned migration before saturation"]
```

Solid lines show what happens by default, and dashed lines show the alternative. The register costs very little and gives lead time, which is what changes an emergency into a plan. Nothing in the dashed path requires predicting the feature: only noticing that the belief no longer holds.

## Trade-offs

### Advantages

- Catches false facts cheaply, before any design work relies on them.
- Focuses verification on what actually changes decisions.
- Surfaces negotiable constraints that would otherwise cost money indefinitely.

### Costs

- Takes senior time, and challenging constraints can be politically awkward.
- A register becomes a graveyard unless it is tied to a gate or a review.
- Sensitivity ranges are themselves guesses.

### Alternatives

- **Risk register:** broader, and tracks delivery risks as well as architectural ones.
- **Spikes and prototypes:** the most direct way to check an assumption, at higher cost per check.
- **Assumption mapping workshop:** fast cross-functional sorting by importance and evidence.
- **ATAM-style review:** a structured method for finding sensitivity points and trade-offs in heavier programs.

### When to use it

For anything hard to reverse, anything spanning several teams, and any project whose brief contains numbers nobody has measured.

### When not to use it

Skip the formal register for short-lived, cheap-to-replace work. A short list in the pull request description is enough. Do not perform sensitivity analysis on inputs that cannot change the decision.

### Reconsider when

- A confirmed assumption is more than a year old, or the product has changed materially.
- A constraint's owner, contract, or regulation has changed.
- A driver no longer passes the ten-times test.

## Capacity planning

### Inputs and assumptions

Telemetry scenario: 40,000 vehicles, each reporting every 10 s, with 200 bytes per message, and buffered upload after dead zones. The peak recovery burst is assumed: 20% of the fleet reconnects within one minute after a regional outage, each with 20 minutes of buffered points.

### Formula and units

- Steady writes per second = vehicles ÷ report interval in seconds.
- Backlog points = vehicles affected × buffered seconds ÷ report interval.
- Burst writes per second = backlog points ÷ drain time in seconds.
- Storage per day (bytes) = writes per second × 86,400 s × message size in bytes.

### Intermediate calculations

- Steady: 40,000 ÷ 10 = 4,000 writes per second.
- Affected vehicles: 40,000 × 0.2 = 8,000.
- Backlog: 8,000 × 1,200 s ÷ 10 s = 960,000 points.
- Drain over 60 s: 960,000 ÷ 60 = 16,000 writes per second, on top of 4,000, giving 20,000.
- Storage: 4,000 × 86,400 × 200 B = 69.12 GB per day, before indexes and replication.

### Headroom

Keep 30% headroom on steady ingest: 4,000 ÷ 0.7 ≈ 5,715 writes per second. Rather than provisioning 20,000 writes per second for a rare burst, slow the drain: over 10 minutes the backlog adds only 1,600 writes per second, for 5,600 total, fitting within headroom. Client-side pacing has turned a 5x capacity need into a behavior, which is a driver worth stating.

### Failure capacity

With three zones and surviving one zone loss, 5,715 × 3 ÷ 2 ≈ 8,573 writes per second of provisioned capacity. If the burst assumption is wrong and 50% of the fleet reconnects, the backlog is 2,400,000 points and the same 10-minute drain adds 4,000 writes per second, so total is 8,000. That still fits, but barely. Since the design is sensitive to that assumption, schedule a test of it.

## Failure modes

:::failure Assumption treated as fact
Trigger: A guess gets written into a brief with no label, then repeated.
Symptoms: Saturation or redesign in an area the team thought it had settled.
Blast radius: Whatever rests on the belief, often the data layer.
Detection: Compare measured ratios and growth with those in the design document on a schedule.
Mitigation: Add capacity or a throttle to buy time.
Recovery: Reopen dependent decisions and plan the migration.
Prevention: Allow no unlabeled numbers in design documents, and record the source of each number.
:::

:::failure Phantom constraint
Trigger: "We can't do that" persists after its reason has gone.
Symptoms: Expensive workarounds, with no one able to say who imposed the rule.
Blast radius: Ongoing cost and lost options across several teams.
Detection: Ask for the owner and reason, and treat "nobody knows" as a finding.
Mitigation: Propose a time-limited exception for one workload.
Recovery: Have the owner lift it and publish the change.
Prevention: Record owner, reason, and review date for each constraint.
:::

:::failure Driver missed because it was non-technical
Trigger: A team-skill, on-call, or budget limit isn't treated as architectural.
Symptoms: The design is correct on paper, but the team can't operate it.
Blast radius: Reliability of the system and retention of the team.
Detection: Ask who is paged at 03:00 and whether they've ever operated this technology.
Mitigation: Use a managed service or fund training before launch.
Recovery: Simplify the architecture toward the team's skills.
Prevention: Include people, budget, and timeline in driver analysis.
:::

:::failure Register decays into a graveyard
Trigger: Nobody reviews it and nothing depends on it.
Symptoms: Many overdue entries, and people stop updating them.
Blast radius: Assumption tracking loses all credibility.
Detection: Track the overdue count and age of oldest entry.
Mitigation: Archive low-impact items and keep the top ten.
Recovery: Run one review meeting, confirm or delete each entry.
Prevention: Gate architecture review or CI on high-impact overdue entries.
:::

## Security and privacy

### Threats

Security assumptions cause some of the worst outcomes: "the internal network is trusted", "only our app calls this endpoint", "this field holds no personal data". State each explicitly, and test it: an internal endpoint reachable through a server-side request forgery attack breaks the first two. See [[o46]].

### Trust boundaries

List the trust assumptions at each boundary. For the tracking platform: are device identities verifiable, can a stolen device send false positions, and does the map vendor receive vehicle locations? Each answer may become a driver.

### Authentication and authorization

"Devices are authenticated" is an assumption until you know how credentials are issued, rotated, and revoked. If devices keep credentials for ten years, rotation is a driver. Fail-open or fail-closed behavior during an identity outage needs a stated decision.

### Tenant isolation

"Customers will not share a fleet" is an assumption that may change with resellers. Record it, because adding tenancy later touches every table and every query. See [[a180]].

### Sensitive data

Location data can identify individuals. A constraint such as GDPR in the EU affects retention and residency. Registers may also describe known weaknesses, so restrict access to security-relevant entries.

### Abuse resistance

Check what your assumptions imply about an attacker. "Devices report every 10 seconds" isn't enforced by anything unless the server enforces it. One compromised credential could send 10,000 messages per second, so make it an enforced limit.

## Observability

### Metrics

Monitor the assumptions themselves: read-to-write ratio, peak-to-mean ratio, mean object size, per-tenant share of traffic. Also register health: `assumptions_overdue_total{impact}` and days since last review.

### Logs

The register checker emits one JSON line for each assessment. Keep decision records, and link them to assumption IDs so that a refuted statement leads to affected decisions.

### Traces

Traces check assumptions on fan-out and dependency order, such as "each request calls at most 4 services". Sampled traces will reveal when it no longer holds.

### Dashboards

Build an "assumption health" view: each numeric assumption, the original value, the current measurement, and drift. Plot it beside the threshold where the design would have to change.

### Alerts

Send tickets rather than pages. Example: "write ratio has exceeded the design assumption by 50% for 7 days." High-impact overdue items block the next architecture review.

### SLO examples

- All high-impact assumptions are verified within their stated date, checked monthly.
- No active decision rests on a refuted assumption for more than 30 days.
- 90% of numeric design assumptions have a live measurement.

### Runbook actions

When an alert fires: find the assumption ID, list dependents, check whether the drift is temporary, and notify the owner. If a threshold will be crossed within two quarters, schedule design work now.

## Implementation

### Architecture of the examples

TypeScript provides a register checker for CI, split into a parser and pure `assess` function. Python provides a sensitivity analysis over a capacity model. Neither has an HTTP layer, because a command that returns an exit code suits their use, and a server would add nothing to the lesson.

### Data structures

`Assumption` carries owner, impact, status, verify-by date, and dependents. `Report` holds the action as a union of `block`, `verify-now`, `watch`, and `none`. In Python, `Input` validates that low ≤ base ≤ high, and `Swing` records spread and threshold crossing.

### Interfaces

`pnpm start register.json` prints JSON lines with exit codes 0, 1, or 2. `python -m app.main` prints JSON. Python's `sensitivity(inputs, threshold)` is usable as a library.

### Error handling

The TypeScript parser rejects missing owners, since an unowned assumption defeats the purpose, and it reports invalid dates. Exit code 2 stands apart from 1, which allows CI to distinguish bad data from a real block. Pydantic rejects unordered ranges at construction time.

### Concurrency considerations

Both tools run once and hold no shared state. Concurrency arises in editing the register itself. Version control handles this, with merge review acting as the change process.

### Educational limitations

One-at-a-time analysis ignores correlated inputs. The node model is deliberately simple and leaves out storage, memory, and fan-out. Neither tool can find an assumption that nobody wrote down, which is often the most dangerous kind.

### Production hardening

Link IDs to ADRs, feed measurements from metrics into the register, run the check on a schedule as well as in CI, and notify owners automatically. Use Monte Carlo sampling when inputs correlate.

## Terminal lab

### Setup

```bash
cd topics/constraints-assumptions-and-architecture-drivers/examples/typescript
pnpm install --ignore-workspace
```

### Run

```bash
pnpm --silent start register.json | jq -c "{id, action}"
```

Now see which assumption to verify first:

```bash
cd ../python && uv run python -m app.main | jq -c '.swings[] | {name, at_low, at_high, crosses_threshold}'
```

### Test

```bash
cd ../typescript && pnpm test
```

```bash
cd ../python && uv run pytest -q
```

### Expected output

The register produces:

```json
{"id":"A1","action":"block"}
{"id":"A2","action":"none"}
{"id":"A3","action":"block"}
{"id":"A4","action":"watch"}
```

The sensitivity tool ranks `daily_active` first, spanning 3 to 21 nodes, and it alone has `crosses_threshold` true against the 16-node limit.

### Cleanup

```bash
rm -rf ../typescript/node_modules .venv
```

### Troubleshooting

- `A4` shows `verify-now`: its 2030 date has passed, so edit the date in `register.json`.
- `ERR_UNKNOWN_FILE_EXTENSION`: upgrade Node.js to 23.6 or later.

## Practical challenges

:::challenge Concept | Sort the kickoff notes
Classify each one and name the next action: (a) "We have to use Kafka because the platform team runs it." (b) "Data for German customers must stay in the EU." (c) "Peak traffic is about 3x mean." (d) "The system should be easy to operate."
>>> Hint
Ask who could change it, and what evidence would disprove it.
>>> Solution
(a) Soft constraint: ask the platform team what happens if another broker is used, and who carries the operational cost. (b) Hard constraint if confirmed by legal: verify the exact wording, as it may be broader or narrower than stated. (c) Assumption: measure it. (d) An untestable requirement: rewrite it, for example "a new on-call engineer can complete a failover using the runbook in under 15 minutes."
>>> Common mistakes
Treating all "must" statements as hard. Accepting (c) because it sounds common.
:::

:::challenge Debugging | The design that kept getting more expensive
A team's cache keeps growing, and hit rate has dropped from 92% to 61% in a year, although read traffic is flat. Their design says "80% of reads go to 20% of keys". Use a logged key sample to test that belief. What do you measure, and what do you do if the skew has flattened?
>>> Hint
Compute the share of reads going to the top 20% of keys. Compare it with the design value and check what changed in the product.
>>> Solution
Count reads by key over a representative window, sort, and compute the cumulative share at 20% of distinct keys. If it is now 45%, for example, the assumption is refuted: likely personalization or a long-tail feature changed the access pattern. Register the refutation, then reopen the cache decision: it may need a larger tier, a different admission policy, or caching at a different layer. Add the skew measurement to the dashboard. See [[a105]].
>>> Common mistakes
Only resizing the cache. Looking at one hour rather than a whole cycle of traffic.
:::

:::challenge Capacity | Find the assumption that matters
Users: 1 to 8 million, base 3 million. Each sends 2 to 10 messages per day, base 4. Peak ratio: 2 to 5, base 3. Each node takes 200 messages per second. Which input has the widest swing? Would the limit of 8 nodes be crossed?
>>> Hint
At base: 3,000,000 × 4 ÷ 86,400 × 3 ÷ 200. Vary one input at a time and round up.
>>> Solution
Base: 138.9 mean per second × 3 = 416.7, ÷ 200 = 2.08, so 3 nodes. Users: 1 million gives 0.69, so 1 node; 8 million gives 5.56, so 6 nodes; spread 5. Messages: 2 gives 1.04, so 2; 10 gives 5.21, so 6; spread 4. Peak: 2 gives 1.39, so 2; 5 gives 3.47, so 4; spread 2. User count has the widest swing, and no single input crosses 8 nodes. But two at once can: 8,000,000 × 10 ÷ 86,400 × 3 ÷ 200 = 13.9, so 14 nodes. So check combined cases too, since one-at-a-time analysis hides them.
>>> Common mistakes
Stopping at the single-input result. Forgetting to divide by 86,400.
:::

:::challenge Design | Drivers for a video-conference recording feature
Recording is being added to a 500,000-user conferencing product, with recordings stored for 90 days. List two hard constraints that you would verify, three assumptions, and three drivers. For each driver, explain the ten-times test.
>>> Hint
Think about consent law, storage volume, and whether processing happens during or after the meeting.
>>> Solution
Constraints: consent and retention rules in each jurisdiction, confirmed by legal; contractual data residency. Assumptions: 10% of meetings get recorded; average 45 minutes at 2 Mbit/s; 80% of views happen within a week. Drivers: storage volume (10x means tiering and a different cost model), processing latency requirement (ten times faster means real-time pipelines rather than batch), and per-tenant residency (ten times as many regions changes deployment topology). Data: 45 min × 60 × 2 Mbit/s ÷ 8 = 675 MB per recording.
>>> Common mistakes
Naming features as drivers. Leaving out legal constraints until the end. Giving drivers that would not change the diagram.
:::

:::challenge Incident | Refuted during an outage
A vendor rate-limits you at 100 requests per second during the year's largest sale, and your design assumed 500. Requests pile up and threads exhaust. What do you do during the incident, and which follow-up actions address the assumption rather than just the symptom?
>>> Hint
Protect your own system first. Then trace how 500 got into your documents.
>>> Solution
During: declare the incident, cap outbound calls below the actual limit, shed or queue non-critical calls, and degrade the feature. Contact the vendor and request an increase. Afterwards: find where 500 came from (probably a sales conversation or old documentation), get limits in writing, record the assumption with an owner, test limits in a sandbox where allowed, watch `429` rate and quota use as metrics, and review other vendor assumptions the same way. See [[o2]] and [[o41]].
>>> Common mistakes
Only adding retries, which worsens the overload. Calling this a vendor failure when your design assumed an unverified number.
:::

## Industry standards and trends

### Standards and specifications

No formal standard governs this area in general. Useful references: [ISO/IEC/IEEE 29148](https://www.iso.org/standard/72089.html), 2018, covers stakeholder requirements including constraints. [arc42 section 2](https://docs.arc42.org/section-2/), a living open template, gives constraints their own section. It is a widely used convention rather than a standard.

### Established practice

[Architectural Decision Records](https://adr.github.io/), maintained by a community group, connect decisions to their context. Published methods include the [Architecture Tradeoff Analysis Method](https://en.wikipedia.org/wiki/Architecture_tradeoff_analysis_method) from the Software Engineering Institute, which names "sensitivity points" and "trade-off points". The [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html) gives review questions that often expose unstated assumptions.

### Managed-service options

No managed service is needed: JSON or Markdown in Git works. Risk-management tools fit regulated organizations. Your metrics platform is the important dependency, as it supplies evidence.

### Emerging approaches

Architecture fitness functions automate checks on some assumptions. See [[a11]]. Teams are also experimenting with language models to find contradictions in design documents. This is an inference from public activity with no reliable adoption data, and the output is only a prompt for human checking.

### Recent changes

Practice is stable, with no significant recent standards change found in the review for this topic. One shift is that cloud-provider pricing and quotas change often enough that vendor limits need a shorter review date.

### Adoption constraints

Questioning constraints requires organizational trust, and it can read as resistance. Lead with the reason behind the rule. Lightweight registers succeed where something enforces them, and fail where they are only documents.

## Interview preparation

:::q Foundational | What is the difference between a constraint and an assumption?
**Strong answer.** A constraint is a limit I must design within, whereas an assumption is something I believe but haven't verified. The action differs: I challenge constraints with their owner and test assumptions with evidence.

**Why it is asked.** It checks basic design vocabulary and habits.

**Weak-answer warning signs.** Using the terms interchangeably.

**Follow-up.** Give an example of an assumption that was written as a constraint.
:::

:::q Foundational | What is an architecture driver?
**Strong answer.** A requirement, constraint, or assumption that would change the structure if it changed. I test by asking if 10 times more or less would mean a different diagram. Usually only a few qualify.

**Why it is asked.** Focus on the right things is what interviewers want to see.

**Weak-answer warning signs.** Listing every requirement, or only naming technologies.

**Follow-up.** Can team size be a driver?
:::

:::q Foundational | How do you state assumptions in a design interview?
**Strong answer.** Aloud and with numbers: "I'll assume 10 million daily users and a 20:1 read ratio. If writes are higher, the storage choice changes." Naming the sensitivity shows which ones matter.

**Why it is asked.** Interviewers need to follow your reasoning and correct you.

**Weak-answer warning signs.** Hidden assumptions that come out late, or asking the interviewer for every number.

**Follow-up.** The interviewer changes your assumption by ten times. What now?
:::

:::q Senior | How do you challenge a constraint without creating conflict?
**Strong answer.** I find the reason behind it and meet that reason another way. If a database mandate exists to limit operational load, I offer to carry on-call. I come with priced options and leave the decision to the owner, and I often suggest a time-limited exception.

**Why it is asked.** This is how real designs get unblocked.

**Weak-answer warning signs.** Going around the owner, or accepting every constraint.

**Follow-up.** The owner says no with no reason. What do you do?
:::

:::q Senior | Which assumptions do you verify first?
**Strong answer.** I rank by impact, uncertainty, and cost to check, and use sensitivity analysis to see which range crosses a design threshold. An assumption with a smaller range that crosses a threshold comes before a larger one that doesn't.

**Why it is asked.** Verification effort is limited.

**Weak-answer warning signs.** Verifying what is easy, or trying to verify everything.

**Follow-up.** How do you check an assumption about future traffic?
:::

:::q Senior | Give an example of a non-technical architecture driver.
**Strong answer.** On-call capacity. A six-person team cannot sustainably run a self-managed distributed database, which argues for a managed service even at higher unit cost. Hiring markets and contract dates can matter equally.

**Why it is asked.** It shows you consider operating reality.

**Weak-answer warning signs.** Treating people as outside architecture.

**Follow-up.** How would you quantify the on-call burden?
:::

:::q Senior | What do you do when a design assumption gets refuted after launch?
**Strong answer.** Find the decisions resting on it, estimate time until a threshold is crossed, buy time if needed through limits or capacity, then plan the change. I also find why it wasn't detected sooner and add a measurement.

**Why it is asked.** It tests calm, structured response.

**Weak-answer warning signs.** Jumping to a rewrite or denying the evidence.

**Follow-up.** How do you explain the extra cost to leadership?
:::

:::q Staff | How do you stop assumptions from going stale across many teams?
**Strong answer.** Keep them close to the code, with owners and dates, and connect high-impact ones to live metrics that alert on drift. Make overdue items block architecture review. Keep the list short, or nobody will maintain it.

**Why it is asked.** It tests designing a mechanism, not a one-time fix.

**Weak-answer warning signs.** Depending on a wiki and good intentions.

**Follow-up.** What metric shows that this process works?
:::

:::q Staff | Two teams hold contradictory assumptions about shared infrastructure. How do you find and fix that?
**Strong answer.** Read their load forecasts and capacity assumptions side by side, and sum what each expects from the shared system. Then make shared capacity explicit, with quotas and an owner, so that the contradiction turns into a visible allocation decision.

**Why it is asked.** Cross-team failures are common at this level.

**Weak-answer warning signs.** Solving it through one meeting with no lasting mechanism.

**Follow-up.** The total is 150% of capacity. Who decides?
:::

:::q Staff | When would you accept an unverified high-impact assumption?
**Strong answer.** When verifying costs more than being wrong, or when evidence can come only from real use. In those cases I reduce the blast radius: build the reversible version, launch to a small group, and set a clear signal for revisiting.

**Why it is asked.** Waiting for certainty is also a risky choice.

**Weak-answer warning signs.** Saying never, or accepting them without any mitigation.

**Follow-up.** What would make this decision irreversible, and how would you avoid that?
:::

:::q Principal | How do you distinguish a real regulatory constraint from an over-cautious interpretation?
**Strong answer.** I read the text with counsel and ask what specifically is required, for what data, and with what penalties. Often the rule covers less than the internal policy does. I bring engineering options and costs so legal can judge the risk, and I document who accepted it. I don't substitute my own legal view.

**Why it is asked.** Principals work directly on these boundaries, and the stakes are high.

**Weak-answer warning signs.** Ignoring legal, or giving legal advice yourself.

**Follow-up.** Legal says "it depends". How do you proceed with the design?
:::

:::q Principal | A long-standing company rule costs millions each year. How would you change it?
**Strong answer.** I would find its origin and current owner, quantify its cost and benefit, and identify what risk it still guards against. I would propose a pilot with defined guardrails and exit criteria on a low-risk workload. Then I would publish results so the decision rests with the owner and has evidence behind it.

**Why it is asked.** Changing organizational constraints is core principal work.

**Weak-answer warning signs.** Arguing from principle, or quietly ignoring the rule.

**Follow-up.** The pilot succeeds, but the owner still refuses. What next?
:::

## Review

### Key takeaways

- Label each statement: requirement, constraint, or assumption. "Fact" needs evidence.
- Constraints have owners, so ask them why, and price the alternative.
- Assumptions have owners and dates, and impact sets their order.
- Drivers change the diagram. Use the ten-times test.
- Team skills, budgets, and dates can all be legitimate drivers.
- A confirmed assumption becomes unverified again when conditions change.

### Decision checklist

- [ ] Has every number got a source or an assumption label?
- [ ] Does each constraint list who can lift it?
- [ ] Have I run arithmetic to check that statements do not conflict?
- [ ] Have I named three to five drivers and tested each?
- [ ] Do I know which assumption would most change the design?

### Production-readiness checklist

- [ ] Design-critical assumptions have live measurements.
- [ ] Drift from assumption values raises a ticket.
- [ ] Vendor limits are confirmed in writing and tracked.
- [ ] Dependent decisions are linked to assumptions.
- [ ] High-impact overdue assumptions block the next review.

### Glossary

- **Hard constraint:** breaking it causes legal, contractual, or physical failure.
- **Soft constraint:** a policy or earlier decision that its owner could change.
- **Sensitivity point:** a parameter to which an outcome is highly sensitive.
- **Tornado chart:** a bar chart of output swings, ranked by size.
- **Ten-times test:** asking whether a tenfold change would alter the structure.

### Quiz

:::quiz A brief says "must use the shared Oracle cluster". What should you do first?
- Design around it, since it says must.
- Ignore it if another database is better.
- *Find the owner and the reason, then price the alternative.
- Escalate to the CTO.
It may be hard or soft. Only the owner and reason can tell you, and an alternative needs a price before anyone can decide.
:::

:::quiz Which is the best test for an architecture driver?
- Stakeholders listed it first.
- It is the hardest to implement.
- *A tenfold change in it would change the diagram.
- It is a quality attribute.
Drivers change structure. They may come from requirements, constraints, or assumptions, and need not be listed first.
:::

:::quiz 40,000 vehicles report every 10 seconds, and dashboards do 300 reads per second. What is true?
- The workload is read-heavy.
- *The workload is write-heavy, at about 4,000 writes per second.
- The two are balanced.
- There is not enough information.
40,000 ÷ 10 = 4,000 writes per second, more than 13 times the reads. Simple arithmetic refutes the belief.
:::

:::quiz One input has a spread of 3 nodes and crosses a design threshold. Another has a spread of 6 nodes and does not. Which do you verify first?
- The one with spread 6.
- *The one that crosses the threshold.
- Both equally.
- Neither.
Crossing a threshold means the design itself changes. A larger spread that stays within the design matters less.
:::

:::quiz When should a confirmed assumption return to unverified?
- Never.
- Once per decade.
- *When the conditions behind the evidence change.
- Only after an incident.
Evidence is true only for conditions when it was gathered. Product and traffic changes make it a belief again.
:::

### Further study

Next, continue with [[a3]] to measure workloads in place of assuming them. Then read [[a12]] for choosing among options and [[a13]] for recording those choices.
