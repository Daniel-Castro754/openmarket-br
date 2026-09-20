from datetime import date

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from openmarket_api.api.routes.events import get_company_events
from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.documents import DocumentType, PublicDocument
from openmarket_api.domain.entities import Company, Instrument
from openmarket_api.domain.events import (
    CompanyEventCategory,
    CompanyEventType,
)
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.document_repository import PublicDocumentRepository
from openmarket_api.persistence.models import CompanyEventRecord
from openmarket_api.persistence.repositories import CompanyRepository, InstrumentRepository
from openmarket_api.services.company_events import (
    CompanyEventProjectionService,
    CompanyEventService,
)


def _source(reference_date: date) -> SourceMetadata:
    return SourceMetadata(
        provider="cvm-ipe-documents",
        source_name="CVM — Documentos Periódicos e Eventuais (IPE)",
        source_url="https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe",
        reference_date=reference_date,
        quality=DataQuality.OFFICIAL,
        license=DataLicense(
            license_id="odc-odbl",
            redistribution=RedistributionScope.ATTRIBUTION_REQUIRED,
            attribution_required=True,
        ),
    )


def _seed_company(session: Session) -> Company:
    company = Company(
        legal_name="PETROLEO BRASILEIRO S.A. PETROBRAS",
        trading_name="PETROBRAS",
        cvm_code="9512",
    )
    record = CompanyRepository(session).upsert(company)
    InstrumentRepository(session).upsert(
        Instrument(ticker="PETR4", company_id=record.id),
        company_id=record.id,
    )
    session.flush()
    return Company(
        id=record.id,
        legal_name=record.legal_name,
        trading_name=record.trading_name,
        cvm_code=record.cvm_code,
    )


def _document(
    company_id,
    *,
    title: str,
    published_at: date,
    document_type: DocumentType = DocumentType.OTHER,
    category: str | None = None,
    subject: str | None = None,
) -> PublicDocument:
    return PublicDocument(
        company_id=company_id,
        title=title,
        document_type=document_type,
        source_url="https://www.rad.cvm.gov.br/ENET/frmDownloadDocumento.aspx?numProtocolo=1",
        published_at=published_at,
        reference_period="2026",
        source_category=category,
        source_subject=subject,
        source=_source(published_at),
    )


def test_document_projection_is_idempotent_and_preserves_source_document() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = _seed_company(session)
        document = _document(
            company.id,
            title="Petrobras anuncia atualização operacional",
            published_at=date(2026, 9, 20),
            category="Comunicado ao Mercado",
        )
        record = PublicDocumentRepository(session).upsert(document)
        projector = CompanyEventProjectionService(session)

        assert projector.project_document(record) is True
        first = session.scalar(select(CompanyEventRecord))
        assert first is not None

        assert projector.project_document(record) is True
        session.commit()

        count = session.scalar(select(func.count()).select_from(CompanyEventRecord))
        second = session.scalar(select(CompanyEventRecord))

        assert count == 1
        assert second is not None
        assert second.id == first.id
        assert second.source_document_id == record.id
        assert second.category == CompanyEventCategory.MATERIAL.value
        assert second.event_type == CompanyEventType.DOCUMENT.value
        assert second.source_url == document.source_url


def test_document_projection_updates_category_without_duplication() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = _seed_company(session)
        record = PublicDocumentRepository(session).upsert(
            _document(
                company.id,
                title="Documento corporativo",
                published_at=date(2026, 9, 19),
                category="Outros",
            )
        )
        projector = CompanyEventProjectionService(session)
        projector.project_document(record)

        record.source_category = "Assembleia"
        record.source_subject = "Deliberação societária"
        projector.project_document(record)
        session.commit()

        events = list(session.scalars(select(CompanyEventRecord)))
        assert len(events) == 1
        assert events[0].category == CompanyEventCategory.GOVERNANCE.value
        assert events[0].event_type == CompanyEventType.GOVERNANCE.value
        assert events[0].description == "Deliberação societária"


def test_event_type_and_category_mapping_are_deterministic() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = _seed_company(session)
        repo = PublicDocumentRepository(session)
        documents = [
            _document(
                company.id,
                title="Fato relevante",
                published_at=date(2026, 9, 20),
                document_type=DocumentType.MATERIAL_FACT,
            ),
            _document(
                company.id,
                title="Release de resultados 2T26",
                published_at=date(2026, 8, 7),
                document_type=DocumentType.EARNINGS_RELEASE,
            ),
            _document(
                company.id,
                title="Calendário de Eventos Corporativos",
                published_at=date(2026, 1, 10),
            ),
            _document(
                company.id,
                title="Emissão de debêntures",
                published_at=date(2026, 2, 10),
            ),
        ]
        projector = CompanyEventProjectionService(session)
        for document in documents:
            projector.project_document(repo.upsert(document))
        session.commit()

        timeline = CompanyEventService(session).timeline("PETR4")
        observed = {(event.event_type, event.category) for event in timeline.events}

        assert (CompanyEventType.MATERIAL_FACT, CompanyEventCategory.MATERIAL) in observed
        assert (CompanyEventType.EARNINGS, CompanyEventCategory.RESULTS) in observed
        assert (CompanyEventType.DOCUMENT, CompanyEventCategory.CALENDAR) in observed
        assert (CompanyEventType.DOCUMENT, CompanyEventCategory.FINANCE) in observed


def test_timeline_filters_and_route_return_company_events() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = _seed_company(session)
        repo = PublicDocumentRepository(session)
        projector = CompanyEventProjectionService(session)

        material = repo.upsert(
            _document(
                company.id,
                title="Fato relevante",
                published_at=date(2026, 9, 10),
                document_type=DocumentType.MATERIAL_FACT,
            )
        )
        results = repo.upsert(
            _document(
                company.id,
                title="Release de resultados",
                published_at=date(2026, 8, 7),
                document_type=DocumentType.EARNINGS_RELEASE,
            )
        )
        projector.project_document(material)
        projector.project_document(results)
        session.commit()

        response = get_company_events(
            "PETR4",
            session,
            category=CompanyEventCategory.MATERIAL,
            event_type=None,
            start=date(2026, 9, 1),
            end=date(2026, 9, 30),
            limit=100,
            offset=0,
        )

        assert response.ticker == "PETR4"
        assert len(response.events) == 1
        assert response.events[0].title == "Fato relevante"
        assert response.events[0].source_document_id == material.id


def test_project_for_ticker_backfills_existing_documents() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = _seed_company(session)
        repo = PublicDocumentRepository(session)
        repo.upsert(
            _document(
                company.id,
                title="Posição Consolidada",
                published_at=date(2026, 9, 5),
                category="Governança",
            )
        )
        repo.upsert(
            _document(
                company.id,
                title="Relatório sem data",
                published_at=date(2026, 9, 4),
                document_type=DocumentType.ANNUAL_REPORT,
            )
        )
        session.commit()

        first = CompanyEventProjectionService(session).project_for_ticker("PETR4")
        second = CompanyEventProjectionService(session).project_for_ticker("PETR4")

        count = session.scalar(select(func.count()).select_from(CompanyEventRecord))
        assert first.projected == 2
        assert second.projected == 2
        assert count == 2
