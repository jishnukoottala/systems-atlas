import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitUsl, InputError, uslPeak, uslThroughput } from './index.ts';
import type { UslParams } from './index.ts';

const p: UslParams = { lambda: 1_000, sigma: 0.05, kappa: 0.0005 };

test('one worker equals lambda', () => { assert.equal(uslThroughput(1, p), 1_000); });
test('throughput falls after the peak', () => {
  const peak = Math.round(uslPeak(p) ?? 0);
  assert.equal(peak, 44);
  assert.ok(uslThroughput(peak, p) > uslThroughput(peak * 3, p));
});
test('zero contention and coherency scales linearly with no peak', () => {
  const linear = { lambda: 100, sigma: 0, kappa: 0 };
  assert.equal(uslThroughput(10, linear), 1_000);
  assert.equal(uslPeak(linear), null);
});
test('fit recovers known parameters from clean data', () => {
  const samples = [1, 2, 4, 8, 16, 32, 64].map((n) => ({ n, throughput: uslThroughput(n, p) }));
  const fit = fitUsl(samples);
  assert.ok(Math.abs(fit.sigma - p.sigma) < 1e-6);
  assert.ok(Math.abs(fit.kappa - p.kappa) < 1e-6);
});
test('bad input is rejected', () => {
  assert.throws(() => uslThroughput(0, p), InputError);
  assert.throws(() => fitUsl([{ n: 2, throughput: 10 }]), InputError);
});
