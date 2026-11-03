"""Show the common ways percentile numbers go wrong, using seeded data.

1. Averaging per-server p99s does not give the fleet p99.
2. Few samples give an unstable p99.
3. Coarse histogram buckets decide the answer you see.
4. Percentiles over a window hide short bad periods.
"""

from __future__ import annotations

import json
import math
import random
from bisect import bisect_left
from statistics import mean

from pydantic import BaseModel, Field


class ServerProfile(BaseModel):
    name: str
    median_ms: float = Field(gt=0)
    sigma: float = Field(gt=0)
    requests: int = Field(gt=0)


def percentile(values: list[float], q: float) -> float:
    """Nearest-rank percentile. Sorts a copy, so it is O(n log n)."""
    if not values:
        raise ValueError("no values")
    if not 0 < q <= 1:
        raise ValueError("q must be in (0, 1]")
    ordered = sorted(values)
    return ordered[math.ceil(q * len(ordered)) - 1]


def sample(rng: random.Random, p: ServerProfile) -> list[float]:
    return [rng.lognormvariate(math.log(p.median_ms), p.sigma) for _ in range(p.requests)]


def average_of_p99s(seed: int = 3) -> dict[str, float]:
    rng = random.Random(seed)
    fleet = [
        ServerProfile(name=f"healthy-{i}", median_ms=20, sigma=0.5, requests=50_000) for i in range(9)
    ] + [ServerProfile(name="degraded", median_ms=300, sigma=0.6, requests=50_000)]
    per_server = [sample(rng, p) for p in fleet]
    p99s = [percentile(v, 0.99) for v in per_server]
    pooled = [x for v in per_server for x in v]
    return {
        "mean_of_p99s_ms": round(mean(p99s), 1),
        "max_of_p99s_ms": round(max(p99s), 1),
        "true_pooled_p99_ms": round(percentile(pooled, 0.99), 1),
        "true_pooled_p50_ms": round(percentile(pooled, 0.50), 1),
    }


def p99_spread(samples: int, trials: int = 300, seed: int = 5) -> dict[str, float]:
    """Repeat a measurement and report how far the estimated p99 moves."""
    rng = random.Random(seed)
    estimates = sorted(
        percentile([rng.lognormvariate(math.log(20), 0.5) for _ in range(samples)], 0.99)
        for _ in range(trials)
    )
    return {
        "samples": samples,
        "low_5pct_ms": round(estimates[int(trials * 0.05)], 1),
        "high_95pct_ms": round(estimates[int(trials * 0.95)], 1),
    }


def bucket_p99(values: list[float], bounds: list[float]) -> float:
    """What a histogram with these upper bounds reports: linear interpolation inside a bucket."""
    ordered = sorted(values)
    rank = 0.99 * len(ordered)
    below = 0
    lower = 0.0
    for upper in bounds:
        count = bisect_left(ordered, upper) - below
        if below + count >= rank:
            return lower + (upper - lower) * (rank - below) / max(count, 1)
        below += count
        lower = upper
    return bounds[-1]


def bucket_effect(seed: int = 9) -> dict[str, float]:
    rng = random.Random(seed)
    values = [rng.lognormvariate(math.log(20), 0.5) for _ in range(100_000)]
    return {
        "exact_p99_ms": round(percentile(values, 0.99), 1),
        "coarse_buckets_p99_ms": round(bucket_p99(values, [10, 100, 1_000]), 1),
        "default_like_buckets_p99_ms": round(bucket_p99(values, [5, 10, 25, 50, 100, 250, 500, 1_000]), 1),
        "fine_buckets_p99_ms": round(bucket_p99(values, [20, 30, 40, 50, 55, 60, 65, 70, 80, 100, 1_000]), 1),
    }


def window_effect(seed: int = 13) -> dict[str, float]:
    """A 5-minute incident hides inside a 1-hour p99 if it covers under 1% of requests."""
    rng = random.Random(seed)
    normal = [rng.lognormvariate(math.log(20), 0.3) for _ in range(359_000)]
    incident = [rng.lognormvariate(math.log(2_000), 0.2) for _ in range(1_000)]
    return {
        "hour_p99_ms": round(percentile(normal + incident, 0.99), 1),
        "incident_window_p50_ms": round(percentile(incident, 0.5), 1),
        "incident_share_pct": round(100 * len(incident) / (len(normal) + len(incident)), 2),
    }


def main() -> int:
    print(json.dumps({
        "average_of_p99s": average_of_p99s(),
        "stability": [p99_spread(n) for n in (100, 1_000, 10_000)],
        "bucket_effect": bucket_effect(),
        "window_effect": window_effect(),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
