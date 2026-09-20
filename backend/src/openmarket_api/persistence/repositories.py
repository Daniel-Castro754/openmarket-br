from collections.abc import Iterable
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from openmarket_api.domain.entities import Company, FinancialStatementItem, Instrument, Quote
from openmarket_api.persistence.models import (
    CompanyRecord,
    FinancialStatementRecord,
    InstrumentRecord,
    QuoteRecord,
)


class CompanyRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_by_id(self, company_id: UUID) -> CompanyRecord | None:
        return self.session.get(CompanyRecord, company_id)

    def upsert(self, company: Company) -> CompanyRecord:
        record: CompanyRecord | None = None
        if company.cvm_code:
            record = self.session.scalar(
                select(CompanyRecord).where(CompanyRecord.cvm_code == company.cvm_code)
            )
        if record is None and company.cnpj:
            record = self.session.scalar(
                select(CompanyRecord).where(CompanyRecord.cnpj == company.cnpj)
            )

        values = {
            "legal_name": company.legal_name,
            "trading_name": company.trading_name,
            "cnpj": company.cnpj,
            "cvm_code": company.cvm_code,
            "website": company.website,
            "investor_relations_url": company.investor_relations_url,
            "source": company.source.model_dump(mode="json") if company.source else None,
        }

        if record is None:
            record = CompanyRecord(id=company.id, **values)
            self.session.add(record)
        else:
            for field, value in values.items():
                setattr(record, field, value)

        self.session.flush()
        return record


class InstrumentRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_by_ticker(self, ticker: str, *, exchange: str = "B3") -> InstrumentRecord | None:
        return self.session.scalar(
            select(InstrumentRecord).where(
                InstrumentRecord.exchange == exchange.upper(),
                InstrumentRecord.ticker == ticker.upper(),
            )
        )

    def upsert(self, instrument: Instrument, *, company_id: UUID | None = None) -> InstrumentRecord:
        exchange = instrument.exchange.upper()
        ticker = instrument.ticker.upper()
        record = self.get_by_ticker(ticker, exchange=exchange)
        values = {
            "company_id": company_id,
            "ticker": ticker,
            "exchange": exchange,
            "isin": instrument.isin,
            "issuer_name": instrument.issuer_name,
            "security_category": instrument.security_category,
            "specification": instrument.specification,
            "governance_level": instrument.governance_level,
            "instrument_type": instrument.instrument_type.value,
            "currency": instrument.currency,
            "source": instrument.source.model_dump(mode="json") if instrument.source else None,
        }

        if record is None:
            record = InstrumentRecord(id=instrument.id, **values)
            self.session.add(record)
        else:
            for field, value in values.items():
                setattr(record, field, value)

        self.session.flush()
        return record


class QuoteRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert_many(self, quotes: Iterable[Quote], *, instrument_id: UUID) -> int:
        changed = 0
        for quote in quotes:
            provider = quote.source.provider
            record = self.session.scalar(
                select(QuoteRecord).where(
                    QuoteRecord.instrument_id == instrument_id,
                    QuoteRecord.as_of == quote.as_of,
                    QuoteRecord.provider == provider,
                )
            )
            values = {
                "instrument_id": instrument_id,
                "as_of": quote.as_of,
                "provider": provider,
                "price": quote.price,
                "currency": quote.currency,
                "source": quote.source.model_dump(mode="json"),
            }
            if record is None:
                self.session.add(QuoteRecord(**values))
            else:
                for field, value in values.items():
                    setattr(record, field, value)
            changed += 1

        self.session.flush()
        return changed

    def list_history(
        self,
        instrument_id: UUID,
        *,
        start: date | None = None,
        end: date | None = None,
        provider: str | None = None,
    ) -> list[QuoteRecord]:
        query = select(QuoteRecord).where(QuoteRecord.instrument_id == instrument_id)
        if start is not None:
            query = query.where(QuoteRecord.as_of >= start)
        if end is not None:
            query = query.where(QuoteRecord.as_of <= end)
        if provider is not None:
            query = query.where(QuoteRecord.provider == provider)
        query = query.order_by(QuoteRecord.as_of.asc())
        return list(self.session.scalars(query))


class FinancialStatementRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    @staticmethod
    def legacy_natural_key(item: FinancialStatementItem, *, company_id: UUID) -> str:
        start = item.period_start.isoformat() if item.period_start else "-"
        return "|".join(
            (
                str(company_id),
                start,
                item.period_end.isoformat(),
                item.statement,
                item.account_code,
                "con" if item.consolidated else "ind",
                item.currency,
            )
        )

    @staticmethod
    def natural_key(item: FinancialStatementItem, *, company_id: UUID) -> str:
        start = item.period_start.isoformat() if item.period_start else "-"
        filing_date = item.filing_reference_date.isoformat() if item.filing_reference_date else "-"
        version = str(item.filing_version) if item.filing_version is not None else "-"
        return "|".join(
            (
                str(company_id),
                item.filing_type or "-",
                filing_date,
                version,
                item.exercise_order or "-",
                start,
                item.period_end.isoformat(),
                item.statement,
                item.account_code,
                "con" if item.consolidated else "ind",
                item.currency,
            )
        )

    def list_for_company(
        self,
        company_id: UUID,
        *,
        start: date | None = None,
        end: date | None = None,
        statement: str | None = None,
        consolidated: bool | None = None,
    ) -> list[FinancialStatementRecord]:
        query = select(FinancialStatementRecord).where(
            FinancialStatementRecord.company_id == company_id
        )
        if start is not None:
            query = query.where(FinancialStatementRecord.period_end >= start)
        if end is not None:
            query = query.where(FinancialStatementRecord.period_end <= end)
        if statement is not None:
            query = query.where(FinancialStatementRecord.statement == statement.upper())
        if consolidated is not None:
            query = query.where(FinancialStatementRecord.consolidated == consolidated)
        query = query.order_by(
            FinancialStatementRecord.filing_reference_date.desc(),
            FinancialStatementRecord.filing_version.desc(),
            FinancialStatementRecord.period_end.desc(),
            FinancialStatementRecord.statement,
            FinancialStatementRecord.account_code,
        )
        return list(self.session.scalars(query))

    def summary_for_company(self, company_id: UUID) -> tuple[int, date | None, list[date]]:
        item_count = self.session.scalar(
            select(func.count()).where(FinancialStatementRecord.company_id == company_id)
        )
        latest_period = self.session.scalar(
            select(func.max(FinancialStatementRecord.period_end)).where(
                FinancialStatementRecord.company_id == company_id
            )
        )
        periods = list(
            self.session.scalars(
                select(FinancialStatementRecord.period_end)
                .where(FinancialStatementRecord.company_id == company_id)
                .distinct()
                .order_by(FinancialStatementRecord.period_end.desc())
            )
        )
        return int(item_count or 0), latest_period, periods

    def upsert_many(
        self, items: Iterable[FinancialStatementItem], *, company_id: UUID
    ) -> int:
        changed = 0
        for item in items:
            natural_key = self.natural_key(item, company_id=company_id)
            record = self.session.scalar(
                select(FinancialStatementRecord).where(
                    FinancialStatementRecord.natural_key == natural_key
                )
            )
            if record is None:
                legacy_key = self.legacy_natural_key(item, company_id=company_id)
                record = self.session.scalar(
                    select(FinancialStatementRecord).where(
                        FinancialStatementRecord.natural_key == legacy_key
                    )
                )
                if record is not None:
                    record.natural_key = natural_key

            values = {
                "company_id": company_id,
                "filing_type": item.filing_type,
                "filing_reference_date": item.filing_reference_date,
                "filing_version": item.filing_version,
                "exercise_order": item.exercise_order,
                "fixed_account": item.fixed_account,
                "statement_group": item.statement_group,
                "period_start": item.period_start,
                "period_end": item.period_end,
                "statement": item.statement,
                "account_code": item.account_code,
                "account_name": item.account_name,
                "value": item.value,
                "currency": item.currency,
                "consolidated": item.consolidated,
                "source": item.source.model_dump(mode="json"),
            }

            if record is None:
                self.session.add(FinancialStatementRecord(natural_key=natural_key, **values))
            else:
                for field, value in values.items():
                    setattr(record, field, value)
            changed += 1

        self.session.flush()
        return changed
