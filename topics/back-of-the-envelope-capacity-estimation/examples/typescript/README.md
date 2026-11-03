# Unit-safe capacity arithmetic (TypeScript)

Uses branded types so that mixing up units fails at compile time, at no runtime cost. A small command-line
report shows sample figures. Needs Node.js 23.6+ and pnpm.

```bash
pnpm install --ignore-workspace
pnpm run check
pnpm test
pnpm start
```

Educational limits: only the operations defined here are unit-checked, and plain numbers inside the helper
functions are not. Decimal units are used throughout, with 1 GB = 10^9 bytes.
