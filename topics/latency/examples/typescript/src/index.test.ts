import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, DELAYS, PhaseTimer } from './index.ts';

let server: Server;
let base: string;
before(async () => {
  await new Promise<void>((resolve) => { server = createApp().listen(0, () => { resolve(); }); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server.close(); });

test('PhaseTimer records phases using an injected clock, and records failures too', async () => {
  let t = 0;
  const timer = new PhaseTimer(() => { t += 10; return t; });
  await timer.measure('a', async () => 1);
  await assert.rejects(timer.measure('b', async () => { throw new Error('boom'); }));
  assert.equal(timer.header(), 'a;dur=10.0, b;dur=10.0');
  assert.equal(timer.total(), 20);
});

test('the parallel path is faster than the sequential one by about the shorter branch', async () => {
  const seq = (await (await fetch(`${base}/feed`)).json()) as { totalMs: number };
  const par = (await (await fetch(`${base}/feed?mode=parallel`)).json()) as { totalMs: number };
  assert.ok(seq.totalMs >= DELAYS.auth + DELAYS.db + DELAYS.ranking + DELAYS.ads - 5);
  assert.ok(par.totalMs < seq.totalMs - DELAYS.ranking / 2);
});

test('the response carries a Server-Timing header', async () => {
  const res = await fetch(`${base}/feed`);
  assert.match(res.headers.get('server-timing') ?? '', /auth;dur=.*ads;dur=/);
});
