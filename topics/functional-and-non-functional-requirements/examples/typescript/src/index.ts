// Express service that lints requirements so vague quality claims fail early, in review.
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { NextFunction, Request, Response, Express } from 'express';
import { lintRequirement, parseRequirements, ValidationError } from './lint.ts';

const log = (level: string, msg: string, fields: Record<string, unknown> = {}): void => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }));
};

export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/healthz', (_req: Request, res: Response) => { res.json({ status: 'ok' }); });

  app.post('/lint', (req: Request, res: Response) => {
    const requirements = parseRequirements(req.body);
    const findings = requirements.flatMap(lintRequirement);
    const errors = findings.filter((f) => f.severity === 'error').length;
    log('info', 'lint.completed', { requirements: requirements.length, findings: findings.length, errors });
    res.json({ pass: errors === 0, requirements: requirements.length, findings });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) { res.status(422).json({ error: err.message }); return; }
    if (err instanceof SyntaxError) { res.status(400).json({ error: 'Malformed JSON.' }); return; }
    log('error', 'request.failed', { error: String(err) });
    res.status(500).json({ error: 'Internal error.' });
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env['PORT'] ?? 3000);
  const server = createApp().listen(port, () => { log('info', 'server.started', { port }); });
  const shutdown = (signal: string): void => {
    log('info', 'server.stopping', { signal });
    server.close(() => { process.exit(0); });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
