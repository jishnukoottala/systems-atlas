// Curriculum catalog: the hand-curated input from which curriculum-manifest.json is built.
// Line format: id|title|level|prerequisites|related
// IDs: oNN = original topic number, aNN = additional topic number. They never change.
// Levels: F foundational, I intermediate, A advanced, P principal.

export const DOMAINS = {
  A: 'Design method and quantitative reasoning',
  B: 'Computer systems',
  C: 'Networking and web foundations',
  D: 'API and contract design',
  E: 'Data systems and storage internals',
  F: 'Distributed systems',
  G: 'Messaging, streaming, and workflows',
  H: 'Performance and resilience',
  I: 'Observability and operations',
  J: 'Security, privacy, and multi-tenancy',
  K: 'Platform and delivery engineering',
  L: 'Multi-region and continuity',
  M: 'Architecture and evolution',
  N: 'Testing and correctness',
  O: 'Economics and principal-level leadership',
};

const RAW = {
  A: `
a1|Functional and non-functional requirements|F||a2,a12,o107
a2|Constraints, assumptions, and architecture drivers|F|a1|a12,a13,a3
a3|Workload characterization and traffic modeling|I|a1|a4,a60,a8
o90|Latency|F||o92,o93,a5
o91|Throughput|F|o90|a6,a8,a4
o92|P99 latency|I|o90|o93,a120,a109
o93|Tail latency|A|o92|a5,a109,o10
a4|Back-of-the-envelope capacity estimation|F|a3|a7,a8,o91
a5|Latency budgets and critical-path analysis|I|o90,o92|o10,a39,o93
a6|Concurrency, utilization, saturation, and bottlenecks|I|o91|a8,a123,a112
a7|Storage, bandwidth, memory, and IOPS calculations|F|a4|a204,a200
a8|Little’s Law and practical queueing theory|A|a6|a112,o41,o4
a9|Availability and reliability mathematics|I||o107,a116,a162
a10|Failure-budget and risk calculations|A|a9|o108,a118,a212
a11|Architecture fitness functions|A|a2|a182,a185,a215
a12|Decision criteria and trade-off matrices|I|a2|a13,a14,a213
a13|Architecture decision records|I|a12|a205,a14
a14|Reversible versus irreversible decisions|A|a12|a209,a13`,
  B: `
a15|Processes, threads, coroutines, and event loops|F||a16,a17,o81
a16|Blocking versus non-blocking I/O|F|a15|a17,a21,o4
a17|Async I/O and scheduling|I|a16|a22,o41
a21|File descriptors, sockets, and resource limits|I|a16|a27,o4
a22|System calls and context switching|I|a15|a20,a23,a24
a20|CPU caches, locality, false sharing, and NUMA|A|a22|a18,a24
a23|Serialization, compression, and zero-copy|I|a22|a45,a107
o16|Race conditions|I|a15|o81,a192,a18
o81|Thread safety|I|o16|a18,o17
o17|Deadlocks|I|o81|a19,a53
a18|Atomicity, visibility, and memory ordering|A|o81|a19,a20
a19|Livelock, starvation, and lock-free programming|A|a18|o17,a18
o18|Memory leaks|I|a15|o80,a24
o80|Garbage collection|I|o18|o93,a24
a24|CPU, heap, lock-contention, and I/O profiling|A|a15,a6|o18,o80,a6`,
  C: `
o60|TCP versus UDP|F||a27,a28,o59
o61|DNS|F||a29,a160,o65
a25|HTTP semantics, methods, status codes, and headers|F||a26,a35,a38
a26|HTTP caching and conditional requests|I|a25|o85,o6,a34
a27|Connection establishment, keep-alive, and draining|I|o60|o4,a114,o50
a28|Congestion control and head-of-line blocking|A|o60|o59,a30
a29|NAT, firewalls, routing, anycast, and BGP fundamentals|I|o60|o61,o54,a160
a30|Packet loss, jitter, retransmission, and MTU problems|A|o60|a28,o93
o50|TLS|I|o60|a31,o52,a27
a31|Certificate authorities, PKI, and mutual TLS|A|o50|a135,a153
o59|HTTP/2 and HTTP/3|I|a25,o60|a28,o58
o3|Reverse proxies|F|a25|o8,o9,a32
a32|Forward proxies, tunnels, ingress, and egress|I|o3|o46,a33
o8|Load balancing|F|o3|a33,a59,o75
a33|L4 versus L7 load balancing|I|o8|o3,a153
o12|Gateways and routers|I|o3|o9,a153
o20|CORS|F|a25|o45,o44
o55|WebSockets|I|a25|o56,o57,a27
o56|Server-Sent Events|I|a25|o55,o57
o57|Long polling|F|a25|o55,o56
o85|CDNs|F|a26|o86,a34,o54
o86|Edge caching|I|o85|a34,a26
a34|Origin shielding and CDN request collapsing|A|o86|a104,o7`,
  D: `
a35|REST resource modeling|F|a25|a36,a37,a38
a36|Pagination: offset, cursor, and keyset|I|a35|a37,a58
a37|Filtering, sorting, sparse fields, and bulk operations|I|a35|a36,a38,o5
a38|API error models and partial success|I|a35|a40,o13
o1|Idempotency keys|I|a35|o13,a46,a86
a39|Deadlines and cancellation propagation|I|o10|a5,o10,a121
a40|Long-running operation APIs|I|a38|a102,o19
o19|Webhooks|I|a35|a46,o13,a88
a46|Webhook replay protection and signature verification|A|o19|o1,o46
o9|API gateways|I|o3|o12,o2,a43
a43|Backend-for-frontend architecture|I|o9|o11,a175
o11|GraphQL challenges|I|a35|a44,o5
a44|GraphQL federation and query-complexity controls|A|o11|a207,o2
o58|gRPC|I|o59|a45,a39,a153
a45|Protocol Buffers compatibility|A|o58|a95,a42
o78|API versioning|I|a35|o79,a42
o79|Semantic versioning|F||o78,o77
a42|Compatibility, deprecation, and sunset policies|A|o78|a41,a207
a41|Consumer-driven contract testing|A|a42|a187,a207`,
  E: `
a47|Relational modeling and normalization|F||a48,o22
o22|Database indexing|F|a47|a58,o23,a54
o23|Query optimization|I|o22|o5,a58
o5|N+1 queries|F|a47|o23,o4
o4|Connection pooling|I|a27,a8|o5,a21,a8
a50|Transactions and ACID|F|a47|a51,a55,o35
a51|Isolation levels and transaction anomalies|I|a50|a52,o27,o16
a52|MVCC and serializability|A|a51|a53,a50
o27|Optimistic locking|I|a51|a53,o28
a53|Pessimistic concurrency control|I|a51|o27,o17
a58|Composite, covering, and secondary indexes|I|o22|o23,a54
a48|Denormalization and materialized views|I|a47|a49,a98
a49|Access-pattern-driven NoSQL modeling|I|a48|a60,a69
a54|B-trees and LSM trees|A|o22|a57,a56
a55|Write-ahead logs, checkpoints, and recovery|A|a50|a56,o31
a56|Buffer pools, pages, and storage layout|A|a54|a55,a20
a57|Compaction and read/write amplification|A|a54|a7,a64
o24|Read replicas|I|o31|a73,o31
o31|Replication|I|a50|o24,a74,a161
o30|Partitioning|I|a47|o29,a59
o29|Sharding|A|o30|a59,a60
a59|Consistent and rendezvous hashing|A|o29|a60,o8
a60|Hot keys, hot partitions, and rebalancing|A|o29|a59,a3,o6
o25|Database migrations|I|a47|a61,o26,a196
o26|Schema versioning|I|o25|a95,a61
a61|Online schema changes and large backfills|A|o25|a178,a196
a62|Change data capture|A|o31|a93,a94
a63|Search and inverted indexes|I|o22|a66,a62
a64|Time-series databases|A|a54|a120,a67
a65|Graph databases|I|a47|a69
a66|Vector databases and approximate-nearest-neighbor indexes|A|a63|a63,a69
a67|Columnar and analytical storage|A|a54|a64,a62
a68|Blob and object storage|I||a7,a142,o85
a69|Polyglot persistence and data ownership|P|a49|a174,a207`,
  F: `
a70|Partial failure and failure detection|I|o10|o94,a83,a116
o94|Network partitions|I|a70|o33,a78
o33|CAP theorem|I|o94|a71,a72
a71|PACELC|A|o33|a75,a72
o34|Eventual consistency|I|o33|a72,a82,a83
a72|Linearizable, sequential, causal, and eventual consistency|A|o34|a73,a52
a73|Read-your-writes and monotonic-read guarantees|I|o34|o24,a72
a74|Read/write quorums|A|o31|a75,a76
a75|Tunable consistency|A|a74|a71
o95|Clock skew|I||a79,a81,a78
a79|Lamport clocks|A|o95|a80,a81
a80|Vector clocks and version vectors|A|a79|a82,a81
a81|Hybrid logical clocks|A|a79|o95,a80
a82|CRDTs and conflict resolution|A|a80|o34,a161
a83|Gossip, membership, and anti-entropy|A|a70|o65,o34
o32|Leader election|A|a70|a76,a78
a76|Raft and Paxos concepts|A|o32|a77,a74
a77|Consensus safety and liveness|P|a76|a198,a191
a78|Leases, fencing tokens, and split brain|A|o32|o28,o95
o28|Distributed locks|A|a78|o27,a53
o35|Distributed transactions|A|a50|a84,o36,a93
a84|Two-phase commit|A|o35|a85,o36
a85|Atomic commit and blocking failure modes|P|a84|a77
a86|Exactly-once claims versus end-to-end effects|A|o1,a88|a93,o13
a87|Invariant-first distributed-system design|P|a72|a190,a198`,
  G: `
o37|Message queues|F||o38,a88,o40
o38|Publish/subscribe|F|o37|o39,a96
a88|Delivery semantics|I|o37|a86,a91,a89
a89|Ordering and partition keys|I|a88|a90,o30
a90|Consumer groups and parallel processing|I|a89|a91,a107
a91|Acknowledgements and visibility timeouts|I|a88|a92,o40
o40|Dead-letter queues|I|a91|a92,o13
a92|Poison messages, quarantine, and replay|A|o40|a91
o39|Event-driven architecture|I|o38|a96,a97,a103
a93|Transactional outbox and inbox patterns|A|a94|a62,o1
a94|Dual-write failure and reconciliation|A|a88|a93,a178
a95|Event schemas and schema registries|A|o39|a45,o26
a96|Event notification versus event-carried state transfer|A|o39|a48,a97
a97|Event sourcing|A|o39|a98,a55
a98|CQRS|A|a97|a48,o24
a99|Stream-processing windows|A|a90|a100,a64
a100|Watermarks and late-arriving events|A|a99|o95
o42|Cron jobs|F||a101,o28
a101|Durable timers and duplicate execution|A|o42|a102,o1
o36|Saga patterns|A|o35|a103,a102
a102|Workflow engines and durable execution|A|o36|a40,a101
a103|Orchestration versus choreography|A|o36|o39,a175`,
  H: `
o10|Timeouts|F|o90|o13,a39,a5
o13|Retries|F|o10|o14,a110,o1
o14|Exponential backoff|F|o13|a110,o15
a110|Retry budgets|A|o13|o15,o14,a112
o15|Circuit breakers|I|o10|a113,a111
a111|Bulkheads and isolation pools|I|o15|a115,a139
o2|Rate limiting|I||a112,a139,o54
o41|Backpressure|I|a8|a112,o37
a112|Load shedding and admission control|A|a8|a113,o41,o2
a113|Graceful degradation and brownouts|A|a112|a117,o70
o6|Caching strategies|F||o7,a105,a104
o7|Cache invalidation|I|o6|a104,a62,a34
a104|Cache stampedes and request coalescing|A|o6|a34,a105
a105|Cache admission and eviction algorithms|A|o6|a106,a20
a106|Probabilistic data structures|A|a105|o2,a63
a107|Batching, pipelining, and parallelism|I|o91|a23,a90
a108|Load, stress, spike, and soak testing|I|a6|a109,o82
a109|Benchmark design and coordinated omission|A|a108|o92,o93
o75|Health checks|F||o76,o8,a114
a114|Graceful shutdown and connection draining|I|a27|o76,o73
o83|Horizontal scaling|F||o84,o82,o8
o84|Vertical scaling|F||o83,a204
o82|Autoscaling|I|o83|o88,a204,a166
o88|Cold starts|I|o82|o89,o4
o89|Serverless limits|I|o88|o4,a202
a115|Blast-radius containment|A|a111|a168,a116,o72
a116|Single points of failure and correlated failure|A|a9|a115,a158
a117|Safe defaults, kill switches, and operational guardrails|A|o70|a113,a115
a118|Failure-mode and effects analysis|A|a116|a10,o100
o100|Chaos engineering|A|a70|a193,a169,a118`,
  I: `
o101|Logging|F||a119,o106
a119|Structured logging and correlation identifiers|I|o101|a121,a141
o104|Metrics|F||a120,o102,a123
a120|Metric cardinality and histogram design|A|o104|o92,a64
o103|Distributed tracing|I|a119|a121,a122
a121|Trace sampling and context propagation|A|o103|a39,a122
a122|OpenTelemetry and telemetry pipelines|A|o103|a121,a120
o102|Monitoring|F|o104|a123,o105,o106
o106|Observability|I|o101,o104,o103|a122,o102
a123|Golden Signals, RED, and USE methods|I|o104|a6,o102
o107|SLAs, SLOs, and SLIs|I|o104|o108,a124,a9
o108|Error budgets|I|o107|a124,a10
o105|Alerts|F|o102|a125,a124
a124|Multi-window burn-rate alerts|A|o108|o105,a125
a125|Alert fatigue and symptom-based alerting|A|o105|a129,a124
o109|Production incidents|F||a126,o111
a126|Incident command and incident communication|I|o109|a145,o110,a206
o110|On-call engineering|I|o109|a129,a128
a128|Runbook design and operational ownership|I|o110|a127,a117
a129|Sustainable on-call rotations|A|o110|a125,a203
o111|Postmortems|I|o109|a215,a126
a127|Production-readiness reviews|A|a128|a205,o107`,
  J: `
a130|Threat modeling and abuse cases|I||a145,a144
a131|Authentication versus authorization|F||o49,a133,o47
o49|Identity and access management|I|a131|a133,a134,a135
a133|RBAC versus ABAC|I|o49|a134,a139
a134|Least privilege and separation of duties|I|o49|a135,a141
o47|OAuth|I|a131|a132,o48
a132|OpenID Connect and PKCE|A|o47|o48,o44
o48|JWT rotation|I|o47|a137,o21
a135|Workload identity|A|o49|a31,o21,a153
o21|Secrets management|I||a137,a135,a140
o43|SQL injection|F||o44,a138
o44|Cross-site scripting|F||o45,o20
o45|Cross-site request forgery|F||o44,o20
o46|Server-side request forgery|I||a32,a135
a138|Request smuggling and insecure deserialization|A|o3|o53,o46
o52|Encryption in transit|F|o50|o51,a31
o51|Encryption at rest|I||a136,a137,o52
a136|Envelope encryption|A|o51|a137,a142
a137|KMS, HSMs, and crypto agility|A|a136|o21,o48
o53|Web application firewalls|I||o54,a138
o54|DDoS protection|I|o2|o53,o85,a29
a139|Tenant isolation and noisy-neighbor controls|A|a180|a111,o2
a140|Supply-chain security, SBOMs, and provenance|A|o77|a147,a152
a141|Audit logs and tamper evidence|A|a119|a212,a134
a142|Data classification, retention, and deletion|I||a143,a144,a68
a143|Data residency and sovereignty|A|a142|o96,a161
a144|Privacy-by-design|A|a142|a130,a143
a145|Security incident containment|A|a126|a130,a141`,
  K: `
o62|Docker|F||a146,o63
a146|Container image layers and multi-stage builds|I|o62|a147,o67
o63|Kubernetes|I|o62|a148,o64,a149
o64|Helm charts|I|o63|a151,o68
a148|Kubernetes controllers and reconciliation|A|o63|a151,a152
a149|Kubernetes requests, limits, QoS, and disruption budgets|A|o63|o82,o76
o76|Liveness and readiness probes|I|o75,o63|a114,o73
a150|Persistent storage in Kubernetes|A|o63|o98,o31
o65|Service discovery|I|o61|a83,a153,o8
a153|Service mesh architecture and trade-offs|A|o65|a31,a33,a135
o66|CI/CD|F||o67,a154,o72
o67|Build caching|I|o66|a146,a147
a147|Reproducible and hermetic builds|A|o67|a140,a154
o77|Dependency management and dependency hell|I|o79|a140,a208
o68|Infrastructure as code|F||o69,a151,a152
o69|Terraform|I|o68|a151,o64
a151|GitOps|A|o68|a148,a154
a152|Policy as code and admission control|A|a148|a134,a140
a154|Artifact promotion and environment parity|I|o66|a147,o71
o70|Feature flags|F||a117,o72,a177
o73|Rolling deployments|F|o66|o71,o72,o74
o71|Blue-green deployments|I|o73|o72,o74
o72|Canary releases|I|o73|a155,a115
a155|Progressive delivery and automated canary analysis|A|o72|o108,a194
o74|Rollbacks and roll-forwards|I|o73|a196,o25
a156|Platform engineering and paved roads|P|o66|a157,a211
a157|Developer experience as a platform concern|P|a156|a203,a215`,
  L: `
a158|Regions, availability zones, and failure domains|F||a116,o96
o96|Multi-region deployments|A|a158|a159,a161,a160
a159|Active-passive versus active-active architecture|A|o96|o97,a161
a160|Regional traffic steering|A|o96|o61,a29
a161|Cross-region replication and write ownership|A|a159|o31,a82,a143
o97|Failover and failback|A|a159|a166,a78
a162|RTO and RPO|I|a9|a163,o99
a163|Business-impact analysis|I|a162|a212,a10
o98|Backups and restoration|F||a164,a165,a162
a164|Immutable backups and cyber recovery|A|o98|a145,a165
a165|Restore verification|I|o98|a197,a169
o99|Disaster recovery|A|a162,o98|a169,o97
a166|Regional evacuation and capacity reservation|A|o97|a204,o82
a167|Control-plane versus data-plane survivability|P|a181|a168,a116
a168|Cell-based architecture|P|a115|a180,a167
a169|Disaster-recovery exercises|A|o99|o100,a197`,
  M: `
a170|Cohesion, coupling, modularity, and information hiding|F||a171,a173
a171|Modular monoliths|I|a170|a172,a174
a172|Microservice boundaries and service sizing|A|a171|a174,a207
a173|Hexagonal and ports-and-adapters architecture|I|a170|a179,a177
a174|Domain-driven design and bounded contexts|A|a170|a172,a179,a69
a175|Synchronous versus asynchronous composition|A|a172|o39,a103,a39
a176|Strangler migrations|A|a172|a177,a178,a179
a177|Branch by abstraction|I|a173|a176,o70
a178|Dual reads, dual writes, and migration reconciliation|A|a94|a176,a61,a195
a179|Anti-corruption layers|I|a174|a176,a173
a180|Multi-tenancy architecture models|A|a174|a139,a168
a181|Control-plane and data-plane separation|A|a172|a167,a153
a182|Evolutionary architecture|P|a11|a183,a209
a183|Technical-debt portfolio management|P|a182|a203,a209
a184|Build versus buy versus managed services|P|a12|a202,a203`,
  N: `
a185|Test portfolios and confidence boundaries|I||a186,a11
a186|Unit, integration, component, and end-to-end testing|F||a185,a187
a187|Contract and compatibility testing|I|a186|a41,a42,a196
a188|Property-based testing|I|a186|a189,a190
a189|Fuzz testing|I|a188|a195,o43
a190|Invariant testing|A|a188|a87,a191
a191|Deterministic distributed-system simulation|P|a190|a77,a193
a192|Concurrency and race testing|A|o16|a191,a18
a193|Fault-injection testing|A|a186|o100,a191
a194|Shadow traffic and traffic replay|A|a186|a195,a155
a195|Differential testing|A|a186|a178,a194
a196|Migration and rollback testing|A|o25|o74,a61
a197|Restore and disaster-recovery testing|A|o98|a165,a169
a198|Formal methods and model checking|P|a190|a77,a87
a199|Production verification|A|a185|a155,a194`,
  O: `
a200|Cloud unit economics|I|a7|a201,o87
a201|Cost per request, tenant, and workload|I|a200|o87,a139
o87|Cost optimization|I|a200|a202,a204
a202|Total cost of ownership|A|a200|a184,a203
a203|Operational burden and opportunity cost|P|a202|a129,a183
a204|Capacity commitments and elasticity|A|a200|o82,a166
a205|Architecture narratives and review documents|P|a13|a206,a127
a206|Executive communication|P|a205|a213,a215
a207|Cross-team contracts and ownership boundaries|P|a172|a208,a42
a208|Dependency governance|P|a207|o77,a140
a209|Technical strategy and sequencing|P|a14|a210,a183
a210|Migration economics|P|a209|a176,a202
a211|Standardization versus autonomy|P|a156|a156,a208
a212|Risk management and compliance evidence|P|a10|a141,a163
a213|Decision facilitation, dissent, and escalation|P|a12|a206,a214
a214|Mentoring architecture reasoning|P|a213|a215
a215|Measuring architecture outcomes|P|a11|a157,a206`,
};

