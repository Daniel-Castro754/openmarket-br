from fastapi import APIRouter, HTTPException, Query

from openmarket_api.domain.entities import Company
from openmarket_api.providers.contracts import CompanyProvider
from openmarket_api.providers.registry import registry

router = APIRouter(prefix="/api/v1/companies", tags=["companies"])


@router.get("/search", response_model=list[Company])
async def search_companies(q: str = Query(min_length=2, max_length=100)) -> list[Company]:
    provider = registry.get("cvm-company-registry")
    if not isinstance(provider, CompanyProvider):
        raise HTTPException(status_code=500, detail="Configured provider cannot search companies")
    try:
        return list(await provider.search_companies(q))
    except Exception as exc:
        raise HTTPException(status_code=502, detail="CVM data source unavailable") from exc
