import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyze, CHECKOUT, GraphError, whatIf } from './index.ts';

test('the checkout total follows the longest path', () => {
  const a = analyze(CHECKOUT);
  assert.equal(a.totalMs, 265);
  assert.deepEqual(a.criticalPath, ['gateway', 'auth', 'cart', 'fraud', 'payment', 'write-order']);
});

test('slack is the room before a step delays the request', () => {
  const slack = new Map(analyze(CHECKOUT).steps.map((s) => [s.id, s.slack]));
  assert.equal(slack.get('pricing'), 50);
  assert.equal(slack.get('inventory'), 30);
  assert.equal(slack.get('fraud'), 0);
});

test('speeding up a non-critical step saves nothing', () => {
  assert.equal(whatIf(CHECKOUT, 'pricing', 10).savedMs, 0);
});

test('savings on a critical step are capped by the next-longest path', () => {
  assert.equal(whatIf(CHECKOUT, 'fraud', 40).savedMs, 30);
});

test('cycles and unknown dependencies are rejected', () => {
  assert.throws(() => analyze([{ id: 'a', durationMs: 1, dependsOn: ['b'] }, { id: 'b', durationMs: 1, dependsOn: ['a'] }]), GraphError);
  assert.throws(() => analyze([{ id: 'a', durationMs: 1, dependsOn: ['z'] }]), GraphError);
  assert.throws(() => analyze([]), GraphError);
});
