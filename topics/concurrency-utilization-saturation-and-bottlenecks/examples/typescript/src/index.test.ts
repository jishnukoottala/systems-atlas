import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from './index.ts';
import { ConcurrencyLimiter, QueueFullError } from './limiter.ts';

const gate = (): { wait: Promise<void>; open: () => void } => {
  let open = (): void => {};
  const wait = new Promise<void>((resolve) => { open = resolve; });
  return { wait, open };
};

test('concurrency never exceeds the limit, and excess queues', async () => {
  const l = new ConcurrencyLimiter(2, 5);
  const g = gate();
  let peak = 0;
  let active = 0;
  const tasks = Array.from({ length: 5 }, () => l.run(async () => {
    active++; peak = Math.max(peak, active);
    await g.wait;
    active--;
  }));
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(l.stats().inFlight, 2);
  assert.equal(l.stats().queued, 3);
  g.open();
  await Promise.all(tasks);
  assert.equal(peak, 2);
  assert.equal(l.stats().inFlight, 0);
  assert.equal(l.stats().completed, 5);
});

test('a full queue rejects immediately', async () => {
  const l = new ConcurrencyLimiter(1, 1);
  const g = gate();
  const a = l.run(() => g.wait);
  const b = l.run(() => g.wait);
  await assert.rejects(l.run(() => g.wait), QueueFullError);
  assert.equal(l.stats().rejected, 1);
  g.open();
  await Promise.all([a, b]);
});

test('a failed task still releases its slot', async () => {
  const l = new ConcurrencyLimiter(1, 0);
  await assert.rejects(l.run(() => Promise.reject(new Error('boom'))));
  assert.equal(l.stats().inFlight, 0);
  assert.equal(await l.run(async () => 7), 7);
});

test('utilization is computed from slot-time with an injected clock', async () => {
  let t = 0;
  const l = new ConcurrencyLimiter(2, 0, () => t);
  const g = gate();
  const task = l.run(() => g.wait);
  t = 100;
  assert.equal(l.stats().utilization, 0.5); // one of two slots busy for the whole period
  g.open();
  await task;
});

let server: Server;
let base: string;
before(async () => {
  await new Promise<void>((resolve) => { server = createApp({ limit: 2, queueLimit: 2, workMs: 30 }).listen(0, () => { resolve(); }); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server.close(); });

test('HTTP: overload gets 503 with Retry-After, and others succeed', async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => fetch(`${base}/query`)));
  const statuses = results.map((r) => r.status);
  assert.equal(statuses.filter((s) => s === 200).length, 4);
  assert.equal(statuses.filter((s) => s === 503).length, 6);
  assert.equal(results.find((r) => r.status === 503)?.headers.get('retry-after'), '1');
});
