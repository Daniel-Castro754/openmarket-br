from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from openmarket_api.api.dependencies import get_db_session
from openmarket_api.domain.analytics import (
    FinancialMetric,
    FinancialSeries,
    SeriesFrequency,
)
from openmarket_api.domain.entities import Company, FinancialStatementItem, Instrument
from openmarket_api.services.asset_read import AssetReadService
from openmarket_api.services.cash_flow_series import (
    CASH_FLOW_METRICS,
    CashFlowSeriesService,
)
from openmarket_api.services.financial_series import FinancialSeriesService

router = APIRouter(prefix="/api/v1/assets", tags=["assets"])


class AssetSnapshotResponse(BaseModel):
    instrument: Instrument
    company: Company | None = None
    financial_item_count: int
    latest_period: date | None = None
    available_periods: list[date]


@router.get("/{ticker}", response_model=AssetSnapshotResponse)
def get_asset(
    ticker: str,
    session: Annotated[Session, Depends(get_db_session)],
) -> AssetSnapshotResponse:
    service = AssetReadService(session)
    try:
        snapshot = service.get_asset(ticker)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return AssetSnapshotResponse(
        instrument=snapshot.instrument,
        company=snapshot.company,
        financial_item_count=snapshot.financial_item_count,
        latest_period=snapshot.latest_period,
        available_periods=snapshot.available_periods,
    )


@router.get("/{ticker}/financials", response_model=list[FinancialStatementItem])
def get_asset_financials(
    ticker: str,
    session: Annotated[Session, Depends(get_db_session)],
    start: Annotated[date | None, Query()] = None,
    end: Annotated[date | None, Query()] = None,
    statement: Annotated[str | None, Query(min_length=2, max_length=16)] = None,
    consolidated: Annotated[bool | None, Query()] = None,
) -> list[FinancialStatementItem]:
    if start is not None and end is not None and start > end:
        raise HTTPException(status_code=400, detail="start must be on or before end")

    try:
        return AssetReadService(session).get_financials(
            ticker,
            start=start,
            end=end,
            statement=statement,
            consolidated=consolidated,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{ticker}/series/{metric}", response_model=FinancialSeries)
def get_asset_financial_series(
    ticker: str,
    metric: FinancialMetric,
    session: Annotated[Session, Depends(get_db_session)],
    frequency: Annotated[SeriesFrequency, Query()] = SeriesFrequency.ANNUAL,
) -> FinancialSeries:
    try:
        if metric in CASH_FLOW_METRICS:
            return CashFlowSeriesService(session).get_series(
                ticker,
                metric,
                frequency=frequency,
            )
        return FinancialSeriesService(session).get_series(
            ticker,
            metric,
            frequency=frequency,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
