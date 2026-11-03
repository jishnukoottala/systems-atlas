from app.main import DEPS, correlated_sequential, own_p99, parallel, sequential, with_deadline

N = 30_000


def test_sum_of_p99s_overstates_independent_sequential_p99() -> None:
    total = sum(own_p99(d, N, 7) for d in DEPS)
    assert sequential(DEPS, N).p99_ms < total * 0.85


def test_correlation_pushes_the_tail_past_the_sum() -> None:
    total = sum(own_p99(d, N, 7) for d in DEPS)
    assert correlated_sequential(DEPS, N, 0.02, 4).p99_ms > total


def test_parallel_is_at_least_the_slowest_member() -> None:
    slowest = max(own_p99(d, N, 7) for d in DEPS)
    assert parallel(DEPS, N).p99_ms >= slowest * 0.95


def test_a_deadline_bounds_time_spent() -> None:
    r = with_deadline(DEPS, 200, N)
    assert r["max_spent_ms"] <= 200
    assert r["success_pct"] < with_deadline(DEPS, 300, N)["success_pct"]
