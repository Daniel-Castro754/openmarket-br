from datetime import datetime
from hashlib import sha256
from uuid import UUID

from sqlalchemy import delete, exists, func, or_, select
from sqlalchemy.orm import Session

from openmarket_api.domain.common import SourceMetadata
from openmarket_api.domain.documents import (
    DocumentDetail,
    DocumentProcessingStatus,
    DocumentSection,
    DocumentSummary,
    PublicDocument,
)
from openmarket_api.persistence.models import (
    CompanyRecord,
    DocumentSectionRecord,
    InstrumentRecord,
    PublicDocumentRecord,
)


class PublicDocumentRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    @staticmethod
    def legacy_natural_key(document: PublicDocument) -> str:
        source_url = (document.source_url or "-").strip()
        published_at = document.published_at.isoformat() if document.published_at else "-"
        company = str(document.company_id) if document.company_id else "-"
        title = document.title.strip()
        return (
            f"{document.source.provider}|{company}|{document.document_type.value}|"
            f"{published_at}|{source_url}|{title}"
        )

    @classmethod
    def natural_key(cls, document: PublicDocument) -> str:
        identity = cls.legacy_natural_key(document)
        digest = sha256(identity.encode("utf-8")).hexdigest()
        return f"sha256:{digest}"

    def upsert(self, document: PublicDocument) -> PublicDocumentRecord:
        natural_key = self.natural_key(document)
        record = self.session.scalar(
            select(PublicDocumentRecord).where(PublicDocumentRecord.natural_key == natural_key)
        )
        if record is None:
            legacy_key = self.legacy_natural_key(document)
            if len(legacy_key) <= 1024:
                record = self.session.scalar(
                    select(PublicDocumentRecord).where(
                        PublicDocumentRecord.natural_key == legacy_key
                    )
                )

        metadata_values = {
            "natural_key": natural_key,
            "company_id": document.company_id,
            "title": document.title,
            "document_type": document.document_type.value,
            "source_url": document.source_url,
            "published_at": document.published_at,
            "reference_period": document.reference_period,
            "source_category": document.source_category,
            "source_document_type": document.source_document_type,
            "source_species": document.source_species,
            "source_subject": document.source_subject,
            "source_presentation_type": document.source_presentation_type,
            "content_type": document.content_type,
            "source": document.source.model_dump(mode="json"),
        }
        if record is None:
            record = PublicDocumentRecord(
                id=document.id,
                page_count=document.page_count,
                processing_status=document.processing_status.value,
                content_size_bytes=document.content_size_bytes,
                content_sha256=document.content_sha256,
                processed_at=document.processed_at,
                processing_error=document.processing_error,
                **metadata_values,
            )
            self.session.add(record)
        else:
            for field, value in metadata_values.items():
                setattr(record, field, value)
        self.session.flush()
        return record

    def replace_sections(
        self,
        document_id: UUID,
        sections: list[DocumentSection],
    ) -> None:
        self.session.execute(
            delete(DocumentSectionRecord).where(DocumentSectionRecord.document_id == document_id)
        )
        for section in sorted(sections, key=lambda item: item.sequence):
            self.session.add(
                DocumentSectionRecord(
                    id=section.id,
                    document_id=document_id,
                    sequence=section.sequence,
                    page_start=section.page_start,
                    page_end=section.page_end,
                    heading=section.heading,
                    text=section.text,
                )
            )
        self.session.flush()

    def get_record(self, document_id: UUID) -> PublicDocumentRecord | None:
        return self.session.get(PublicDocumentRecord, document_id)

    def public_document(self, record: PublicDocumentRecord) -> PublicDocument:
        return PublicDocument(
            id=record.id,
            company_id=record.company_id,
            title=record.title,
            document_type=record.document_type,
            source_url=record.source_url,
            published_at=record.published_at,
            reference_period=record.reference_period,
            source_category=record.source_category,
            source_document_type=record.source_document_type,
            source_species=record.source_species,
            source_subject=record.source_subject,
            source_presentation_type=record.source_presentation_type,
            content_type=record.content_type,
            page_count=record.page_count,
            processing_status=record.processing_status,
            content_size_bytes=record.content_size_bytes,
            content_sha256=record.content_sha256,
            processed_at=record.processed_at,
            processing_error=record.processing_error,
            source=SourceMetadata.model_validate(record.source),
        )

    def list_for_processing(
        self,
        *,
        company_id: UUID | None = None,
        include_failed: bool = True,
        limit: int = 25,
    ) -> list[PublicDocumentRecord]:
        statuses = [DocumentProcessingStatus.PENDING.value]
        if include_failed:
            statuses.append(DocumentProcessingStatus.FAILED.value)
        query = select(PublicDocumentRecord).where(
            PublicDocumentRecord.processing_status.in_(statuses),
            PublicDocumentRecord.source_url.is_not(None),
        )
        if company_id is not None:
            query = query.where(PublicDocumentRecord.company_id == company_id)
        query = query.order_by(
            PublicDocumentRecord.published_at.desc(),
            PublicDocumentRecord.id,
        ).limit(limit)
        return list(self.session.scalars(query))

    def section_count(self, document_id: UUID) -> int:
        return int(
            self.session.scalar(
                select(func.count())
                .select_from(DocumentSectionRecord)
                .where(DocumentSectionRecord.document_id == document_id)
            )
            or 0
        )

    def mark_ready(
        self,
        document_id: UUID,
        *,
        page_count: int,
        content_size_bytes: int,
        content_sha256: str,
        processed_at: datetime,
    ) -> None:
        record = self.session.get(PublicDocumentRecord, document_id)
        if record is None:
            raise LookupError(f"document not found: {document_id}")
        record.page_count = page_count
        record.processing_status = DocumentProcessingStatus.READY.value
        record.content_size_bytes = content_size_bytes
        record.content_sha256 = content_sha256
        record.processed_at = processed_at
        record.processing_error = None
        self.session.flush()

    def mark_failed(
        self,
        document_id: UUID,
        *,
        error: str,
        processed_at: datetime,
    ) -> None:
        record = self.session.get(PublicDocumentRecord, document_id)
        if record is None:
            raise LookupError(f"document not found: {document_id}")
        record.processing_status = DocumentProcessingStatus.FAILED.value
        record.processed_at = processed_at
        record.processing_error = error[:4000]
        self.session.flush()

    def list_documents(
        self,
        *,
        company_id: UUID | None = None,
        document_type: str | None = None,
        query_text: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[DocumentSummary]:
        query = select(PublicDocumentRecord)
        if company_id is not None:
            query = query.where(PublicDocumentRecord.company_id == company_id)
        if document_type is not None:
            query = query.where(PublicDocumentRecord.document_type == document_type)
        if query_text:
            needle = query_text.strip().casefold()
            section_match = exists(
                select(DocumentSectionRecord.id).where(
                    DocumentSectionRecord.document_id == PublicDocumentRecord.id,
                    or_(
                        func.lower(DocumentSectionRecord.text).contains(needle),
                        func.lower(func.coalesce(DocumentSectionRecord.heading, "")).contains(needle),
                    ),
                )
            )
            query = query.where(
                or_(
                    func.lower(PublicDocumentRecord.title).contains(needle),
                    func.lower(func.coalesce(PublicDocumentRecord.reference_period, "")).contains(needle),
                    func.lower(func.coalesce(PublicDocumentRecord.source_category, "")).contains(needle),
                    func.lower(func.coalesce(PublicDocumentRecord.source_document_type, "")).contains(needle),
                    func.lower(func.coalesce(PublicDocumentRecord.source_species, "")).contains(needle),
                    func.lower(func.coalesce(PublicDocumentRecord.source_subject, "")).contains(needle),
                    section_match,
                )
            )
        query = query.order_by(
            PublicDocumentRecord.published_at.desc(),
            PublicDocumentRecord.title,
        ).offset(offset).limit(limit)
        return [self._summary(record) for record in self.session.scalars(query)]

    def get_document(self, document_id: UUID) -> DocumentDetail | None:
        record = self.session.get(PublicDocumentRecord, document_id)
        if record is None:
            return None
        sections = list(
            self.session.scalars(
                select(DocumentSectionRecord)
                .where(DocumentSectionRecord.document_id == document_id)
                .order_by(DocumentSectionRecord.sequence)
            )
        )
        summary = self._summary(record)
        return DocumentDetail(
            **summary.model_dump(),
            sections=[
                DocumentSection(
                    id=section.id,
                    document_id=section.document_id,
                    sequence=section.sequence,
                    page_start=section.page_start,
                    page_end=section.page_end,
                    heading=section.heading,
                    text=section.text,
                )
                for section in sections
            ],
        )

    def company_id_for_ticker(self, ticker: str) -> UUID | None:
        instrument = self.session.scalar(
            select(InstrumentRecord).where(
                InstrumentRecord.exchange == "B3",
                InstrumentRecord.ticker == ticker.upper(),
            )
        )
        if instrument is None:
            raise LookupError(f"asset not found for ticker {ticker.upper()}")
        return instrument.company_id

    def _summary(self, record: PublicDocumentRecord) -> DocumentSummary:
        company_name: str | None = None
        tickers: list[str] = []
        if record.company_id is not None:
            company = self.session.get(CompanyRecord, record.company_id)
            if company is not None:
                company_name = company.trading_name or company.legal_name
            tickers = list(
                self.session.scalars(
                    select(InstrumentRecord.ticker)
                    .where(InstrumentRecord.company_id == record.company_id)
                    .order_by(InstrumentRecord.ticker)
                )
            )

        return DocumentSummary(
            id=record.id,
            company_id=record.company_id,
            company_name=company_name,
            tickers=tickers,
            title=record.title,
            document_type=record.document_type,
            source_url=record.source_url,
            published_at=record.published_at,
            reference_period=record.reference_period,
            source_category=record.source_category,
            source_document_type=record.source_document_type,
            source_species=record.source_species,
            source_subject=record.source_subject,
            source_presentation_type=record.source_presentation_type,
            content_type=record.content_type,
            page_count=record.page_count,
            processing_status=record.processing_status,
            content_size_bytes=record.content_size_bytes,
            content_sha256=record.content_sha256,
            processed_at=record.processed_at,
            processing_error=record.processing_error,
            source=SourceMetadata.model_validate(record.source),
        )