// Language rules: Go and Rust are required for these topics in addition to TypeScript and Python.
export const GO_TOPICS = new Set('o58 o59 o60 o61 o8 o3 o4 o81 o16 o17 a15 a18 a19 o28 o32 o37 o38 a90 a99 a100 o41 a33 a27 a148 a76 a107 a111 a112 a114 o2'.split(' '));
export const RUST_TOPICS = new Set('o81 o16 o17 o18 o80 a18 a19 a20 o41 o37 a92 o55 o58 a54 a55 a56 a57 a23 o60 a21 a82'.split(' '));

export const SYSTEMS = [
  ['url-shortener', 'URL shortener / Bitly'],
  ['cloud-file-storage', 'Cloud file storage / Dropbox'],
  ['local-delivery-service', 'Local delivery service'],
  ['ticket-booking', 'Ticket booking / Ticketmaster'],
  ['social-news-feed', 'Social news feed'],
  ['dating-matching-service', 'Dating and matching service / Tinder'],
  ['online-judge', 'Online judge / LeetCode'],
  ['messaging-platform', 'Messaging platform / WhatsApp'],
  ['distributed-rate-limiter', 'Distributed rate limiter'],
  ['video-platform', 'Video platform / YouTube'],
  ['live-comments', 'Live comments'],
  ['top-k-video-analytics', 'Top-K video analytics'],
  ['ride-sharing-platform', 'Ride-sharing platform / Uber'],
  ['distributed-web-crawler', 'Distributed web crawler'],
  ['ad-click-aggregator', 'Advertisement click aggregator'],
  ['social-post-search', 'Social-post search'],
  ['local-business-discovery', 'Local business discovery / Yelp'],
  ['photo-sharing-platform', 'Photo-sharing platform / Instagram'],
  ['fitness-activity-platform', 'Fitness activity platform / Strava'],
  ['distributed-cache', 'Distributed cache'],
  ['online-auction', 'Online auction'],
  ['distributed-job-scheduler', 'Distributed job scheduler'],
  ['news-aggregator', 'News aggregator'],
  ['price-tracking-service', 'Price-tracking service'],
  ['notification-system', 'Notification system'],
  ['retail-brokerage-platform', 'Retail brokerage platform / Robinhood'],
  ['collaborative-document-editor', 'Collaborative document editor / Google Docs'],
  ['payment-system', 'Payment system'],
  ['metrics-monitoring-platform', 'Metrics-monitoring platform'],
  ['online-chess-platform', 'Online chess platform'],
  ['llm-conversational-platform', 'LLM conversational platform / ChatGPT'],
  ['flash-sale-platform', 'Flash-sale platform'],
];

