// Hedged requests with cancellation. A second copy goes out if the first has not answered in time,
// the first success wins, and the loser is aborted so that it stops consuming server resources.
import { fileURLToPath } from 'node:url';

export type Call<T> = (signal: AbortSignal, replica: number) => Promise<T>;
export interface HedgeOptions { hedgeAfterMs: number; maxCopies: number; budget?: HedgeBudget }
export interface HedgeResult<T> { value: T; winner: number; copiesSent: number }

// Caps hedges at a fraction of requests, so hedging cannot multiply load during an overload.
export class HedgeBudget {
  private tokens = 0;
  private readonly ratio: number;
  private readonly capacity: number;
  constructor(ratio: number, capacity: number) { this.ratio = ratio; this.capacity = capacity; }
  onRequest(): void { this.tokens = Math.min(this.capacity, this.tokens + this.ratio); }
  tryHedge(): boolean {
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export class AllCopiesFailed extends Error {
  readonly causes: unknown[];
  constructor(causes: unknown[]) { super(`All ${causes.length} copies failed.`); this.causes = causes; }
}

export function hedged<T>(call: Call<T>, opts: HedgeOptions): Promise<HedgeResult<T>> {
  if (opts.maxCopies < 1) throw new RangeError('maxCopies must be at least 1.');
  opts.budget?.onRequest();
  return new Promise<HedgeResult<T>>((resolve, reject) => {
    const controllers: AbortController[] = [];
    const failures: unknown[] = [];
    let settled = false;
    let inFlight = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const canSendMore = (): boolean => controllers.length < opts.maxCopies;
    const send = (): void => {
      const replica = controllers.length;
      const ctrl = new AbortController();
      controllers.push(ctrl);
      inFlight++;
      call(ctrl.signal, replica).then(
        (value) => {
          inFlight--;
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          controllers.forEach((c, i) => { if (i !== replica) c.abort(); });
          resolve({ value, winner: replica, copiesSent: controllers.length });
        },
        (err: unknown) => {
          inFlight--;
          if (settled) return;
          failures.push(err);
          if (canSendMore()) { clearTimeout(timer); send(); schedule(); return; }
          if (inFlight === 0) { settled = true; clearTimeout(timer); reject(new AllCopiesFailed(failures)); }
        },
      );
    };
    const schedule = (): void => {
      if (!canSendMore()) return;
      timer = setTimeout(() => {
        if (settled || !canSendMore()) return;
        if (opts.budget && !opts.budget.tryHedge()) return;
        send();
        schedule();
      }, opts.hedgeAfterMs);
    };
    send();
    schedule();
  });
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
});

async function demo(): Promise<void> {
  const delays = [500, 20]; // the first replica is stuck, and the second is healthy
  let cancelled = 0;
  const call: Call<string> = async (signal, replica) => {
    try {
      await sleep(delays[replica] ?? 20, signal);
      return `answer from replica ${replica}`;
    } catch (err) { cancelled++; throw err; }
  };
  const start = performance.now();
  const r = await hedged(call, { hedgeAfterMs: 50, maxCopies: 2 });
  await new Promise((resolve) => { setImmediate(resolve); });
  console.log(JSON.stringify({ level: 'info', msg: 'hedge.done', ...r, cancelled, elapsedMs: Math.round(performance.now() - start) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  demo().catch((err: unknown) => {
    console.error(JSON.stringify({ level: 'error', msg: 'hedge.failed', error: String(err) }));
    process.exitCode = 1;
  });
}
