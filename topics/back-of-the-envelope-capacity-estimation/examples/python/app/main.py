"""FastAPI capacity estimator. It returns every intermediate step with units, so reviewers can check
the reasoning and not only the answer. Run the module directly for a command-line estimate.
"""

from __future__ import annotations

import json
import logging
import math

from fastapi import FastAPI
from pydantic import BaseModel, Field, model_validator

log = logging.getLogger("estimator")
SECONDS_PER_DAY = 86_400
DAYS_PER_YEAR = 365


class Workload(BaseModel):
    daily_active_users: int = Field(gt=0)
    writes_per_user_per_day: float = Field(ge=0)
    reads_per_user_per_day: float = Field(ge=0)
    object_size_bytes: int = Field(gt=0)
    metadata_bytes_per_object: int = Field(default=0, ge=0)
    response_size_bytes: int = Field(gt=0)
    peak_to_mean: float = Field(default=3.0, ge=1)
    retention_years: float = Field(default=5.0, gt=0)
    replication_factor: int = Field(default=3, ge=1)
    cache_hit_ratio: float = Field(default=0.0, ge=0, lt=1)
    cache_working_set_fraction: float = Field(default=0.2, gt=0, le=1)
    rps_per_server: float = Field(default=1_000, gt=0)
    headroom: float = Field(default=0.3, ge=0, lt=1)
    zones: int = Field(default=3, ge=2)

    @model_validator(mode="after")
    def some_traffic(self) -> "Workload":
        if self.writes_per_user_per_day + self.reads_per_user_per_day == 0:
            raise ValueError("workload has no traffic")
        return self


class Step(BaseModel):
    name: str
    formula: str
    value: float
    unit: str


class Estimate(BaseModel):
    steps: list[Step]
    summary: dict[str, float]


def human(bytes_: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB", "PB", "EB"):
        if bytes_ < 1_000:
            return f"{bytes_:.1f} {unit}"
        bytes_ /= 1_000
    return f"{bytes_:.1f} ZB"


def estimate(w: Workload) -> Estimate:
    steps: list[Step] = []

    def step(name: str, formula: str, value: float, unit: str) -> float:
        steps.append(Step(name=name, formula=formula, value=round(value, 3), unit=unit))
        return value

    writes = step("mean writes", "DAU x writes per day / 86,400", w.daily_active_users * w.writes_per_user_per_day / SECONDS_PER_DAY, "req/s")
    reads = step("mean reads", "DAU x reads per day / 86,400", w.daily_active_users * w.reads_per_user_per_day / SECONDS_PER_DAY, "req/s")
    peak_writes = step("peak writes", "mean writes x peak-to-mean", writes * w.peak_to_mean, "req/s")
    peak_reads = step("peak reads", "mean reads x peak-to-mean", reads * w.peak_to_mean, "req/s")
    db_reads = step("peak database reads", "peak reads x (1 - hit ratio)", peak_reads * (1 - w.cache_hit_ratio), "req/s")
    per_object = w.object_size_bytes + w.metadata_bytes_per_object
    daily = step("new data per day", "mean writes x 86,400 x bytes per object", writes * SECONDS_PER_DAY * per_object, "B")
    raw = step("raw storage", "daily x 365 x years", daily * DAYS_PER_YEAR * w.retention_years, "B")
    stored = step("replicated storage", "raw x replication factor", raw * w.replication_factor, "B")
    egress = step("peak egress", "peak reads x response bytes x 8", peak_reads * w.response_size_bytes * 8, "bit/s")
    ingress = step("peak ingress", "peak writes x object bytes x 8", peak_writes * w.object_size_bytes * 8, "bit/s")
    unique_daily = reads * SECONDS_PER_DAY * w.cache_working_set_fraction
    cache = step("cache memory", "daily reads x working-set fraction x bytes per object", unique_daily * per_object, "B")
    exact = step("servers at capacity", "peak total / rps per server", (peak_reads + peak_writes) / w.rps_per_server, "servers")
    with_headroom = step("with headroom", "servers / (1 - headroom)", exact / (1 - w.headroom), "servers")
    failure = step("surviving one zone", "servers x zones / (zones - 1)", with_headroom * w.zones / (w.zones - 1), "servers")

    return Estimate(steps=steps, summary={
        "peak_total_rps": round(peak_reads + peak_writes, 1),
        "peak_db_reads_rps": round(db_reads, 1),
        "stored_bytes": stored,
        "egress_gbps": round(egress / 1e9, 2),
        "ingress_gbps": round(ingress / 1e9, 3),
        "cache_bytes": cache,
        "servers": math.ceil(failure),
    })


app = FastAPI(title="Capacity estimator")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/estimate")
def post_estimate(workload: Workload) -> Estimate:
    result = estimate(workload)
    log.info(json.dumps({"msg": "estimate", "servers": result.summary["servers"]}))
    return result


URL_SHORTENER = Workload(
    daily_active_users=100_000_000,
    writes_per_user_per_day=0.1,
    reads_per_user_per_day=10,
    object_size_bytes=500,
    response_size_bytes=500,
    peak_to_mean=3,
    retention_years=5,
    replication_factor=3,
    cache_hit_ratio=0.9,
    cache_working_set_fraction=0.2,
    rps_per_server=5_000,
)


def main() -> int:
    result = estimate(URL_SHORTENER)
    for s in result.steps:
        shown = human(s.value) if s.unit == "B" else f"{s.value:,.1f} {s.unit}"
        print(f"{s.name:<24} {shown:>18}    {s.formula}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
