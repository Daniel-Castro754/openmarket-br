from datetime import date
from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from .common import SourceMetadata


class InstrumentType(StrEnum):
    STOCK = "stock"
    FII = "fii"
    ETF = "etf"
    BDR = "bdr"
    INDEX = "index"
    FUTURE = "future"
    OTHER = "other"


class Company(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    legal_name: str
    trading_name: str | None = None
    cnpj: str | None = None
    cvm_code: str | None = None
    website: str | None = None
    investor_relations_url: str | None = None
    source: SourceMetadata | None = None


class Instrument(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    company_id: UUID | None = None
    ticker: str
    exchange: str = "B3"
    isin: str | None = None
    issuer_name: str | None = None
    security_category: str | None = None
    specification: str | None = None
    governance_level: str | None = None
    instrument_type: InstrumentType = InstrumentType.STOCK
    currency: str = "BRL"
    source: SourceMetadata | None = None


class Quote(BaseModel):
    instrument_id: UUID
    price: Decimal
    currency: str
    as_of: date
    source: SourceMetadata


class FinancialStatementItem(BaseModel):
    company_id: UUID
    period_start: date | None = None
    period_end: date
    statement: str
    account_code: str
    account_name: str
    value: Decimal
    currency: str = "BRL"
    consolidated: bool = True
    source: SourceMetadata


class Dividend(BaseModel):
    instrument_id: UUID
    event_type: str
    amount_per_unit: Decimal
    ex_date: date | None = None
    payment_date: date | None = None
    source: SourceMetadata
