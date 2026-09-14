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
        source_name="CVM screener fixture",
        reference_date=reference_date,
        quality=DataQuality.OFFICIAL,
        license=DataLicense(
            license_id="fixture",
            redistribution=RedistributionScope.ALLOWED,
        ),
    )


def _seed_company(
    session: Session,
    *,
    ticker: str,
    cvm_code: str,
    current_assets: int,
    current_liabilities: int,
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

    period_end = date(2025, 12, 31)
    FinancialStatementRepository(session).upsert_many(
        [
            FinancialStatementItem(
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
                account_code="1.01",
                account_name="Ativo Circulante",
                value=Decimal(current_assets),
                source=_source(period_end),
            ),
            FinancialStatementItem(
                company_id=company.id,
                filing_type="DFP",
                filing_reference_date=period_end,
                filing_version=1,
                exercise_order="ÚLTIMO",
                fixed_account=True,
                statement_group="DF Consolidado - BPP",
                period_start=None,
                period_end=period_end,
                statement="BPP",
                account_code="2.01",
                account_name="Passivo Circulante",
                value=Decimal(current_liabilities),
                source=_source(period_end),
            ),
        ],
        company_id=company_record.id,
    )
    session.commit()


def test_screener_filters_and_sorts_by_current_ratio() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed_company(
            session,
            ticker="ALFA3",
            cvm_code="1001",
            current_assets=250,
            current_liabilities=100,
        )
        _seed_company(
            session,
            ticker="BETA3",
            cvm_code="1002",
            current_assets=150,
            current_liabilities=100,
        )

        response = get_screener(
            session=session,
            q=None,
            filters=["current_ratio:gte:2"],
            sort="current_ratio",
            direction="desc",
            limit=50,
            offset=0,
        )

    assert response.total == 1
    assert response.applied_filters == 1
    assert [row.ticker for row in response.rows] == ["ALFA3"]
    assert response.rows[0].metrics["current_ratio"] == Decimal("2.5")
    assert response.rows[0].metric_periods["current_ratio"] == date(2025, 12, 31)
