# Latency

Latency is the time between a cause and its effect: for a request, the time from when it is sent to when a response arrives. It always needs two qualifiers: where it is measured, and which part of the distribution you mean. "50 ms" means nothing until you say "p99, measured at the load balancer, including time to last byte."

- ID: O090
- Domain: Design method and quantitative reasoning
- Level: Foundational
- Last reviewed: 2026-11-03

Read the full lesson in [index.html](index.html). It is rendered from [content.md](content.md).

## Diagrams

- [Request states and where latency accumulates](diagrams/state-request.mmd)
- [Context: path of a request from client to data and its latency contributors](diagrams/context.mmd)
- [Component view of the phase timer and calculator](diagrams/component.mmd)
- [Sequence: new connection compared with a reused connection](diagrams/sequence.mmd)
- [Failure path: rising utilization turns into a latency collapse](diagrams/failure-path.mmd)

## Examples

- [TypeScript example](examples/typescript/README.md)
- [Python example](examples/python/README.md)

## Exercises

- [Challenges](exercises/challenges.md)
- [Solutions](exercises/solutions.md)
