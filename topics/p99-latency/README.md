# P99 latency

The p99 latency is the value that 99% of requests finish within, for a stated population and time window. Put differently, 1 request in 100 is slower than it. It describes one point on the latency distribution and says nothing about how much slower the remaining 1% are.

- ID: O092
- Domain: Design method and quantitative reasoning
- Level: Intermediate
- Last reviewed: 2026-11-03

Read the full lesson in [index.html](index.html). It is rendered from [content.md](content.md).

## Diagrams

- [Path of one latency sample to a reported percentile](diagrams/state-sample.mmd)
- [Context: where latency is measured and aggregated](diagrams/context.mmd)
- [Component view of the histogram service and percentile analysis](diagrams/component.mmd)
- [Sequence: computing a fleet p99 correctly](diagrams/sequence.mmd)
- [Failure path: a degraded server hidden by averaged percentiles](diagrams/failure-path.mmd)

## Examples

- [TypeScript example](examples/typescript/README.md)
- [Python example](examples/python/README.md)

## Exercises

- [Challenges](exercises/challenges.md)
- [Solutions](exercises/solutions.md)
