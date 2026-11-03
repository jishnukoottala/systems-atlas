import pytest

from app.main import Hop, breakdown, md1_queueing_ms, propagation_ms, rtts_to_first_byte, transmission_ms


def test_propagation_includes_route_factor() -> None:
    assert propagation_ms(1_000) == pytest.approx(7.0)
    assert propagation_ms(1_000, route_factor=1.0) == pytest.approx(5.0)


def test_transmission_of_a_megabyte_at_100_mbps_is_80_ms() -> None:
    assert transmission_ms(1_000_000, 100) == pytest.approx(80.0)


def test_queueing_grows_nonlinearly() -> None:
    assert md1_queueing_ms(0.5, 10) == pytest.approx(5.0)
    assert md1_queueing_ms(0.9, 10) == pytest.approx(45.0)
    assert md1_queueing_ms(0.99, 10) == pytest.approx(495.0)


def test_connection_reuse_saves_round_trips() -> None:
    assert rtts_to_first_byte(80) == 240
    assert rtts_to_first_byte(80, tls13=False) == 320
    assert rtts_to_first_byte(80, reused=True) == 80


def test_breakdown_sums_components() -> None:
    b = breakdown(Hop(distance_km=1_000, bandwidth_mbps=100, payload_bytes=1_000_000, processing_ms=2, utilization=0.5, service_ms=10))
    assert b.total_ms == pytest.approx(7 + 80 + 2 + 5)


def test_full_utilization_is_rejected() -> None:
    with pytest.raises(ValueError):
        Hop(distance_km=1, bandwidth_mbps=1, payload_bytes=1, utilization=1.0)
