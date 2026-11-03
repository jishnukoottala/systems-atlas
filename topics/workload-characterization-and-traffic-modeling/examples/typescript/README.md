# Streaming trace profiler (TypeScript)

Profiles an NDJSON trace of any size using bounded memory: a Space-Saving summary for top keys and a
power-of-two histogram for sizes. Needs Node.js 23.6+ and pnpm.

```bash
pnpm install --ignore-workspace
pnpm run check
pnpm test
```

Generate input with the Python example, then profile it:

```bash
pnpm start /tmp/trace.ndjson
```

Educational limits: the histogram gives an upper bound rather than an exact percentile, and top-key
counts can be overestimated. The per-second map grows with trace duration in this version.
