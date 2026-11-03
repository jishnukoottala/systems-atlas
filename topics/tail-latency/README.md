# Tail latency

Tail latency is the behavior of the slowest part of a latency distribution, usually p99, p99.9, and beyond. Tail amplification is what happens when a request depends on many components: a rare slow event in any of them becomes a common slow event for the whole request.

- ID: O093
- Domain: Design method and quantitative reasoning
- Level: Advanced
- Last reviewed: 2026-11-03

Read the full lesson in [index.html](index.html). It is rendered from [content.md](content.md).

## Diagrams

- [State of one sub-request with hedging](diagrams/state-subrequest.mmd)
- [Context: fan-out request across replicated shards](diagrams/context.mmd)
- [Component view of the hedging library and the simulation](diagrams/component.mmd)
- [Sequence: a hedged call with cancellation](diagrams/sequence.mmd)
- [Failure path: hedging amplifies overload](diagrams/failure-path.mmd)

## Examples

- [TypeScript example](examples/typescript/README.md)
- [Python example](examples/python/README.md)

## Exercises

- [Challenges](exercises/challenges.md)
- [Solutions](exercises/solutions.md)
