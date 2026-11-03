# Requirement linter (TypeScript and Express)

Rejects quality requirements that cannot be falsified. Needs Node.js 23.6+ and pnpm.

```bash
pnpm install --ignore-workspace
pnpm run check
pnpm test
PORT=3000 pnpm start
```

```bash
curl -s localhost:3000/lint -H 'content-type: application/json' \
  -d '[{"id":"Q1","kind":"quality","text":"The API must be fast"}]' | jq .
```

Educational limits: the rules are simple patterns. They catch omissions, not wrong targets.
