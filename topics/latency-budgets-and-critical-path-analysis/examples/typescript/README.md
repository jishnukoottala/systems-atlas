# Critical-path analysis (TypeScript)

Computes the longest path, slack per step, and the effect of speeding up one step. It is a command-line
tool, as the lesson is the graph calculation. Needs Node.js 23.6+ and pnpm.

```bash
pnpm install --ignore-workspace
pnpm run check
pnpm test
pnpm start
```

Educational limits: durations are fixed numbers, while real ones are distributions, which the Python
example addresses. Real call graphs come from traces.
