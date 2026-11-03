"""Seeded simulation of tail amplification and three mitigations.

Each leaf server is usually fast and occasionally very slow. A request fans out to many leaves and
waits for all of them, so one slow leaf delays the whole request. Hedging sends a second copy after
a short delay, and partial results return at a deadline with some answers missing.
"""

from __future__ import annotations

import json
import math
import random

from pydantic import BaseModel, Field


class Leaf(BaseModel):
    fast_ms: float = Field(default=10, gt=0)
    slow_ms: float = Field(default=1_000, gt=0)
    slow_probability: float = Field(default=0.01, ge=0, le=1)


class Outcome(BaseModel):
    name: str
    p50_ms: float
    p95_ms: float
    p99_ms: float
    p999_ms: float
    over_100ms_pct: float
    extra_load_pct: float = 0.0
    mean_completeness_pct: float = 100.0


def leaf_time(rng: random.Random, leaf: Leaf) -> float:
    base = leaf.slow_ms if rng.random() < leaf.slow_probability else leaf.fast_ms
    return base * rng.uniform(0.8, 1.2)


def pct(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return round(ordered[math.ceil(q * len(ordered)) - 1], 1)


def summarize(name: str, totals: list[float], extra: float = 0.0, complete: float = 100.0) -> Outcome:
    over = 100 * sum(1 for t in totals if t > 100) / len(totals)
    return Outcome(name=name, p50_ms=pct(totals, 0.5), p95_ms=pct(totals, 0.95), p99_ms=pct(totals, 0.99),
                   p999_ms=pct(totals, 0.999), over_100ms_pct=round(over, 2),
                   extra_load_pct=round(extra, 1), mean_completeness_pct=round(complete, 2))


def fan_out(requests: int, width: int, leaf: Leaf, seed: int = 1) -> Outcome:
    rng = random.Random(seed)
    totals = [max(leaf_time(rng, leaf) for _ in range(width)) for _ in range(requests)]
    return summarize(f"fan-out {width}", totals)


def hedged_leaf(rng: random.Random, leaf: Leaf, hedge_after_ms: float) -> tuple[float, bool]:
    """Returns finish time and whether a second copy was sent."""
    first = leaf_time(rng, leaf)
    if first <= hedge_after_ms:
        return first, False
    return min(first, hedge_after_ms + leaf_time(rng, leaf)), True


def hedged(requests: int, width: int, leaf: Leaf, hedge_after_ms: float, seed: int = 1) -> Outcome:
    rng = random.Random(seed)
    totals: list[float] = []
    sent = 0
    for _ in range(requests):
        results = [hedged_leaf(rng, leaf, hedge_after_ms) for _ in range(width)]
        sent += sum(1 for _, h in results if h)
        totals.append(max(t for t, _ in results))
    return summarize(f"fan-out {width}, hedge at {hedge_after_ms:g} ms", totals, 100 * sent / (requests * width))


def partial(requests: int, width: int, leaf: Leaf, deadline_ms: float, seed: int = 1) -> Outcome:
    rng = random.Random(seed)
    totals: list[float] = []
    answered = 0
    for _ in range(requests):
        times = [leaf_time(rng, leaf) for _ in range(width)]
        answered += sum(1 for t in times if t <= deadline_ms)
        totals.append(min(max(times), deadline_ms))
    return summarize(f"fan-out {width}, partial at {deadline_ms:g} ms", totals, 0.0, 100 * answered / (requests * width))


def predicted_slow_fraction(width: int, slow_probability: float) -> float:
    return 1 - (1 - slow_probability) ** width


def predicted_hedged_slow_fraction(width: int, slow_probability: float) -> float:
    # A hedged leaf is slow only if both copies are, assuming independent copies.
    return predicted_slow_fraction(width, slow_probability**2)


def main() -> int:
    leaf = Leaf()
    n = 20_000
    rows = [fan_out(n, w, leaf) for w in (1, 10, 100)]
    rows += [hedged(n, 100, leaf, 15), hedged(n, 100, leaf, 50), partial(n, 100, leaf, 50)]
    print(json.dumps({
        "predicted_slow_fraction": {str(w): round(predicted_slow_fraction(w, 0.01), 3) for w in (1, 10, 100)},
        "predicted_hedged_slow_fraction_100": round(predicted_hedged_slow_fraction(100, 0.01), 4),
        "results": [r.model_dump() for r in rows],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
