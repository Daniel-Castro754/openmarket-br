from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from openmarket_api.domain.entities import Company, Instrument
from openmarket_api.providers.contracts import CompanyProvider, InstrumentProvider
from openmarket_api.providers.registry import registry
from openmarket_api.services.instrument_resolution import InstrumentResolutionService

router = APIRouter(prefix="/api/v1/instruments", tags=["instruments"])


class InstrumentResolutionResponse(BaseModel):
    instrument: Instrument
    company: Company | None = None


@router.get("/{ticker}", response_model=InstrumentResolutionResponse)
async def get_instrument(ticker: str) -> InstrumentResolutionResponse:
    instrument_provider = registry.get("b3-instruments")
    company_provider = registry.get("cvm-company-registry")
    if not isinstance(instrument_provider, InstrumentProvider):
        raise HTTPException(status_code=500, detail="Configured provider cannot resolve instruments")
    if not isinstance(company_provider, CompanyProvider):
        raise HTTPException(status_code=500, detail="Configured provider cannot resolve companies")

    service = InstrumentResolutionService(
        instrument_provider=instrument_provider,
        company_provider=company_provider,
    )
    try:
        instrument, company = await service.resolve(ticker)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="B3/CVM data source unavailable") from exc

    return InstrumentResolutionResponse(instrument=instrument, company=company)
