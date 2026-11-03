import pytest

from app.main import Leaf, fan_out, hedged, partial, predicted_hedged_slow_fraction, predicted_slow_fraction


def test_prediction_matches_formula() -> None:
    assert predicted_slow_fraction(100, 0.01) == pytest.approx(0.634, abs=0.001)


def test_fan_out_moves_the_median_into_the_tail() -> None:
    leaf = Leaf()
    assert fan_out(5_000, 1, leaf).p50_ms < 15
    assert fan_out(5_000, 100, leaf).p50_ms > 500


def test_hedging_fixes_most_requests_with_small_extra_load() -> None:
    leaf = Leaf()
    plain, hedge = fan_out(20_000, 100, leaf), hedged(20_000, 100, leaf, 50)
    assert plain.over_100ms_pct > 60
    assert hedge.over_100ms_pct < 2
    assert hedge.p95_ms < 100 < plain.p95_ms
    assert 0 < hedge.extra_load_pct < 3


def test_hedging_leaves_a_residue_near_the_predicted_fraction() -> None:
    hedge = hedged(20_000, 100, Leaf(), 50)
    assert hedge.over_100ms_pct == pytest.approx(100 * predicted_hedged_slow_fraction(100, 0.01), abs=0.4)


def test_partial_results_bound_latency_and_lose_completeness() -> None:
    r = partial(5_000, 100, Leaf(), 50)
    assert r.p999_ms <= 50
    assert 98 < r.mean_completeness_pct < 100
