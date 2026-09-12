from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.entities import Company, FinancialStatementItem
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.models import CompanyRecord, FinancialStatementRecord
from openmarket_api.persistence.repositories import (
    CompanyRepository,
    FinancialStatementRepository,
)


def _source() -> SourceMetadata:
    return SourceMetadata(
        provider="test",
        source_name="Test Source",
        quality=DataQuality.OFFICIAL,
        license=DataLicense(
            license_id="test-open",
            redistribution=RedistributionScope.ALLOWED,
        ),
    )


def test_company_upsert_is_idempotent() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(
            legal_name="PETROLEO BRASILEIRO S.A.",
            trading_name="PETROBRAS",
            cnpj="33.000.167/0001-01",
            cvm_code="9512",
            source=_source(),
        )
        repository = CompanyRepository(session)
        first = repository.upsert(company)
        company.trading_name = "PETROBRAS S.A."
        second = repository.upsert(company)
        session.commit()

        count = session.scalar(select(func.count()).select_from(CompanyRecord))
        assert count == 1
        assert first.id == second.id
        assert second.trading_name == "PETROBRAS S.A."


def test_financial_upsert_updates_same_natural_key() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(legal_name="PETROLEO BRASILEIRO S.A.", cvm_code="9512")
        company_record = CompanyRepository(session).upsert(company)
        item = FinancialStatementItem(
            company_id=company.id,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 6, 30),
            statement="DRE",
            account_code="3.01",
            account_name="Receita",
            value=Decimal(1000000),
            source=_source(),
        )
        repository = FinancialStatementRepository(session)
        repository.upsert_many([item], company_id=company_record.id)
        item.value = Decimal(1200000)
        repository.upsert_many([item], company_id=company_record.id)
        session.commit()

        records = list(session.scalars(select(FinancialStatementRecord)))
        assert len(records) == 1
        assert records[0].value == Decimal(1200000)
