# Latency breakdown with Server-Timing (TypeScript and Express)

Splits request time into named phases and reports them in a `Server-Timing` header. Needs Node.js
23.6+ and pnpm.

```bash
pnpm install --ignore-workspace
pnpm run check
pnpm test
PORT=3000 pnpm start
```

```bash
curl -si 'localhost:3000/feed?mode=parallel' | grep -i server-timing
```

Educational limits: delays are timers and not real dependencies, and Node timers have a resolution of
about a millisecond. Do not expose detailed Server-Timing data publicly without review.
