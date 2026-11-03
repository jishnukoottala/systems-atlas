"""Discrete-event simulation of a server pool, separating throughput from goodput.

Throughput counts everything completed. Goodput counts only what finished before the client's
deadline. Under overload with an unbounded queue, throughput stays high while goodput collapses,
because servers spend their time on requests whose clients have already given up. A bounded queue
rejects the excess early and keeps goodput near capacity. The simulation is seeded and repeatable.
"""

from __future__ import annotations

import argparse
import heapq
import json
import random
from collections import deque

from pydantic import BaseModel, Field


class Config(BaseModel):
    workers: int = Field(default=10, gt=0)
    service_ms: float = Field(default=10, gt=0)
    deadline_ms: float = Field(default=200, gt=0)
    duration_s: float = Field(default=30, gt=0)
    queue_limit: int | None = Field(default=None, ge=0)
    seed: int = 11


class Result(BaseModel):
    offered_rps: float
    throughput_rps: float
    goodput_rps: float
    rejected_rps: float
    mean_response_ms: float


def simulate(offered_rps: float, cfg: Config) -> Result:
    if offered_rps <= 0:
        raise ValueError("offered_rps must be positive")
    rng = random.Random(cfg.seed)
    end_ms = cfg.duration_s * 1_000
    queue: deque[float] = deque()
    finish: list[float] = []  # min-heap of worker completion times
    t = 0.0
    completed = good = rejected = 0
    total_response = 0.0

    def start_ready(now: float) -> None:
        nonlocal completed, good, total_response
        while queue and len(finish) < cfg.workers:
            arrived = queue.popleft()
            done = now + rng.expovariate(1 / cfg.service_ms)
            heapq.heappush(finish, done)
            if done <= end_ms:
                completed += 1
                total_response += done - arrived
                if done - arrived <= cfg.deadline_ms:
                    good += 1

    while t < end_ms:
        t += rng.expovariate(offered_rps / 1_000)
        while finish and finish[0] <= t:
            now = heapq.heappop(finish)
            start_ready(now)
        if cfg.queue_limit is not None and len(queue) >= cfg.queue_limit and len(finish) >= cfg.workers:
            rejected += 1
            continue
        queue.append(t)
        start_ready(t)

    seconds = cfg.duration_s
    return Result(
        offered_rps=offered_rps,
        throughput_rps=round(completed / seconds, 1),
        goodput_rps=round(good / seconds, 1),
        rejected_rps=round(rejected / seconds, 1),
        mean_response_ms=round(total_response / completed, 1) if completed else 0.0,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queue-limit", type=int, default=None)
    args = parser.parse_args(argv)
    cfg = Config(queue_limit=args.queue_limit)
    # 10 workers at 10 ms each: capacity is 1,000 requests per second.
    for load in (250, 500, 800, 950, 1_100, 1_500, 3_000):
        print(simulate(load, cfg).model_dump_json())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
