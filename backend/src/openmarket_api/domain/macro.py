from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from openmarket_api.domain.common import SourceMetadata


class MacroSeriesPoint(BaseModel):
    reference_date: date
    value: Decimal


class MacroIndicator(BaseModel):
    key: str
    label: str
    description: str
    unit: str
    frequency: str
    latest_value: Decimal
    previous_value: Decimal | None = None
    reference_date: date
    change: Decimal | None = None
    points: list[MacroSeriesPoint] = Field(default_factory=list)
    source: SourceMetadata


class MacroExpectation(BaseModel):
    key: str
    label: str
    reference_year: int
    median: Decimal
    minimum: Decimal | None = None
    maximum: Decimal | None = None
    respondents: int | None = None
    observation_date: date
    unit: str
    source: SourceMetadata


class MacroSnapshot(BaseModel):
    indicators: list[MacroIndicator]
    expectations: list[MacroExpectation]
