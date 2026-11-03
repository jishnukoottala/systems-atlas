import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Profiler, SpaceSaving } from './index.ts';

test('Space-Saving keeps a heavy hitter in bounded memory', () => {
  const s = new SpaceSaving(10);
  for (let i = 0; i < 10_000; i++) { s.add(i % 3 === 0 ? 42 : i); }
  assert.equal(s.top(1)[0]?.[0], 42);
  assert.ok((s.top(1)[0]?.[1] ?? 0) >= 3_334);
});

test('profiler computes rates and ratios, and skips bad lines', () => {
  const p = new Profiler();
  for (let i = 0; i < 100; i++) p.ingest(JSON.stringify({ t: i / 10, op: i % 10 === 0 ? 'write' : 'read', key: 1, size: 100 }));
  p.ingest('not json');
  p.ingest(JSON.stringify({ t: 'x' }));
  const r = p.profile();
  assert.equal(r.lines, 100);
  assert.equal(r.skipped, 2);
  assert.equal(r.readRatio, 0.9);
  assert.equal(r.peakRps, 10);
  assert.equal(r.sizeP99UpperBound, 128);
});

test('an empty trace fails loudly rather than reporting zeros', () => {
  assert.throws(() => new Profiler().profile(), /No valid trace lines/);
});
