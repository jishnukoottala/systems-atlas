"""Calculate one-way network latency from physics, to show what no design can buy back.

Latency = propagation + transmission + processing + queueing. The speed of light in fiber sets a
hard floor on propagation, and that floor is often the deciding number in a multi-region design.
"""

from __future__ import annotations

import argparse
import json

from pydantic import BaseModel, Field

FIBER_KM_PER_MS = 200.0  # about two-thirds of c in vacuum
ROUTE_FACTOR = 1.4  # illustrative: real fiber paths are longer than the great-circle distance


class Hop(BaseModel):
    distance_km: float = Field(ge=0)
    bandwidth_mbps: float = Field(gt=0)
    payload_bytes: int = Field(ge=0)
    processing_ms: float = Field(default=0.0, ge=0)
    utilization: float = Field(default=0.0, ge=0, lt=1)
    service_ms: float = Field(default=0.0, ge=0)


class Breakdown(BaseModel):
    propagation_ms: float
    transmission_ms: float
    processing_ms: float
    queueing_ms: float
    total_ms: float


def propagation_ms(distance_km: float, route_factor: float = ROUTE_FACTOR) -> float:
    return distance_km * route_factor / FIBER_KM_PER_MS


def transmission_ms(payload_bytes: int, bandwidth_mbps: float) -> float:
    return payload_bytes * 8 / (bandwidth_mbps * 1_000)


def md1_queueing_ms(utilization: float, service_ms: float) -> float:
    """Mean M/D/1 wait: rho / (2 * (1 - rho)) * service time. Grows sharply as rho nears 1."""
    return utilization / (2 * (1 - utilization)) * service_ms


def breakdown(hop: Hop) -> Breakdown:
    prop = propagation_ms(hop.distance_km)
    tx = transmission_ms(hop.payload_bytes, hop.bandwidth_mbps)
    queue = md1_queueing_ms(hop.utilization, hop.service_ms)
    total = prop + tx + hop.processing_ms + queue
    return Breakdown(
        propagation_ms=round(prop, 3), transmission_ms=round(tx, 3),
        processing_ms=hop.processing_ms, queueing_ms=round(queue, 3), total_ms=round(total, 3),
    )


def rtts_to_first_byte(rtt_ms: float, *, tls13: bool = True, reused: bool = False) -> float:
    """Time to first response byte, in milliseconds: TCP handshake, TLS, then request and response."""
    if reused:
        return rtt_ms
    return rtt_ms * (1 + (1 if tls13 else 2) + 1)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--km", type=float, default=5_600, help="distance; default is roughly New York to London")
    parser.add_argument("--mbps", type=float, default=100)
    parser.add_argument("--bytes", type=int, default=1_000_000)
    args = parser.parse_args(argv)
    hop = Hop(distance_km=args.km, bandwidth_mbps=args.mbps, payload_bytes=args.bytes)
    rtt = 2 * propagation_ms(args.km)
    print(json.dumps({
        "one_way": breakdown(hop).model_dump(),
        "rtt_floor_ms": round(rtt, 1),
        "first_byte_new_tls13_ms": round(rtts_to_first_byte(rtt), 1),
        "first_byte_reused_ms": round(rtts_to_first_byte(rtt, reused=True), 1),
        "queueing_ms_at_utilization": {
            str(u): round(md1_queueing_ms(u, 10), 1) for u in (0.5, 0.8, 0.9, 0.95, 0.99)
        },
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
