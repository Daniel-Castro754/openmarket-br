from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from openmarket_api.api.dependencies import get_db_session
from openmarket_api.domain.insights import ConsumerInsightSnapshot
from openmarket_api.services.data_platform import PersistedDataPlatformService

router = APIRouter(prefix="/api/v1/insights", tags=["insights"])


@router.get("/consumer", response_model=ConsumerInsightSnapshot)
def get_consumer_insights(
    session: Annotated[Session, Depends(get_db_session)],
) -> ConsumerInsightSnapshot:
    snapshot = PersistedDataPlatformService(session).consumer_insights()
    if snapshot is None:
        raise HTTPException(
            status_code=503,
            detail="Consumer-insights snapshot is not synchronized yet",
        )
    return snapshot
