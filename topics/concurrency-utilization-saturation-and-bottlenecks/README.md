# Concurrency, utilization, saturation, and bottlenecks

Concurrency is the number of requests in progress at one moment. Utilization is the fraction of time a resource is busy. Saturation is the amount of work waiting because that resource is fully occupied. A bottleneck is the resource that limits a system's throughput, which is the one that saturates first as load grows.

- ID: A006
- Domain: Design method and quantitative reasoning
- Level: Intermediate
- Last reviewed: 2026-11-03

Read the full lesson in [index.html](index.html). It is rendered from [content.md](content.md).

## Diagrams

- [States of a resource as load increases](diagrams/state-resource.mmd)
- [Context: resources a request uses and where the queues hide](diagrams/context.mmd)
- [Component view of the limiter service and the operational analysis](diagrams/component.mmd)
- [Sequence: a limiter under overload](diagrams/sequence.mmd)
- [Failure path: scaling the wrong resource](diagrams/failure-path.mmd)

## Examples

- [TypeScript example](examples/typescript/README.md)
- [Python example](examples/python/README.md)

## Exercises

- [Challenges](exercises/challenges.md)
- [Solutions](exercises/solutions.md)
