# Latency budgets and critical-path analysis

A latency budget divides a user-facing latency target among the steps that make up a request. Critical-path analysis finds the sequence of steps that actually determines total time: the longest path through the request's call graph. Only time saved on that path shortens the request.

- ID: A005
- Domain: Design method and quantitative reasoning
- Level: Intermediate
- Last reviewed: 2026-11-03

Read the full lesson in [index.html](index.html). It is rendered from [content.md](content.md).

## Diagrams

- [Remaining budget as a request moves along the path](diagrams/state-deadline.mmd)
- [Context: a checkout journey and where its budget goes](diagrams/context.mmd)
- [Component view of the analyzer and simulation](diagrams/component.mmd)
- [Sequence: deadline propagation along the path](diagrams/sequence.mmd)
- [Failure path: fixed timeouts and retries overrun the budget](diagrams/failure-path.mmd)

## Examples

- [TypeScript example](examples/typescript/README.md)
- [Python example](examples/python/README.md)

## Exercises

- [Challenges](exercises/challenges.md)
- [Solutions](exercises/solutions.md)
