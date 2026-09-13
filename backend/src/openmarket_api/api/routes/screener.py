from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
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

SCREENER_METRIC_BY_VALUE = {metric.value: metric for metric in SCREENER_METRICS}
FILTER_OPERATORS = {"gt", "gte", "lt", "lte"}


@dataclass(frozen=True)
class ScreenerFilter:
    metric: FinancialMetric
    operator: str
    value: Decimal


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
    universe_total: int
    limit: int
    offset: int
    sort: str
    direction: Literal["asc", "desc"]
    applied_filters: int


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


def _parse_filter(raw_filter: str) -> ScreenerFilter:
    parts = raw_filter.split(":", 2)
    if len(parts) != 3:
        raise ValueError("Filtro deve usar o formato indicador:operador:valor.")

    metric_name, operator, raw_value = parts
    metric = SCREENER_METRIC_BY_VALUE.get(metric_name)
    if metric is None:
        raise ValueError(f"Indicador não suportado no screener: {metric_name}.")
    if operator not in FILTER_OPERATORS:
        raise ValueError(f"Operador não suportado no screener: {operator}.")

    try:
        value = Decimal(raw_value.replace(",", "."))
    except InvalidOperation as exc:
        raise ValueError(f"Valor inválido para filtro: {raw_value}.") from exc

    return ScreenerFilter(metric=metric, operator=operator, value=value)


def _matches_filter(value: Decimal | None, rule: ScreenerFilter) -> bool:
    if value is None:
        return False
    if rule.operator == "gt":
        return value > rule.value
    if rule.operator == "gte":
        return value >= rule.value
    if rule.operator == "lt":
        return value < rule.value
    return value <= rule.value


def _company_name(instrument: InstrumentRecord, company: CompanyRecord | None) -> str:
    if company and company.trading_name:
        return company.trading_name
    if company:
        return company.legal_name
    return instrument.issuer_name or instrument.ticker


def _sort_records(
    records: list[tuple[InstrumentRecord, CompanyRecord | None]],
    sort: str,
    direction: Literal["asc", "desc"],
    metric_value,
) -> list[tuple[InstrumentRecord, CompanyRecord | None]]:
    reverse = direction == "desc"
    if sort == "ticker":
        return sorted(records, key=lambda item: item[0].ticker, reverse=reverse)
    if sort == "company":
        return sorted(records, key=lambda item: _company_name(*item).casefold(), reverse=reverse)

    metric = SCREENER_METRIC_BY_VALUE.get(sort)
    if metric is None:
        raise HTTPException(status_code=422, detail=f"Ordenação não suportada: {sort}.")

    with_value: list[tuple[Decimal, tuple[InstrumentRecord, CompanyRecord | None]]] = []
    without_value: list[tuple[InstrumentRecord, CompanyRecord | None]] = []
    for record in records:
        value, _ = metric_value(record[0].ticker, metric)
        if value is None:
            without_value.append(record)
        else:
            with_value.append((value, record))

    with_value.sort(key=lambda item: item[0], reverse=reverse)
    return [record for _, record in with_value] + without_value


def _build_row(
    instrument: InstrumentRecord,
    company: CompanyRecord | None,
    session: Session,
    metric_value,
) -> ScreenerRow:
    metrics: dict[str, Decimal | None] = {}
    periods: dict[str, date | None] = {}
    for metric in SCREENER_METRICS:
        value, period = metric_value(instrument.ticker, metric)
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

    return ScreenerRow(
        ticker=instrument.ticker,
        company_name=_company_name(instrument, company),
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


@router.get("", response_model=ScreenerResponse)
def get_screener(
    session: Annotated[Session, Depends(get_db_session)],
    q: Annotated[str | None, Query(max_length=80)] = None,
    filters: Annotated[list[str] | None, Query(alias="filter")] = None,
    sort: Annotated[str, Query(max_length=40)] = "ticker",
    direction: Annotated[Literal["asc", "desc"], Query()] = "asc",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ScreenerResponse:
    parsed_filters: list[ScreenerFilter] = []
    for raw_filter in filters or []:
        try:
            parsed_filters.append(_parse_filter(raw_filter))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    base = select(InstrumentRecord, CompanyRecord).outerjoin(
        CompanyRecord,
        InstrumentRecord.company_id == CompanyRecord.id,
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

    universe_total = int(session.scalar(count_query) or 0)
    financial_service = FinancialSeriesService(session)
    cash_service = CashFlowSeriesService(session)
    metric_cache: dict[tuple[str, FinancialMetric], tuple[Decimal | None, date | None]] = {}

    def metric_value(ticker: str, metric: FinancialMetric) -> tuple[Decimal | None, date | None]:
        key = (ticker, metric)
        if key not in metric_cache:
            metric_cache[key] = _latest_metric(ticker, metric, financial_service, cash_service)
        return metric_cache[key]

    requires_python_scan = bool(parsed_filters) or sort not in {"ticker", "company"}

    if requires_python_scan:
        records = list(session.execute(base).all())
        if parsed_filters:
            records = [
                record
                for record in records
                if all(
                    _matches_filter(metric_value(record[0].ticker, rule.metric)[0], rule)
                    for rule in parsed_filters
                )
            ]
        records = _sort_records(records, sort, direction, metric_value)
        total = len(records)
        page_records = records[offset : offset + limit]
    else:
        total = universe_total
        if sort == "company":
            company_sort = func.coalesce(
                CompanyRecord.trading_name,
                CompanyRecord.legal_name,
                InstrumentRecord.issuer_name,
                InstrumentRecord.ticker,
            )
            ordered = base.order_by(company_sort.desc() if direction == "desc" else company_sort.asc())
        else:
            ordered = base.order_by(
                InstrumentRecord.ticker.desc() if direction == "desc" else InstrumentRecord.ticker.asc()
            )
        page_records = list(session.execute(ordered.limit(limit).offset(offset)).all())

    rows = [
        _build_row(instrument, company, session, metric_value)
        for instrument, company in page_records
    ]

    return ScreenerResponse(
        rows=rows,
        total=total,
        universe_total=universe_total,
        limit=limit,
        offset=offset,
        sort=sort,
        direction=direction,
        applied_filters=len(parsed_filters),
    )
