from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from openmarket_api.persistence.repositories import (
    CompanyRepository,
    FinancialStatementRepository,
    InstrumentRepository,
)
from openmarket_api.providers.contracts import (
    CompanyProvider,
    FinancialProvider,
    InstrumentProvider,
)
from openmarket_api.services.instrument_resolution import InstrumentResolutionService


@dataclass(frozen=True)
class AssetSyncResult:
    ticker: str
    cvm_code: str | None
    financial_items: int


class AssetSyncService:
    def __init__(
        self,
        *,
        session: Session,
        instrument_provider: InstrumentProvider,
        company_provider: CompanyProvider,
        financial_provider: FinancialProvider,
    ) -> None:
        self.session = session
        self.instrument_provider = instrument_provider
        self.company_provider = company_provider
        self.financial_provider = financial_provider

    async def sync(
        self,
        ticker: str,
        *,
        start: date | None = None,
        end: date | None = None,
    ) -> AssetSyncResult:
        resolver = InstrumentResolutionService(
            instrument_provider=self.instrument_provider,
            company_provider=self.company_provider,
        )

        try:
            instrument, company = await resolver.resolve(ticker)
            company_id = None
            financial_items = 0

            if company is not None:
                company_record = CompanyRepository(self.session).upsert(company)
                company_id = company_record.id
                instrument.company_id = company_id
                statements = await self.financial_provider.get_statements(
                    company,
                    start=start,
                    end=end,
                )
                financial_items = FinancialStatementRepository(self.session).upsert_many(
                    statements,
                    company_id=company_id,
                )

            InstrumentRepository(self.session).upsert(instrument, company_id=company_id)
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise

        return AssetSyncResult(
            ticker=instrument.ticker,
            cvm_code=company.cvm_code if company is not None else None,
            financial_items=financial_items,
        )
