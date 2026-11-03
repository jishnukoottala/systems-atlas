import pytest

from app.main import GeneratorConfig, characterize, generate, percentile


def small(**kw) -> GeneratorConfig:
    return GeneratorConfig(**({"duration_s": 600, "mean_rps": 20, "keys": 2_000, "burst_at_s": 300} | kw))


def test_generation_is_deterministic() -> None:
    assert generate(small())[:50] == generate(small())[:50]


def test_read_ratio_is_recovered() -> None:
    assert characterize(generate(small())).read_ratio == pytest.approx(0.9, abs=0.02)


def test_burst_raises_peak_to_mean() -> None:
    plain = characterize(generate(small(burst_multiplier=1)))
    burst = characterize(generate(small(burst_multiplier=5)))
    assert burst.peak_to_mean > plain.peak_to_mean * 2


def test_skew_concentrates_traffic() -> None:
    uniform = characterize(generate(small(zipf_s=0)))
    skewed = characterize(generate(small(zipf_s=1.0)))
    assert skewed.top_1pct_key_share > 0.3 > uniform.top_1pct_key_share


def test_percentile_uses_nearest_rank() -> None:
    assert percentile([1, 2, 3, 4], 0.5) == 2
    assert percentile([1, 2, 3, 4], 0.99) == 4


def test_empty_trace_is_rejected() -> None:
    with pytest.raises(ValueError):
        characterize([])
