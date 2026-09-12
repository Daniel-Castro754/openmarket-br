import asyncio
from datetime import date

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.documents import DocumentType, PublicDocument
from openmarket_api.domain.entities import Company, Instrument
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.models import PublicDocumentRecord
from openmarket_api.persistence.repositories import CompanyRepository, InstrumentRepository
from openmarket_api.providers.contracts import DocumentProvider
from openmarket_api.services.document_sync import DocumentSyncService


class FakeDocumentProvider(DocumentProvider):
    name = "fake-documents"

    async def healthcheck(self) -> bool:
        return True

    async def get_documents(
        self,
        company: Company,
        start: date | None = None,
        end: date | None = None,
    ) -> list[PublicDocument]:
        return [
            PublicDocument(
                company_id=company.id,
                title="Fato relevante de teste",
                document_type=DocumentType.MATERIAL_FACT,
                source_url="https://example.test/fato.pdf",
                published_at=date(2026, 9, 1),
                reference_period="2026-09-01",
                source=SourceMetadata(
                    provider=self.name,
                    source_name="Fixture",
                    reference_date=date(2026, 9, 1),
                    quality=DataQuality.OFFICIAL,
                    license=DataLicense(
                        license_id="fixture",
                        redistribution=RedistributionScope.ALLOWED,
                    ),
                ),
            )
        ]


def _seed_asset(session: Session) -> None:
    company = Company(
        legal_name="PETROLEO BRASILEIRO S.A. PETROBRAS",
        trading_name="PETROBRAS",
        cvm_code="9512",
    )
    company_record = CompanyRepository(session).upsert(company)
    InstrumentRepository(session).upsert(
        Instrument(ticker="PETR4", company_id=company_record.id),
        company_id=company_record.id,
    )
    session.commit()


def test_sync_documents_persists_provider_results_idempotently() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed_asset(session)
        service = DocumentSyncService(
            session=session,
            document_provider=FakeDocumentProvider(),
        )

        first = asyncio.run(service.sync("PETR4"))
        second = asyncio.run(service.sync("PETR4"))
        stored = list(session.scalars(select(PublicDocumentRecord)))

        assert first.documents == 1
        assert second.documents == 1
        assert first.cvm_code == "9512"
        assert len(stored) == 1
        assert stored[0].title == "Fato relevante de teste"


def test_sync_documents_requires_asset_to_be_persisted_first() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        service = DocumentSyncService(
            session=session,
            document_provider=FakeDocumentProvider(),
        )
        try:
            asyncio.run(service.sync("XXXX3"))
        except LookupError as exc:
            assert "sync-asset first" in str(exc)
        else:
            raise AssertionError("document sync should require an existing asset")
