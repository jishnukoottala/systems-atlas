# Assumption register (TypeScript)

A command-line check that can gate CI. There is no HTTP layer, because the lesson is the rule set.
Needs Node.js 23.6+ and pnpm.

```bash
pnpm install --ignore-workspace
pnpm run check
pnpm test
pnpm start register.json
```

Exit codes: 0 means nothing blocks, 1 means an assumption blocks, 2 means an invalid register.
Educational limits: impact is a human judgment, and the tool cannot find unstated assumptions.
