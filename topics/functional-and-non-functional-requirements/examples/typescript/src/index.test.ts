import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from './index.ts';
import { lintRequirement } from './lint.ts';

let server: Server;
let base: string;
before(async () => {
  await new Promise<void>((resolve) => { server = createApp().listen(0, () => { resolve(); }); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server.close(); });

test('a vague quality requirement fails on every missing field', () => {
  const rules = lintRequirement({ id: 'Q1', kind: 'quality', text: 'The API must be fast.' }).map((f) => f.rule);
  assert.deepEqual(rules, ['missing-metric', 'missing-target', 'missing-window', 'missing-loadCondition', 'vague-word']);
});

test('a falsifiable quality requirement passes', () => {
  const findings = lintRequirement({ id: 'Q2', kind: 'quality', text: 'Checkout latency', metric: 'p99 server latency', target: '<= 300 ms', window: '28 days', loadCondition: 'up to 2,000 rps' });
  assert.deepEqual(findings, []);
});

test('a functional requirement hiding a quality claim is flagged', () => {
  const rules = lintRequirement({ id: 'F1', kind: 'functional', text: 'A customer can search products in real time.' }).map((f) => f.rule);
  assert.deepEqual(rules, ['hidden-quality']);
});

test('HTTP: invalid body gets 422 and a valid one gets findings', async () => {
  const post = (body: unknown): Promise<globalThis.Response> => fetch(`${base}/lint`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ nope: true })).status, 422);
  const ok = await post([{ id: 'Q1', kind: 'quality', text: 'Be fast' }]);
  assert.equal(ok.status, 200);
  assert.equal(((await ok.json()) as { pass: boolean }).pass, false);
});
