from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import (
    FinancialMetric,
    FinancialSeries,
    FinancialSeriesPoint,
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


class FinancialSeriesService:
    def __init__(self, session: Session) -> None:
        self.instruments = InstrumentRepository(session)
        self.financials = FinancialStatementRepository(session)

    def get_annual_series(
        self,
        ticker: str,
        metric: FinancialMetric,
    ) -> FinancialSeries:
        instrument = self.instruments.get_by_ticker(ticker)
        if instrument is None:
            raise LookupError(f"asset not found for ticker {ticker}")

        definition = METRICS[metric]
        if instrument.company_id is None:
            return self._empty_series(metric, definition)

        records = self.financials.list_for_company(
            instrument.company_id,
            statement=definition.statement,
            consolidated=True,
        )
        candidates = [
            record
            for record in records
            if self._is_annual_candidate(record, definition)
        ]

        selected: dict[date, FinancialStatementRecord] = {}
        for record in candidates:
            current = selected.get(record.period_end)
            if current is None or self._filing_rank(record) > self._filing_rank(current):
                selected[record.period_end] = record

        points = [
            FinancialSeriesPoint(
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
            statement=definition.statement,
            account_code=definition.account_code,
            points=points,
        )

    @staticmethod
    def _empty_series(
        metric: FinancialMetric,
        definition: MetricDefinition,
    ) -> FinancialSeries:
        return FinancialSeries(
            metric=metric,
            label=definition.label,
            statement=definition.statement,
            account_code=definition.account_code,
            points=[],
        )

    @staticmethod
    def _is_annual_candidate(
        record: FinancialStatementRecord,
        definition: MetricDefinition,
    ) -> bool:
        if record.filing_type != "DFP":
            return False
        if record.account_code != definition.account_code:
            return False
        if record.exercise_order not in {None, "ÚLTIMO"}:
            return False
        if record.fixed_account is False:
            return False
        if definition.flow:
            if record.period_start is None:
                return False
            if (record.period_end - record.period_start).days < 300:
                return False
        return True

    @staticmethod
    def _filing_rank(record: FinancialStatementRecord) -> tuple[date, int]:
        return (
            record.filing_reference_date or record.period_end,
            record.filing_version or 0,
        )
