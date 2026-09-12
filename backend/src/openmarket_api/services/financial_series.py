from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import (
    FinancialMetric,
    FinancialSeries,
    FinancialSeriesPoint,
    SeriesFrequency,
    SeriesUnit,
)
from openmarket_api.domain.common import SourceMetadata
from openmarket_api.persistence.models import FinancialStatementRecord
from openmarket_api.persistence.repositories import (
    FinancialStatementRepository,
    InstrumentRepository,
)


@dataclass(frozen=True)
class MetricDefinition:
    label: str
    statement: str
    account_code: str
    flow: bool


@dataclass(frozen=True)
class MarginDefinition:
    label: str
    numerator: FinancialMetric
    formula: str


METRICS: dict[FinancialMetric, MetricDefinition] = {
    FinancialMetric.REVENUE: MetricDefinition(
        label="Receita",
        statement="DRE",
        account_code="3.01",
        flow=True,
    ),
    FinancialMetric.GROSS_PROFIT: MetricDefinition(
        label="Lucro bruto",
        statement="DRE",
        account_code="3.03",
        flow=True,
    ),
    FinancialMetric.OPERATING_RESULT: MetricDefinition(
        label="Resultado operacional",
        statement="DRE",
        account_code="3.05",
        flow=True,
    ),
    FinancialMetric.NET_INCOME: MetricDefinition(
        label="Lucro líquido",
        statement="DRE",
        account_code="3.11",
        flow=True,
    ),
    FinancialMetric.TOTAL_ASSETS: MetricDefinition(
        label="Ativos totais",
        statement="BPA",
        account_code="1",
        flow=False,
    ),
    FinancialMetric.EQUITY: MetricDefinition(
        label="Patrimônio líquido",
        statement="BPP",
        account_code="2.03",
        flow=False,
    ),
}

MARGINS: dict[FinancialMetric, MarginDefinition] = {
    FinancialMetric.GROSS_MARGIN: MarginDefinition(
        label="Margem bruta",
        numerator=FinancialMetric.GROSS_PROFIT,
        formula="gross_profit / revenue * 100",
    ),
    FinancialMetric.OPERATING_MARGIN: MarginDefinition(
        label="Margem operacional",
        numerator=FinancialMetric.OPERATING_RESULT,
        formula="operating_result / revenue * 100",
    ),
    FinancialMetric.NET_MARGIN: MarginDefinition(
        label="Margem líquida",
        numerator=FinancialMetric.NET_INCOME,
        formula="net_income / revenue * 100",
    ),
}


