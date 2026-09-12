from datetime import date, datetime, timezone
from enum import StrEnum
from typing import Generic, TypeVar

from pydantic import BaseModel, Field


class DataQuality(StrEnum):
    OFFICIAL = "official"
    LICENSED = "licensed"
    SECONDARY = "secondary"
    USER_PROVIDED = "user_provided"


class RedistributionScope(StrEnum):
    ALLOWED = "allowed"
    ATTRIBUTION_REQUIRED = "attribution_required"
    CONDITIONAL = "conditional"
    INTERNAL_ONLY = "internal_only"
    UNKNOWN = "unknown"


class DataLicense(BaseModel):
    license_id: str
    redistribution: RedistributionScope = RedistributionScope.UNKNOWN
    commercial_use_allowed: bool | None = None
    attribution_required: bool = False
    terms_url: str | None = None
    notes: str | None = None


class SourceMetadata(BaseModel):
    provider: str
    source_name: str
    source_url: str | None = None
    reference_date: date | None = None
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    quality: DataQuality
    license: DataLicense


T = TypeVar("T")


class SourcedValue(BaseModel, Generic[T]):
    value: T
    source: SourceMetadata
