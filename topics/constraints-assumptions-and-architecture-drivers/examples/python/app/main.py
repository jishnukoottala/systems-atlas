"""One-at-a-time sensitivity analysis: which assumption would change the design most?

An architecture driver is often an assumption whose plausible range crosses a design threshold.
This varies each input across its range and reports the swing in required capacity, and whether
that swing crosses a threshold where the design must change.
"""

from __future__ import annotations

import json
import math

from pydantic import BaseModel, Field, model_validator


class Input(BaseModel):
    name: str
    low: float = Field(gt=0)
    base: float = Field(gt=0)
    high: float = Field(gt=0)

    @model_validator(mode="after")
    def ordered(self) -> "Input":
        if not self.low <= self.base <= self.high:
            raise ValueError(f"{self.name}: expected low <= base <= high")
        return self


class Swing(BaseModel):
    name: str
    at_low: int
    at_high: int
    spread: int
    crosses_threshold: bool


def nodes_needed(daily_active: float, reqs_per_user: float, peak_ratio: float, rps_per_node: float) -> int:
    """Nodes for peak load: daily requests / 86,400 s, scaled to peak, over per-node capacity."""
    peak_rps = daily_active * reqs_per_user / 86_400 * peak_ratio
    return math.ceil(peak_rps / rps_per_node)


def sensitivity(inputs: list[Input], threshold: int) -> list[Swing]:
    base = {i.name: i.base for i in inputs}
    swings: list[Swing] = []
    for item in inputs:
        low = nodes_needed(**(base | {item.name: item.low}))
        high = nodes_needed(**(base | {item.name: item.high}))
        lo, hi = min(low, high), max(low, high)
        swings.append(
            Swing(name=item.name, at_low=low, at_high=high, spread=hi - lo,
                  crosses_threshold=lo <= threshold < hi)
        )
    return sorted(swings, key=lambda s: s.spread, reverse=True)


SAMPLE = [
    Input(name="daily_active", low=2e6, base=5e6, high=2e7),
    Input(name="reqs_per_user", low=20, base=30, high=60),
    Input(name="peak_ratio", low=2, base=3, high=6),
    Input(name="rps_per_node", low=500, base=1_000, high=1_500),
]


def main() -> int:
    # A single primary database is assumed workable up to 16 nodes of load in this scenario.
    threshold = 16
    print(json.dumps({
        "base_nodes": nodes_needed(**{i.name: i.base for i in SAMPLE}),
        "threshold_nodes": threshold,
        "swings": [s.model_dump() for s in sensitivity(SAMPLE, threshold)],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
