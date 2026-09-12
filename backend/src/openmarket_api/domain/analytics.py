from datetime import date
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field

from openmarket_api.domain.common import SourceMetadata


class FinancialMetric(StrEnum):
    REVENUE = "revenue"
    GROSS_PROFIT = "gross_profit"
    OPERATING_RESULT = "operating_result"
    NET_INCOME = "net_income"
    TOTAL_ASSETS = "total_assets"
    EQUITY = "equity"
    GROSS_MARGIN = "gross_margin"
    OPERATING_MARGIN = "operating_margin"
    NET_MARGIN = "net_margin"
    REVENUE_GROWTH_YOY = "revenue_growth_yoy"


class SeriesFrequency(StrEnum):
    ANNUAL = "annual"
    QUARTERLY = "quarterly"


class SeriesUnit(StrEnum):
    CURRENCY = "currency"
    PERCENT = "percent"


class FinancialSeriesPoint(BaseModel):
    period_start: date | None = None
    period_end: date
    value: Decimal
    currency: str | None = None
    filing_reference_date: date | None = None
    filing_version: int | None = None
    source: SourceMetadata
    derived: bool = False
    derivation: str | None = None
    input_sources: list[SourceMetadata] = Field(default_factory=list)


class FinancialSeries(BaseModel):
    metric: FinancialMetric
    label: str
    frequency: SeriesFrequency = SeriesFrequency.ANNUAL
    unit: SeriesUnit = SeriesUnit.CURRENCY
    statement: str | None = None
    account_code: str | None = None
    consolidated: bool = True
    formula: str | None = None
    points: list[FinancialSeriesPoint]
