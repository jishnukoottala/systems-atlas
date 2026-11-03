// Assumption register. An assumption is a debt with a due date, so this tool reports which
// assumptions are overdue and how much design rests on each.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type Impact = 'low' | 'medium' | 'high';
export type Status = 'unverified' | 'confirmed' | 'refuted';

export interface Assumption {
  id: string;
  statement: string;
  owner: string;
  impact: Impact;
  status: Status;
  verifyBy: string; // ISO date
  dependents: string[]; // decision IDs that rest on this assumption
}

export interface Report {
  id: string;
  action: 'block' | 'verify-now' | 'watch' | 'none';
  reason: string;
}

export class RegisterError extends Error {}

export function parseRegister(raw: unknown): Assumption[] {
  if (!Array.isArray(raw)) throw new RegisterError('Register must be a JSON array.');
  return raw.map((v: unknown, i: number): Assumption => {
    const o = v as Partial<Assumption> | null;
    if (!o || typeof o.id !== 'string' || typeof o.statement !== 'string' || typeof o.owner !== 'string' || o.owner === '') {
      throw new RegisterError(`Entry ${i} needs id, statement, and a named owner.`);
    }
    if (o.impact !== 'low' && o.impact !== 'medium' && o.impact !== 'high') throw new RegisterError(`Entry ${o.id} has an invalid impact.`);
    if (o.status !== 'unverified' && o.status !== 'confirmed' && o.status !== 'refuted') throw new RegisterError(`Entry ${o.id} has an invalid status.`);
    if (typeof o.verifyBy !== 'string' || Number.isNaN(Date.parse(o.verifyBy))) throw new RegisterError(`Entry ${o.id} needs a valid verifyBy date.`);
    return { id: o.id, statement: o.statement, owner: o.owner, impact: o.impact, status: o.status, verifyBy: o.verifyBy, dependents: Array.isArray(o.dependents) ? o.dependents : [] };
  });
}

export function assess(a: Assumption, today: Date): Report {
  if (a.status === 'confirmed') return { id: a.id, action: 'none', reason: 'Confirmed by evidence.' };
  if (a.status === 'refuted') {
    return a.dependents.length > 0
      ? { id: a.id, action: 'block', reason: `Refuted, and ${a.dependents.length} decision(s) still rest on it: ${a.dependents.join(', ')}.` }
      : { id: a.id, action: 'none', reason: 'Refuted, with nothing depending on it.' };
  }
  const overdue = new Date(a.verifyBy).getTime() < today.getTime();
  if (overdue && a.impact === 'high') return { id: a.id, action: 'block', reason: `High impact and overdue since ${a.verifyBy}.` };
  if (overdue) return { id: a.id, action: 'verify-now', reason: `Overdue since ${a.verifyBy}.` };
  return { id: a.id, action: 'watch', reason: `Verify by ${a.verifyBy}. Owner: ${a.owner}.` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const path = process.argv[2];
    if (!path) throw new RegisterError('Usage: pnpm start <register.json>');
    const reports = parseRegister(JSON.parse(readFileSync(path, 'utf8'))).map((a) => assess(a, new Date()));
    for (const r of reports) console.log(JSON.stringify({ level: r.action === 'block' ? 'error' : 'info', msg: 'assumption.assessed', ...r }));
    process.exitCode = reports.some((r) => r.action === 'block') ? 1 : 0;
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'register.invalid', error: err instanceof Error ? err.message : String(err) }));
    process.exitCode = 2;
  }
}
