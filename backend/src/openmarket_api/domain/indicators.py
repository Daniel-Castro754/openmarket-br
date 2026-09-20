from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field

from openmarket_api.domain.analytics import (
    FinancialMetric,
    FinancialSeriesPoint,
    SeriesFrequency,
    SeriesUnit,
)
from openmarket_api.domain.common import RedistributionScope, SourceMetadata


class IndicatorGroup(StrEnum):
    EFFICIENCY = "efficiency"
    PROFITABILITY = "profitability"
    LEVERAGE = "leverage"
    LIQUIDITY = "liquidity"
    GROWTH = "growth"


class IndicatorDefinition(BaseModel):
    slug: str
    metric: FinancialMetric | None = None
    label: str
    short_label: str | None = None
    group: IndicatorGroup
    group_label: str | None = None
    description: str
    unit: SeriesUnit
    format: str
    formula: str | None = None
    dependencies: list[FinancialMetric] = Field(default_factory=list)
    available_frequencies: list[SeriesFrequency] = Field(
        default_factory=lambda: [SeriesFrequency.ANNUAL, SeriesFrequency.QUARTERLY]
    )
    supports_history: bool = True
    supports_sector_benchmark: bool = False
    requires_market_data: bool = False
    methodology_version: str = "1.0"
    methodology_notes: str | None = None


class IndicatorPassportStatus(StrEnum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"


class IndicatorPassportInput(BaseModel):
    metric: FinancialMetric
    label: str
    unit: SeriesUnit
    value: Decimal | None = None
    period_start: date | None = None
    period_end: date
    currency: str | None = None
    filing_reference_date: date | None = None
    filing_version: int | None = None
    source: SourceMetadata
    restricted: bool = False


class IndicatorDataPassport(BaseModel):
    ticker: str
    definition: IndicatorDefinition
    frequency: SeriesFrequency
    status: IndicatorPassportStatus
    value: Decimal | None = None
    period_start: date | None = None
    period_end: date | None = None
    filing_reference_date: date | None = None
    filing_version: int | None = None
    formula: str | None = None
    derived: bool = False
    source: SourceMetadata | None = None
    inputs: list[IndicatorPassportInput] = Field(default_factory=list)
    input_sources: list[SourceMetadata] = Field(default_factory=list)
    collected_at: datetime | None = None
    redistribution_scope: RedistributionScope | None = None
    warnings: list[str] = Field(default_factory=list)


class IndicatorValue(IndicatorDefinition):
    value: Decimal | None = None
    period_end: date | None = None
    source: SourceMetadata | None = None
    derived: bool = False
    history_points: int = 0


class IndicatorGroupSummary(BaseModel):
    group: IndicatorGroup
    label: str
    indicators: list[IndicatorValue]


class IndicatorSummary(BaseModel):
    ticker: str
    frequency: SeriesFrequency
    groups: list[IndicatorGroupSummary]


class IndicatorHistory(BaseModel):
    ticker: str
    definition: IndicatorDefinition
    frequency: SeriesFrequency
    years: int
    current_value: Decimal | None = None
    current_period: date | None = None
    historical_average: Decimal | None = None
    points: list[FinancialSeriesPoint]
