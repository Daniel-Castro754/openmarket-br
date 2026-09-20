from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from openmarket_api.api.dependencies import get_db_session
from openmarket_api.domain.platform import ProviderPlatformStatus
from openmarket_api.providers.registry import registry
from openmarket_api.services.data_platform import ProviderObservabilityService

router = APIRouter(prefix="/api/v1", tags=["meta"])


@router.get("/meta")
async def meta() -> dict[str, object]:
    return {
        "name": "OpenMarket BR",
        "api_version": "v1",
        "status": "foundation",
        "providers": registry.names(),
    }


@router.get("/meta/providers", response_model=ProviderPlatformStatus)
def provider_status(
    session: Annotated[Session, Depends(get_db_session)],
) -> ProviderPlatformStatus:
    return ProviderObservabilityService(session).status(registry.descriptors())
