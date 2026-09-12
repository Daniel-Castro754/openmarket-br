from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from openmarket_api.persistence.base import Base


class CompanyRecord(Base):
    __tablename__ = "companies"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    trading_name: Mapped[str | None] = mapped_column(String(255))
    cnpj: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    cvm_code: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    website: Mapped[str | None] = mapped_column(String(500))
    investor_relations_url: Mapped[str | None] = mapped_column(String(500))
    source: Mapped[dict[str, object] | None] = mapped_column(JSON)


class InstrumentRecord(Base):
    __tablename__ = "instruments"
    __table_args__ = (UniqueConstraint("exchange", "ticker", name="uq_instruments_exchange_ticker"),)

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    company_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), index=True
    )
    ticker: Mapped[str] = mapped_column(String(32), index=True)
    exchange: Mapped[str] = mapped_column(String(16), default="B3")
    isin: Mapped[str | None] = mapped_column(String(32), index=True)
    issuer_name: Mapped[str | None] = mapped_column(String(255))
    security_category: Mapped[str | None] = mapped_column(String(128))
    specification: Mapped[str | None] = mapped_column(String(128))
    governance_level: Mapped[str | None] = mapped_column(String(128))
    instrument_type: Mapped[str] = mapped_column(String(32))
    currency: Mapped[str] = mapped_column(String(8), default="BRL")
    source: Mapped[dict[str, object] | None] = mapped_column(JSON)


class FinancialStatementRecord(Base):
    __tablename__ = "financial_statement_items"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    natural_key: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    company_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    filing_type: Mapped[str | None] = mapped_column(String(16), index=True)
    filing_reference_date: Mapped[date | None] = mapped_column(Date, index=True)
    filing_version: Mapped[int | None] = mapped_column(Integer)
    exercise_order: Mapped[str | None] = mapped_column(String(32))
    fixed_account: Mapped[bool | None] = mapped_column(Boolean)
    statement_group: Mapped[str | None] = mapped_column(String(255))
    period_start: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date, index=True)
    statement: Mapped[str] = mapped_column(String(32), index=True)
    account_code: Mapped[str] = mapped_column(String(64), index=True)
    account_name: Mapped[str] = mapped_column(String(500))
    value: Mapped[Decimal] = mapped_column(Numeric(28, 6))
    currency: Mapped[str] = mapped_column(String(8), default="BRL")
    consolidated: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
