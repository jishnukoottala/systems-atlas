import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import URL_SHORTENER, Workload, app, estimate, human

client = TestClient(app)


def value(result, name: str) -> float:
    return next(s.value for s in result.steps if s.name == name)


def test_url_shortener_rates() -> None:
    r = estimate(URL_SHORTENER)
    assert value(r, "mean writes") == pytest.approx(115.741, abs=0.01)
    assert value(r, "mean reads") == pytest.approx(11_574.074, abs=0.01)
    assert r.summary["peak_total_rps"] == pytest.approx(35_069.4, abs=0.1)


def test_url_shortener_storage_is_about_27_tb() -> None:
    assert estimate(URL_SHORTENER).summary["stored_bytes"] == pytest.approx(2.7375e13, rel=0.001)


def test_cache_hit_ratio_reduces_database_reads() -> None:
    assert estimate(URL_SHORTENER).summary["peak_db_reads_rps"] == pytest.approx(3_472.2, abs=0.1)


def test_failure_capacity_is_applied_after_headroom() -> None:
    r = estimate(URL_SHORTENER)
    assert value(r, "surviving one zone") == pytest.approx(value(r, "servers at capacity") / 0.7 * 1.5, rel=0.001)


def test_no_traffic_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Workload(daily_active_users=1, writes_per_user_per_day=0, reads_per_user_per_day=0, object_size_bytes=1, response_size_bytes=1)


def test_human_units() -> None:
    assert human(2.7375e13) == "27.4 TB"


def test_http_validation_and_success() -> None:
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.post("/estimate", json={"daily_active_users": -1}).status_code == 422
    ok = client.post("/estimate", json=URL_SHORTENER.model_dump())
    assert ok.status_code == 200 and ok.json()["summary"]["servers"] == 16
