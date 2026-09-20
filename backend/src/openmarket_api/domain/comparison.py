from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from openmarket_api.domain.analytics import SeriesFrequency
from openmarket_api.domain.common import SourceMetadata


class ComparisonAsset(BaseModel):
    ticker: str
    company_name: str | None = None
    synchronized: bool = False
    financial_item_count: int = 0
    latest_period: date | None = None


class ComparisonValue(BaseModel):
    value: Decimal | None = None
    period_end: date | None = None
    currency: str | None = None
    derived: bool = False
    source: SourceMetadata | None = None


class ComparisonMetricResult(BaseModel):
    key: str
    values: dict[str, ComparisonValue] = Field(default_factory=dict)


class CompanyComparisonResponse(BaseModel):
    tickers: list[str]
    frequency: SeriesFrequency
    assets: list[ComparisonAsset]
    metrics: list[ComparisonMetricResult]
