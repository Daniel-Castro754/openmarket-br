from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from openmarket_api.api.routes.screener import get_screener
from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.entities import (
    Company,
    FinancialStatementItem,
    Instrument,
    InstrumentType,
)
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.repositories import (
    CompanyRepository,
    FinancialStatementRepository,
    InstrumentRepository,
)


def _source(reference_date: date) -> SourceMetadata:
    return SourceMetadata(
        provider="cvm-financial-statements",
        source_name="CVM derived screener fixture",
        reference_date=reference_date,
        quality=DataQuality.OFFICIAL,
        license=DataLicense(
            license_id="fixture",
            redistribution=RedistributionScope.ALLOWED,
        ),
    )


def _balance_fact(
    company: Company,
    *,
    year: int,
    value: int,
) -> FinancialStatementItem:
    period_end = date(year, 12, 31)
    return FinancialStatementItem(
        company_id=company.id,
        filing_type="DFP",
        filing_reference_date=period_end,
        filing_version=1,
        exercise_order="ÚLTIMO",
        fixed_account=True,
        statement_group="DF Consolidado - BPA",
        period_start=None,
        period_end=period_end,
        statement="BPA",
        account_code="1",
        account_name="Ativo Total",
        value=Decimal(value),
        source=_source(period_end),
    )


def _income_fact(
    company: Company,
    *,
    year: int,
    value: int,
) -> FinancialStatementItem:
    period_end = date(year, 12, 31)
    return FinancialStatementItem(
        company_id=company.id,
        filing_type="DFP",
        filing_reference_date=period_end,
        filing_version=1,
        exercise_order="ÚLTIMO",
        fixed_account=True,
        statement_group="DF Consolidado - DRE",
        period_start=date(year, 1, 1),
        period_end=period_end,
        statement="DRE",
        account_code="3.11",
        account_name="Lucro/Prejuízo Consolidado do Período",
        value=Decimal(value),
        source=_source(period_end),
    )


def _seed_company(
    session: Session,
    *,
    ticker: str,
    cvm_code: str,
    previous_assets: int,
    current_assets: int,
    net_income: int,
) -> None:
    company = Company(
        legal_name=f"{ticker} S.A.",
        trading_name=ticker,
        cvm_code=cvm_code,
    )
    company_record = CompanyRepository(session).upsert(company)
    InstrumentRepository(session).upsert(
        Instrument(
            ticker=ticker,
            exchange="B3",
            issuer_name=company.legal_name,
            instrument_type=InstrumentType.STOCK,
            currency="BRL",
        ),
        company_id=company_record.id,
    )
    FinancialStatementRepository(session).upsert_many(
        [
            _balance_fact(company, year=2024, value=previous_assets),
            _balance_fact(company, year=2025, value=current_assets),
            _income_fact(company, year=2025, value=net_income),
        ],
        company_id=company_record.id,
    )
    session.commit()


def test_screener_filters_and_sorts_by_roa() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed_company(
            session,
            ticker="ALFA3",
            cvm_code="2001",
            previous_assets=100,
            current_assets=100,
            net_income=20,
        )
        _seed_company(
            session,
            ticker="BETA3",
            cvm_code="2002",
            previous_assets=200,
            current_assets=200,
            net_income=10,
        )

        response = get_screener(
            session=session,
            q=None,
            filters=["roa:gte:10"],
            sort="roa",
            direction="desc",
            limit=50,
            offset=0,
        )

    assert response.total == 1
    assert response.applied_filters == 1
    assert [row.ticker for row in response.rows] == ["ALFA3"]
    assert response.rows[0].metrics["roa"] == Decimal(20)
    assert response.rows[0].metric_periods["roa"] == date(2025, 12, 31)
