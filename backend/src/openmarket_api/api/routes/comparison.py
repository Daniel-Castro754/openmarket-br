from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from openmarket_api.api.dependencies import get_db_session
from openmarket_api.domain.analytics import SeriesFrequency
from openmarket_api.domain.comparison import CompanyComparisonResponse
from openmarket_api.services.company_comparison import CompanyComparisonService

router = APIRouter(prefix="/api/v1/comparison", tags=["comparison"])


@router.get("", response_model=CompanyComparisonResponse)
def get_company_comparison(
    session: Annotated[Session, Depends(get_db_session)],
    tickers: Annotated[list[str], Query(alias="ticker")],
    metrics: Annotated[list[str], Query(alias="metric")],
    frequency: Annotated[SeriesFrequency, Query()] = SeriesFrequency.ANNUAL,
) -> CompanyComparisonResponse:
    try:
        return CompanyComparisonService(session).compare(
            tickers,
            metrics,
            frequency=frequency,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
