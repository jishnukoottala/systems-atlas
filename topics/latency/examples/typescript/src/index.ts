// Express service that breaks a request's latency into named phases and reports them with the
// W3C Server-Timing header, so a browser or curl can see where the time went.
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';

export interface Phase { name: string; durationMs: number }

export class PhaseTimer {
  readonly phases: Phase[] = [];
  private readonly now: () => number;
  constructor(now: () => number = () => performance.now()) { this.now = now; }

  async measure<T>(name: string, work: () => Promise<T>): Promise<T> {
    const start = this.now();
    try {
      return await work();
    } finally {
      this.phases.push({ name, durationMs: this.now() - start });
    }
  }

  header(): string {
    return this.phases.map((p) => `${p.name};dur=${p.durationMs.toFixed(1)}`).join(', ');
  }

  total(): number { return this.phases.reduce((sum, p) => sum + p.durationMs, 0); }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });
const log = (level: string, msg: string, fields: Record<string, unknown>): void => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }));
};

// Simulated dependency delays in milliseconds. Sequential phases add, and parallel phases cost
// only as much as the slowest member.
export const DELAYS = { auth: 5, db: 20, ranking: 30, ads: 45 } as const;

export function createApp(): Express {
  const app = express();
  app.get('/healthz', (_req: Request, res: Response) => { res.json({ status: 'ok' }); });

  app.get('/feed', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mode = req.query['mode'] === 'parallel' ? 'parallel' : 'sequential';
      const timer = new PhaseTimer();
      await timer.measure('auth', () => sleep(DELAYS.auth));
      await timer.measure('db', () => sleep(DELAYS.db));
      if (mode === 'parallel') {
        await timer.measure('rank_and_ads', () => Promise.all([sleep(DELAYS.ranking), sleep(DELAYS.ads)]));
      } else {
        await timer.measure('ranking', () => sleep(DELAYS.ranking));
        await timer.measure('ads', () => sleep(DELAYS.ads));
      }
      res.setHeader('Server-Timing', timer.header());
      log('info', 'feed.served', { mode, totalMs: Math.round(timer.total()), phases: timer.phases });
      res.json({ mode, totalMs: Math.round(timer.total()), phases: timer.phases.map((p) => p.name) });
    } catch (err) { next(err); }
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
  process.on('SIGTERM', () => { server.close(() => { process.exit(0); }); });
  process.on('SIGINT', () => { server.close(() => { process.exit(0); }); });
}
