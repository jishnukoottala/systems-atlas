// Universal Scalability Law: why adding workers can stop helping, and then start to hurt.
// X(N) = lambda * N / (1 + sigma * (N - 1) + kappa * N * (N - 1))
// sigma models contention (serialized work), and kappa models coherency (cross-talk between workers).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface UslParams { lambda: number; sigma: number; kappa: number }
export interface Sample { n: number; throughput: number }

export class InputError extends Error {}

export function uslThroughput(n: number, p: UslParams): number {
  if (!Number.isInteger(n) || n < 1) throw new InputError(`n must be a positive integer, got ${n}.`);
  return (p.lambda * n) / (1 + p.sigma * (n - 1) + p.kappa * n * (n - 1));
}

// Peak concurrency, from setting dX/dN = 0. With no coherency cost, throughput never peaks.
export function uslPeak(p: UslParams): number | null {
  if (p.kappa <= 0) return null;
  return Math.sqrt((1 - p.sigma) / p.kappa);
}

// The USL rearranges to a quadratic: N / (X(N) / X(1)) - 1 = kappa * x^2 + (sigma + kappa) * x,
// where x = N - 1. This fits it by least squares with no intercept.
export function fitUsl(samples: Sample[]): UslParams {
  const base = samples.find((s) => s.n === 1);
  if (!base || base.throughput <= 0) throw new InputError('Samples must include n = 1 with positive throughput.');
  const points = samples.filter((s) => s.n > 1);
  if (points.length < 2) throw new InputError('Need at least two samples with n > 1.');
  let x2 = 0, x3 = 0, x4 = 0, xy = 0, x2y = 0;
  for (const s of points) {
    const x = s.n - 1;
    const y = s.n / (s.throughput / base.throughput) - 1;
    x2 += x * x; x3 += x ** 3; x4 += x ** 4; xy += x * y; x2y += x * x * y;
  }
  const det = x4 * x2 - x3 * x3;
  if (det === 0) throw new InputError('Samples are degenerate; use more distinct values of n.');
  const a = (x2y * x2 - xy * x3) / det; // kappa
  const b = (xy * x4 - x2y * x3) / det; // sigma + kappa
  return { lambda: base.throughput, sigma: Math.max(0, b - a), kappa: Math.max(0, a) };
}

const SAMPLE: Sample[] = [
  { n: 1, throughput: 955 }, { n: 4, throughput: 3_400 }, { n: 8, throughput: 5_900 },
  { n: 16, throughput: 8_700 }, { n: 32, throughput: 10_100 }, { n: 64, throughput: 8_400 },
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const path = process.argv[2];
    const samples = path ? (JSON.parse(readFileSync(path, 'utf8')) as Sample[]) : SAMPLE;
    const params = fitUsl(samples);
    const peak = uslPeak(params);
    console.log(JSON.stringify({ level: 'info', msg: 'usl.fit', sigma: +params.sigma.toFixed(4), kappa: +params.kappa.toFixed(5), peakWorkers: peak === null ? null : Math.round(peak) }));
    for (const n of [1, 8, 16, 32, 64, 128]) {
      console.log(JSON.stringify({ n, predictedRps: Math.round(uslThroughput(n, params)), linearRps: Math.round(params.lambda * n) }));
    }
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'usl.failed', error: err instanceof Error ? err.message : String(err) }));
    process.exitCode = 2;
  }
}
