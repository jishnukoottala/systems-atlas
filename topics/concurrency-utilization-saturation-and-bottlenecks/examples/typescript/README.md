# Concurrency limiter with saturation metrics (TypeScript and Express)

Limits work in flight, queues a bounded amount, rejects the rest, and reports concurrency, utilization,
and saturation. Needs Node.js 23.6+ and pnpm.

```bash
pnpm install --ignore-workspace
pnpm run check
pnpm test
PORT=3000 pnpm start
```

```bash
seq 1 60 | xargs -P 60 -I{} curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/query | sort | uniq -c
curl -s localhost:3000/stats | jq .
```

Educational limits: a single process, a fixed limit, and simulated work. Production limiters often adapt
to measured latency and distinguish request priorities.
