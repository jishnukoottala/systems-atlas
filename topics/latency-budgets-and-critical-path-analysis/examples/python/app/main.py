"""Why percentile budgets do not simply add up, shown by seeded Monte Carlo simulation.

Each dependency has its own latency distribution. Adding their p99s overstates sequential total p99
when the delays are independent, and understates the effect of parallel branches. Timeouts should be
set from the remaining budget, so this also shows how a deadline protects the total.
"""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass

from pydantic import BaseModel, Field


class Dependency(BaseModel):
    name: str
    median_ms: float = Field(gt=0)
    sigma: float = Field(gt=0)


class Summary(BaseModel):
    p50_ms: float
    p99_ms: float


@dataclass(frozen=True)
class Sampler:
    rng: random.Random

    def draw(self, d: Dependency) -> float:
        return self.rng.lognormvariate(math.log(d.median_ms), d.sigma)


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return ordered[math.ceil(q * len(ordered)) - 1]


def summarize(values: list[float]) -> Summary:
    return Summary(p50_ms=round(percentile(values, 0.5), 1), p99_ms=round(percentile(values, 0.99), 1))


def own_p99(d: Dependency, n: int, seed: int) -> float:
    s = Sampler(random.Random(seed))
    return percentile([s.draw(d) for _ in range(n)], 0.99)


def sequential(deps: list[Dependency], n: int, seed: int = 1) -> Summary:
    s = Sampler(random.Random(seed))
    return summarize([sum(s.draw(d) for d in deps) for _ in range(n)])


def parallel(deps: list[Dependency], n: int, seed: int = 1) -> Summary:
    s = Sampler(random.Random(seed))
    return summarize([max(s.draw(d) for d in deps) for _ in range(n)])


def correlated_sequential(deps: list[Dependency], n: int, slow_probability: float, slow_factor: float, seed: int = 1) -> Summary:
    """All dependencies slow down together sometimes, as with a shared host or network problem."""
    rng = random.Random(seed)
    s = Sampler(rng)
    totals = []
    for _ in range(n):
        factor = slow_factor if rng.random() < slow_probability else 1.0
        totals.append(sum(s.draw(d) * factor for d in deps))
    return summarize(totals)


def with_deadline(deps: list[Dependency], budget_ms: float, n: int, seed: int = 1) -> dict[str, float]:
    """Sequential calls, each limited to what remains of the budget. Fails fast when none remains."""
    s = Sampler(random.Random(seed))
    ok = 0
    spent: list[float] = []
    for _ in range(n):
        remaining = budget_ms
        success = True
        for d in deps:
            t = s.draw(d)
            if t > remaining:
                remaining = 0
                success = False
                break
            remaining -= t
        spent.append(budget_ms - remaining)
        ok += success
    return {"success_pct": round(100 * ok / n, 2), "max_spent_ms": round(max(spent), 1)}


DEPS = [
    Dependency(name="auth", median_ms=10, sigma=0.4),
    Dependency(name="profile", median_ms=30, sigma=0.5),
    Dependency(name="pricing", median_ms=40, sigma=0.5),
    Dependency(name="inventory", median_ms=50, sigma=0.6),
]


def main() -> int:
    n = 100_000
    p99s = {d.name: round(own_p99(d, n, 7), 1) for d in DEPS}
    print(json.dumps({
        "per_dependency_p99_ms": p99s,
        "sum_of_p99s_ms": round(sum(p99s.values()), 1),
        "sequential_independent": sequential(DEPS, n).model_dump(),
        "sequential_correlated": correlated_sequential(DEPS, n, slow_probability=0.02, slow_factor=4).model_dump(),
        "parallel": parallel(DEPS, n).model_dump(),
        "deadline_300ms": with_deadline(DEPS, 300, n),
        "deadline_200ms": with_deadline(DEPS, 200, n),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
