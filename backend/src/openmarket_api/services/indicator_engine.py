# ruff: noqa: I001

from decimal import Decimal

from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import FinancialMetric, SeriesFrequency, SeriesUnit
from openmarket_api.domain.indicators import (
    IndicatorDefinition,
    IndicatorGroup,
    IndicatorGroupSummary,
    IndicatorHistory,
    IndicatorSummary,
    IndicatorValue,
)
from openmarket_api.services.asset_read import AssetReadService
from openmarket_api.services.financial_series import FinancialSeriesService


GROUP_LABELS: dict[IndicatorGroup, str] = {
    IndicatorGroup.EFFICIENCY: "Eficiência",
    IndicatorGroup.PROFITABILITY: "Rentabilidade",
    IndicatorGroup.LEVERAGE: "Endividamento",
    IndicatorGroup.GROWTH: "Crescimento",
}


INDICATOR_CATALOG: tuple[IndicatorDefinition, ...] = (
    IndicatorDefinition(
        slug="gross-margin",
        metric=FinancialMetric.GROSS_MARGIN,
        label="Margem Bruta",
        group=IndicatorGroup.EFFICIENCY,
        description="Lucro bruto como percentual da receita líquida.",
        unit=SeriesUnit.PERCENT,
        formula="gross_profit / revenue * 100",
    ),
    IndicatorDefinition(
        slug="operating-margin",
        metric=FinancialMetric.OPERATING_MARGIN,
        label="Margem Operacional",
        group=IndicatorGroup.EFFICIENCY,
        description="Resultado operacional como percentual da receita líquida.",
        unit=SeriesUnit.PERCENT,
        formula="operating_result / revenue * 100",
    ),
    IndicatorDefinition(
        slug="net-margin",
        metric=FinancialMetric.NET_MARGIN,
        label="Margem Líquida",
        group=IndicatorGroup.EFFICIENCY,
        description="Lucro líquido como percentual da receita líquida.",
        unit=SeriesUnit.PERCENT,
        formula="net_income / revenue * 100",
    ),
    IndicatorDefinition(
        slug="roe",
        metric=FinancialMetric.ROE,
        label="ROE",
        group=IndicatorGroup.PROFITABILITY,
        description="Retorno sobre o patrimônio líquido médio do período.",
        unit=SeriesUnit.PERCENT,
        formula="annual_net_income / average_equity * 100",
    ),
    IndicatorDefinition(
        slug="gross-debt",
        metric=FinancialMetric.GROSS_DEBT,
        label="Dívida Bruta",
        group=IndicatorGroup.LEVERAGE,
        description="Soma das dívidas financeiras de curto e longo prazo mapeadas.",
        unit=SeriesUnit.CURRENCY,
        formula="short_term_debt + long_term_debt",
    ),
    IndicatorDefinition(
        slug="net-debt",
        metric=FinancialMetric.NET_DEBT,
        label="Dívida Líquida",
        group=IndicatorGroup.LEVERAGE,
        description="Dívida bruta menos caixa e equivalentes.",
        unit=SeriesUnit.CURRENCY,
        formula="gross_debt - cash",
    ),
    IndicatorDefinition(
        slug="revenue-growth-yoy",
        metric=FinancialMetric.REVENUE_GROWTH_YOY,
        label="Crescimento da Receita",
        group=IndicatorGroup.GROWTH,
        description="Variação da receita contra o mesmo período do ano anterior.",
        unit=SeriesUnit.PERCENT,
        formula="(current / same_period_previous_year - 1) * 100",
    ),
)


class IndicatorEngine:
    def __init__(self, session: Session) -> None:
        self.assets = AssetReadService(session)
        self.series = FinancialSeriesService(session)

    @staticmethod
    def get_catalog() -> list[IndicatorDefinition]:
        return [definition.model_copy(deep=True) for definition in INDICATOR_CATALOG]

    @staticmethod
    def get_definition(slug: str) -> IndicatorDefinition:
        normalized_slug = slug.strip().lower()
        for definition in INDICATOR_CATALOG:
            if definition.slug == normalized_slug:
                return definition.model_copy(deep=True)
        raise LookupError(f"indicator not found for slug {slug}")

    def get_summary(
        self,
        ticker: str,
        *,
        frequency: SeriesFrequency = SeriesFrequency.ANNUAL,
    ) -> IndicatorSummary:
        normalized_ticker = ticker.strip().upper()
        self.assets.get_asset(normalized_ticker)

        grouped: dict[IndicatorGroup, list[IndicatorValue]] = {
            group: [] for group in GROUP_LABELS
        }

        for definition in INDICATOR_CATALOG:
            series = self.series.get_series(
                normalized_ticker,
                definition.metric,
                frequency=frequency,
            )
            latest = series.points[-1] if series.points else None
            payload = definition.model_dump()
            payload["formula"] = series.formula or definition.formula
            grouped[definition.group].append(
                IndicatorValue(
                    **payload,
                    value=latest.value if latest else None,
                    period_end=latest.period_end if latest else None,
                    source=latest.source if latest else None,
                    derived=latest.derived if latest else False,
                    history_points=len(series.points),
                )
            )

        return IndicatorSummary(
            ticker=normalized_ticker,
            frequency=frequency,
            groups=[
                IndicatorGroupSummary(
                    group=group,
                    label=label,
                    indicators=grouped[group],
                )
                for group, label in GROUP_LABELS.items()
            ],
        )

    def get_history(
        self,
        ticker: str,
        slug: str,
        *,
        years: int = 5,
        frequency: SeriesFrequency = SeriesFrequency.ANNUAL,
    ) -> IndicatorHistory:
        if years < 1:
            raise ValueError("years must be at least 1")

        normalized_ticker = ticker.strip().upper()
        self.assets.get_asset(normalized_ticker)
        definition = self.get_definition(slug)
        series = self.series.get_series(
            normalized_ticker,
            definition.metric,
            frequency=frequency,
        )

        points = series.points
        if points:
            latest_year = points[-1].period_end.year
            cutoff_year = latest_year - years + 1
            points = [point for point in points if point.period_end.year >= cutoff_year]

        average = None
        if points:
            average = sum((point.value for point in points), Decimal(0)) / Decimal(len(points))

        current = points[-1] if points else None
        resolved_definition = definition.model_copy(
            update={"formula": series.formula or definition.formula}
        )
        return IndicatorHistory(
            ticker=normalized_ticker,
            definition=resolved_definition,
            frequency=frequency,
            years=years,
            current_value=current.value if current else None,
            current_period=current.period_end if current else None,
            historical_average=average,
            points=points,
        )
