from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from hashlib import sha256
from io import BytesIO
from uuid import UUID

from pypdf import PdfReader
from sqlalchemy.orm import Session

from openmarket_api.core.settings import Settings, get_settings
from openmarket_api.domain.documents import (
    DocumentProcessingStatus,
    DocumentSection,
)
from openmarket_api.persistence.document_repository import PublicDocumentRepository
from openmarket_api.providers.contracts import DocumentContentProvider

logger = logging.getLogger("openmarket.documents")


@dataclass(frozen=True)
class ExtractedDocument:
    page_count: int
    sections: list[DocumentSection]


@dataclass(frozen=True)
class DocumentProcessingResult:
    document_id: UUID
    status: DocumentProcessingStatus
    page_count: int | None
    sections: int
    skipped: bool = False


@dataclass(frozen=True)
class DocumentBatchProcessingResult:
    ticker: str
    attempted: int
    ready: int
    failed: int
    skipped: int
    errors: list[str] = field(default_factory=list)


class PdfDocumentExtractor:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def extract(self, document_id: UUID, content: bytes) -> ExtractedDocument:
        reader = PdfReader(BytesIO(content), strict=False)
        if reader.is_encrypted:
            try:
                decrypted = reader.decrypt("")
            except Exception as exc:
                raise ValueError("encrypted PDF cannot be processed") from exc
            if not decrypted:
                raise ValueError("encrypted PDF cannot be processed")

        page_count = len(reader.pages)
        if page_count <= 0:
            raise ValueError("PDF has no pages")
        if page_count > self.settings.document_max_pages:
            raise ValueError(
                f"PDF exceeds maximum page count of {self.settings.document_max_pages}"
            )

        sections: list[DocumentSection] = []
        sequence = 1
        for page_number, page in enumerate(reader.pages, start=1):
            text = self._normalize_text(page.extract_text() or "")
            if not text:
                continue
            sections.append(
                DocumentSection(
                    document_id=document_id,
                    sequence=sequence,
                    page_start=page_number,
                    page_end=page_number,
                    heading=f"Página {page_number}",
                    text=text,
                )
            )
            sequence += 1

        if not sections:
            raise ValueError(
                "PDF has no extractable text; scanned/image-only documents require OCR"
            )
        return ExtractedDocument(page_count=page_count, sections=sections)

    @staticmethod
    def _normalize_text(value: str) -> str:
        value = value.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.split("\n")]
        normalized: list[str] = []
        blank = False
        for line in lines:
            if line:
                normalized.append(line)
                blank = False
            elif normalized and not blank:
                normalized.append("")
                blank = True
        return "\n".join(normalized).strip()


class DocumentProcessingService:
    def __init__(
        self,
        *,
        session: Session,
        content_provider: DocumentContentProvider,
        extractor: PdfDocumentExtractor | None = None,
    ) -> None:
        self.session = session
        self.content_provider = content_provider
        self.extractor = extractor or PdfDocumentExtractor()
        self.repository = PublicDocumentRepository(session)

    async def process_document(
        self,
        document_id: UUID,
        *,
        force: bool = False,
    ) -> DocumentProcessingResult:
        record = self.repository.get_record(document_id)
        if record is None:
            raise LookupError(f"document not found: {document_id}")

        existing_sections = self.repository.section_count(document_id)
        if (
            not force
            and record.processing_status == DocumentProcessingStatus.READY.value
            and existing_sections > 0
        ):
            return DocumentProcessingResult(
                document_id=document_id,
                status=DocumentProcessingStatus.READY,
                page_count=record.page_count,
                sections=existing_sections,
                skipped=True,
            )

        document = self.repository.public_document(record)
        try:
            fetched = await self.content_provider.fetch(document)
            digest = sha256(fetched.content).hexdigest()
            extracted = self.extractor.extract(document_id, fetched.content)

            self.repository.replace_sections(document_id, extracted.sections)
            self.repository.mark_ready(
                document_id,
                page_count=extracted.page_count,
                content_size_bytes=len(fetched.content),
                content_sha256=digest,
                processed_at=datetime.now(UTC),
            )
            record.content_type = fetched.content_type
            self.session.commit()
        except Exception as exc:
            self.session.rollback()
            self.repository.mark_failed(
                document_id,
                error=f"{type(exc).__name__}: {exc}",
                processed_at=datetime.now(UTC),
            )
            self.session.commit()
            raise

        return DocumentProcessingResult(
            document_id=document_id,
            status=DocumentProcessingStatus.READY,
            page_count=extracted.page_count,
            sections=len(extracted.sections),
        )

    async def process_for_ticker(
        self,
        ticker: str,
        *,
        limit: int = 10,
        include_failed: bool = True,
    ) -> DocumentBatchProcessingResult:
        if limit < 1:
            raise ValueError("limit must be at least 1")

        company_id = self.repository.company_id_for_ticker(ticker)
        if company_id is None:
            raise LookupError(f"ticker {ticker.upper()} is not linked to a company")

        records = self.repository.list_for_processing(
            company_id=company_id,
            include_failed=include_failed,
            limit=limit,
        )
        if not records:
            return DocumentBatchProcessingResult(
                ticker=ticker.upper(),
                attempted=0,
                ready=0,
                failed=0,
                skipped=0,
            )

        ready = 0
        failed = 0
        skipped = 0
        errors: list[str] = []
        document_ids = [record.id for record in records]

        for document_id in document_ids:
            try:
                result = await self.process_document(document_id)
            except Exception as exc:  # noqa: BLE001 - batch isolates per-document failures
                failed += 1
                error = f"{document_id}: {type(exc).__name__}: {exc}"
                errors.append(error)
                logger.warning("document processing failed: %s", error)
                continue

            if result.skipped:
                skipped += 1
            else:
                ready += 1

        return DocumentBatchProcessingResult(
            ticker=ticker.upper(),
            attempted=len(document_ids),
            ready=ready,
            failed=failed,
            skipped=skipped,
            errors=errors,
        )
