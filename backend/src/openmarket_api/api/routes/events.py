from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from openmarket_api.api.dependencies import get_db_session
from openmarket_api.domain.events import (
    CompanyEventCategory,
    CompanyEventTimeline,
    CompanyEventType,
)
from openmarket_api.services.company_events import CompanyEventService

router = APIRouter(prefix="/api/v1/assets", tags=["events"])


@router.get("/{ticker}/events", response_model=CompanyEventTimeline)
def get_company_events(
    ticker: str,
    session: Annotated[Session, Depends(get_db_session)],
    category: Annotated[CompanyEventCategory | None, Query()] = None,
    event_type: Annotated[CompanyEventType | None, Query()] = None,
    start: Annotated[date | None, Query()] = None,
    end: Annotated[date | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CompanyEventTimeline:
    try:
        return CompanyEventService(session).timeline(
            ticker,
            category=category,
            event_type=event_type,
            start=start,
            end=end,
            limit=limit,
            offset=offset,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
