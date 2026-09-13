from sqlalchemy.orm import Session

from openmarket_api.domain import analytics, indicators
from openmarket_api.services import asset_read, financial_series


GROUP_LABELS: dict[indicators.IndicatorGroup, str] = {
    indicators.IndicatorGroup.EFFICIENCY: "Eficiência",
    indicators.IndicatorGroup.PROFITABILITY: "Rentabilidade",
    indicators.IndicatorGroup.LEVERAGE: "Endividamento",
    indicators.IndicatorGroup.GROWTH: "Crescimento",
}


INDICATOR_CATALOG: tuple[indicators.IndicatorDefinition, ...] = (
    indicators.IndicatorDefinition(
        slug="gross-margin",
        metric=analytics.FinancialMetric.GROSS_MARGIN,
        label="Margem Bruta",
        group=indicators.IndicatorGroup.EFFICIENCY,
        description="Lucro bruto como percentual da receita líquida.",
        unit=analytics.SeriesUnit.PERCENT,
        formula="gross_profit / revenue * 100",
    ),
    indicators.IndicatorDefinition(
        slug="operating-margin",
        metric=analytics.FinancialMetric.OPERATING_MARGIN,
        label="Margem Operacional",
        group=indicators.IndicatorGroup.EFFICIENCY,
        description="Resultado operacional como percentual da receita líquida.",
        unit=analytics.SeriesUnit.PERCENT,
        formula="operating_result / revenue * 100",
    ),
    indicators.IndicatorDefinition(
        slug="net-margin",
        metric=analytics.FinancialMetric.NET_MARGIN,
        label="Margem Líquida",
        group=indicators.IndicatorGroup.EFFICIENCY,
        description="Lucro líquido como percentual da receita líquida.",
        unit=analytics.SeriesUnit.PERCENT,
        formula="net_income / revenue * 100",
    ),
    indicators.IndicatorDefinition(
        slug="roe",
        metric=analytics.FinancialMetric.ROE,
        label="ROE",
        group=indicators.IndicatorGroup.PROFITABILITY,
        description="Retorno sobre o patrimônio líquido médio do período.",
        unit=analytics.SeriesUnit.PERCENT,
        formula="annual_net_income / average_equity * 100",
    ),
    indicators.IndicatorDefinition(
        slug="gross-debt",
        metric=analytics.FinancialMetric.GROSS_DEBT,
        label="Dívida Bruta",
        group=indicators.IndicatorGroup.LEVERAGE,
        description="Soma das dívidas financeiras de curto e longo prazo mapeadas.",
        unit=analytics.SeriesUnit.CURRENCY,
        formula="short_term_debt + long_term_debt",
    ),
    indicators.IndicatorDefinition(
        slug="net-debt",
        metric=analytics.FinancialMetric.NET_DEBT,
        label="Dívida Líquida",
        group=indicators.IndicatorGroup.LEVERAGE,
        description="Dívida bruta menos caixa e equivalentes.",
        unit=analytics.SeriesUnit.CURRENCY,
        formula="gross_debt - cash",
    ),
    indicators.IndicatorDefinition(
        slug="revenue-growth-yoy",
        metric=analytics.FinancialMetric.REVENUE_GROWTH_YOY,
        label="Crescimento da Receita",
        group=indicators.IndicatorGroup.GROWTH,
        description="Variação da receita contra o mesmo período do ano anterior.",
        unit=analytics.SeriesUnit.PERCENT,
        formula="(current / same_period_previous_year - 1) * 100",
    ),
)


class IndicatorEngine:
    def __init__(self, session: Session) -> None:
        self.assets = asset_read.AssetReadService(session)
        self.series = financial_series.FinancialSeriesService(session)

    @staticmethod
    def get_catalog() -> list[indicators.IndicatorDefinition]:
        return [definition.model_copy(deep=True) for definition in INDICATOR_CATALOG]

    def get_summary(
        self,
        ticker: str,
        *,
        frequency: analytics.SeriesFrequency = analytics.SeriesFrequency.ANNUAL,
    ) -> indicators.IndicatorSummary:
        normalized_ticker = ticker.strip().upper()
        self.assets.get_asset(normalized_ticker)

        grouped: dict[indicators.IndicatorGroup, list[indicators.IndicatorValue]] = {
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
                indicators.IndicatorValue(
                    **payload,
                    value=latest.value if latest else None,
                    period_end=latest.period_end if latest else None,
                    source=latest.source if latest else None,
                    derived=latest.derived if latest else False,
                    history_points=len(series.points),
                )
            )

        return indicators.IndicatorSummary(
            ticker=normalized_ticker,
            frequency=frequency,
            groups=[
                indicators.IndicatorGroupSummary(
                    group=group,
                    label=label,
                    indicators=grouped[group],
                )
                for group, label in GROUP_LABELS.items()
            ],
        )
