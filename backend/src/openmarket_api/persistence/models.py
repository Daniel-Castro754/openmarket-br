from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, Date, ForeignKey, Numeric, String, Uuid
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


class FinancialStatementRecord(Base):
    __tablename__ = "financial_statement_items"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    natural_key: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    company_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    period_start: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date, index=True)
    statement: Mapped[str] = mapped_column(String(32), index=True)
    account_code: Mapped[str] = mapped_column(String(64), index=True)
    account_name: Mapped[str] = mapped_column(String(500))
    value: Mapped[Decimal] = mapped_column(Numeric(28, 6))
    currency: Mapped[str] = mapped_column(String(8), default="BRL")
    consolidated: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
