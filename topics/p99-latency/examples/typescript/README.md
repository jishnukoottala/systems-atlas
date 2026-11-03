# Mergeable latency histogram (TypeScript and Express)

A log-linear histogram with bounded relative error, plus a service exposing percentiles. Needs Node.js
23.6+ and pnpm.

```bash
pnpm install --ignore-workspace
pnpm run check
pnpm test
PORT=3000 pnpm start
```

```bash
for i in $(seq 1 500); do curl -s localhost:3000/work >/dev/null; done
curl -s localhost:3000/metrics/latency | jq .
```

Educational limits: one process, no time windows, and curl runs sequentially, so this is a closed-loop
measurement. A production histogram needs windowing and should be exported to a metrics system.
