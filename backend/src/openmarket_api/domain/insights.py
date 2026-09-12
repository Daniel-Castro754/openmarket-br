from decimal import Decimal

from pydantic import BaseModel, Field

from openmarket_api.domain.common import SourceMetadata


class InsightPoint(BaseModel):
    period: str
    value: Decimal


class EconomicTrend(BaseModel):
    key: str
    label: str
    description: str
    unit: str
    latest_value: Decimal | None = None
    latest_period: str | None = None
    points: list[InsightPoint] = Field(default_factory=list)
    source: SourceMetadata


class ConsumptionItem(BaseModel):
    key: str
    label: str
    share_percent: Decimal
    monthly_value: Decimal | None = None


class ConsumptionProfile(BaseModel):
    key: str
    label: str
    description: str
    average_monthly_consumption: Decimal | None = None
    items: list[ConsumptionItem]
    source: SourceMetadata


class ConsumerInsightSnapshot(BaseModel):
    consumption_profiles: list[ConsumptionProfile]
    trends: list[EconomicTrend]
    notes: list[str] = Field(default_factory=list)
