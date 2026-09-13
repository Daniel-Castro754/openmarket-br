from datetime import date
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel

from openmarket_api.domain.analytics import FinancialMetric, SeriesFrequency, SeriesUnit
from openmarket_api.domain.common import SourceMetadata


class IndicatorGroup(StrEnum):
    EFFICIENCY = "efficiency"
    PROFITABILITY = "profitability"
    LEVERAGE = "leverage"
    GROWTH = "growth"


class IndicatorDefinition(BaseModel):
    slug: str
    metric: FinancialMetric
    label: str
    group: IndicatorGroup
    description: str
    unit: SeriesUnit
    formula: str | None = None
    supports_history: bool = True
    supports_sector_benchmark: bool = False
    requires_market_data: bool = False


class IndicatorValue(BaseModel):
    slug: str
    metric: FinancialMetric
    label: str
    group: IndicatorGroup
    description: str
    unit: SeriesUnit
    formula: str | None = None
    value: Decimal | None = None
    period_end: date | None = None
    source: SourceMetadata | None = None
    derived: bool = False
    history_points: int = 0
    supports_history: bool = True
    supports_sector_benchmark: bool = False
    requires_market_data: bool = False


class IndicatorGroupSummary(BaseModel):
    group: IndicatorGroup
    label: str
    indicators: list[IndicatorValue]


class IndicatorSummary(BaseModel):
    ticker: str
    frequency: SeriesFrequency
    groups: list[IndicatorGroupSummary]
