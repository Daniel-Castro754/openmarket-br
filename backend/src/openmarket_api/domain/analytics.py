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
    CURRENT_ASSETS = "current_assets"
    EQUITY = "equity"
    CURRENT_LIABILITIES = "current_liabilities"
    CASH = "cash"
    SHORT_TERM_DEBT = "short_term_debt"
    LONG_TERM_DEBT = "long_term_debt"
    GROSS_DEBT = "gross_debt"
    NET_DEBT = "net_debt"
    CURRENT_RATIO = "current_ratio"
    OPERATING_CASH_FLOW = "operating_cash_flow"
    INVESTING_CASH_FLOW = "investing_cash_flow"
    FINANCING_CASH_FLOW = "financing_cash_flow"
    NET_CHANGE_IN_CASH = "net_change_in_cash"
    GROSS_MARGIN = "gross_margin"
    OPERATING_MARGIN = "operating_margin"
    NET_MARGIN = "net_margin"
    REVENUE_GROWTH_YOY = "revenue_growth_yoy"
    ROE = "roe"


class SeriesFrequency(StrEnum):
    ANNUAL = "annual"
    QUARTERLY = "quarterly"


class SeriesUnit(StrEnum):
    CURRENCY = "currency"
    PERCENT = "percent"
    MULTIPLE = "multiple"


class CalculationInput(BaseModel):
    metric: FinancialMetric
    label: str
    unit: SeriesUnit
    value: Decimal
    period_start: date | None = None
    period_end: date
    currency: str | None = None
    filing_reference_date: date | None = None
    filing_version: int | None = None
    source: SourceMetadata


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
    calculation_inputs: list[CalculationInput] = Field(default_factory=list)


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
