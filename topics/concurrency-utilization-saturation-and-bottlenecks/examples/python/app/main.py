"""Operational analysis: find the bottleneck from measured service demands, before any load test.

Service demand D is the CPU, disk, or other resource time one request needs in total. These laws hold
regardless of the arrival distribution:

    Utilization law:   U = X * D
    Bottleneck limit:  X <= 1 / D_max
    Response floor:    R >= sum(D)
    Saturation knee:   N* = (sum(D) + Z) / D_max
"""

from __future__ import annotations

import json

from pydantic import BaseModel, Field


class Resource(BaseModel):
    name: str
    demand_ms: float = Field(gt=0, description="total service time per request")
    servers: int = Field(default=1, gt=0)

    @property
    def effective_demand_ms(self) -> float:
        return self.demand_ms / self.servers


class Row(BaseModel):
    name: str
    utilization_pct: float
    status: str
    max_rps: float


class Report(BaseModel):
    bottleneck: str
    max_throughput_rps: float
    min_response_ms: float
    knee_concurrency: float
    rows: list[Row]


def classify(u: float) -> str:
    if u >= 1:
        return "saturated"
    if u >= 0.8:
        return "near saturation"
    return "ok"


def analyze(resources: list[Resource], rps: float, think_ms: float = 0.0) -> Report:
    if not resources:
        raise ValueError("at least one resource is required")
    if rps < 0:
        raise ValueError("rps must be non-negative")
    worst = max(resources, key=lambda r: r.effective_demand_ms)
    total = sum(r.demand_ms for r in resources)
    rows = [
        Row(
            name=r.name,
            utilization_pct=round(rps * r.effective_demand_ms / 10, 1),  # rps x ms / 1000 x 100
            status=classify(rps * r.effective_demand_ms / 1_000),
            max_rps=round(1_000 / r.effective_demand_ms, 1),
        )
        for r in resources
    ]
    return Report(
        bottleneck=worst.name,
        max_throughput_rps=round(1_000 / worst.effective_demand_ms, 1),
        min_response_ms=round(total, 1),
        knee_concurrency=round((total + think_ms) / worst.effective_demand_ms, 1),
        rows=rows,
    )


def required_servers(resources: list[Resource], rps: float, target_utilization: float) -> dict[str, int]:
    """Servers per resource so that each one stays at or below the target utilization."""
    if not 0 < target_utilization <= 1:
        raise ValueError("target_utilization must be in (0, 1]")
    out = {}
    for r in resources:
        needed = rps * r.demand_ms / 1_000 / target_utilization
        out[r.name] = max(1, int(needed) + (needed > int(needed)))
    return out


SAMPLE = [
    Resource(name="web_cpu", demand_ms=8, servers=8),
    Resource(name="app_cpu", demand_ms=25, servers=16),
    Resource(name="db_cpu", demand_ms=6, servers=8),
    Resource(name="db_disk", demand_ms=4, servers=2),
    Resource(name="db_row_lock", demand_ms=2.5, servers=1),
]


def main() -> int:
    print(json.dumps({
        "at_300_rps": analyze(SAMPLE, 300).model_dump(),
        "at_450_rps": analyze(SAMPLE, 450).model_dump(),
        "servers_for_1000_rps_at_70pct": required_servers(SAMPLE, 1_000, 0.7),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
