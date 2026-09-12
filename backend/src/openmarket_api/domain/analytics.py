from datetime import date
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel

from openmarket_api.domain.common import SourceMetadata


class FinancialMetric(StrEnum):
    REVENUE = "revenue"
    GROSS_PROFIT = "gross_profit"
    OPERATING_RESULT = "operating_result"
    NET_INCOME = "net_income"
    TOTAL_ASSETS = "total_assets"
    EQUITY = "equity"


class SeriesFrequency(StrEnum):
    ANNUAL = "annual"


class FinancialSeriesPoint(BaseModel):
    period_end: date
    value: Decimal
    currency: str
    filing_reference_date: date | None = None
    filing_version: int | None = None
    source: SourceMetadata


class FinancialSeries(BaseModel):
    metric: FinancialMetric
    label: str
    frequency: SeriesFrequency = SeriesFrequency.ANNUAL
    statement: str
    account_code: str
    consolidated: bool = True
    points: list[FinancialSeriesPoint]
