import pytest

from openmarket_api.domain.analytics import FinancialMetric, SeriesUnit
from openmarket_api.domain.indicators import IndicatorDefinition, IndicatorGroup
from openmarket_api.services.indicator_registry import IndicatorRegistry, indicator_registry


def _definition(slug: str = "test-indicator") -> IndicatorDefinition:
    return IndicatorDefinition(
        slug=slug,
        label="Indicador de teste",
        group=IndicatorGroup.PROFITABILITY,
        description="Definição usada para validar o registry.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="net_income / equity * 100",
        dependencies=[FinancialMetric.NET_INCOME, FinancialMetric.EQUITY],
    )


def test_indicator_registry_rejects_duplicate_slugs() -> None:
    with pytest.raises(ValueError, match="duplicate indicator slug"):
        IndicatorRegistry(
            [_definition("same"), _definition("SAME")],
            {IndicatorGroup.PROFITABILITY: "Rentabilidade"},
        )


def test_indicator_registry_rejects_missing_group_label() -> None:
    with pytest.raises(ValueError, match="missing group label"):
        IndicatorRegistry([_definition()], {})


def test_indicator_registry_returns_defensive_copies() -> None:
    first = indicator_registry.get_definition("roe")
    first.dependencies.clear()

    second = indicator_registry.get_definition("ROE")

    assert second.dependencies == [FinancialMetric.NET_INCOME, FinancialMetric.EQUITY]
    assert second.group_label == "Rentabilidade"
    assert second.methodology_version == "1.0"


def test_indicator_registry_exposes_stable_group_order() -> None:
    assert indicator_registry.groups == (
        IndicatorGroup.EFFICIENCY,
        IndicatorGroup.PROFITABILITY,
        IndicatorGroup.LEVERAGE,
        IndicatorGroup.LIQUIDITY,
        IndicatorGroup.GROWTH,
    )


def test_indicator_registry_rejects_unknown_slug() -> None:
    with pytest.raises(LookupError, match="indicator not found"):
        indicator_registry.get_definition("does-not-exist")
