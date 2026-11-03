// Express service recording request latency in a histogram and exposing percentiles for inspection.
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { Histogram } from './histogram.ts';

const log = (level: string, msg: string, fields: Record<string, unknown> = {}): void => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }));
};
const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

// 2% of requests are slow, so the median stays low and p99 reveals them.
export const pickDelay = (r: number): number => (r < 0.02 ? 200 : 5);

export function createApp(random: () => number = Math.random): Express {
  const app = express();
  const latency = new Histogram();

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    res.on('finish', () => { if (req.path === '/work') latency.record(performance.now() - start); });
    next();
  });
  app.get('/healthz', (_req: Request, res: Response) => { res.json({ status: 'ok' }); });
  app.get('/work', async (_req: Request, res: Response) => {
    await sleep(pickDelay(random()));
    res.json({ done: true });
  });
  app.get('/metrics/latency', (_req: Request, res: Response) => {
    if (latency.count === 0) { res.json({ count: 0 }); return; }
    const pct = (q: number): number => Math.round(latency.quantile(q) * 10) / 10;
    res.json({ count: latency.count, p50: pct(0.5), p90: pct(0.9), p99: pct(0.99), p999: pct(0.999), buckets: latency.bucketCount });
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log('error', 'request.failed', { error: String(err) });
    res.status(500).json({ error: 'Internal error.' });
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env['PORT'] ?? 3000);
  const server = createApp().listen(port, () => { log('info', 'server.started', { port }); });
  const stop = (): void => { server.close(() => { process.exit(0); }); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
