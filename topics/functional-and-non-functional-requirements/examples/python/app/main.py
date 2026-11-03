"""Evaluate measured evidence against quality requirements and report which ones hold.

Requirements are only useful if they can be checked after launch. This command-line tool models
each requirement as a comparison over a measurement and refuses evidence gathered under less load
than the requirement specifies, since that evidence proves nothing.
"""

from __future__ import annotations

import argparse
import json
import logging
import operator
import sys
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

log = logging.getLogger("requirements")

Comparison = Literal["<=", ">="]
Verdict = Literal["met", "violated", "inconclusive", "no-evidence"]
OPS = {"<=": operator.le, ">=": operator.ge}


class QualityRequirement(BaseModel):
    id: str
    metric: str
    comparison: Comparison
    target: float
    unit: str
    window_days: int = Field(gt=0)
    min_load_rps: float = Field(ge=0)


class Measurement(BaseModel):
    metric: str
    value: float
    window_days: int = Field(gt=0)
    load_rps: float = Field(ge=0)


class Spec(BaseModel):
    requirements: list[QualityRequirement]
    measurements: list[Measurement]


class Result(BaseModel):
    id: str
    verdict: Verdict
    detail: str


def evaluate(req: QualityRequirement, measurements: list[Measurement]) -> Result:
    candidates = [m for m in measurements if m.metric == req.metric]
    if not candidates:
        return Result(id=req.id, verdict="no-evidence", detail=f"nothing measures {req.metric}")
    usable = [
        m for m in candidates if m.window_days >= req.window_days and m.load_rps >= req.min_load_rps
    ]
    if not usable:
        return Result(
            id=req.id,
            verdict="inconclusive",
            detail=f"evidence is below {req.min_load_rps} rps or shorter than {req.window_days} days",
        )
    # Judge on the worst qualifying measurement: one good run does not cancel out a bad one.
    pick = max if req.comparison == "<=" else min
    worst = pick(m.value for m in usable)
    ok = OPS[req.comparison](worst, req.target)
    return Result(
        id=req.id,
        verdict="met" if ok else "violated",
        detail=f"worst {worst} {req.unit} against {req.comparison} {req.target} {req.unit}",
    )


def evaluate_all(spec: Spec) -> list[Result]:
    return [evaluate(r, spec.measurements) for r in spec.requirements]


SAMPLE = {
    "requirements": [
        {"id": "Q-LAT", "metric": "checkout_p99_ms", "comparison": "<=", "target": 300, "unit": "ms",
         "window_days": 28, "min_load_rps": 2000},
        {"id": "Q-AVL", "metric": "checkout_success_pct", "comparison": ">=", "target": 99.95, "unit": "%",
         "window_days": 28, "min_load_rps": 0},
        {"id": "Q-RPO", "metric": "replication_lag_s", "comparison": "<=", "target": 5, "unit": "s",
         "window_days": 7, "min_load_rps": 0},
    ],
    "measurements": [
        {"metric": "checkout_p99_ms", "value": 240, "window_days": 28, "load_rps": 400},
        {"metric": "checkout_success_pct", "value": 99.91, "window_days": 28, "load_rps": 1500},
    ],
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, help="JSON spec; uses a built-in sample when omitted")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format='{"level":"%(levelname)s","msg":"%(message)s"}')
    try:
        raw = json.loads(args.file.read_text()) if args.file else SAMPLE
        spec = Spec.model_validate(raw)
    except (OSError, json.JSONDecodeError, ValidationError) as exc:
        log.error("invalid spec: %s", type(exc).__name__)
        print(exc, file=sys.stderr)
        return 2
    results = evaluate_all(spec)
    print(json.dumps([r.model_dump() for r in results], indent=2))
    return 0 if all(r.verdict == "met" for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
