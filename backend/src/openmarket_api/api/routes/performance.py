from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from openmarket_api.api.dependencies import get_db_session
from openmarket_api.domain.performance import (
    PerformanceRiskSnapshot,
    PerformanceWindow,
    PriceHistory,
)
from openmarket_api.services.performance_risk import PerformanceRiskService
from openmarket_api.services.price_history import PriceHistoryService

router = APIRouter(prefix="/api/v1/assets", tags=["performance"])


@router.get("/{ticker}/prices", response_model=PriceHistory)
def get_asset_prices(
    ticker: str,
    session: Annotated[Session, Depends(get_db_session)],
    start: Annotated[date | None, Query()] = None,
    end: Annotated[date | None, Query()] = None,
) -> PriceHistory:
    if start is not None and end is not None and start > end:
        raise HTTPException(status_code=422, detail="start must be on or before end")
    try:
        return PriceHistoryService(session).get_history(
            ticker,
            start=start,
            end=end,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{ticker}/performance", response_model=PerformanceRiskSnapshot)
def get_asset_performance(
    ticker: str,
    session: Annotated[Session, Depends(get_db_session)],
    window: Annotated[PerformanceWindow, Query()] = PerformanceWindow.ONE_YEAR,
    risk_free_rate: Annotated[Decimal, Query(ge=Decimal(-99), le=Decimal(1000))] = Decimal(0),
    benchmark: Annotated[str | None, Query(min_length=1, max_length=32)] = None,
) -> PerformanceRiskSnapshot:
    try:
        return PerformanceRiskService(session).get_snapshot(
            ticker,
            window=window,
            risk_free_rate_annual_percent=risk_free_rate,
            benchmark_ticker=benchmark,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
