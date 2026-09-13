from collections.abc import Iterable
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import FinancialMetric, SeriesFrequency
from openmarket_api.persistence.models import (
    CompanyRecord,
    FinancialStatementRecord,
    InstrumentRecord,
    ScreenerMetricSnapshotRecord,
)
from openmarket_api.services.cash_flow_series import CASH_FLOW_METRICS, CashFlowSeriesService
from openmarket_api.services.financial_series import FinancialSeriesService

SnapshotValue = tuple[Decimal | None, date | None]
SnapshotMap = dict[tuple[UUID, FinancialMetric], SnapshotValue]


class ScreenerSnapshotService:
    """Persistent cache for the latest annual values used by discovery tools."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.financial_service = FinancialSeriesService(session)
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
        changed = False
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
                    if snapshot is None:
                        snapshot = ScreenerMetricSnapshotRecord(
                            instrument_id=instrument.id,
                            metric=metric.value,
                            frequency=SeriesFrequency.ANNUAL.value,
                        )
                        self.session.add(snapshot)
                        existing_by_key[key] = snapshot
                    snapshot.value = value
                    snapshot.period_end = period_end
                    snapshot.source_latest_period = source_latest_period
                    changed = True

                values[(instrument.id, metric)] = (snapshot.value, snapshot.period_end)

        if changed:
            self.session.commit()
        return values

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
