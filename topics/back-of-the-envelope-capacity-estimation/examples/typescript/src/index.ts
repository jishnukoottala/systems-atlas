// Unit-safe capacity arithmetic. Most estimation errors are unit errors, such as bits for bytes or
// per-day for per-second. Branded types make those mistakes compile errors, at zero runtime cost.
import { fileURLToPath } from 'node:url';

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type Bytes = Brand<number, 'bytes'>;
export type BitsPerSecond = Brand<number, 'bits/s'>;
export type BytesPerSecond = Brand<number, 'bytes/s'>;
export type PerSecond = Brand<number, 'per-second'>;
export type PerDay = Brand<number, 'per-day'>;
export type Seconds = Brand<number, 'seconds'>;

export class EstimateError extends Error {}

const positive = (n: number, label: string): number => {
  if (!Number.isFinite(n) || n < 0) throw new EstimateError(`${label} must be a non-negative number, got ${n}.`);
  return n;
};

export const bytes = (n: number): Bytes => positive(n, 'bytes') as Bytes;
export const kb = (n: number): Bytes => bytes(n * 1_000);
export const mb = (n: number): Bytes => bytes(n * 1_000_000);
export const gb = (n: number): Bytes => bytes(n * 1_000_000_000);
export const seconds = (n: number): Seconds => positive(n, 'seconds') as Seconds;
export const perDay = (n: number): PerDay => positive(n, 'rate') as PerDay;
export const perSecond = (n: number): PerSecond => positive(n, 'rate') as PerSecond;
export const gbps = (n: number): BitsPerSecond => (positive(n, 'bandwidth') * 1e9) as BitsPerSecond;

export const toPerSecond = (r: PerDay): PerSecond => perSecond(r / 86_400);
export const toBytesPerSecond = (b: BitsPerSecond): BytesPerSecond => (b / 8) as BytesPerSecond;
export const throughput = (rate: PerSecond, size: Bytes): BytesPerSecond => (rate * size) as BytesPerSecond;
export const transferTime = (size: Bytes, link: BitsPerSecond): Seconds => seconds(size / toBytesPerSecond(link));
export const amountOver = (rate: BytesPerSecond, t: Seconds): Bytes => bytes(rate * t);

export function format(n: number, unit: string): string {
  const scales: Array<[number, string]> = [[1e15, 'P'], [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k']];
  for (const [scale, prefix] of scales) if (n >= scale) return `${(n / scale).toFixed(1)} ${prefix}${unit}`;
  return `${n.toFixed(1)} ${unit}`;
}

// The classic number sense check: transfer times for common cases.
export function report(): Record<string, string> {
  const uploads = toPerSecond(perDay(500_000_000));
  const flow = throughput(uploads, mb(2));
  return {
    'uploads per second': format(uploads, '/s'),
    'upload bandwidth': format(flow * 8, 'bit/s'),
    'storage per year': format(amountOver(flow, seconds(365 * 86_400)), 'B'),
    '1 TB over 1 Gbit/s': `${(transferTime(gb(1_000), gbps(1)) / 3_600).toFixed(1)} hours`,
    '1 PB over 10 Gbit/s': `${(transferTime(gb(1_000_000), gbps(10)) / 86_400).toFixed(1)} days`,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [k, v] of Object.entries(report())) console.log(JSON.stringify({ item: k, value: v }));
}
