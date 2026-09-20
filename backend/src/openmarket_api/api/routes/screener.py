from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from openmarket_api.api.dependencies import get_db_session
from openmarket_api.domain.analytics import FinancialMetric, SeriesFrequency
from openmarket_api.domain.screener import ScreenerMetric, screener_metric_value
from openmarket_api.persistence.models import (
    CompanyRecord,
    FinancialStatementRecord,
    InstrumentRecord,
    PublicDocumentRecord,
)
from openmarket_api.services.indicator_registry import indicator_registry
from openmarket_api.services.screener_snapshots import ScreenerSnapshotService, SnapshotMap

router = APIRouter(prefix="/api/v1/screener", tags=["screener"])

BASE_SCREENER_METRICS: tuple[FinancialMetric, ...] = (
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
)


def _registry_screener_metrics() -> list[ScreenerMetric]:
    metrics: list[ScreenerMetric] = []
    for definition in indicator_registry.get_catalog():
        if SeriesFrequency.ANNUAL not in definition.available_frequencies:
            continue
        if definition.requires_market_data:
            continue
        metrics.append(definition.metric if definition.metric is not None else definition.slug)
    return metrics


SCREENER_METRICS: tuple[ScreenerMetric, ...] = tuple(
    dict.fromkeys([*BASE_SCREENER_METRICS, *_registry_screener_metrics()])
)

SCREENER_METRIC_BY_VALUE = {
    screener_metric_value(metric): metric for metric in SCREENER_METRICS
}
FILTER_OPERATORS = {"gt", "gte", "lt", "lte"}
CompanyStats = tuple[int, date | None, int]


@dataclass(frozen=True)
class ScreenerFilter:
    metric: ScreenerMetric
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


def _snapshot_value(
    values: SnapshotMap,
    instrument: InstrumentRecord,
    metric: ScreenerMetric,
) -> tuple[Decimal | None, date | None]:
    return values.get((instrument.id, metric), (None, None))


def _sort_records(
    records: list[tuple[InstrumentRecord, CompanyRecord | None]],
    sort: str,
    direction: Literal["asc", "desc"],
    values: SnapshotMap,
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
        value, _ = _snapshot_value(values, record[0], metric)
        if value is None:
            without_value.append(record)
        else:
            with_value.append((value, record))

    with_value.sort(key=lambda item: item[0], reverse=reverse)
    return [record for _, record in with_value] + without_value


def _load_company_stats(session: Session, company_ids: set[UUID]) -> dict[UUID, CompanyStats]:
    if not company_ids:
        return {}

    financial_rows = session.execute(
        select(
            FinancialStatementRecord.company_id,
            func.count(FinancialStatementRecord.id),
            func.max(FinancialStatementRecord.period_end),
        )
        .where(FinancialStatementRecord.company_id.in_(company_ids))
        .group_by(FinancialStatementRecord.company_id)
    ).all()
    document_rows = session.execute(
        select(
            PublicDocumentRecord.company_id,
            func.count(PublicDocumentRecord.id),
        )
        .where(PublicDocumentRecord.company_id.in_(company_ids))
        .group_by(PublicDocumentRecord.company_id)
    ).all()

    financial_by_company = {
        company_id: (int(count), latest_period)
        for company_id, count, latest_period in financial_rows
    }
    documents_by_company = {
        company_id: int(count)
        for company_id, count in document_rows
        if company_id is not None
    }
    return {
        company_id: (
            financial_by_company.get(company_id, (0, None))[0],
            financial_by_company.get(company_id, (0, None))[1],
            documents_by_company.get(company_id, 0),
        )
        for company_id in company_ids
    }


def _build_row(
    instrument: InstrumentRecord,
    company: CompanyRecord | None,
    values: SnapshotMap,
    company_stats: dict[UUID, CompanyStats],
) -> ScreenerRow:
    metrics: dict[str, Decimal | None] = {}
    periods: dict[str, date | None] = {}
    for metric in SCREENER_METRICS:
        value, period = _snapshot_value(values, instrument, metric)
        metric_name = screener_metric_value(metric)
        metrics[metric_name] = value
        periods[metric_name] = period

    if instrument.company_id is not None:
        financial_item_count, latest_period, document_count = company_stats.get(
            instrument.company_id,
            (0, None, 0),
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
    snapshot_service = ScreenerSnapshotService(session)
    sort_metric = SCREENER_METRIC_BY_VALUE.get(sort)
    requires_snapshot_scan = bool(parsed_filters) or sort_metric is not None

    if requires_snapshot_scan:
        records = list(session.execute(base).all())
        scan_metrics = {rule.metric for rule in parsed_filters}
        if sort_metric is not None:
            scan_metrics.add(sort_metric)
        scan_values = snapshot_service.ensure(records, scan_metrics)

        if parsed_filters:
            records = [
                record
                for record in records
                if all(
                    _matches_filter(
                        _snapshot_value(scan_values, record[0], rule.metric)[0],
                        rule,
                    )
                    for rule in parsed_filters
                )
            ]
        records = _sort_records(records, sort, direction, scan_values)
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
        elif sort == "ticker":
            ordered = base.order_by(
                InstrumentRecord.ticker.desc() if direction == "desc" else InstrumentRecord.ticker.asc()
            )
        else:
            raise HTTPException(status_code=422, detail=f"Ordenação não suportada: {sort}.")
        page_records = list(session.execute(ordered.limit(limit).offset(offset)).all())

    page_values = snapshot_service.ensure(page_records, SCREENER_METRICS)
    company_ids = {
        instrument.company_id
        for instrument, _ in page_records
        if instrument.company_id is not None
    }
    company_stats = _load_company_stats(session, company_ids)
    rows = [
        _build_row(instrument, company, page_values, company_stats)
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
