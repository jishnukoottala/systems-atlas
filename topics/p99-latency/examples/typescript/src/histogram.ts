// Log-linear latency histogram, similar in spirit to HdrHistogram. Bucket width grows with the
// value, so relative error stays bounded with a small fixed amount of memory. Histograms merge by
// adding counts, which is why they can be aggregated across servers and percentiles cannot.
export class Histogram {
  readonly subBuckets: number;
  private readonly counts = new Map<number, number>();
  private total = 0;

  constructor(subBuckets = 16) {
    if (!Number.isInteger(subBuckets) || subBuckets < 1) throw new RangeError('subBuckets must be a positive integer.');
    this.subBuckets = subBuckets;
  }

  private index(value: number): number {
    if (value < 1) return 0;
    const exponent = Math.floor(Math.log2(value));
    const position = Math.floor(((value / 2 ** exponent) - 1) * this.subBuckets);
    return exponent * this.subBuckets + position + 1;
  }

  private upperBound(index: number): number {
    if (index === 0) return 1;
    const i = index - 1;
    const exponent = Math.floor(i / this.subBuckets);
    const position = i % this.subBuckets;
    return 2 ** exponent * (1 + (position + 1) / this.subBuckets);
  }

  record(valueMs: number): void {
    if (!Number.isFinite(valueMs) || valueMs < 0) throw new RangeError(`Invalid latency: ${valueMs}.`);
    const i = this.index(valueMs);
    this.counts.set(i, (this.counts.get(i) ?? 0) + 1);
    this.total++;
  }

  merge(other: Histogram): void {
    if (other.subBuckets !== this.subBuckets) throw new RangeError('Only histograms with equal bucket layouts can merge.');
    for (const [i, c] of other.counts) this.counts.set(i, (this.counts.get(i) ?? 0) + c);
    this.total += other.total;
  }

  get count(): number { return this.total; }
  get bucketCount(): number { return this.counts.size; }

  // Returns the upper bound of the bucket holding the quantile, so the result never understates.
  quantile(q: number): number {
    if (q <= 0 || q > 1) throw new RangeError('q must be in (0, 1].');
    if (this.total === 0) throw new RangeError('The histogram is empty.');
    const target = Math.ceil(q * this.total);
    let seen = 0;
    for (const i of [...this.counts.keys()].sort((a, b) => a - b)) {
      seen += this.counts.get(i) ?? 0;
      if (seen >= target) return this.upperBound(i);
    }
    return this.upperBound(Math.max(...this.counts.keys()));
  }
}
