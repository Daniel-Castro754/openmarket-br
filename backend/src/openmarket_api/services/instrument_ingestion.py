from sqlalchemy.orm import Session

from openmarket_api.domain.entities import Company, Instrument
from openmarket_api.persistence.repositories import CompanyRepository, InstrumentRepository
from openmarket_api.services.instrument_resolution import InstrumentResolutionService


class InstrumentIngestionService:
    def __init__(self, *, session: Session, resolution_service: InstrumentResolutionService) -> None:
        self.session = session
        self.resolution_service = resolution_service

    async def sync_ticker(self, ticker: str) -> tuple[Instrument, Company | None]:
        instrument, company = await self.resolution_service.resolve(ticker)

        company_id = None
        if company is not None:
            company_record = CompanyRepository(self.session).upsert(company)
            company_id = company_record.id
            instrument.company_id = company_id

        InstrumentRepository(self.session).upsert(instrument, company_id=company_id)
        self.session.commit()
        return instrument, company
