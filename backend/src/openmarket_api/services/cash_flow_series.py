from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import (
    FinancialMetric,
    FinancialSeries,
    FinancialSeriesPoint,
    SeriesFrequency,
    SeriesUnit,
)
from openmarket_api.domain.common import DataQuality, SourceMetadata
from openmarket_api.persistence.models import FinancialStatementRecord
from openmarket_api.persistence.repositories import (
    FinancialStatementRepository,
    InstrumentRepository,
)


@dataclass(frozen=True)
class CashFlowDefinition:
    label: str
    account_code: str


CASH_FLOW_METRICS: dict[FinancialMetric, CashFlowDefinition] = {
    FinancialMetric.OPERATING_CASH_FLOW: CashFlowDefinition(
        label="Fluxo de caixa operacional",
        account_code="6.01",
    ),
    FinancialMetric.INVESTING_CASH_FLOW: CashFlowDefinition(
        label="Fluxo de caixa de investimentos",
        account_code="6.02",
    ),
    FinancialMetric.FINANCING_CASH_FLOW: CashFlowDefinition(
        label="Fluxo de caixa de financiamentos",
        account_code="6.03",
    ),
    FinancialMetric.NET_CHANGE_IN_CASH: CashFlowDefinition(
        label="Variação líquida de caixa",
        account_code="6.05",
    ),
}

DFC_STATEMENTS = {"DFC_MD", "DFC_MI"}


