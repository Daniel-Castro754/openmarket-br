from datetime import date
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from openmarket_api.domain.common import SourceMetadata


class DocumentType(StrEnum):
    DFP = "dfp"
    ITR = "itr"
    FRE = "fre"
    MATERIAL_FACT = "material_fact"
    EARNINGS_RELEASE = "earnings_release"
    PRESENTATION = "presentation"
    ANNUAL_REPORT = "annual_report"
    OTHER = "other"


class DocumentProcessingStatus(StrEnum):
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"


class PublicDocument(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    company_id: UUID | None = None
    title: str
    document_type: DocumentType = DocumentType.OTHER
    source_url: str | None = None
    published_at: date | None = None
    reference_period: str | None = None
    content_type: str = "application/pdf"
    page_count: int | None = None
    processing_status: DocumentProcessingStatus = DocumentProcessingStatus.PENDING
    source: SourceMetadata


class DocumentSection(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    document_id: UUID
    sequence: int
    page_start: int | None = None
    page_end: int | None = None
    heading: str | None = None
    text: str


class DocumentSummary(BaseModel):
    id: UUID
    company_id: UUID | None = None
    company_name: str | None = None
    tickers: list[str] = Field(default_factory=list)
    title: str
    document_type: DocumentType
    source_url: str | None = None
    published_at: date | None = None
    reference_period: str | None = None
    content_type: str
    page_count: int | None = None
    processing_status: DocumentProcessingStatus
    source: SourceMetadata


class DocumentDetail(DocumentSummary):
    sections: list[DocumentSection] = Field(default_factory=list)
