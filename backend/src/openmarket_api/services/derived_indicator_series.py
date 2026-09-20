from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from openmarket_api.domain.analytics import (
    CalculationInput,
    FinancialMetric,
    FinancialSeries,
    FinancialSeriesPoint,
    SeriesFrequency,
)
from openmarket_api.domain.common import DataQuality, SourceMetadata
from openmarket_api.domain.indicators import IndicatorDefinition
from openmarket_api.services.financial_series import FinancialSeriesService


@dataclass(frozen=True)
class IndicatorSeriesResult:
    formula: str | None
    points: list[FinancialSeriesPoint]


class DerivedIndicatorSeriesService:
    def __init__(self, financial_series: FinancialSeriesService) -> None:
        self.financial_series = financial_series

    def get_series(
        self,
        ticker: str,
        definition: IndicatorDefinition,
        *,
        frequency: SeriesFrequency,
    ) -> IndicatorSeriesResult:
        if frequency not in definition.available_frequencies:
            return IndicatorSeriesResult(formula=definition.formula, points=[])

        if definition.slug == "roa":
            return self._average_balance_return(
                ticker,
                definition,
                numerator=FinancialMetric.NET_INCOME,
                balance=FinancialMetric.TOTAL_ASSETS,
                frequency=frequency,
            )
        if definition.slug == "net-debt-to-equity":
            return self._same_period_ratio(
                ticker,
                definition,
                numerator=FinancialMetric.NET_DEBT,
                denominator=FinancialMetric.EQUITY,
                frequency=frequency,
            )
        if definition.slug == "gross-debt-to-equity":
            return self._same_period_ratio(
                ticker,
                definition,
                numerator=FinancialMetric.GROSS_DEBT,
                denominator=FinancialMetric.EQUITY,
                frequency=frequency,
            )
        if definition.slug == "equity-to-assets":
            return self._same_period_ratio(
                ticker,
                definition,
                numerator=FinancialMetric.EQUITY,
                denominator=FinancialMetric.TOTAL_ASSETS,
                frequency=frequency,
            )
        if definition.slug == "net-income-growth-yoy":
            return self._growth_yoy(
                ticker,
                definition,
                base_metric=FinancialMetric.NET_INCOME,
                frequency=frequency,
            )
        raise ValueError(f"unsupported derived indicator: {definition.slug}")

    def _same_period_ratio(
        self,
        ticker: str,
        definition: IndicatorDefinition,
        *,
        numerator: FinancialMetric,
        denominator: FinancialMetric,
        frequency: SeriesFrequency,
    ) -> IndicatorSeriesResult:
        numerator_series = self.financial_series.get_series(
            ticker,
            numerator,
            frequency=frequency,
        )
        denominator_series = self.financial_series.get_series(
            ticker,
            denominator,
            frequency=frequency,
        )
        denominator_by_period = {
            point.period_end: point for point in denominator_series.points
        }

        points: list[FinancialSeriesPoint] = []
        for numerator_point in numerator_series.points:
            denominator_point = denominator_by_period.get(numerator_point.period_end)
            if denominator_point is None or denominator_point.value == 0:
                continue
            if not self._same_reporting_context(numerator_point, denominator_point):
                continue

            inputs = self._merge_input_sources(numerator_point, denominator_point)
            points.append(
                FinancialSeriesPoint(
                    period_start=numerator_point.period_start,
                    period_end=numerator_point.period_end,
                    value=(numerator_point.value / denominator_point.value) * Decimal(100),
                    currency=None,
                    filing_reference_date=numerator_point.filing_reference_date,
                    source=self._calculation_source(
                        definition.label,
                        inputs,
                        numerator_point.filing_reference_date,
                    ),
                    derived=True,
                    derivation=definition.formula,
                    input_sources=inputs,
                    calculation_inputs=[
                        *self._calculation_inputs(numerator_series, numerator_point),
                        *self._calculation_inputs(denominator_series, denominator_point),
                    ],
                )
            )

        return IndicatorSeriesResult(formula=definition.formula, points=points)

    def _average_balance_return(
        self,
        ticker: str,
        definition: IndicatorDefinition,
        *,
        numerator: FinancialMetric,
        balance: FinancialMetric,
        frequency: SeriesFrequency,
    ) -> IndicatorSeriesResult:
        if frequency != SeriesFrequency.ANNUAL:
            return IndicatorSeriesResult(formula=definition.formula, points=[])

        numerator_series = self.financial_series.get_series(
            ticker,
            numerator,
            frequency=frequency,
        )
        balance_series = self.financial_series.get_series(
            ticker,
            balance,
            frequency=frequency,
        )
        balance_by_period = {point.period_end: point for point in balance_series.points}

        points: list[FinancialSeriesPoint] = []
        for numerator_point in numerator_series.points:
            current_balance = balance_by_period.get(numerator_point.period_end)
            previous_balance = balance_by_period.get(
                date(
                    numerator_point.period_end.year - 1,
                    numerator_point.period_end.month,
                    numerator_point.period_end.day,
                )
            )
            if current_balance is None or previous_balance is None:
                continue
            if not self._same_reporting_context(numerator_point, current_balance):
                continue

            average_balance = (current_balance.value + previous_balance.value) / Decimal(2)
            if average_balance == 0:
                continue

            inputs = self._merge_input_sources(
                previous_balance,
                current_balance,
                numerator_point,
            )
            points.append(
                FinancialSeriesPoint(
                    period_start=numerator_point.period_start,
                    period_end=numerator_point.period_end,
                    value=(numerator_point.value / average_balance) * Decimal(100),
                    currency=None,
                    filing_reference_date=numerator_point.filing_reference_date,
                    source=self._calculation_source(
                        definition.label,
                        inputs,
                        numerator_point.filing_reference_date,
                    ),
                    derived=True,
                    derivation=definition.formula,
                    input_sources=inputs,
                    calculation_inputs=[
                        *self._calculation_inputs(balance_series, previous_balance),
                        *self._calculation_inputs(balance_series, current_balance),
                        *self._calculation_inputs(numerator_series, numerator_point),
                    ],
                )
            )

        return IndicatorSeriesResult(formula=definition.formula, points=points)

    def _growth_yoy(
        self,
        ticker: str,
        definition: IndicatorDefinition,
        *,
        base_metric: FinancialMetric,
        frequency: SeriesFrequency,
    ) -> IndicatorSeriesResult:
        base = self.financial_series.get_series(
            ticker,
            base_metric,
            frequency=frequency,
        )
        by_period = {
            (point.period_end.year, point.period_end.month, point.period_end.day): point
            for point in base.points
        }

        points: list[FinancialSeriesPoint] = []
        for point in base.points:
            previous = by_period.get(
                (point.period_end.year - 1, point.period_end.month, point.period_end.day)
            )
            if previous is None or previous.value <= 0:
                continue

            inputs = self._merge_input_sources(previous, point)
            points.append(
                FinancialSeriesPoint(
                    period_start=point.period_start,
                    period_end=point.period_end,
                    value=((point.value / previous.value) - Decimal(1)) * Decimal(100),
                    currency=None,
                    filing_reference_date=point.filing_reference_date,
                    source=self._calculation_source(
                        definition.label,
                        inputs,
                        point.filing_reference_date,
                    ),
                    derived=True,
                    derivation=definition.formula,
                    input_sources=inputs,
                    calculation_inputs=[
                        *self._calculation_inputs(base, previous),
                        *self._calculation_inputs(base, point),
                    ],
                )
            )

        return IndicatorSeriesResult(formula=definition.formula, points=points)

    @classmethod
    def _calculation_inputs(
        cls,
        series: FinancialSeries,
        point: FinancialSeriesPoint,
    ) -> list[CalculationInput]:
        if point.calculation_inputs:
            return [item.model_copy(deep=True) for item in point.calculation_inputs]
        return [cls._calculation_input(series, point)]

    @staticmethod
    def _calculation_input(
        series: FinancialSeries,
        point: FinancialSeriesPoint,
    ) -> CalculationInput:
        return CalculationInput(
            metric=series.metric,
            label=series.label,
            unit=series.unit,
            value=point.value,
            period_start=point.period_start,
            period_end=point.period_end,
            currency=point.currency,
            filing_reference_date=point.filing_reference_date,
            filing_version=point.filing_version,
            source=point.source,
        )

    @staticmethod
    def _same_reporting_context(
        left: FinancialSeriesPoint,
        right: FinancialSeriesPoint,
    ) -> bool:
        if left.period_end != right.period_end:
            return False
        return (
            left.filing_reference_date is None
            or right.filing_reference_date is None
            or left.filing_reference_date == right.filing_reference_date
        )

    @staticmethod
    def _point_inputs(point: FinancialSeriesPoint) -> list[SourceMetadata]:
        return point.input_sources or [point.source]

    @classmethod
    def _merge_input_sources(
        cls,
        *points: FinancialSeriesPoint,
    ) -> list[SourceMetadata]:
        merged: list[SourceMetadata] = []
        seen: set[tuple[str, date | None]] = set()
        for point in points:
            for source in cls._point_inputs(point):
                key = (source.source_name, source.reference_date)
                if key not in seen:
                    seen.add(key)
                    merged.append(source)
        return merged

    @staticmethod
    def _calculation_source(
        label: str,
        inputs: list[SourceMetadata],
        reference_date: date | None,
    ) -> SourceMetadata:
        primary = inputs[-1]
        return SourceMetadata(
            provider="openmarket-derived",
            source_name=f"OpenMarket BR — {label}",
            source_url=primary.source_url,
            reference_date=reference_date,
            quality=DataQuality.SECONDARY,
            license=primary.license,
        )
