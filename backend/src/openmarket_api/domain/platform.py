from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class ProviderCapability(StrEnum):
    COMPANY_SEARCH = "company_search"
    INSTRUMENT_SEARCH = "instrument_search"
    QUOTES = "quotes"
    FINANCIAL_STATEMENTS = "financial_statements"
    DOCUMENTS = "documents"
    DOCUMENT_CONTENT = "document_content"
    MACRO_SNAPSHOT = "macro_snapshot"
    CONSUMER_INSIGHTS = "consumer_insights"


class ProviderDescriptor(BaseModel):
    name: str
    capabilities: list[ProviderCapability] = Field(default_factory=list)


class ProviderSyncStatus(StrEnum):
    SUCCESS = "success"
    FAILED = "failed"


class ProviderSyncState(BaseModel):
    provider: str
    dataset: str
    status: ProviderSyncStatus
    started_at: datetime
    finished_at: datetime
    item_count: int | None = None
    error: str | None = None


class ProviderOperationalStatus(BaseModel):
    descriptor: ProviderDescriptor
    latest_syncs: list[ProviderSyncState] = Field(default_factory=list)


class ProviderPlatformStatus(BaseModel):
    providers: list[ProviderOperationalStatus] = Field(default_factory=list)


class DataSyncResult(BaseModel):
    provider: str
    dataset: str
    status: ProviderSyncStatus
    item_count: int
    collected_at: datetime
