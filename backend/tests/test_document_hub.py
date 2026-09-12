from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.documents import (
    DocumentProcessingStatus,
    DocumentSection,
    DocumentType,
    PublicDocument,
)
from openmarket_api.domain.entities import Company, Instrument
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.document_repository import PublicDocumentRepository
from openmarket_api.persistence.repositories import CompanyRepository, InstrumentRepository
from openmarket_api.services.document_hub import DocumentHubService


def _source(reference_date: date) -> SourceMetadata:
    return SourceMetadata(
        provider="cvm-public-documents",
        source_name="CVM — documentos públicos",
        source_url="https://dados.cvm.gov.br/",
        reference_date=reference_date,
        quality=DataQuality.OFFICIAL,
        license=DataLicense(
            license_id="fixture",
            redistribution=RedistributionScope.ALLOWED,
        ),
    )


def _seed_company(session: Session) -> Company:
    company = Company(
        legal_name="PETROLEO BRASILEIRO S.A. PETROBRAS",
        trading_name="PETROBRAS",
        cvm_code="9512",
    )
    company_record = CompanyRepository(session).upsert(company)
    for ticker in ("PETR3", "PETR4"):
        InstrumentRepository(session).upsert(
            Instrument(ticker=ticker, company_id=company_record.id),
            company_id=company_record.id,
        )
    session.commit()
    return Company(
        id=company_record.id,
        legal_name=company_record.legal_name,
        trading_name=company_record.trading_name,
        cvm_code=company_record.cvm_code,
    )


def test_document_hub_filters_by_ticker_and_returns_company_context() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = _seed_company(session)
        repo = PublicDocumentRepository(session)
        document = PublicDocument(
            company_id=company.id,
            title="Relatório anual Petrobras 2025",
            document_type=DocumentType.ANNUAL_REPORT,
            source_url="https://example.test/petrobras-2025.pdf",
            published_at=date(2026, 3, 15),
            reference_period="2025",
            page_count=120,
            processing_status=DocumentProcessingStatus.READY,
            source=_source(date(2026, 3, 15)),
        )
        repo.upsert(document)
        session.commit()

        results = DocumentHubService(session).list_documents(ticker="petr4")

        assert len(results) == 1
        assert results[0].title == document.title
        assert results[0].company_name == "PETROBRAS"
        assert results[0].tickers == ["PETR3", "PETR4"]
        assert results[0].processing_status == DocumentProcessingStatus.READY


def test_document_detail_preserves_section_order_and_pages() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = _seed_company(session)
        repo = PublicDocumentRepository(session)
        document = PublicDocument(
            company_id=company.id,
            title="Release de resultados 2T26",
            document_type=DocumentType.EARNINGS_RELEASE,
            source_url="https://example.test/release-2t26.pdf",
            published_at=date(2026, 8, 7),
            reference_period="2T26",
            page_count=20,
            processing_status=DocumentProcessingStatus.READY,
            source=_source(date(2026, 8, 7)),
        )
        record = repo.upsert(document)
        repo.replace_sections(
            record.id,
            [
                DocumentSection(
                    document_id=record.id,
                    sequence=2,
                    page_start=5,
                    page_end=8,
                    heading="Desempenho financeiro",
                    text="Receita, margens e geração de caixa.",
                ),
                DocumentSection(
                    document_id=record.id,
                    sequence=1,
                    page_start=1,
                    page_end=4,
                    heading="Destaques",
                    text="Principais destaques do trimestre.",
                ),
            ],
        )
        session.commit()

        detail = DocumentHubService(session).get_document(record.id)

        assert detail.title == document.title
        assert [section.sequence for section in detail.sections] == [1, 2]
        assert detail.sections[0].page_start == 1
        assert detail.sections[1].heading == "Desempenho financeiro"


def test_document_hub_supports_type_and_text_filters() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = _seed_company(session)
        repo = PublicDocumentRepository(session)
        repo.upsert(
            PublicDocument(
                company_id=company.id,
                title="Fato relevante — plano estratégico",
                document_type=DocumentType.MATERIAL_FACT,
                published_at=date(2026, 9, 1),
                processing_status=DocumentProcessingStatus.PENDING,
                source=_source(date(2026, 9, 1)),
            )
        )
        repo.upsert(
            PublicDocument(
                company_id=company.id,
                title="Apresentação institucional",
                document_type=DocumentType.PRESENTATION,
                published_at=date(2026, 8, 1),
                processing_status=DocumentProcessingStatus.PENDING,
                source=_source(date(2026, 8, 1)),
            )
        )
        session.commit()

        results = DocumentHubService(session).list_documents(
            document_type=DocumentType.MATERIAL_FACT,
            query_text="estratégico",
        )

        assert len(results) == 1
        assert results[0].document_type == DocumentType.MATERIAL_FACT


def test_document_hub_rejects_unknown_ticker() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        try:
            DocumentHubService(session).list_documents(ticker="XXXX3")
        except LookupError as exc:
            assert "XXXX3" in str(exc)
        else:
            raise AssertionError("unknown ticker should not resolve")
