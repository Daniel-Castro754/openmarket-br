import asyncio
from datetime import date
from io import BytesIO

import httpx
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
    DocumentType,
    PublicDocument,
)
from openmarket_api.domain.entities import Company, Instrument
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.document_repository import PublicDocumentRepository
from openmarket_api.persistence.repositories import CompanyRepository, InstrumentRepository
from openmarket_api.providers.contracts import DocumentContent, DocumentContentProvider
from openmarket_api.providers.cvm_document_content import CVMDocumentContentProvider
from openmarket_api.services.document_hub import DocumentHubService
from openmarket_api.services.document_processing import DocumentProcessingService


def _minimal_pdf(text: str = "Receita cresceu dez por cento") -> bytes:
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
        ),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length %d >>\nstream\n" % len(stream)
        + stream
        + b"\nendstream",
    ]

    output = BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets = [0]
    for index, body in enumerate(objects, start=1):
        offsets.append(output.tell())
        output.write(f"{index} 0 obj\n".encode())
        output.write(body)
        output.write(b"\nendobj\n")

    xref = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n".encode())
    output.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.write(f"{offset:010d} 00000 n \n".encode())
    output.write(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref}\n%%EOF\n"
        ).encode()
    )
    return output.getvalue()


def _source(
    *,
    redistribution: RedistributionScope = RedistributionScope.ATTRIBUTION_REQUIRED,
) -> SourceMetadata:
    return SourceMetadata(
        provider="cvm-ipe-documents",
        source_name="CVM — Documentos Periódicos e Eventuais (IPE)",
        source_url="https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe",
        reference_date=date(2026, 9, 1),
        quality=DataQuality.OFFICIAL,
        license=DataLicense(
            license_id="odc-odbl",
            redistribution=redistribution,
            attribution_required=True,
        ),
    )


def _seed_document(session: Session) -> PublicDocument:
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
    document = PublicDocument(
        company_id=company_record.id,
        title="Release operacional",
        document_type=DocumentType.EARNINGS_RELEASE,
        source_url=(
            "https://www.rad.cvm.gov.br/ENET/frmDownloadDocumento.aspx?"
            "Tela=ext&numProtocolo=123"
        ),
        published_at=date(2026, 9, 1),
        source=_source(),
    )
    PublicDocumentRepository(session).upsert(document)
    session.commit()
    return document


class FakeContentProvider(DocumentContentProvider):
    name = "fake-content"

    def __init__(self, content: bytes) -> None:
        self.content = content
        self.calls = 0

    async def healthcheck(self) -> bool:
        return True

    async def fetch(self, document: PublicDocument) -> DocumentContent:
        self.calls += 1
        return DocumentContent(
            content=self.content,
            content_type="application/pdf",
            final_url=document.source_url or "",
        )


def test_document_processing_extracts_real_pdf_text_and_is_idempotent() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        document = _seed_document(session)
        provider = FakeContentProvider(_minimal_pdf())
        service = DocumentProcessingService(session=session, content_provider=provider)

        first = asyncio.run(service.process_document(document.id))
        second = asyncio.run(service.process_document(document.id))

        detail = PublicDocumentRepository(session).get_document(document.id)
        assert detail is not None
        assert first.status == DocumentProcessingStatus.READY
        assert first.page_count == 1
        assert first.sections == 1
        assert second.skipped is True
        assert provider.calls == 1
        assert detail.processing_status == DocumentProcessingStatus.READY
        assert detail.page_count == 1
        assert detail.content_size_bytes == len(provider.content)
        assert len(detail.content_sha256 or "") == 64
        assert detail.processing_error is None
        assert detail.processed_at is not None
        assert detail.sections[0].page_start == 1
        assert "Receita cresceu dez por cento" in detail.sections[0].text

        matches = DocumentHubService(session).list_documents(
            query_text="cresceu dez",
        )
        assert [item.id for item in matches] == [document.id]


def test_metadata_resync_does_not_reset_ready_processing_state() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        document = _seed_document(session)
        provider = FakeContentProvider(_minimal_pdf())
        asyncio.run(
            DocumentProcessingService(
                session=session,
                content_provider=provider,
            ).process_document(document.id)
        )

        refreshed = document.model_copy(
            update={
                "source_category": "Comunicados",
                "processing_status": DocumentProcessingStatus.PENDING,
                "page_count": None,
            }
        )
        PublicDocumentRepository(session).upsert(refreshed)
        session.commit()

        detail = PublicDocumentRepository(session).get_document(document.id)
        assert detail is not None
        assert detail.title == "Release operacional"
        assert detail.source_category == "Comunicados"
        assert detail.processing_status == DocumentProcessingStatus.READY
        assert detail.page_count == 1
        assert len(detail.sections) == 1
        assert detail.content_sha256 is not None


def test_processing_failure_marks_document_failed_without_losing_metadata() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        document = _seed_document(session)
        provider = FakeContentProvider(b"not-a-pdf")

        try:
            asyncio.run(
                DocumentProcessingService(
                    session=session,
                    content_provider=provider,
                ).process_document(document.id)
            )
        except Exception:
            pass
        else:
            raise AssertionError("invalid PDF should fail processing")

        detail = PublicDocumentRepository(session).get_document(document.id)
        assert detail is not None
        assert detail.title == "Release operacional"
        assert detail.source_url is not None
        assert detail.processing_status == DocumentProcessingStatus.FAILED
        assert detail.processed_at is not None
        assert detail.processing_error


def test_cvm_content_provider_accepts_trusted_pdf_and_checks_signature() -> None:
    pdf = _minimal_pdf()

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "www.rad.cvm.gov.br"
        return httpx.Response(
            200,
            content=pdf,
            headers={
                "content-type": "application/pdf",
                "content-length": str(len(pdf)),
            },
        )

    document = PublicDocument(
        title="Documento oficial",
        source_url="https://www.rad.cvm.gov.br/ENET/documento.pdf",
        source=_source(),
    )
    provider = CVMDocumentContentProvider(transport=httpx.MockTransport(handler))
    fetched = asyncio.run(provider.fetch(document))

    assert fetched.content == pdf
    assert fetched.content_type == "application/pdf"


def test_cvm_content_provider_rejects_untrusted_host_and_license() -> None:
    provider = CVMDocumentContentProvider(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, content=b"unused"))
    )
    untrusted = PublicDocument(
        title="Documento externo",
        source_url="https://example.com/document.pdf",
        source=_source(),
    )
    restricted = PublicDocument(
        title="Documento restrito",
        source_url="https://www.rad.cvm.gov.br/ENET/documento.pdf",
        source=_source(redistribution=RedistributionScope.INTERNAL_ONLY),
    )

    for document, expected in (
        (untrusted, "untrusted CVM document host"),
        (restricted, "license does not allow"),
    ):
        try:
            asyncio.run(provider.fetch(document))
        except (ValueError, PermissionError) as exc:
            assert expected in str(exc)
        else:
            raise AssertionError("unsafe document fetch should be rejected")
