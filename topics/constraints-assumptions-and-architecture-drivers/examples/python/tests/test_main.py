import pytest
from pydantic import ValidationError

from app.main import SAMPLE, Input, nodes_needed, sensitivity


def test_nodes_formula_rounds_up() -> None:
    # 5e6 x 30 / 86,400 = 1,736 rps mean; x 3 = 5,208 rps; / 1,000 = 5.2, so 6 nodes.
    assert nodes_needed(5e6, 30, 3, 1_000) == 6


def test_largest_swing_is_first_and_is_user_count() -> None:
    swings = sensitivity(SAMPLE, threshold=16)
    assert swings[0].name == "daily_active"
    assert swings[0].at_high == 21


def test_only_user_count_crosses_the_threshold() -> None:
    assert [s.name for s in sensitivity(SAMPLE, 16) if s.crosses_threshold] == ["daily_active"]


def test_inverse_input_still_gives_positive_spread() -> None:
    swing = next(s for s in sensitivity(SAMPLE, 16) if s.name == "rps_per_node")
    assert swing.at_low > swing.at_high and swing.spread > 0


def test_unordered_range_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Input(name="x", low=5, base=1, high=9)
