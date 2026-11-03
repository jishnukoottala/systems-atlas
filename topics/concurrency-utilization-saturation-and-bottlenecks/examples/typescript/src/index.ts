// Express service protecting a simulated database with a concurrency limit. Excess requests queue
// briefly and are then rejected with 503, and /stats reports concurrency, utilization, and saturation.
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { ConcurrencyLimiter, QueueFullError } from './limiter.ts';

const log = (level: string, msg: string, fields: Record<string, unknown> = {}): void => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }));
};
const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

export interface AppOptions { limit: number; queueLimit: number; workMs: number }

export function createApp(opts: AppOptions): Express {
  const app = express();
  const limiter = new ConcurrencyLimiter(opts.limit, opts.queueLimit);
  app.get('/healthz', (_req: Request, res: Response) => { res.json({ status: 'ok' }); });
  app.get('/stats', (_req: Request, res: Response) => { res.json(limiter.stats()); });
  app.get('/query', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await limiter.run(() => sleep(opts.workMs));
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof QueueFullError) {
        res.status(503).set('Retry-After', '1').json({ error: 'Overloaded, retry later.' });
        return;
      }
      next(err);
    }
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log('error', 'request.failed', { error: String(err) });
    res.status(500).json({ error: 'Internal error.' });
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env['PORT'] ?? 3000);
  const server = createApp({ limit: 10, queueLimit: 20, workMs: 100 }).listen(port, () => { log('info', 'server.started', { port }); });
  const stop = (): void => { server.close(() => { process.exit(0); }); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
