import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AllCopiesFailed, HedgeBudget, hedged } from './index.ts';
import type { Call } from './index.ts';

const after = <T>(ms: number, value: T, signal: AbortSignal): Promise<T> => new Promise((resolve, reject) => {
  const t = setTimeout(() => { resolve(value); }, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
});

test('a fast first copy sends no hedge', async () => {
  const r = await hedged((s) => after(1, 'a', s), { hedgeAfterMs: 100, maxCopies: 2 });
  assert.deepEqual(r, { value: 'a', winner: 0, copiesSent: 1 });
});

test('a slow first copy is hedged, and the loser is aborted', async () => {
  let aborted = false;
  const call: Call<string> = (signal, replica) => {
    if (replica === 0) signal.addEventListener('abort', () => { aborted = true; });
    return after(replica === 0 ? 1_000 : 5, `r${replica}`, signal);
  };
  const r = await hedged(call, { hedgeAfterMs: 10, maxCopies: 2 });
  assert.equal(r.winner, 1);
  assert.equal(r.copiesSent, 2);
  assert.equal(aborted, true);
});

test('a failure sends the next copy at once', async () => {
  const call: Call<string> = (signal, replica) => (replica === 0 ? Promise.reject(new Error('boom')) : after(1, 'ok', signal));
  const r = await hedged(call, { hedgeAfterMs: 1_000, maxCopies: 2 });
  assert.equal(r.value, 'ok');
});

test('every copy failing rejects with all causes', async () => {
  const call: Call<string> = () => Promise.reject(new Error('boom'));
  await assert.rejects(hedged(call, { hedgeAfterMs: 1, maxCopies: 2 }), (e: unknown) => e instanceof AllCopiesFailed && e.causes.length === 2);
});

test('an empty budget prevents hedging', async () => {
  let copies = 0;
  const call: Call<string> = (signal) => { copies++; return after(30, 'x', signal); };
  await hedged(call, { hedgeAfterMs: 5, maxCopies: 2, budget: new HedgeBudget(0.05, 10) });
  assert.equal(copies, 1);
});

test('the budget allows about ratio hedges per request', () => {
  const b = new HedgeBudget(0.1, 10);
  let granted = 0;
  for (let i = 0; i < 100; i++) { b.onRequest(); if (b.tryHedge()) granted++; }
  assert.ok(granted >= 9 && granted <= 10);
});
