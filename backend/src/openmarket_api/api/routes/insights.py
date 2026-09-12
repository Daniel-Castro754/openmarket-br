from fastapi import APIRouter, HTTPException

from openmarket_api.domain.insights import ConsumerInsightSnapshot
from openmarket_api.providers.ibge_consumer import IBGEConsumerProvider

router = APIRouter(prefix="/api/v1/insights", tags=["insights"])


@router.get("/consumer", response_model=ConsumerInsightSnapshot)
async def get_consumer_insights() -> ConsumerInsightSnapshot:
    try:
        return await IBGEConsumerProvider().snapshot()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
