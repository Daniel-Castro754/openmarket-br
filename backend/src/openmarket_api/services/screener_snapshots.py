from collections.abc import Iterable
from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import FinancialMetric, SeriesFrequency
from openmarket_api.persistence.models import (
    CompanyRecord,
    FinancialStatementRecord,
    InstrumentRecord,
    ScreenerMetricSnapshotRecord,
)
from openmarket_api.services.cash_flow_series import CASH_FLOW_METRICS, CashFlowSeriesService
from openmarket_api.services.liquidity_series import LiquidityFinancialSeriesService

SnapshotValue = tuple[Decimal | None, date | None]
SnapshotMap = dict[tuple[UUID, FinancialMetric], SnapshotValue]
SnapshotRow = dict[str, object]


class ScreenerSnapshotService:
    """Persistent cache for the latest annual values used by discovery tools."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.financial_service = LiquidityFinancialSeriesService(session)
        self.cash_service = CashFlowSeriesService(session)

    def ensure(
        self,
        records: Iterable[tuple[InstrumentRecord, CompanyRecord | None]],
        metrics: Iterable[FinancialMetric],
    ) -> SnapshotMap:
        materialized_records = list(records)
        metric_list = list(dict.fromkeys(metrics))
        if not materialized_records or not metric_list:
            return {}

        instrument_ids = [instrument.id for instrument, _ in materialized_records]
        company_ids = [
            instrument.company_id
            for instrument, _ in materialized_records
            if instrument.company_id is not None
        ]
        latest_periods = self._latest_company_periods(company_ids)

        existing = self.session.scalars(
            select(ScreenerMetricSnapshotRecord).where(
                ScreenerMetricSnapshotRecord.instrument_id.in_(instrument_ids),
                ScreenerMetricSnapshotRecord.metric.in_([metric.value for metric in metric_list]),
                ScreenerMetricSnapshotRecord.frequency == SeriesFrequency.ANNUAL.value,
            )
        ).all()
        existing_by_key = {
            (snapshot.instrument_id, snapshot.metric): snapshot for snapshot in existing
        }

        values: SnapshotMap = {}
        pending_rows: list[SnapshotRow] = []
        for instrument, _ in materialized_records:
            source_latest_period = (
                latest_periods.get(instrument.company_id)
                if instrument.company_id is not None
                else None
            )
            for metric in metric_list:
                key = (instrument.id, metric.value)
                snapshot = existing_by_key.get(key)
                if snapshot is None or snapshot.source_latest_period != source_latest_period:
                    value, period_end = self._latest_metric(instrument.ticker, metric)
                    pending_rows.append(
                        {
                            "id": snapshot.id if snapshot is not None else uuid4(),
                            "instrument_id": instrument.id,
                            "metric": metric.value,
                            "frequency": SeriesFrequency.ANNUAL.value,
                            "value": value,
                            "period_end": period_end,
                            "source_latest_period": source_latest_period,
                        }
                    )
                    values[(instrument.id, metric)] = (value, period_end)
                else:
                    values[(instrument.id, metric)] = (snapshot.value, snapshot.period_end)

        if pending_rows:
            self._upsert_rows(pending_rows)
            self.session.commit()
        return values

    def _upsert_rows(self, rows: list[SnapshotRow]) -> None:
        """Atomically insert or refresh snapshot rows on supported databases."""

        if not rows:
            return

        table = ScreenerMetricSnapshotRecord.__table__
        dialect_name = self.session.get_bind().dialect.name
        if dialect_name == "postgresql":
            statement = postgresql_insert(table).values(rows)
        elif dialect_name == "sqlite":
            statement = sqlite_insert(table).values(rows)
        else:
            raise RuntimeError(
                f"Atomic screener snapshot upsert is not implemented for {dialect_name!r}"
            )

        statement = statement.on_conflict_do_update(
            index_elements=[table.c.instrument_id, table.c.metric, table.c.frequency],
            set_={
                "value": statement.excluded.value,
                "period_end": statement.excluded.period_end,
                "source_latest_period": statement.excluded.source_latest_period,
            },
        )
        self.session.execute(statement)

    def _latest_company_periods(self, company_ids: list[UUID]) -> dict[UUID, date | None]:
        if not company_ids:
            return {}
        rows = self.session.execute(
            select(
                FinancialStatementRecord.company_id,
                func.max(FinancialStatementRecord.period_end),
            )
            .where(FinancialStatementRecord.company_id.in_(company_ids))
            .group_by(FinancialStatementRecord.company_id)
        ).all()
        return {company_id: latest_period for company_id, latest_period in rows}

    def _latest_metric(
        self,
        ticker: str,
        metric: FinancialMetric,
    ) -> SnapshotValue:
        try:
            if metric in CASH_FLOW_METRICS:
                series = self.cash_service.get_series(
                    ticker,
                    metric,
                    frequency=SeriesFrequency.ANNUAL,
                )
            else:
                series = self.financial_service.get_series(
                    ticker,
                    metric,
                    frequency=SeriesFrequency.ANNUAL,
                )
        except LookupError:
            return None, None

        if not series.points:
            return None, None
        latest = series.points[-1]
        return latest.value, latest.period_end
