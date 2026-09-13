from fastapi import APIRouter

from openmarket_api.domain.indicators import IndicatorDefinition
from openmarket_api.services.indicator_engine import IndicatorEngine

router = APIRouter(prefix="/api/v1/indicators", tags=["indicators"])


@router.get("/catalog", response_model=list[IndicatorDefinition])
def get_indicator_catalog() -> list[IndicatorDefinition]:
    return IndicatorEngine.get_catalog()
