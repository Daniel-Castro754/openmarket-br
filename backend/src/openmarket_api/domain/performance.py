from datetime import date
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field

from openmarket_api.domain.common import SourceMetadata


class PerformanceWindow(StrEnum):
    ONE_YEAR = "1y"
    THREE_YEARS = "3y"
    FIVE_YEARS = "5y"
    MAX = "max"


class PerformanceStatus(StrEnum):
    AVAILABLE = "available"
    INSUFFICIENT_DATA = "insufficient_data"


class PriceHistoryPoint(BaseModel):
    as_of: date
    price: Decimal
    currency: str
    source: SourceMetadata


class PriceHistory(BaseModel):
    ticker: str
    observations: int
    start: date | None = None
    end: date | None = None
    price_basis: str = "unadjusted_close"
    points: list[PriceHistoryPoint] = Field(default_factory=list)


class PerformancePoint(BaseModel):
    as_of: date
    price: Decimal
    normalized_value: Decimal
    drawdown_percent: Decimal


class BenchmarkPerformance(BaseModel):
    ticker: str
    status: PerformanceStatus
    observations: int
    start: date | None = None
    end: date | None = None
    total_return_percent: Decimal | None = None
    cagr_percent: Decimal | None = None
    annualized_volatility_percent: Decimal | None = None
    max_drawdown_percent: Decimal | None = None


class PerformanceRiskSnapshot(BaseModel):
    ticker: str
    window: PerformanceWindow
    status: PerformanceStatus
    observations: int
    start: date | None = None
    end: date | None = None
    price_basis: str = "unadjusted_close"
    risk_free_rate_annual_percent: Decimal = Decimal("0")
    total_return_percent: Decimal | None = None
    cagr_percent: Decimal | None = None
    annualized_volatility_percent: Decimal | None = None
    max_drawdown_percent: Decimal | None = None
    sharpe_ratio: Decimal | None = None
    sortino_ratio: Decimal | None = None
    calmar_ratio: Decimal | None = None
    best_day_percent: Decimal | None = None
    worst_day_percent: Decimal | None = None
    points: list[PerformancePoint] = Field(default_factory=list)
    source: SourceMetadata | None = None
    benchmark: BenchmarkPerformance | None = None
    warnings: list[str] = Field(default_factory=list)


class PriceImportResult(BaseModel):
    ticker: str
    provider: str
    parsed_rows: int
    persisted_rows: int
    start: date | None = None
    end: date | None = None
