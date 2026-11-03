from app.main import SAMPLE, Measurement, QualityRequirement, Spec, evaluate, evaluate_all, main


def req(**kw) -> QualityRequirement:
    base = dict(id="Q", metric="m", comparison="<=", target=10, unit="ms", window_days=7, min_load_rps=100)
    return QualityRequirement(**(base | kw))


def meas(value: float, load: float = 100, days: int = 7) -> Measurement:
    return Measurement(metric="m", value=value, window_days=days, load_rps=load)


def test_evidence_below_required_load_is_inconclusive() -> None:
    assert evaluate(req(), [meas(1, load=50)]).verdict == "inconclusive"


def test_short_window_is_inconclusive() -> None:
    assert evaluate(req(), [meas(1, days=1)]).verdict == "inconclusive"


def test_worst_measurement_decides() -> None:
    assert evaluate(req(), [meas(5), meas(11)]).verdict == "violated"


def test_lower_bound_uses_minimum() -> None:
    r = req(comparison=">=", target=99.9)
    assert evaluate(r, [meas(99.95), meas(99.0)]).verdict == "violated"


def test_sample_reports_all_four_outcomes_except_met() -> None:
    verdicts = {r.id: r.verdict for r in evaluate_all(Spec.model_validate(SAMPLE))}
    assert verdicts == {"Q-LAT": "inconclusive", "Q-AVL": "violated", "Q-RPO": "no-evidence"}


def test_exit_code_signals_unmet_requirements() -> None:
    assert main([]) == 1
