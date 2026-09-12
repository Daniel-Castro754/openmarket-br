from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from openmarket_api.api.dependencies import get_db_session
from openmarket_api.domain.analytics import FinancialMetric, SeriesFrequency
from openmarket_api.persistence.models import (
    CompanyRecord,
    FinancialStatementRecord,
    InstrumentRecord,
    PublicDocumentRecord,
)
from openmarket_api.services.cash_flow_series import CASH_FLOW_METRICS, CashFlowSeriesService
from openmarket_api.services.financial_series import FinancialSeriesService

router = APIRouter(prefix="/api/v1/screener", tags=["screener"])

SCREENER_METRICS: tuple[FinancialMetric, ...] = (
    FinancialMetric.REVENUE,
    FinancialMetric.GROSS_PROFIT,
    FinancialMetric.OPERATING_RESULT,
    FinancialMetric.NET_INCOME,
    FinancialMetric.TOTAL_ASSETS,
    FinancialMetric.EQUITY,
    FinancialMetric.CASH,
    FinancialMetric.GROSS_DEBT,
    FinancialMetric.NET_DEBT,
    FinancialMetric.OPERATING_CASH_FLOW,
    FinancialMetric.INVESTING_CASH_FLOW,
    FinancialMetric.FINANCING_CASH_FLOW,
    FinancialMetric.NET_CHANGE_IN_CASH,
    FinancialMetric.GROSS_MARGIN,
    FinancialMetric.OPERATING_MARGIN,
    FinancialMetric.NET_MARGIN,
    FinancialMetric.REVENUE_GROWTH_YOY,
    FinancialMetric.ROE,
)


class ScreenerRow(BaseModel):
    ticker: str
    company_name: str
    legal_name: str | None = None
    exchange: str
    instrument_type: str
    security_category: str | None = None
    governance_level: str | None = None
    currency: str
    cvm_code: str | None = None
    isin: str | None = None
    latest_period: date | None = None
    financial_item_count: int = 0
    document_count: int = 0
    metrics: dict[str, Decimal | None]
    metric_periods: dict[str, date | None]


class ScreenerResponse(BaseModel):
    rows: list[ScreenerRow]
    total: int
    limit: int
    offset: int


def _latest_metric(
    ticker: str,
    metric: FinancialMetric,
    financial_service: FinancialSeriesService,
    cash_service: CashFlowSeriesService,
) -> tuple[Decimal | None, date | None]:
    try:
        if metric in CASH_FLOW_METRICS:
            series = cash_service.get_series(ticker, metric, frequency=SeriesFrequency.ANNUAL)
        else:
            series = financial_service.get_series(ticker, metric, frequency=SeriesFrequency.ANNUAL)
    except LookupError:
        return None, None

    if not series.points:
        return None, None
    latest = series.points[-1]
    return latest.value, latest.period_end


@router.get("", response_model=ScreenerResponse)
def get_screener(
    session: Annotated[Session, Depends(get_db_session)],
    q: Annotated[str | None, Query(max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 80,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ScreenerResponse:
    base = (
        select(InstrumentRecord, CompanyRecord)
        .outerjoin(CompanyRecord, InstrumentRecord.company_id == CompanyRecord.id)
        .order_by(InstrumentRecord.ticker)
    )
    count_query = select(func.count(InstrumentRecord.id))

    if q:
        pattern = f"%{q.strip()}%"
        predicate = or_(
            InstrumentRecord.ticker.ilike(pattern),
            InstrumentRecord.issuer_name.ilike(pattern),
            CompanyRecord.legal_name.ilike(pattern),
            CompanyRecord.trading_name.ilike(pattern),
        )
        base = base.where(predicate)
        count_query = count_query.outerjoin(
            CompanyRecord,
            InstrumentRecord.company_id == CompanyRecord.id,
        ).where(predicate)

    total = int(session.scalar(count_query) or 0)
    records = session.execute(base.limit(limit).offset(offset)).all()
    financial_service = FinancialSeriesService(session)
    cash_service = CashFlowSeriesService(session)
    rows: list[ScreenerRow] = []

    for instrument, company in records:
        metrics: dict[str, Decimal | None] = {}
        periods: dict[str, date | None] = {}
        for metric in SCREENER_METRICS:
            value, period = _latest_metric(
                instrument.ticker,
                metric,
                financial_service,
                cash_service,
            )
            metrics[metric.value] = value
            periods[metric.value] = period

        if instrument.company_id is not None:
            financial_item_count = int(
                session.scalar(
                    select(func.count(FinancialStatementRecord.id)).where(
                        FinancialStatementRecord.company_id == instrument.company_id
                    )
                )
                or 0
            )
            latest_period = session.scalar(
                select(func.max(FinancialStatementRecord.period_end)).where(
                    FinancialStatementRecord.company_id == instrument.company_id
                )
            )
            document_count = int(
                session.scalar(
                    select(func.count(PublicDocumentRecord.id)).where(
                        PublicDocumentRecord.company_id == instrument.company_id
                    )
                )
                or 0
            )
        else:
            financial_item_count = 0
            latest_period = None
            document_count = 0

        rows.append(
            ScreenerRow(
                ticker=instrument.ticker,
                company_name=(
                    company.trading_name
                    if company and company.trading_name
                    else company.legal_name
                    if company
                    else instrument.issuer_name or instrument.ticker
                ),
                legal_name=company.legal_name if company else instrument.issuer_name,
                exchange=instrument.exchange,
                instrument_type=instrument.instrument_type,
                security_category=instrument.security_category,
                governance_level=instrument.governance_level,
                currency=instrument.currency,
                cvm_code=company.cvm_code if company else None,
                isin=instrument.isin,
                latest_period=latest_period,
                financial_item_count=financial_item_count,
                document_count=document_count,
                metrics=metrics,
                metric_periods=periods,
            )
        )

    return ScreenerResponse(rows=rows, total=total, limit=limit, offset=offset)
