// Critical-path analysis over a call graph. A request is a directed acyclic graph of steps with
// durations. The critical path is the longest route through it, and slack is how much a step can
// slow down before it delays the request. Only steps with zero slack are worth speeding up first.
import { fileURLToPath } from 'node:url';

export interface Step { id: string; durationMs: number; dependsOn: string[] }
export interface StepTiming { id: string; earliestStart: number; earliestFinish: number; slack: number; critical: boolean }
export interface Analysis { totalMs: number; criticalPath: string[]; steps: StepTiming[] }

export class GraphError extends Error {}

function topoSort(steps: Step[]): Step[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  if (byId.size !== steps.length) throw new GraphError('Step IDs must be unique.');
  const state = new Map<string, 'visiting' | 'done'>();
  const order: Step[] = [];
  const visit = (s: Step, trail: string[]): void => {
    const seen = state.get(s.id);
    if (seen === 'done') return;
    if (seen === 'visiting') throw new GraphError(`Cycle: ${[...trail, s.id].join(' -> ')}`);
    state.set(s.id, 'visiting');
    for (const d of s.dependsOn) {
      const dep = byId.get(d);
      if (!dep) throw new GraphError(`${s.id} depends on unknown step ${d}.`);
      visit(dep, [...trail, s.id]);
    }
    state.set(s.id, 'done');
    order.push(s);
  };
  for (const s of steps) visit(s, []);
  return order;
}

export function analyze(steps: Step[]): Analysis {
  if (steps.length === 0) throw new GraphError('At least one step is required.');
  for (const s of steps) if (!(s.durationMs >= 0)) throw new GraphError(`${s.id} has an invalid duration.`);
  const order = topoSort(steps);
  const finish = new Map<string, number>();
  const start = new Map<string, number>();
  for (const s of order) {
    const es = Math.max(0, ...s.dependsOn.map((d) => finish.get(d) ?? 0));
    start.set(s.id, es);
    finish.set(s.id, es + s.durationMs);
  }
  const total = Math.max(...finish.values());
  const latest = new Map<string, number>(); // latest allowed finish
  for (const s of [...order].reverse()) {
    const successors = steps.filter((o) => o.dependsOn.includes(s.id));
    const lf = successors.length === 0 ? total : Math.min(...successors.map((o) => (latest.get(o.id) ?? total) - o.durationMs));
    latest.set(s.id, lf);
  }
  const timings: StepTiming[] = order.map((s) => {
    const ef = finish.get(s.id) ?? 0;
    const slack = (latest.get(s.id) ?? total) - ef;
    return { id: s.id, earliestStart: start.get(s.id) ?? 0, earliestFinish: ef, slack, critical: slack === 0 };
  });
  return { totalMs: total, criticalPath: timings.filter((t) => t.critical).map((t) => t.id), steps: timings };
}

// Shows what speeding up one step achieves. The saving is capped by the next-longest path.
export function whatIf(steps: Step[], id: string, newDurationMs: number): { before: number; after: number; savedMs: number } {
  const before = analyze(steps).totalMs;
  const after = analyze(steps.map((s) => (s.id === id ? { ...s, durationMs: newDurationMs } : s))).totalMs;
  return { before, after, savedMs: before - after };
}

export const CHECKOUT: Step[] = [
  { id: 'gateway', durationMs: 5, dependsOn: [] },
  { id: 'auth', durationMs: 10, dependsOn: ['gateway'] },
  { id: 'cart', durationMs: 25, dependsOn: ['auth'] },
  { id: 'inventory', durationMs: 60, dependsOn: ['cart'] },
  { id: 'pricing', durationMs: 40, dependsOn: ['cart'] },
  { id: 'fraud', durationMs: 90, dependsOn: ['cart'] },
  { id: 'payment', durationMs: 120, dependsOn: ['inventory', 'pricing', 'fraud'] },
  { id: 'write-order', durationMs: 15, dependsOn: ['payment'] },
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const a = analyze(CHECKOUT);
    console.log(JSON.stringify({ totalMs: a.totalMs, criticalPath: a.criticalPath }));
    for (const t of a.steps) console.log(JSON.stringify({ id: t.id, finish: t.earliestFinish, slack: t.slack }));
    console.log(JSON.stringify({ optimizePricingTo10: whatIf(CHECKOUT, 'pricing', 10) }));
    console.log(JSON.stringify({ optimizeFraudTo40: whatIf(CHECKOUT, 'fraud', 40) }));
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'analysis.failed', error: String(err) }));
    process.exitCode = 1;
  }
}
