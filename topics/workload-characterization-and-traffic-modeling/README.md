# Workload characterization and traffic modeling

Workload characterization is measuring how a system is actually used: request rates over time, the mix of operations, how traffic spreads across keys and tenants, how large the objects are, and how users' sessions behave. Traffic modeling turns those measurements into a forecast that can be used to size and test a design.

- ID: A003
- Domain: Design method and quantitative reasoning
- Level: Intermediate
- Last reviewed: 2026-11-03

Read the full lesson in [index.html](index.html). It is rendered from [content.md](content.md).

## Diagrams

- [Lifecycle of a workload model](diagrams/state-profile.mmd)
- [Context: from production traffic to design decisions](diagrams/context.mmd)
- [Component view of the generator and two analyzers](diagrams/component.mmd)
- [Sequence: refreshing a profile before a launch](diagrams/sequence.mmd)
- [Failure path: sized on the mean, broken by the distribution](diagrams/failure-path.mmd)

## Examples

- [TypeScript example](examples/typescript/README.md)
- [Python example](examples/python/README.md)

## Exercises

- [Challenges](exercises/challenges.md)
- [Solutions](exercises/solutions.md)