export const PATTERNS = [
  'Real-time updates', 'Contention and hot resources', 'Multi-step processes', 'Scaling reads',
  'Scaling writes', 'Handling large blobs', 'Managing long-running operations', 'Proximity search',
  'Vector databases', 'Time-series databases', 'Data structures for big data', 'Change data capture',
];

const LEVELS = { F: 'Foundational', I: 'Intermediate', A: 'Advanced', P: 'Principal' };
const MINUTES = { F: 75, I: 90, A: 120, P: 120 };

export const stableId = (short) => short[0].toUpperCase() + short.slice(1).padStart(3, '0');
export const slugify = (title) =>
  title.toLowerCase().replace(/[’']/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function buildTopics() {
  const topics = [];
  for (const [domain, block] of Object.entries(RAW)) {
    for (const line of block.trim().split('\n')) {
      const [short, title, level, prereq, related] = line.split('|');
      const langs = ['typescript', 'python'];
      if (GO_TOPICS.has(short)) langs.push('go');
      if (RUST_TOPICS.has(short)) langs.push('rust');
      topics.push({
        short, id: stableId(short), title, slug: slugify(title), domain, domainName: DOMAINS[domain],
        level: LEVELS[level], minutes: MINUTES[level],
        prereqShort: prereq ? prereq.split(',') : [], relatedShort: related ? related.split(',') : [],
        languages: langs,
      });
    }
  }
  return topics;
}