class CashFlowSeriesService:
    def __init__(self, session: Session) -> None:
        self.instruments = InstrumentRepository(session)
        self.financials = FinancialStatementRepository(session)

    def get_series(
        self,
        ticker: str,
        metric: FinancialMetric,
        *,
        frequency: SeriesFrequency = SeriesFrequency.ANNUAL,
    ) -> FinancialSeries:
        if metric not in CASH_FLOW_METRICS:
            raise ValueError(f"unsupported cash flow metric: {metric}")

        instrument = self.instruments.get_by_ticker(ticker)
        if instrument is None:
            raise LookupError(f"asset not found for ticker {ticker}")

        definition = CASH_FLOW_METRICS[metric]
        if instrument.company_id is None:
            return self._empty_series(metric, definition, frequency)

        records = [
            record
            for record in self.financials.list_for_company(
                instrument.company_id,
                consolidated=True,
            )
            if self._base_candidate(record, definition)
        ]

        points = (
            self._annual_points(records)
            if frequency == SeriesFrequency.ANNUAL
            else self._quarterly_points(records)
        )
        return FinancialSeries(
            metric=metric,
            label=definition.label,
            frequency=frequency,
            unit=SeriesUnit.CURRENCY,
            statement="DFC",
            account_code=definition.account_code,
            points=points,
        )

    @staticmethod
    def _base_candidate(
        record: FinancialStatementRecord,
        definition: CashFlowDefinition,
    ) -> bool:
        if record.statement not in DFC_STATEMENTS:
            return False
        if record.account_code != definition.account_code:
            return False
        if record.exercise_order not in {None, "ÚLTIMO"}:
            return False
        if record.fixed_account is False:
            return False
        return record.period_start is not None

    def _annual_points(
        self,
        records: list[FinancialStatementRecord],
    ) -> list[FinancialSeriesPoint]:
        selected: dict[date, FinancialStatementRecord] = {}
        for record in records:
            if record.filing_type != "DFP" or record.period_start is None:
                continue
            if (record.period_end - record.period_start).days < 300:
                continue
            current = selected.get(record.period_end)
            if current is None or self._filing_rank(record) > self._filing_rank(current):
                selected[record.period_end] = record

        return [
            self._point_from_record(record)
            for record in sorted(selected.values(), key=lambda item: item.period_end)
        ]

    def _quarterly_points(
        self,
        records: list[FinancialStatementRecord],
    ) -> list[FinancialSeriesPoint]:
        selected: dict[tuple[date, date], FinancialStatementRecord] = {}
        for record in records:
            if record.filing_type not in {"ITR", "DFP"} or record.period_start is None:
                continue
            period_days = (record.period_end - record.period_start).days + 1
            if period_days < 60 or period_days > 370:
                continue
            key = (record.period_start, record.period_end)
            current = selected.get(key)
            if current is None or self._filing_rank(record) > self._filing_rank(current):
                selected[key] = record

        grouped: dict[date, list[FinancialStatementRecord]] = {}
        for record in selected.values():
            grouped.setdefault(record.period_start, []).append(record)

        result: list[FinancialSeriesPoint] = []
        for period_start, year_records in grouped.items():
            ordered = sorted(year_records, key=lambda item: item.period_end)
            previous: FinancialStatementRecord | None = None
            for current in ordered:
                period_days = (current.period_end - period_start).days + 1
                if previous is None:
                    if 60 <= period_days <= 120:
                        result.append(self._point_from_record(current))
                    previous = current
                    continue

                if previous.statement != current.statement:
                    previous = current
                    continue
                if previous.currency != current.currency:
                    previous = current
                    continue

                result.append(self._derived_quarter_point(previous, current))
                previous = current

        by_period: dict[date, FinancialSeriesPoint] = {}
        for point in result:
            current = by_period.get(point.period_end)
            if current is None or self._point_rank(point) > self._point_rank(current):
                by_period[point.period_end] = point
        return sorted(by_period.values(), key=lambda item: item.period_end)

    def _derived_quarter_point(
        self,
        previous: FinancialStatementRecord,
        current: FinancialStatementRecord,
    ) -> FinancialSeriesPoint:
        previous_source = SourceMetadata.model_validate(previous.source)
        current_source = SourceMetadata.model_validate(current.source)
        inputs = [previous_source, current_source]
        return FinancialSeriesPoint(
            period_start=previous.period_end + timedelta(days=1),
            period_end=current.period_end,
            value=current.value - previous.value,
            currency=current.currency,
            filing_reference_date=current.filing_reference_date,
            filing_version=None,
            source=self._calculation_source(inputs, current.filing_reference_date),
            derived=True,
            derivation="cumulative_current - cumulative_previous",
            input_sources=inputs,
        )

    @staticmethod
    def _point_from_record(record: FinancialStatementRecord) -> FinancialSeriesPoint:
        return FinancialSeriesPoint(
            period_start=record.period_start,
            period_end=record.period_end,
            value=record.value,
            currency=record.currency,
            filing_reference_date=record.filing_reference_date,
            filing_version=record.filing_version,
            source=SourceMetadata.model_validate(record.source),
        )

    @staticmethod
    def _calculation_source(
        inputs: list[SourceMetadata],
        reference_date: date | None,
    ) -> SourceMetadata:
        primary = inputs[-1]
        return SourceMetadata(
            provider="openmarket-derived",
            source_name="OpenMarket BR — trimestre derivado da DFC acumulada",
            source_url=primary.source_url,
            reference_date=reference_date,
            quality=DataQuality.SECONDARY,
            license=primary.license,
        )

    @staticmethod
    def _empty_series(
        metric: FinancialMetric,
        definition: CashFlowDefinition,
        frequency: SeriesFrequency,
    ) -> FinancialSeries:
        return FinancialSeries(
            metric=metric,
            label=definition.label,
            frequency=frequency,
            unit=SeriesUnit.CURRENCY,
            statement="DFC",
            account_code=definition.account_code,
            points=[],
        )

    @staticmethod
    def _filing_rank(record: FinancialStatementRecord) -> tuple[date, int]:
        return (
            record.filing_reference_date or record.period_end,
            record.filing_version or 0,
        )

    @staticmethod
    def _point_rank(point: FinancialSeriesPoint) -> tuple[date, int]:
        return (
            point.filing_reference_date or point.period_end,
            point.filing_version or 0,
        )
