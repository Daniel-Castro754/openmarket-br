from decimal import Decimal

from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import SeriesFrequency
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
from openmarket_api.services.indicator_registry import indicator_registry
from openmarket_api.services.liquidity_series import LiquidityFinancialSeriesService


class IndicatorEngine:
    def __init__(self, session: Session) -> None:
        self.assets = AssetReadService(session)
        self.series = LiquidityFinancialSeriesService(session)
        self.derived_series = DerivedIndicatorSeriesService(self.series)

    def get_summary(
        self,
        ticker: str,
        *,
        frequency: SeriesFrequency = SeriesFrequency.ANNUAL,
    ) -> IndicatorSummary:
        normalized_ticker = ticker.strip().upper()
        self.assets.get_asset(normalized_ticker)

        grouped: dict[IndicatorGroup, list[IndicatorValue]] = {
            group: [] for group in indicator_registry.groups
        }

        for definition in indicator_registry.get_catalog():
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
                    label=indicator_registry.get_group_label(group),
                    indicators=grouped[group],
                )
                for group in indicator_registry.groups
            ],
        )

    def get_resolved_series(
        self,
        ticker: str,
        slug: str,
        *,
        frequency: SeriesFrequency = SeriesFrequency.ANNUAL,
    ) -> tuple[str, IndicatorDefinition, IndicatorSeriesResult]:
        normalized_ticker = ticker.strip().upper()
        self.assets.get_asset(normalized_ticker)
        definition = indicator_registry.get_definition(slug)
        series = self.resolve_definition_series(
            normalized_ticker,
            definition,
            frequency=frequency,
        )
        resolved_definition = definition.model_copy(
            update={"formula": series.formula or definition.formula}
        )
        return normalized_ticker, resolved_definition, series

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

        normalized_ticker, resolved_definition, series = self.get_resolved_series(
            ticker,
            slug,
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

    def resolve_definition_series(
        self,
        ticker: str,
        definition: IndicatorDefinition,
        *,
        frequency: SeriesFrequency,
    ) -> IndicatorSeriesResult:
        return self._resolve_series(
            ticker.strip().upper(),
            definition,
            frequency=frequency,
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
