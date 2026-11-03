# Hedged requests with cancellation and a budget (TypeScript)

Sends a second copy after a delay, returns the first success, and aborts the loser. It is a library with
a small demo, because a server would add nothing. Needs Node.js 23.6+ and pnpm.

```bash
pnpm install --ignore-workspace
pnpm run check
pnpm test
pnpm start
```

Educational limits: only hedge safe, idempotent operations. Aborting here stops the local work, while
a real server only benefits if cancellation propagates to it.
