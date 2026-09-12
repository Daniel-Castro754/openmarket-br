from collections.abc import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from openmarket_api.domain.entities import Company, FinancialStatementItem
from openmarket_api.persistence.models import CompanyRecord, FinancialStatementRecord


class CompanyRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

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


class FinancialStatementRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    @staticmethod
    def natural_key(item: FinancialStatementItem, *, company_id: UUID) -> str:
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
            values = {
                "company_id": company_id,
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
