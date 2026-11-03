import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bytes, EstimateError, format, gb, gbps, kb, mb, perDay, report, throughput, toBytesPerSecond, toPerSecond, transferTime } from './index.ts';

test('per-day converts to per-second', () => { assert.ok(Math.abs(toPerSecond(perDay(86_400)) - 1) < 1e-9); });
test('bits are converted to bytes', () => { assert.equal(toBytesPerSecond(gbps(8)), 1e9); });
test('1 TB over 1 Gbit/s takes 8,000 s', () => { assert.equal(transferTime(gb(1_000), gbps(1)), 8_000); });
test('rate times size gives bytes per second', () => { assert.equal(throughput(toPerSecond(perDay(86_400)), kb(1)), 1_000); });
test('negative values are rejected', () => { assert.throws(() => bytes(-1), EstimateError); });
test('format picks a scale', () => { assert.equal(format(2_500_000, 'B'), '2.5 MB'); });
test('the report covers the sample', () => {
  const r = report();
  assert.equal(r['uploads per second'], '5.8 k/s');
  assert.equal(r['1 TB over 1 Gbit/s'], '2.2 hours');
  assert.equal(r['1 PB over 10 Gbit/s'], '9.3 days');
  assert.ok(mb(1) > 0);
});

// These lines prove the types work: each is a compile error if its @ts-expect-error is removed.
test('wrong units fail to compile', () => {
  // @ts-expect-error a bandwidth is not a byte count
  const a: ReturnType<typeof gb> = gbps(1);
  // @ts-expect-error a per-day rate is not a per-second rate
  throughput(perDay(1), kb(1));
  assert.ok(a);
});
