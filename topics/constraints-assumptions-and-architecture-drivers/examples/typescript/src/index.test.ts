import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assess, parseRegister, RegisterError } from './index.ts';
import type { Assumption } from './index.ts';

const base: Assumption = { id: 'A1', statement: 'Reads outnumber writes 50 to 1', owner: 'Priya', impact: 'high', status: 'unverified', verifyBy: '2026-06-01', dependents: ['ADR-7'] };
const today = new Date('2026-07-01');

test('overdue high-impact assumption blocks', () => { assert.equal(assess(base, today).action, 'block'); });
test('overdue low-impact assumption asks for verification', () => { assert.equal(assess({ ...base, impact: 'low' }, today).action, 'verify-now'); });
test('future date is watched', () => { assert.equal(assess({ ...base, verifyBy: '2026-12-01' }, today).action, 'watch'); });
test('refuted assumption with dependents blocks and names them', () => {
  const r = assess({ ...base, status: 'refuted' }, today);
  assert.equal(r.action, 'block');
  assert.match(r.reason, /ADR-7/);
});
test('refuted assumption without dependents needs nothing', () => { assert.equal(assess({ ...base, status: 'refuted', dependents: [] }, today).action, 'none'); });
test('an assumption without an owner is rejected', () => { assert.throws(() => parseRegister([{ ...base, owner: '' }]), RegisterError); });