class FinancialSeriesService:
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
        if metric in METRICS:
            return self._get_direct_series(ticker, metric, frequency=frequency)
        if metric in MARGINS:
            return self._get_margin_series(ticker, metric, frequency=frequency)
        if metric == FinancialMetric.REVENUE_GROWTH_YOY:
            return self._get_growth_series(
                ticker,
                FinancialMetric.REVENUE,
                metric=metric,
                label="Crescimento da receita (YoY)",
                frequency=frequency,
            )
        raise ValueError(f"unsupported financial metric: {metric}")

    def get_annual_series(
        self,
        ticker: str,
        metric: FinancialMetric,
    ) -> FinancialSeries:
        return self.get_series(ticker, metric, frequency=SeriesFrequency.ANNUAL)

    def get_quarterly_series(
        self,
        ticker: str,
        metric: FinancialMetric,
    ) -> FinancialSeries:
        return self.get_series(ticker, metric, frequency=SeriesFrequency.QUARTERLY)

    def _get_direct_series(
        self,
        ticker: str,
        metric: FinancialMetric,
        *,
        frequency: SeriesFrequency,
    ) -> FinancialSeries:
        instrument = self.instruments.get_by_ticker(ticker)
        if instrument is None:
            raise LookupError(f"asset not found for ticker {ticker}")

        definition = METRICS[metric]
        if instrument.company_id is None:
            return self._empty_direct_series(metric, definition, frequency)

        records = self.financials.list_for_company(
            instrument.company_id,
            statement=definition.statement,
            consolidated=True,
        )
        if frequency == SeriesFrequency.ANNUAL:
            candidates = [
                record
                for record in records
                if self._is_annual_candidate(record, definition)
            ]
        else:
            candidates = [
                record
                for record in records
                if self._is_quarterly_candidate(record, definition)
            ]

        selected: dict[date, FinancialStatementRecord] = {}
        for record in candidates:
            current = selected.get(record.period_end)
            if current is None or self._filing_rank(record) > self._filing_rank(current):
                selected[record.period_end] = record

        points = [
            FinancialSeriesPoint(
                period_start=record.period_start,
                period_end=record.period_end,
                value=record.value,
                currency=record.currency,
                filing_reference_date=record.filing_reference_date,
                filing_version=record.filing_version,
                source=SourceMetadata.model_validate(record.source),
            )
            for record in sorted(selected.values(), key=lambda item: item.period_end)
        ]
        return FinancialSeries(
            metric=metric,
            label=definition.label,
            frequency=frequency,
            unit=SeriesUnit.CURRENCY,
            statement=definition.statement,
            account_code=definition.account_code,
            points=points,
        )

    def _get_margin_series(
        self,
        ticker: str,
        metric: FinancialMetric,
        *,
        frequency: SeriesFrequency,
    ) -> FinancialSeries:
        definition = MARGINS[metric]
        numerator = self._get_direct_series(
            ticker,
            definition.numerator,
            frequency=frequency,
        )
        revenue = self._get_direct_series(
            ticker,
            FinancialMetric.REVENUE,
            frequency=frequency,
        )
        revenue_by_period = {point.period_end: point for point in revenue.points}

        points: list[FinancialSeriesPoint] = []
        for point in numerator.points:
            denominator = revenue_by_period.get(point.period_end)
            if denominator is None or denominator.value == 0:
                continue
            if not self._same_filing(point, denominator):
                continue
            points.append(
                FinancialSeriesPoint(
                    period_start=point.period_start,
                    period_end=point.period_end,
                    value=(point.value / denominator.value) * Decimal(100),
                    currency=None,
                    filing_reference_date=point.filing_reference_date,
                    filing_version=point.filing_version,
                    source=point.source,
                )
            )

        return FinancialSeries(
            metric=metric,
            label=definition.label,
            frequency=frequency,
            unit=SeriesUnit.PERCENT,
            formula=definition.formula,
            points=points,
        )

    def _get_growth_series(
        self,
        ticker: str,
        base_metric: FinancialMetric,
        *,
        metric: FinancialMetric,
        label: str,
        frequency: SeriesFrequency,
    ) -> FinancialSeries:
        base = self._get_direct_series(ticker, base_metric, frequency=frequency)
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
            points.append(
                FinancialSeriesPoint(
                    period_start=point.period_start,
                    period_end=point.period_end,
                    value=((point.value / previous.value) - Decimal(1)) * Decimal(100),
                    currency=None,
                    filing_reference_date=point.filing_reference_date,
                    filing_version=point.filing_version,
                    source=point.source,
                )
            )

        comparison = "t-1 ano" if frequency == SeriesFrequency.ANNUAL else "mesmo trimestre anterior"
        return FinancialSeries(
            metric=metric,
            label=label,
            frequency=frequency,
            unit=SeriesUnit.PERCENT,
            formula=f"({base_metric.value}_t / {base_metric.value}_{comparison} - 1) * 100",
            points=points,
        )

    @staticmethod
    def _empty_direct_series(
        metric: FinancialMetric,
        definition: MetricDefinition,
        frequency: SeriesFrequency,
    ) -> FinancialSeries:
        return FinancialSeries(
            metric=metric,
            label=definition.label,
            frequency=frequency,
            unit=SeriesUnit.CURRENCY,
            statement=definition.statement,
            account_code=definition.account_code,
            points=[],
        )

    @staticmethod
    def _base_candidate(
        record: FinancialStatementRecord,
        definition: MetricDefinition,
    ) -> bool:
        if record.account_code != definition.account_code:
            return False
        if record.exercise_order not in {None, "ÚLTIMO"}:
            return False
        return record.fixed_account is not False

    @classmethod
    def _is_annual_candidate(
        cls,
        record: FinancialStatementRecord,
        definition: MetricDefinition,
    ) -> bool:
        if not cls._base_candidate(record, definition):
            return False
        if record.filing_type != "DFP":
            return False
        if definition.flow:
            if record.period_start is None:
                return False
            if (record.period_end - record.period_start).days < 300:
                return False
        return True

    @classmethod
    def _is_quarterly_candidate(
        cls,
        record: FinancialStatementRecord,
        definition: MetricDefinition,
    ) -> bool:
        if not cls._base_candidate(record, definition):
            return False

        if definition.flow:
            if record.filing_type != "ITR" or record.period_start is None:
                return False
            period_days = (record.period_end - record.period_start).days + 1
            return 60 <= period_days <= 120

        return record.filing_type in {"ITR", "DFP"}

    @staticmethod
    def _same_filing(
        left: FinancialSeriesPoint,
        right: FinancialSeriesPoint,
    ) -> bool:
        return (
            left.filing_reference_date == right.filing_reference_date
            and left.filing_version == right.filing_version
        )

    @staticmethod
    def _filing_rank(record: FinancialStatementRecord) -> tuple[date, int]:
        return (
            record.filing_reference_date or record.period_end,
            record.filing_version or 0,
        )
