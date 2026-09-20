from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from openmarket_api.domain.common import SourceMetadata
from openmarket_api.domain.entities import Company
from openmarket_api.persistence.document_repository import PublicDocumentRepository
from openmarket_api.persistence.repositories import CompanyRepository, InstrumentRepository
from openmarket_api.providers.contracts import DocumentProvider
from openmarket_api.services.company_events import CompanyEventProjectionService


@dataclass(frozen=True)
class DocumentSyncResult:
    ticker: str
    cvm_code: str | None
    documents: int


class DocumentSyncService:
    def __init__(
        self,
        *,
        session: Session,
        document_provider: DocumentProvider,
    ) -> None:
        self.session = session
        self.document_provider = document_provider

    async def sync(
        self,
        ticker: str,
        *,
        start: date | None = None,
        end: date | None = None,
    ) -> DocumentSyncResult:
        if start is not None and end is not None and start > end:
            raise ValueError("start must be on or before end")

        instrument = InstrumentRepository(self.session).get_by_ticker(ticker)
        if instrument is None:
            raise LookupError(
                f"asset not found for ticker {ticker.upper()}; run sync-asset first"
            )
        if instrument.company_id is None:
            raise LookupError(f"ticker {ticker.upper()} is not linked to a company")

        company_record = CompanyRepository(self.session).get_by_id(instrument.company_id)
        if company_record is None:
            raise LookupError(f"company not found for ticker {ticker.upper()}")

        company = Company(
            id=company_record.id,
            legal_name=company_record.legal_name,
            trading_name=company_record.trading_name,
            cnpj=company_record.cnpj,
            cvm_code=company_record.cvm_code,
            website=company_record.website,
            investor_relations_url=company_record.investor_relations_url,
            source=(
                SourceMetadata.model_validate(company_record.source)
                if company_record.source is not None
                else None
            ),
        )

        try:
            documents = await self.document_provider.get_documents(
                company,
                start=start,
                end=end,
            )
            repository = PublicDocumentRepository(self.session)
            projector = CompanyEventProjectionService(self.session)
            for document in documents:
                document.company_id = company_record.id
                record = repository.upsert(document)
                projector.project_document(record)
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise

        return DocumentSyncResult(
            ticker=instrument.ticker,
            cvm_code=company.cvm_code,
            documents=len(documents),
        )
