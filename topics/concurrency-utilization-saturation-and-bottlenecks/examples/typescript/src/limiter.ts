// A concurrency limiter that exposes the numbers this lesson is about: concurrency (in flight),
// utilization (busy fraction of slots over time), saturation (queue depth and wait), and errors
// (rejections). A bounded queue keeps overload from turning into unbounded waiting.
export class QueueFullError extends Error {}

export interface LimiterStats {
  inFlight: number;
  limit: number;
  queued: number;
  queueLimit: number;
  utilization: number;
  completed: number;
  rejected: number;
  meanWaitMs: number;
}

export class ConcurrencyLimiter {
  private readonly limit: number;
  private readonly queueLimit: number;
  private readonly now: () => number;
  private readonly waiters: Array<() => void> = [];
  private inFlight = 0;
  private completed = 0;
  private rejected = 0;
  private totalWaitMs = 0;
  private busySlotMs = 0;
  private lastChange: number;
  private readonly startedAt: number;

  constructor(limit: number, queueLimit: number, now: () => number = () => performance.now()) {
    if (limit < 1 || queueLimit < 0) throw new RangeError('limit must be at least 1 and queueLimit at least 0.');
    this.limit = limit;
    this.queueLimit = queueLimit;
    this.now = now;
    this.startedAt = now();
    this.lastChange = this.startedAt;
  }

  private accrue(): void {
    const t = this.now();
    this.busySlotMs += this.inFlight * (t - this.lastChange);
    this.lastChange = t;
  }

  private acquire(): Promise<void> {
    if (this.inFlight < this.limit) {
      this.accrue();
      this.inFlight++;
      return Promise.resolve();
    }
    if (this.waiters.length >= this.queueLimit) {
      this.rejected++;
      return Promise.reject(new QueueFullError('Queue is full.'));
    }
    const queuedAt = this.now();
    return new Promise<void>((resolve) => {
      this.waiters.push(() => {
        this.totalWaitMs += this.now() - queuedAt;
        resolve();
      });
    });
  }

  private release(): void {
    this.completed++;
    const next = this.waiters.shift();
    if (next) { next(); return; } // the slot passes straight to the next waiter
    this.accrue();
    this.inFlight--;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await work();
    } finally {
      this.release();
    }
  }

  stats(): LimiterStats {
    this.accrue();
    const elapsed = Math.max(this.now() - this.startedAt, 1);
    return {
      inFlight: this.inFlight, limit: this.limit, queued: this.waiters.length, queueLimit: this.queueLimit,
      utilization: Math.round((this.busySlotMs / (elapsed * this.limit)) * 1_000) / 1_000,
      completed: this.completed, rejected: this.rejected,
      meanWaitMs: this.completed === 0 ? 0 : Math.round((this.totalWaitMs / this.completed) * 10) / 10,
    };
  }
}
