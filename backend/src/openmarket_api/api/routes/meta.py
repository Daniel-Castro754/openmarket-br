from fastapi import APIRouter

from openmarket_api.providers.registry import registry

router = APIRouter(prefix="/api/v1", tags=["meta"])


@router.get("/meta")
async def meta() -> dict[str, object]:
    return {
        "name": "OpenMarket BR",
        "api_version": "v1",
        "status": "foundation",
        "providers": registry.names(),
    }
