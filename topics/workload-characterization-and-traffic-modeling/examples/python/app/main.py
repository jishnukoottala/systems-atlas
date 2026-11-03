"""Generate a synthetic request trace, then characterize it the way you would a production log.

The generator is seeded so results repeat. Traffic follows a daily sine curve with a burst, keys
follow a Zipf-like popularity distribution, and sizes are lognormal. The analyzer reports the
numbers a design needs: rates, peak-to-mean ratio, read ratio, key skew, and size percentiles.
"""

from __future__ import annotations

import argparse
import json
import math
import random
from bisect import bisect_left
from collections import Counter
from itertools import accumulate

from pydantic import BaseModel, Field


class Request(BaseModel):
    t: float  # seconds since trace start
    op: str
    key: int
    size: int


class Profile(BaseModel):
    requests: int
    duration_s: float
    mean_rps: float
    peak_rps: int
    peak_to_mean: float
    read_ratio: float
    distinct_keys: int
    top_1pct_key_share: float
    size_p50: int
    size_p99: int


class GeneratorConfig(BaseModel):
    seed: int = 7
    duration_s: int = Field(default=3_600, gt=0)
    mean_rps: float = Field(default=50, gt=0)
    keys: int = Field(default=10_000, gt=0)
    zipf_s: float = Field(default=1.0, ge=0)
    read_ratio: float = Field(default=0.9, ge=0, le=1)
    burst_at_s: int = 1_800
    burst_len_s: int = 60
    burst_multiplier: float = 5


def generate(cfg: GeneratorConfig) -> list[Request]:
    rng = random.Random(cfg.seed)
    cdf = list(accumulate(1 / (rank**cfg.zipf_s) for rank in range(1, cfg.keys + 1)))
    total = cdf[-1]
    out: list[Request] = []
    for second in range(cfg.duration_s):
        # One full sine cycle over the trace, plus a short burst.
        rate = cfg.mean_rps * (1 + 0.5 * math.sin(2 * math.pi * second / cfg.duration_s))
        if cfg.burst_at_s <= second < cfg.burst_at_s + cfg.burst_len_s:
            rate *= cfg.burst_multiplier
        for _ in range(_poisson(rng, rate)):
            out.append(Request(
                t=second + rng.random(),
                op="read" if rng.random() < cfg.read_ratio else "write",
                key=bisect_left(cdf, rng.random() * total),
                size=max(1, int(rng.lognormvariate(8, 1))),
            ))
    return out


def _poisson(rng: random.Random, lam: float) -> int:
    # A normal approximation is accurate for the rates used here and avoids an O(lam) loop.
    return max(0, round(rng.gauss(lam, math.sqrt(lam))))


def percentile(sorted_values: list[int], q: float) -> int:
    return sorted_values[min(len(sorted_values) - 1, math.ceil(q * len(sorted_values)) - 1)]


def characterize(trace: list[Request]) -> Profile:
    if not trace:
        raise ValueError("cannot characterize an empty trace")
    per_second = Counter(int(r.t) for r in trace)
    duration = max(r.t for r in trace) - min(r.t for r in trace)
    mean = len(trace) / max(duration, 1)
    peak = max(per_second.values())
    keys = Counter(r.key for r in trace)
    top_n = max(1, len(keys) // 100)
    top_share = sum(c for _, c in keys.most_common(top_n)) / len(trace)
    sizes = sorted(r.size for r in trace)
    return Profile(
        requests=len(trace),
        duration_s=round(duration, 1),
        mean_rps=round(mean, 1),
        peak_rps=peak,
        peak_to_mean=round(peak / mean, 2),
        read_ratio=round(sum(r.op == "read" for r in trace) / len(trace), 3),
        distinct_keys=len(keys),
        top_1pct_key_share=round(top_share, 3),
        size_p50=percentile(sizes, 0.50),
        size_p99=percentile(sizes, 0.99),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--zipf", type=float, default=1.0, help="key skew; 0 is uniform")
    parser.add_argument("--export", help="write the trace as NDJSON for the TypeScript analyzer")
    args = parser.parse_args(argv)
    trace = generate(GeneratorConfig(seed=args.seed, zipf_s=args.zipf))
    if args.export:
        with open(args.export, "w", encoding="utf-8") as fh:
            for r in sorted(trace, key=lambda x: x.t):
                fh.write(r.model_dump_json() + "\n")
    print(json.dumps(characterize(trace).model_dump(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
