# Throughput

Throughput is the rate at which a system completes work, measured in units per time: requests per second, messages per second, or bytes per second. Goodput is the part of that work that was actually useful: completed successfully, in time, and not duplicated.

- ID: O091
- Domain: Design method and quantitative reasoning
- Level: Foundational
- Last reviewed: 2026-11-03

Read the full lesson in [index.html](index.html). It is rendered from [content.md](content.md).

## Diagrams

- [System operating regions as offered load rises](diagrams/state-load.mmd)
- [Context: a pipeline in which one resource limits overall throughput](diagrams/context.mmd)
- [Component view of the simulator and scalability model](diagrams/component.mmd)
- [Sequence: wasted work under an unbounded queue](diagrams/sequence.mmd)
- [Failure path: scaling the wrong component](diagrams/failure-path.mmd)

## Examples

- [TypeScript example](examples/typescript/README.md)
- [Python example](examples/python/README.md)

## Exercises

- [Challenges](exercises/challenges.md)
- [Solutions](exercises/solutions.md)
