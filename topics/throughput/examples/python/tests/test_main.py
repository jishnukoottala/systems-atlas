import pytest

from app.main import Config, simulate


def test_below_capacity_throughput_tracks_offered_load() -> None:
    r = simulate(500, Config())
    assert r.throughput_rps == pytest.approx(500, rel=0.05)
    assert r.goodput_rps == pytest.approx(r.throughput_rps, rel=0.01)


def test_throughput_plateaus_near_capacity() -> None:
    r = simulate(3_000, Config())
    assert r.throughput_rps == pytest.approx(1_000, rel=0.05)


def test_unbounded_queue_collapses_goodput() -> None:
    r = simulate(1_500, Config())
    assert r.goodput_rps < r.throughput_rps * 0.1
    assert r.mean_response_ms > 1_000


def test_bounded_queue_preserves_goodput_under_overload() -> None:
    r = simulate(1_500, Config(queue_limit=50))
    assert r.goodput_rps > 900
    assert r.rejected_rps > 400


def test_same_seed_is_repeatable() -> None:
    assert simulate(800, Config()) == simulate(800, Config())


def test_invalid_load_is_rejected() -> None:
    with pytest.raises(ValueError):
        simulate(0, Config())
