from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from openmarket_api.domain.entities import Company
from openmarket_api.persistence.models import InstrumentRecord, ScreenerMetricSnapshotRecord
from openmarket_api.persistence.repositories import (
    CompanyRepository,
    FinancialStatementRepository,
)
from openmarket_api.providers.contracts import CompanyProvider, FinancialProvider


class FinancialIngestionService:
    def __init__(
        self,
        *,
        session: Session,
        company_provider: CompanyProvider,
        financial_provider: FinancialProvider,
    ) -> None:
        self.session = session
        self.company_provider = company_provider
        self.financial_provider = financial_provider

    async def sync_company(
        self,
        cvm_code: str,
        *,
        start: date | None = None,
        end: date | None = None,
    ) -> tuple[Company, int]:
        candidates = list(await self.company_provider.search_companies(cvm_code))
        company = next(
            (
                candidate
                for candidate in candidates
                if (candidate.cvm_code or "").lstrip("0") == cvm_code.lstrip("0")
            ),
            None,
        )
        if company is None:
            raise LookupError(f"company not found for CVM code {cvm_code}")

        company_record = CompanyRepository(self.session).upsert(company)
        items = await self.financial_provider.get_statements(company, start=start, end=end)
        changed = FinancialStatementRepository(self.session).upsert_many(
            items, company_id=company_record.id
        )
        if changed:
            instrument_ids = select(InstrumentRecord.id).where(
                InstrumentRecord.company_id == company_record.id
            )
            self.session.execute(
                delete(ScreenerMetricSnapshotRecord).where(
                    ScreenerMetricSnapshotRecord.instrument_id.in_(instrument_ids)
                )
            )
        self.session.commit()
        return company, changed
