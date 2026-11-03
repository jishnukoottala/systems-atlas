# Original project spec

The owner's brief for this project, kept word for word so any session can follow it.

One decision overrides it: the site is now called **Systems Atlas**, with the tagline "Master system
design from first principles to production". `SITE_TITLE` below is the original name. The storage
namespace stays as the spec sets it. See `CLAUDE.md` for how the work is carried out.

---

```text
SITE_TITLE: "Principal Engineer System Design Curriculum"
OUTPUT_DIRECTORY: current working directory
TARGET_AUDIENCE: "Senior, Staff, and Principal Software Engineers"
STARTING_LEVEL: "Advanced and expert system-design knowledge"
TARGET_LEVEL: "Principal engineer"
CURRENT_YEAR: {{default: use the actual current year}}
TOPICS_PER_BATCH: 5
INCLUDE_SYSTEM_DISSECTS: true
INCLUDE_PROGRESS_TRACKING: true
DEFAULT_THEME: "system"
DIAGRAM_FORMAT: "mermaid"
STATIC_HOST_TARGET: "GitHub Pages"
GENERATE_PNG_FALLBACKS: false

TYPESCRIPT_STACK:
  runtime: "Node.js"
  framework: "Express"
  alternative_framework: "Encore.ts when it materially improves the example"
  package_manager: "pnpm"

PYTHON_STACK:
  version: "Python 3.12+"
  framework: "FastAPI"
  package_manager: "uv"

GO_STACK:
  version: "Go 1.23+"
  http_framework: "Gin"
  grpc_framework: "grpc-go"

RUST_STACK:
  edition: "Rust 2024"
  async_runtime: "Tokio"
  http_framework: "Axum"
  grpc_framework: "tonic"

Default behavior:

- Generate every required topic and system dissection.
- Work in resumable batches of TOPICS_PER_BATCH.
- Use Mermaid diagrams with a pinned Mermaid version.
- Generate TypeScript and Python examples for every topic.
- Add Go and Rust examples where specified by the language rules.
- Produce a completely static website requiring no application backend.
- Do not ask questions unless a required input is genuinely missing.
- If an input is unchanged, use its documented default.

======================================================================
ROLE
======================================================================

You are a principal software architect, distributed-systems engineer,
production engineer, technical educator, and curriculum designer.

Build a repository-hosted, browser-accessible system-design curriculum
that takes a reader from foundational mental models to principal-level
architectural judgment.

The curriculum must prepare readers to:

- Design large-scale production systems
- Quantify capacity and reliability
- Reason about distributed-system guarantees
- Diagnose performance and availability failures
- Make and defend architectural trade-offs
- Lead architecture reviews
- Handle principal-level system-design interviews
- Communicate designs to engineers and executives
- Build small runnable implementations of important concepts
- ace top companies system design interviews

Do not merely generate definitions. Teach reasoning, implementation,
operation, failure analysis, and decision-making.

======================================================================
NON-NEGOTIABLE REQUIREMENTS
======================================================================

1. Cover every item in REQUIRED ORIGINAL TOPICS.
2. Cover every item in REQUIRED ADDITIONAL TOPICS.
3. Generate every system in SYSTEMS-DISSECT.
4. Create one stable, unique folder for every canonical topic.
5. Create one folder for every system dissection.
6. Generate TypeScript and Python examples for every topic.
7. Generate Go and Rust examples according to the language rules.
8. Include terminal exercises in every topic.
9. Include diagrams in every topic and system dissection.
10. Generate a root index.html linking to every page.
11. Track progress locally in the browser.
12. Support light and dark themes.
13. Work as a static website on GitHub Pages or equivalent hosting.
14. Use relative links so repository subpath hosting works.
15. Do not leave TODOs, placeholders, empty sections, or broken links.
16. Never claim generation is complete until validation passes.
17. the root index.html should have a clean, minimal look which covers all the topic and links to the sub pages

======================================================================
REQUIRED ORIGINAL TOPICS
======================================================================

Create a traceability record for all 111 original topics.

1. Idempotency keys
2. Rate limiting
3. Reverse proxies
4. Connection pooling
5. N+1 queries
6. Caching strategies
7. Cache invalidation
8. Load balancing
9. API gateways
10. Timeouts
11. GraphQL challenges
12. Gateways and routers
13. Retries
14. Exponential backoff
15. Circuit breakers
16. Race conditions
17. Deadlocks
18. Memory leaks
19. Webhooks
20. CORS
21. Secrets management
22. Database indexing
23. Query optimization
24. Read replicas
25. Database migrations
26. Schema versioning
27. Optimistic locking
28. Distributed locks
29. Sharding
30. Partitioning
31. Replication
32. Leader election
33. CAP theorem
34. Eventual consistency
35. Distributed transactions
36. Saga patterns
37. Message queues
38. Publish/subscribe
39. Event-driven architecture
40. Dead-letter queues
41. Backpressure
42. Cron jobs
43. SQL injection
44. Cross-site scripting
45. Cross-site request forgery
46. Server-side request forgery
47. OAuth
48. JWT rotation
49. Identity and access management
50. TLS
51. Encryption at rest
52. Encryption in transit
53. Web application firewalls
54. DDoS protection
55. WebSockets
56. Server-Sent Events
57. Long polling
58. gRPC
59. HTTP/2 and HTTP/3
60. TCP versus UDP
61. DNS
62. Docker
63. Kubernetes
64. Helm charts
65. Service discovery
66. CI/CD
67. Build caching
68. Infrastructure as code
69. Terraform
70. Feature flags
71. Blue-green deployments
72. Canary releases
73. Rolling deployments
74. Rollbacks and roll-forwards
75. Health checks
76. Liveness and readiness probes
77. Dependency management and dependency hell
78. API versioning
79. Semantic versioning
80. Garbage collection
81. Thread safety
82. Autoscaling
83. Horizontal scaling
84. Vertical scaling
85. CDNs
86. Edge caching
87. Cost optimization
88. Cold starts
89. Serverless limits
90. Latency
91. Throughput
92. P99 latency
93. Tail latency
94. Network partitions
95. Clock skew
96. Multi-region deployments
97. Failover and failback
98. Backups and restoration
99. Disaster recovery
100. Chaos engineering
101. Logging
102. Monitoring
103. Distributed tracing
104. Metrics
105. Alerts
106. Observability
107. SLAs, SLOs, and SLIs
108. Error budgets
109. Production incidents
110. On-call engineering
111. Postmortems

======================================================================
REQUIRED ADDITIONAL TOPICS
======================================================================

Each numbered entry below is a required canonical topic. Closely related
original topics may be linked, but no item may be silently omitted.

A. DESIGN METHOD AND QUANTITATIVE REASONING

1. Functional and non-functional requirements
2. Constraints, assumptions, and architecture drivers
3. Workload characterization and traffic modeling
4. Back-of-the-envelope capacity estimation
5. Latency budgets and critical-path analysis
6. Concurrency, utilization, saturation, and bottlenecks
7. Storage, bandwidth, memory, and IOPS calculations
8. Little’s Law and practical queueing theory
9. Availability and reliability mathematics
10. Failure-budget and risk calculations
11. Architecture fitness functions
12. Decision criteria and trade-off matrices
13. Architecture decision records
14. Reversible versus irreversible decisions

B. COMPUTER SYSTEMS

15. Processes, threads, coroutines, and event loops
16. Blocking versus non-blocking I/O
17. Async I/O and scheduling
18. Atomicity, visibility, and memory ordering
19. Livelock, starvation, and lock-free programming
20. CPU caches, locality, false sharing, and NUMA
21. File descriptors, sockets, and resource limits
22. System calls and context switching
23. Serialization, compression, and zero-copy
24. CPU, heap, lock-contention, and I/O profiling

C. NETWORKING AND WEB FOUNDATIONS

25. HTTP semantics, methods, status codes, and headers
26. HTTP caching and conditional requests
27. Connection establishment, keep-alive, and draining
28. Congestion control and head-of-line blocking
29. NAT, firewalls, routing, anycast, and BGP fundamentals
30. Packet loss, jitter, retransmission, and MTU problems
31. Certificate authorities, PKI, and mutual TLS
32. Forward proxies, tunnels, ingress, and egress
33. L4 versus L7 load balancing
34. Origin shielding and CDN request collapsing

D. API AND CONTRACT DESIGN

35. REST resource modeling
36. Pagination: offset, cursor, and keyset
37. Filtering, sorting, sparse fields, and bulk operations
38. API error models and partial success
39. Deadlines and cancellation propagation
40. Long-running operation APIs
41. Consumer-driven contract testing
42. Compatibility, deprecation, and sunset policies
43. Backend-for-frontend architecture
44. GraphQL federation and query-complexity controls
45. Protocol Buffers compatibility
46. Webhook replay protection and signature verification

E. DATA SYSTEMS AND STORAGE INTERNALS

47. Relational modeling and normalization
48. Denormalization and materialized views
49. Access-pattern-driven NoSQL modeling
50. Transactions and ACID
51. Isolation levels and transaction anomalies
52. MVCC and serializability
53. Pessimistic concurrency control
54. B-trees and LSM trees
55. Write-ahead logs, checkpoints, and recovery
56. Buffer pools, pages, and storage layout
57. Compaction and read/write amplification
58. Composite, covering, and secondary indexes
59. Consistent and rendezvous hashing
60. Hot keys, hot partitions, and rebalancing
61. Online schema changes and large backfills
62. Change data capture
63. Search and inverted indexes
64. Time-series databases
65. Graph databases
66. Vector databases and approximate-nearest-neighbor indexes
67. Columnar and analytical storage
68. Blob and object storage
69. Polyglot persistence and data ownership

F. DISTRIBUTED SYSTEMS

70. Partial failure and failure detection
71. PACELC
72. Linearizable, sequential, causal, and eventual consistency
73. Read-your-writes and monotonic-read guarantees
74. Read/write quorums
75. Tunable consistency
76. Raft and Paxos concepts
77. Consensus safety and liveness
78. Leases, fencing tokens, and split brain
79. Lamport clocks
80. Vector clocks and version vectors
81. Hybrid logical clocks
82. CRDTs and conflict resolution
83. Gossip, membership, and anti-entropy
84. Two-phase commit
85. Atomic commit and blocking failure modes
86. Exactly-once claims versus end-to-end effects
87. Invariant-first distributed-system design

G. MESSAGING, STREAMING, AND WORKFLOWS

88. Delivery semantics
89. Ordering and partition keys
90. Consumer groups and parallel processing
91. Acknowledgements and visibility timeouts
92. Poison messages, quarantine, and replay
93. Transactional outbox and inbox patterns
94. Dual-write failure and reconciliation
95. Event schemas and schema registries
96. Event notification versus event-carried state transfer
97. Event sourcing
98. CQRS
99. Stream-processing windows
100. Watermarks and late-arriving events
101. Durable timers and duplicate execution
102. Workflow engines and durable execution
103. Orchestration versus choreography

H. PERFORMANCE AND RESILIENCE

104. Cache stampedes and request coalescing
105. Cache admission and eviction algorithms
106. Probabilistic data structures
107. Batching, pipelining, and parallelism
108. Load, stress, spike, and soak testing
109. Benchmark design and coordinated omission
110. Retry budgets
111. Bulkheads and isolation pools
112. Load shedding and admission control
113. Graceful degradation and brownouts
114. Graceful shutdown and connection draining
115. Blast-radius containment
116. Single points of failure and correlated failure
117. Safe defaults, kill switches, and operational guardrails
118. Failure-mode and effects analysis

I. OBSERVABILITY AND OPERATIONS

119. Structured logging and correlation identifiers
120. Metric cardinality and histogram design
121. Trace sampling and context propagation
122. OpenTelemetry and telemetry pipelines
123. Golden Signals, RED, and USE methods
124. Multi-window burn-rate alerts
125. Alert fatigue and symptom-based alerting
126. Incident command and incident communication
127. Production-readiness reviews
128. Runbook design and operational ownership
129. Sustainable on-call rotations

J. SECURITY, PRIVACY, AND MULTI-TENANCY

130. Threat modeling and abuse cases
131. Authentication versus authorization
132. OpenID Connect and PKCE
133. RBAC versus ABAC
134. Least privilege and separation of duties
135. Workload identity
136. Envelope encryption
137. KMS, HSMs, and crypto agility
138. Request smuggling and insecure deserialization
139. Tenant isolation and noisy-neighbor controls
140. Supply-chain security, SBOMs, and provenance
141. Audit logs and tamper evidence
142. Data classification, retention, and deletion
143. Data residency and sovereignty
144. Privacy-by-design
145. Security incident containment

K. PLATFORM AND DELIVERY ENGINEERING

146. Container image layers and multi-stage builds
147. Reproducible and hermetic builds
148. Kubernetes controllers and reconciliation
149. Kubernetes requests, limits, QoS, and disruption budgets
150. Persistent storage in Kubernetes
151. GitOps
152. Policy as code and admission control
153. Service mesh architecture and trade-offs
154. Artifact promotion and environment parity
155. Progressive delivery and automated canary analysis
156. Platform engineering and paved roads
157. Developer experience as a platform concern

L. MULTI-REGION AND CONTINUITY

158. Regions, availability zones, and failure domains
159. Active-passive versus active-active architecture
160. Regional traffic steering
161. Cross-region replication and write ownership
162. RTO and RPO
163. Business-impact analysis
164. Immutable backups and cyber recovery
165. Restore verification
166. Regional evacuation and capacity reservation
167. Control-plane versus data-plane survivability
168. Cell-based architecture
169. Disaster-recovery exercises

M. ARCHITECTURE AND EVOLUTION

170. Cohesion, coupling, modularity, and information hiding
171. Modular monoliths
172. Microservice boundaries and service sizing
173. Hexagonal and ports-and-adapters architecture
174. Domain-driven design and bounded contexts
175. Synchronous versus asynchronous composition
176. Strangler migrations
177. Branch by abstraction
178. Dual reads, dual writes, and migration reconciliation
179. Anti-corruption layers
180. Multi-tenancy architecture models
181. Control-plane and data-plane separation
182. Evolutionary architecture
183. Technical-debt portfolio management
184. Build versus buy versus managed services

N. TESTING AND CORRECTNESS

185. Test portfolios and confidence boundaries
186. Unit, integration, component, and end-to-end testing
187. Contract and compatibility testing
188. Property-based testing
189. Fuzz testing
190. Invariant testing
191. Deterministic distributed-system simulation
192. Concurrency and race testing
193. Fault-injection testing
194. Shadow traffic and traffic replay
195. Differential testing
196. Migration and rollback testing
197. Restore and disaster-recovery testing
198. Formal methods and model checking
199. Production verification

O. ECONOMICS AND PRINCIPAL-LEVEL LEADERSHIP

200. Cloud unit economics
201. Cost per request, tenant, and workload
202. Total cost of ownership
203. Operational burden and opportunity cost
204. Capacity commitments and elasticity
205. Architecture narratives and review documents
206. Executive communication
207. Cross-team contracts and ownership boundaries
208. Dependency governance
209. Technical strategy and sequencing
210. Migration economics
211. Standardization versus autonomy
212. Risk management and compliance evidence
213. Decision facilitation, dissent, and escalation
214. Mentoring architecture reasoning
215. Measuring architecture outcomes

======================================================================
SYSTEMS-DISSECT
======================================================================

Create systems-dissect/index.html and one subfolder for each system.

Required systems:

1. URL shortener / Bitly
2. Cloud file storage / Dropbox
3. Local delivery service
4. Ticket booking / Ticketmaster
5. Social news feed
6. Dating and matching service / Tinder
7. Online judge / LeetCode
8. Messaging platform / WhatsApp
9. Distributed rate limiter
10. Video platform / YouTube
11. Live comments
12. Top-K video analytics
13. Ride-sharing platform / Uber
14. Distributed web crawler
15. Advertisement click aggregator
16. Social-post search
17. Local business discovery / Yelp
18. Photo-sharing platform / Instagram
19. Fitness activity platform / Strava
20. Distributed cache
21. Online auction
22. Distributed job scheduler
23. News aggregator
24. Price-tracking service
25. Notification system
26. Retail brokerage platform / Robinhood
27. Collaborative document editor / Google Docs
28. Payment system
29. Metrics-monitoring platform
30. Online chess platform
31. LLM conversational platform / ChatGPT
32. Flash-sale platform

Also create systems-dissect/patterns/index.html covering:

1. Real-time updates
2. Contention and hot resources
3. Multi-step processes
4. Scaling reads
5. Scaling writes
6. Handling large blobs
7. Managing long-running operations
8. Proximity search
9. Vector databases
10. Time-series databases
11. Data structures for big data
12. Change data capture

The names referencing companies describe an educational class of system.
Do not claim to reproduce private company architectures. Clearly label:

- Publicly documented facts
- Reasonable architectural inference
- Hypothetical educational design

======================================================================
REPOSITORY STRUCTURE
======================================================================

Generate:

OUTPUT_DIRECTORY/
├── index.html
├── README.md
├── curriculum-manifest.json
├── generation-state.json
├── traceability.html
├── 404.html
├── assets/
│   ├── styles.css
│   ├── app.js
│   ├── progress.js
│   ├── search.js
│   ├── mermaid-init.js
│   └── mermaid.min.js
├── topics/
│   └── <topic-slug>/
│       ├── index.html
│       ├── README.md
│       ├── diagrams/
│       │   ├── context.mmd
│       │   ├── sequence.mmd
│       │   └── failure-path.mmd
│       ├── examples/
│       │   ├── typescript/
│       │   │   ├── package.json
│       │   │   ├── tsconfig.json
│       │   │   ├── src/index.ts
│       │   │   └── README.md
│       │   ├── python/
│       │   │   ├── pyproject.toml
│       │   │   ├── app/main.py
│       │   │   └── README.md
│       │   ├── go/        # when required
│       │   └── rust/      # when required
│       └── exercises/
│           ├── challenges.md
│           └── solutions.md
├── systems-dissect/
│   ├── index.html
│   ├── patterns/
│   │   └── index.html
│   └── <system-slug>/
│       ├── index.html
│       ├── README.md
│       ├── diagrams/
│       └── examples/
└── scripts/
    ├── validate-links.mjs
    ├── validate-manifest.mjs
    └── validate-examples.mjs

Use lowercase kebab-case slugs.

The manifest is the source of truth. Each entry must include:

- Stable ID
- Original topic number, if applicable
- Title
- Slug
- Domain
- Level
- Prerequisites
- Estimated study time
- Related topics
- Required languages
- Completion status
- Page path

======================================================================
ROOT INDEX.HTML
======================================================================

Build a minimal, content-first curriculum catalog.

Required features:

- Static HTML, CSS, and vanilla JavaScript
- Responsive layout
- Accessible semantic markup
- Consistent typography and spacing
- Light theme
- Dark theme
- Theme switcher
- “System” theme default
- Theme persisted in localStorage
- Search topics by title and keyword
- Filter by domain, level, language, and completion status
- Collapsible curriculum domains
- Topic cards or compact rows
- Links to every topic
- Links to every system dissection
- Overall completion percentage
- Completion by domain
- Estimated remaining study time
- Continue-learning link
- Reset-progress action with confirmation
- Export and import progress as JSON
- Keyboard-accessible controls
- Visible focus states
- Print-friendly styles
- Reduced-motion support
- No decorative animation
- No framework requirement
- No build step required to read the site

Use one stable localStorage namespace:

"principal-system-design-curriculum:v1"

Progress must be keyed by stable manifest IDs, not titles or URLs.

The website must work correctly when hosted below a repository path such
as:

https://example.github.io/principal-system-design/

Do not use root-relative links beginning with "/".

======================================================================
TOPIC PAGE CONTENT
======================================================================

Every topic index.html must contain:

1. Orientation
   - Definition
   - Why it matters
   - Prerequisites
   - Learning objectives
   - Study time
   - Related topics

2. Production scenario
   - A realistic motivating problem
   - Concrete scale and constraints

3. Mental model
   - Memorable analogy
   - Explicitly explain where the analogy breaks
   - Entities, state, flow, and invariants

4. Foundations
   - Concepts and terminology
   - First-principles explanation
   - Relevant mathematics
   - Time and space complexity where applicable

5. Mechanism
   - Step-by-step normal path
   - State transitions
   - Concurrency behavior
   - Ordering and consistency
   - Ownership of data and control

6. Architecture
   - Context diagram
   - Component diagram
   - Sequence diagram
   - Failure-path diagram
   - Deployment diagram when relevant
   - Written explanation below every diagram

7. Trade-offs
   - Advantages
   - Costs
   - Alternatives
   - When to use it
   - When not to use it
   - Conditions that should trigger reconsideration

8. Capacity planning
   - Inputs
   - Assumptions
   - Formula
   - Units
   - Intermediate calculations
   - Headroom
   - Failure capacity

9. Failure modes
   For every relevant failure:
   - Trigger
   - Symptoms
   - Blast radius
   - Detection
   - Mitigation
   - Recovery
   - Prevention

10. Security and privacy
    - Threats specific to this topic
    - Trust boundaries
    - Authentication and authorization
    - Tenant isolation
    - Sensitive-data handling
    - Abuse resistance

11. Observability
    - Metrics
    - Logs
    - Traces
    - Dashboards
    - Alerts
    - SLO examples
    - Runbook actions

12. Implementation
    - Architecture of the examples
    - Data structures
    - Interfaces
    - Error handling
    - Concurrency considerations
    - Educational limitations
    - Production-hardening requirements

13. Terminal lab
    - Setup commands
    - Run commands
    - Test commands
    - curl, grpcurl, dig, openssl, ss/lsof, jq, Docker, or kubectl
      examples when relevant
    - Expected output
    - Cleanup commands
    - Troubleshooting

14. Practical challenges
    - Concept exercise
    - Debugging exercise
    - Capacity exercise
    - Design exercise
    - Production-incident exercise
    - Hints
    - Expandable solutions
    - Common mistakes

15. Industry standards and trends
    - Relevant RFCs, specifications, and standards
    - Established industry practice
    - Managed-service options
    - Emerging approaches
    - Recent changes
    - Trade-offs and adoption constraints

16. Interview preparation
    - At least 12 questions
    - Foundational, senior, staff, and principal levels
    - Strong answer
    - Why it is asked
    - Weak-answer warning signs
    - Follow-up question

17. Review
    - Key takeaways
    - Decision checklist
    - Production-readiness checklist
    - Glossary
    - Five-question quiz with explanations
    - Further-study path

18. Progress controls
    - Mark complete
    - Mark in progress
    - Reset topic progress
    - Previous and next topic links
    - Return to curriculum

Teach from beginner foundations through advanced and principal-level
judgment. Do not assume that familiarity with a term means mastery.

======================================================================
LANGUAGE AND EXAMPLE RULES
======================================================================

TYPESCRIPT

Every topic must include a TypeScript example using:

- Node.js
- Strict TypeScript
- Express by default
- Encore.ts only when its service model materially benefits the lesson
- pnpm
- Explicit types
- Input validation
- Error handling
- Structured logging
- Graceful shutdown when applicable
- Tests or executable verification where practical

PYTHON

Every topic must include a Python example using:

- Python 3.12+
- FastAPI
- uv
- Type hints
- Pydantic models where useful
- Explicit exceptions
- Structured logging
- Async code where appropriate
- pytest or executable verification where practical

Do not add an HTTP API merely to claim framework usage. For algorithmic
topics, provide a command-line demonstration plus a minimal health or
inspection endpoint only if useful.

GO

Generate Go examples for:

- gRPC
- HTTP/2 and HTTP/3
- TCP versus UDP
- DNS
- Load balancing
- Reverse proxies
- Connection pooling
- Concurrency and thread-safety topics
- Distributed locks
- Leader election
- Message queues and stream processing
- High-throughput services
- Kubernetes controllers
- Systems where Go is especially instructive

Use:

- Standard library where sufficient
- Gin for HTTP APIs
- grpc-go for gRPC
- Gin only as an HTTP gateway, health endpoint, or admin API around gRPC
- Context cancellation
- Goroutine lifecycle management
- Race-detector instructions
- Table-driven tests where appropriate

RUST

Generate Rust examples for:

- Thread safety
- Race conditions
- Deadlocks
- Memory management and leaks
- Shared mutable state
- Lock-free or atomic operations
- High-performance networking
- Backpressure
- Message processing
- WebSockets
- gRPC
- Storage-engine internals
- Systems where ownership and memory safety materially improve the lesson

Use:

- Rust 2024 edition
- Tokio for async execution
- Axum for HTTP
- tonic for gRPC
- Explicit error types
- Safe Rust by default
- Explain Send, Sync, ownership, borrowing, Arc, Mutex, RwLock, channels,
  atomics, and pinning only where relevant

Do not generate meaningless translations of identical code. Adapt each
language example to the strengths and conventions of that ecosystem.

======================================================================
SYSTEM DISSECTION PAGE
======================================================================

Every system dissection must follow an interview-style design process:

1. Clarifying questions
2. Functional requirements
3. Non-functional requirements
4. Explicit assumptions
5. Capacity estimates
6. API or event contracts
7. Data model
8. High-level architecture
9. Critical request and event flows
10. Deep dives into the hardest components
11. Scaling reads
12. Scaling writes
13. Partitioning strategy
14. Caching strategy
15. Consistency requirements
16. Concurrency and contention
17. Failure modes
18. Multi-region strategy
19. Security and abuse prevention
20. Observability and SLOs
21. Cost model
22. Evolution from MVP to global scale
23. Alternative designs
24. Interviewer follow-up questions
25. Principal-level trade-off discussion
26. Runnable focused examples where useful

Each system must include at least:

- One context diagram
- One container/component diagram
- One sequence diagram
- One data model
- One failure-path diagram
- One deployment or scaling diagram

Do not create diagrams that are only unlabeled boxes and arrows.

======================================================================
DIAGRAM REQUIREMENTS
======================================================================

Use Mermaid with a pinned local Mermaid asset.

Every diagram must:

- Have a descriptive title
- Use labeled nodes
- Use labeled arrows where meaning is not obvious
- Show protocols where relevant
- Show data ownership
- Show trust boundaries where relevant
- Show failure boundaries where relevant
- Have a written interpretation
- Be readable in light and dark themes
- Have accessible fallback text
- Keep Mermaid source in diagrams/*.mmd

Permitted diagram types:

- flowchart
- sequenceDiagram
- stateDiagram-v2
- classDiagram
- erDiagram
- C4-style flowchart when C4 syntax is unavailable

If GENERATE_PNG_FALLBACKS is true and diagram rendering tools are
available, generate PNG fallbacks. Do not fabricate binary image files.

======================================================================
INDUSTRY RESEARCH RULES
======================================================================

For standards and current trends:

- Prefer primary sources
- Link to RFCs and official specifications
- Link to official project documentation
- Use public engineering articles only when clearly attributed
- Include publication date and access date
- Distinguish standards from common conventions
- Distinguish public facts from inference
- Never invent benchmarks or private company details
- Label unverified claims
- Do not use “industry standard” without naming the standard
- Add a “last reviewed” date to every topic

======================================================================
GENERATION PROCESS
======================================================================

This project is too large for reliable one-response generation. Work
incrementally and resumably.

PHASE 1 — PLAN AND MANIFEST

1. Create OUTPUT_DIRECTORY.
2. Normalize all required topics.
3. Preserve all 111 original IDs in traceability data.
4. Create stable IDs and slugs.
5. Resolve exact duplicates without losing traceability.
6. Create curriculum-manifest.json.
7. Create generation-state.json.
8. Create the root site shell.
9. Create topic and system-dissection indexes.
10. Validate that every required item has a destination.

PHASE 2 — TOPIC GENERATION

Process TOPICS_PER_BATCH topics at a time.

For each topic:

1. Mark it "generating".
2. Generate the topic page.
3. Generate diagrams.
4. Generate TypeScript files.
5. Generate Python files.
6. Generate Go and Rust files when required.
7. Generate exercises and solutions.
8. Verify links and commands.
9. Mark it "complete" only after validation.

PHASE 3 — SYSTEM DISSECTIONS

Generate systems in resumable batches using the same process.

PHASE 4 — VALIDATION

Run:

- Manifest coverage validation
- Traceability validation
- Internal-link validation
- Duplicate-ID validation
- Duplicate-slug validation
- Missing-file validation
- Placeholder and TODO detection
- HTML structural checks
- Relative-path validation
- Example syntax/type checks when toolchains are available

PHASE 5 — FINAL REPORT

Report:

- Topics completed
- Topics remaining
- Systems completed
- Systems remaining
- Validation results
- Examples not executed and why
- Claims requiring later source verification

If execution is interrupted, read generation-state.json and continue from
the first incomplete item. Do not regenerate completed content unless its
inputs changed.

======================================================================
TRACEABILITY REQUIREMENTS
======================================================================

Create traceability.html showing:

- Original topic number
- Original title
- Canonical topic ID
- Canonical topic title
- Generated page
- Coverage status
- Related additional topics

Completion criteria:

- Every original number from 1 through 111 appears exactly once.
- Every required additional topic appears.
- Every required system dissection appears.
- Every manifest entry links to an existing page.
- No page is counted complete merely because a folder exists.

======================================================================
CONTENT QUALITY RULES
======================================================================

- Explain mechanisms, not only definitions.
- Begin at the basic level.
- Build a durable mental model.
- Progress to implementation and operations.
- Finish with principal-level judgment.
- Use concrete numbers and realistic workloads.
- State assumptions explicitly.
- Show calculations with units.
- Separate guarantees from typical behavior.
- Separate logical architecture from physical deployment.
- Explain state ownership.
- Explain consistency boundaries.
- Explain backpressure.
- Explain partial failure.
- Explain recovery and reconciliation.
- Explain security and privacy implications.
- Explain operational and organizational cost.
- Label sample configuration as illustrative, not universal.
- Identify simplifications in educational code.
- Avoid marketing language.
- Avoid shallow listicles.
- Avoid unnecessary visual decoration.
- Do not create fictitious citations.
- Do not use placeholders or unfinished prose.

======================================================================
ACCESSIBILITY AND USER EXPERIENCE
======================================================================

The site must provide:

- Semantic headings
- Skip links
- Keyboard navigation
- Visible focus indicators
- Appropriate ARIA labels
- Accessible disclosure controls
- Sufficient color contrast
- Diagram descriptions
- Reduced-motion support
- Responsive layouts
- Readable line lengths
- Copy buttons with accessible feedback
- Print styles
- No content accessible only by color
- No mandatory JavaScript for reading core content

JavaScript may enhance search, progress, themes, diagrams, and quizzes,
but the educational text and navigation must remain usable without it.

======================================================================
README REQUIREMENTS
======================================================================

README.md must explain:

- Purpose
- Audience
- Curriculum structure
- Repository structure
- How to browse locally
- How to serve locally
- How progress tracking works
- How to deploy to GitHub Pages
- How to add a topic
- How to regenerate a topic
- How to resume interrupted generation
- How to validate the repository
- Required language toolchains
- Mermaid version and licensing
- Educational limitations

Include local serving examples such as:

python -m http.server 8000
uv run python -m http.server 8000
npx serve .
pnpm dlx serve .

Explain that localStorage behavior is most reliable when the curriculum
is served over HTTP instead of opened through file://.

======================================================================
FINAL ACCEPTANCE CHECKLIST
======================================================================

Do not declare completion until all checks pass:

[ ] Every original topic from 1–111 is traceable.
[ ] Every additional topic is in the manifest.
[ ] Every system dissection exists.
[ ] Every topic has a working index.html.
[ ] Every topic has TypeScript and Python examples.
[ ] Required topics have Go and/or Rust examples.
[ ] Every example has setup and run instructions.
[ ] Every topic contains terminal exercises.
[ ] Every topic contains diagrams.
[ ] Every system dissection contains the required diagrams.
[ ] Every page supports light and dark themes.
[ ] Theme preference persists.
[ ] Topic progress persists.
[ ] Progress can be exported and imported.
[ ] Search and filters work.
[ ] All internal links are valid.
[ ] All paths work under a repository subpath.
[ ] No root-relative links exist.
[ ] No TODOs or placeholders remain.
[ ] No unsupported private-company claims exist.
[ ] Current claims have sources or uncertainty labels.
[ ] The static website can be hosted without an application server.
[ ] The README contains local and hosted usage instructions.
[ ] Validation results are included in the final report.

Begin with Phase 1. Do not stop after proposing a plan. Create the
manifest, repository shell, root index, generation state, and validation
scripts, then continue through the curriculum in resumable batches.
```
