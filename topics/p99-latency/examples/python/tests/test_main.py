import pytest

from app.main import average_of_p99s, bucket_effect, bucket_p99, p99_spread, percentile, window_effect


def test_nearest_rank() -> None:
    values = [float(i) for i in range(1, 101)]
    assert percentile(values, 0.99) == 99
    assert percentile(values, 0.5) == 50


def test_empty_and_invalid_are_rejected() -> None:
    with pytest.raises(ValueError):
        percentile([], 0.5)
    with pytest.raises(ValueError):
        percentile([1.0], 0)


def test_mean_of_p99s_is_not_the_pooled_p99() -> None:
    r = average_of_p99s()
    assert r["true_pooled_p99_ms"] > r["mean_of_p99s_ms"] * 1.5


def test_more_samples_narrow_the_estimate() -> None:
    wide, narrow = p99_spread(100), p99_spread(10_000)
    assert narrow["high_95pct_ms"] - narrow["low_5pct_ms"] < wide["high_95pct_ms"] - wide["low_5pct_ms"]


def test_coarse_buckets_distort_the_answer() -> None:
    r = bucket_effect()
    assert abs(r["coarse_buckets_p99_ms"] - r["exact_p99_ms"]) > abs(r["fine_buckets_p99_ms"] - r["exact_p99_ms"])


def test_bucket_interpolation_stays_inside_bucket() -> None:
    assert 10 <= bucket_p99([11.0] * 100, [10, 100]) <= 100


def test_short_incident_is_invisible_in_hour_p99() -> None:
    r = window_effect()
    assert r["hour_p99_ms"] < 100 < r["incident_window_p50_ms"]
