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
from openmarket_api.services.derived_indicator_series import (
    DerivedIndicatorSeriesService,
    IndicatorSeriesResult,
)
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
        format="percent_2",
        formula="gross_profit / revenue * 100",
        dependencies=[FinancialMetric.GROSS_PROFIT, FinancialMetric.REVENUE],
    ),
    IndicatorDefinition(
        slug="operating-margin",
        metric=FinancialMetric.OPERATING_MARGIN,
        label="Margem Operacional",
        group=IndicatorGroup.EFFICIENCY,
        description="Resultado operacional como percentual da receita líquida.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="operating_result / revenue * 100",
        dependencies=[FinancialMetric.OPERATING_RESULT, FinancialMetric.REVENUE],
    ),
    IndicatorDefinition(
        slug="net-margin",
        metric=FinancialMetric.NET_MARGIN,
        label="Margem Líquida",
        group=IndicatorGroup.EFFICIENCY,
        description="Lucro líquido como percentual da receita líquida.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="net_income / revenue * 100",
        dependencies=[FinancialMetric.NET_INCOME, FinancialMetric.REVENUE],
    ),
    IndicatorDefinition(
        slug="roe",
        metric=FinancialMetric.ROE,
        label="ROE",
        group=IndicatorGroup.PROFITABILITY,
        description="Retorno sobre o patrimônio líquido médio do período.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="annual_net_income / average_equity * 100",
        dependencies=[FinancialMetric.NET_INCOME, FinancialMetric.EQUITY],
        available_frequencies=[SeriesFrequency.ANNUAL],
    ),
    IndicatorDefinition(
        slug="roa",
        label="ROA",
        group=IndicatorGroup.PROFITABILITY,
        description="Retorno anual sobre a média dos ativos totais do período.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="annual_net_income / average_total_assets * 100",
        dependencies=[FinancialMetric.NET_INCOME, FinancialMetric.TOTAL_ASSETS],
        available_frequencies=[SeriesFrequency.ANNUAL],
    ),
    IndicatorDefinition(
        slug="gross-debt",
        metric=FinancialMetric.GROSS_DEBT,
        label="Dívida Bruta",
        group=IndicatorGroup.LEVERAGE,
        description="Soma das dívidas financeiras de curto e longo prazo mapeadas.",
        unit=SeriesUnit.CURRENCY,
        format="currency_compact",
        formula="short_term_debt + long_term_debt",
        dependencies=[FinancialMetric.SHORT_TERM_DEBT, FinancialMetric.LONG_TERM_DEBT],
    ),
    IndicatorDefinition(
        slug="net-debt",
        metric=FinancialMetric.NET_DEBT,
        label="Dívida Líquida",
        group=IndicatorGroup.LEVERAGE,
        description="Dívida bruta menos caixa e equivalentes.",
        unit=SeriesUnit.CURRENCY,
        format="currency_compact",
        formula="gross_debt - cash",
        dependencies=[
            FinancialMetric.SHORT_TERM_DEBT,
            FinancialMetric.LONG_TERM_DEBT,
            FinancialMetric.CASH,
        ],
    ),
    IndicatorDefinition(
        slug="net-debt-to-equity",
        label="Dívida Líquida / PL",
        group=IndicatorGroup.LEVERAGE,
        description="Dívida líquida como percentual do patrimônio líquido.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="net_debt / equity * 100",
        dependencies=[FinancialMetric.NET_DEBT, FinancialMetric.EQUITY],
    ),
    IndicatorDefinition(
        slug="gross-debt-to-equity",
        label="Dívida Bruta / PL",
        group=IndicatorGroup.LEVERAGE,
        description="Dívida bruta como percentual do patrimônio líquido.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="gross_debt / equity * 100",
        dependencies=[FinancialMetric.GROSS_DEBT, FinancialMetric.EQUITY],
    ),
    IndicatorDefinition(
        slug="equity-to-assets",
        label="Patrimônio / Ativos",
        group=IndicatorGroup.LEVERAGE,
        description="Participação do patrimônio líquido nos ativos totais.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="equity / total_assets * 100",
        dependencies=[FinancialMetric.EQUITY, FinancialMetric.TOTAL_ASSETS],
    ),
    IndicatorDefinition(
        slug="revenue-growth-yoy",
        metric=FinancialMetric.REVENUE_GROWTH_YOY,
        label="Crescimento da Receita",
        group=IndicatorGroup.GROWTH,
        description="Variação da receita contra o mesmo período do ano anterior.",
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="(current / same_period_previous_year - 1) * 100",
        dependencies=[FinancialMetric.REVENUE],
    ),
    IndicatorDefinition(
        slug="net-income-growth-yoy",
        label="Crescimento do Lucro",
        group=IndicatorGroup.GROWTH,
        description=(
            "Variação do lucro líquido contra o mesmo período do ano anterior; "
            "não é calculada quando a base anterior é nula ou negativa."
        ),
        unit=SeriesUnit.PERCENT,
        format="percent_2",
        formula="(current_net_income / same_period_previous_year - 1) * 100",
        dependencies=[FinancialMetric.NET_INCOME],
    ),
)


class IndicatorEngine:
    def __init__(self, session: Session) -> None:
        self.assets = AssetReadService(session)
        self.series = FinancialSeriesService(session)
        self.derived_series = DerivedIndicatorSeriesService(self.series)

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
            series = self._resolve_series(
                normalized_ticker,
                definition,
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
        series = self._resolve_series(
            normalized_ticker,
            definition,
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

    def _resolve_series(
        self,
        ticker: str,
        definition: IndicatorDefinition,
        *,
        frequency: SeriesFrequency,
    ) -> IndicatorSeriesResult:
        if frequency not in definition.available_frequencies:
            return IndicatorSeriesResult(formula=definition.formula, points=[])

        if definition.metric is not None:
            series = self.series.get_series(
                ticker,
                definition.metric,
                frequency=frequency,
            )
            return IndicatorSeriesResult(
                formula=series.formula or definition.formula,
                points=series.points,
            )

        return self.derived_series.get_series(
            ticker,
            definition,
            frequency=frequency,
        )
