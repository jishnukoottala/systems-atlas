import pytest

from app.main import SAMPLE, Resource, analyze, classify, required_servers


def test_bottleneck_is_the_largest_effective_demand() -> None:
    r = analyze(SAMPLE, 300)
    assert r.bottleneck == "db_row_lock"
    assert r.max_throughput_rps == 400


def test_utilization_law() -> None:
    rows = {x.name: x for x in analyze(SAMPLE, 300).rows}
    assert rows["web_cpu"].utilization_pct == 30.0
    assert rows["db_row_lock"].utilization_pct == 75.0


def test_a_lock_can_be_the_limit_when_cpus_look_fine() -> None:
    rows = {x.name: x for x in analyze(SAMPLE, 450).rows}
    assert rows["db_row_lock"].status == "saturated"
    assert rows["app_cpu"].utilization_pct < 80


def test_response_floor_and_knee() -> None:
    r = analyze(SAMPLE, 300)
    assert r.min_response_ms == 45.5
    assert r.knee_concurrency == 18.2


def test_more_servers_cannot_fix_a_single_lock_without_splitting_it() -> None:
    needed = required_servers(SAMPLE, 1_000, 0.7)
    assert needed["db_row_lock"] == 4
    assert needed["app_cpu"] == 36


def test_classify_and_invalid_input() -> None:
    assert classify(1.0) == "saturated"
    with pytest.raises(ValueError):
        analyze([], 1)
    with pytest.raises(ValueError):
        required_servers([Resource(name="x", demand_ms=1)], 1, 0)
