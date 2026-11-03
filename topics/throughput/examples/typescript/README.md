# Universal Scalability Law fit (TypeScript)

Fits contention and coherency to load-test results and predicts where adding workers stops helping.
It is a command-line tool, because a server would add nothing here. Needs Node.js 23.6+ and pnpm.

```bash
pnpm install --ignore-workspace
pnpm run check
pnpm test
pnpm start
```

Pass your own results as a JSON array of `{ "n": 8, "throughput": 5900 }`, including `n` = 1.

Educational limits: the sample data is invented for the lesson and is not a benchmark. A fit extrapolated
far beyond the measured range is only a hypothesis.
