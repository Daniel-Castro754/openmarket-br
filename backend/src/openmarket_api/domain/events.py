from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from openmarket_api.domain.common import SourceMetadata


class CompanyEventType(StrEnum):
    MATERIAL_FACT = "material_fact"
    EARNINGS = "earnings"
    FILING = "filing"
    PRESENTATION = "presentation"
    ANNUAL_REPORT = "annual_report"
    GOVERNANCE = "governance"
    DOCUMENT = "document"


class CompanyEventCategory(StrEnum):
    RESULTS = "results"
    MATERIAL = "material"
    GOVERNANCE = "governance"
    FINANCE = "finance"
    OPERATIONS = "operations"
    CALENDAR = "calendar"
    REGULATORY = "regulatory"
    OTHER = "other"


class CompanyEventOrigin(StrEnum):
    CVM_DOCUMENT = "cvm_document"


class CompanyEvent(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    company_id: UUID
    event_date: date
    event_type: CompanyEventType
    category: CompanyEventCategory
    origin: CompanyEventOrigin
    title: str
    description: str | None = None
    reference_period: str | None = None
    source_document_id: UUID | None = None
    source_url: str | None = None
    source_classification: str | None = None
    source: SourceMetadata
    projected_at: datetime


class CompanyEventTimeline(BaseModel):
    ticker: str
    events: list[CompanyEvent]
