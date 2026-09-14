from decimal import Decimal

import pytest

from openmarket_api.api.routes.screener import _matches_filter, _parse_filter
from openmarket_api.domain.analytics import FinancialMetric


def test_parse_filter_accepts_supported_metric_and_operator() -> None:
    parsed = _parse_filter("roe:gte:15.5")

    assert parsed.metric is FinancialMetric.ROE
    assert parsed.operator == "gte"
    assert parsed.value == Decimal("15.5")


def test_parse_filter_accepts_current_ratio() -> None:
    parsed = _parse_filter("current_ratio:gte:1.25")

    assert parsed.metric is FinancialMetric.CURRENT_RATIO
    assert parsed.operator == "gte"
    assert parsed.value == Decimal("1.25")


def test_parse_filter_accepts_decimal_comma() -> None:
    parsed = _parse_filter("net_margin:lt:12,75")

    assert parsed.value == Decimal("12.75")


@pytest.mark.parametrize(
    ("raw_filter", "message"),
    [
        ("roe", "formato"),
        ("unknown:gte:10", "Indicador"),
        ("roe:eq:10", "Operador"),
        ("roe:gte:not-a-number", "Valor"),
    ],
)
def test_parse_filter_rejects_invalid_expressions(raw_filter: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        _parse_filter(raw_filter)


@pytest.mark.parametrize(
    ("value", "expression", "expected"),
    [
        (Decimal(20), "roe:gt:15", True),
        (Decimal(15), "roe:gt:15", False),
        (Decimal(15), "roe:gte:15", True),
        (Decimal(9), "roe:lt:10", True),
        (Decimal(10), "roe:lte:10", True),
        (None, "roe:gte:0", False),
    ],
)
def test_matches_filter(value: Decimal | None, expression: str, expected: bool) -> None:
    assert _matches_filter(value, _parse_filter(expression)) is expected
