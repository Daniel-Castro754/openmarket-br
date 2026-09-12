from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from openmarket_api.domain.common import SourceMetadata
from openmarket_api.domain.documents import (
    DocumentDetail,
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
    def natural_key(document: PublicDocument) -> str:
        source_url = (document.source_url or "-").strip()
        published_at = document.published_at.isoformat() if document.published_at else "-"
        company = str(document.company_id) if document.company_id else "-"
        return "|".join(
            (
                document.source.provider,
                company,
                document.document_type.value,
                published_at,
                source_url,
                document.title.strip(),
            )
        )

    def upsert(self, document: PublicDocument) -> PublicDocumentRecord:
        natural_key = self.natural_key(document)
        record = self.session.scalar(
            select(PublicDocumentRecord).where(PublicDocumentRecord.natural_key == natural_key)
        )
        values = {
            "company_id": document.company_id,
            "title": document.title,
            "document_type": document.document_type.value,
            "source_url": document.source_url,
            "published_at": document.published_at,
            "reference_period": document.reference_period,
            "content_type": document.content_type,
            "page_count": document.page_count,
            "processing_status": document.processing_status.value,
            "source": document.source.model_dump(mode="json"),
        }
        if record is None:
            record = PublicDocumentRecord(
                id=document.id,
                natural_key=natural_key,
                **values,
            )
            self.session.add(record)
        else:
            for field, value in values.items():
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
            query = query.where(
                or_(
                    func.lower(PublicDocumentRecord.title).contains(needle),
                    func.lower(func.coalesce(PublicDocumentRecord.reference_period, "")).contains(needle),
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
            content_type=record.content_type,
            page_count=record.page_count,
            processing_status=record.processing_status,
            source=SourceMetadata.model_validate(record.source),
        )
