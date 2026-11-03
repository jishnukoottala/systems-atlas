// Streaming trace profile. Production logs may not fit in memory, so this reads NDJSON line by line
// with bounded state: per-second counts, a keyed count capped by a Space-Saving summary, and a
// fixed-bucket size histogram.
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export interface TraceLine { t: number; op: string; key: number; size: number }

export class SpaceSaving {
  private readonly counts = new Map<number, number>();
  private readonly capacity: number;
  constructor(capacity: number) { this.capacity = capacity; }

  add(key: number): void {
    const seen = this.counts.get(key);
    if (seen !== undefined) { this.counts.set(key, seen + 1); return; }
    if (this.counts.size < this.capacity) { this.counts.set(key, 1); return; }
    // Replace the current minimum and inherit its count. This overestimates but never misses
    // an item whose true frequency exceeds total / capacity.
    let minKey = -1;
    let min = Number.POSITIVE_INFINITY;
    for (const [k, c] of this.counts) if (c < min) { min = c; minKey = k; }
    this.counts.delete(minKey);
    this.counts.set(key, min + 1);
  }

  top(n: number): Array<[number, number]> {
    return [...this.counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  }
}

export interface StreamProfile {
  lines: number;
  skipped: number;
  meanRps: number;
  peakRps: number;
  peakToMean: number;
  readRatio: number;
  topKeys: Array<[number, number]>;
  sizeP99UpperBound: number;
}

export class Profiler {
  private lines = 0;
  private skipped = 0;
  private reads = 0;
  private minT = Infinity;
  private maxT = -Infinity;
  private readonly perSecond = new Map<number, number>();
  private readonly keys = new SpaceSaving(1_000);
  private readonly sizeBuckets = new Array<number>(40).fill(0); // power-of-two buckets

  ingest(raw: string): void {
    let row: Partial<TraceLine>;
    try { row = JSON.parse(raw) as Partial<TraceLine>; } catch { this.skipped++; return; }
    const { t, op, key, size } = row;
    if (typeof t !== 'number' || typeof op !== 'string' || typeof key !== 'number' || typeof size !== 'number' || size < 1) { this.skipped++; return; }
    this.lines++;
    if (op === 'read') this.reads++;
    this.minT = Math.min(this.minT, t);
    this.maxT = Math.max(this.maxT, t);
    const sec = Math.floor(t);
    this.perSecond.set(sec, (this.perSecond.get(sec) ?? 0) + 1);
    this.keys.add(key);
    const bucket = Math.min(this.sizeBuckets.length - 1, Math.ceil(Math.log2(size)));
    this.sizeBuckets[bucket] = (this.sizeBuckets[bucket] ?? 0) + 1;
  }

  profile(): StreamProfile {
    if (this.lines === 0) throw new Error('No valid trace lines.');
    const mean = this.lines / Math.max(this.maxT - this.minT, 1);
    const peak = Math.max(...this.perSecond.values());
    const threshold = Math.ceil(this.lines * 0.99);
    let running = 0;
    let p99 = 0;
    for (let i = 0; i < this.sizeBuckets.length; i++) {
      running += this.sizeBuckets[i] ?? 0;
      if (running >= threshold) { p99 = 2 ** i; break; }
    }
    return {
      lines: this.lines, skipped: this.skipped, meanRps: round(mean), peakRps: peak,
      peakToMean: round(peak / mean), readRatio: round(this.reads / this.lines),
      topKeys: this.keys.top(5), sizeP99UpperBound: p99,
    };
  }
}

const round = (x: number): number => Math.round(x * 100) / 100;

export async function profileFile(path: string): Promise<StreamProfile> {
  const profiler = new Profiler();
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) profiler.ingest(line);
  return profiler.profile();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path) { console.error(JSON.stringify({ level: 'error', msg: 'usage: pnpm start <trace.ndjson>' })); process.exit(2); }
  profileFile(path).then(
    (p) => { console.log(JSON.stringify(p, null, 2)); },
    (err: unknown) => { console.error(JSON.stringify({ level: 'error', msg: 'profile.failed', error: String(err) })); process.exit(1); },
  );
}
