import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Histogram } from './histogram.ts';
import { pickDelay } from './index.ts';

test('quantile is within one bucket of the exact value', () => {
  const h = new Histogram();
  for (let i = 1; i <= 10_000; i++) h.record(i);
  const p99 = h.quantile(0.99);
  assert.ok(p99 >= 9_900 && p99 <= 9_900 * (1 + 1 / 16));
});

test('memory stays small for a wide range of values', () => {
  const h = new Histogram();
  for (let i = 1; i <= 1_000_000; i += 7) h.record(i);
  assert.ok(h.bucketCount < 350);
});

test('merging equals recording everything in one histogram', () => {
  const [a, b, all] = [new Histogram(), new Histogram(), new Histogram()];
  for (let i = 1; i <= 1_000; i++) { (i % 2 ? a : b).record(i); all.record(i); }
  a.merge(b);
  assert.equal(a.quantile(0.99), all.quantile(0.99));
  assert.equal(a.count, 1_000);
});

test('invalid input and mismatched layouts are rejected', () => {
  const h = new Histogram();
  assert.throws(() => { h.record(-1); }, RangeError);
  assert.throws(() => h.quantile(0.5), RangeError);
  assert.throws(() => { h.merge(new Histogram(8)); }, RangeError);
});

test('two percent of requests take the slow path', () => {
  assert.equal(pickDelay(0.01), 200);
  assert.equal(pickDelay(0.5), 5);
});
