from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import FinancialMetric, SeriesFrequency, SeriesUnit
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
from openmarket_api.services.financial_series import FinancialSeriesService


def _source(reference_date: date) -> SourceMetadata:
    return SourceMetadata(
        provider="cvm-financial-statements",
        source_name="CVM fixture",
        reference_date=reference_date,
        quality=DataQuality.OFFICIAL,
        license=DataLicense(
            license_id="fixture",
            redistribution=RedistributionScope.ALLOWED,
        ),
    )


def _seed_asset(session: Session) -> tuple[Company, object]:
    company = Company(
        legal_name="PETROLEO BRASILEIRO S.A. PETROBRAS",
        trading_name="PETROBRAS",
        cvm_code="9512",
    )
    company_record = CompanyRepository(session).upsert(company)
    InstrumentRepository(session).upsert(
        Instrument(
            ticker="PETR4",
            company_id=company_record.id,
            instrument_type=InstrumentType.STOCK,
        ),
        company_id=company_record.id,
    )
    return company, company_record


def _fact(
    company: Company,
    *,
    year: int,
    statement: str,
    account_code: str,
    value: int,
    filing_type: str = "DFP",
    period_end: date | None = None,
    version: int = 1,
) -> FinancialStatementItem:
    resolved_end = period_end or date(year, 12, 31)
    period_start = date(year, 1, 1) if statement == "DRE" else None
    return FinancialStatementItem(
        company_id=company.id,
        filing_type=filing_type,
        filing_reference_date=resolved_end,
        filing_version=version,
        exercise_order="ÚLTIMO",
        fixed_account=True,
        statement_group=f"DF Consolidado - {statement}",
        period_start=period_start,
        period_end=resolved_end,
        statement=statement,
        account_code=account_code,
        account_name="Conta de teste",
        value=Decimal(value),
        source=_source(resolved_end),
    )


def _store(
    session: Session,
    company_record: object,
    facts: list[FinancialStatementItem],
) -> None:
    FinancialStatementRepository(session).upsert_many(
        facts,
        company_id=company_record.id,
    )
    session.commit()


def test_gross_and_net_debt_require_matching_balance_sheet_facts() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed_asset(session)
        _store(
            session,
            company_record,
            [
                _fact(
                    company,
                    year=2025,
                    statement="BPA",
                    account_code="1.01.01",
                    value=40,
                ),
                _fact(
                    company,
                    year=2025,
                    statement="BPP",
                    account_code="2.01.04",
                    value=30,
                ),
                _fact(
                    company,
                    year=2025,
                    statement="BPP",
                    account_code="2.02.01",
                    value=70,
                ),
            ],
        )

        service = FinancialSeriesService(session)
        gross = service.get_annual_series("PETR4", FinancialMetric.GROSS_DEBT)
        net = service.get_annual_series("PETR4", FinancialMetric.NET_DEBT)

        assert len(gross.points) == 1
        assert gross.points[0].value == Decimal(100)
        assert gross.points[0].derived is True
        assert gross.points[0].derivation == "short_term_debt + long_term_debt"

        assert len(net.points) == 1
        assert net.points[0].value == Decimal(60)
        assert net.points[0].derived is True
        assert net.points[0].derivation == "gross_debt - cash"


def test_net_debt_is_empty_when_long_term_debt_is_missing() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed_asset(session)
        _store(
            session,
            company_record,
            [
                _fact(
                    company,
                    year=2025,
                    statement="BPA",
                    account_code="1.01.01",
                    value=40,
                ),
                _fact(
                    company,
                    year=2025,
                    statement="BPP",
                    account_code="2.01.04",
                    value=30,
                ),
            ],
        )

        series = FinancialSeriesService(session).get_annual_series(
            "PETR4",
            FinancialMetric.NET_DEBT,
        )

        assert series.points == []


def test_quarterly_cash_uses_itr_balance_closing() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed_asset(session)
        _store(
            session,
            company_record,
            [
                _fact(
                    company,
                    year=2026,
                    filing_type="ITR",
                    period_end=date(2026, 6, 30),
                    statement="BPA",
                    account_code="1.01.01",
                    value=55,
                )
            ],
        )

        series = FinancialSeriesService(session).get_quarterly_series(
            "PETR4",
            FinancialMetric.CASH,
        )

        assert series.frequency == SeriesFrequency.QUARTERLY
        assert len(series.points) == 1
        assert series.points[0].period_end == date(2026, 6, 30)
        assert series.points[0].value == Decimal(55)


def test_annual_roe_uses_average_equity() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed_asset(session)
        _store(
            session,
            company_record,
            [
                _fact(
                    company,
                    year=2024,
                    statement="BPP",
                    account_code="2.03",
                    value=100,
                ),
                _fact(
                    company,
                    year=2025,
                    statement="BPP",
                    account_code="2.03",
                    value=140,
                ),
                _fact(
                    company,
                    year=2025,
                    statement="DRE",
                    account_code="3.11",
                    value=24,
                ),
            ],
        )

        series = FinancialSeriesService(session).get_annual_series(
            "PETR4",
            FinancialMetric.ROE,
        )

        assert series.unit == SeriesUnit.PERCENT
        assert series.formula == "annual_net_income / average_equity * 100"
        assert len(series.points) == 1
        assert series.points[0].period_end == date(2025, 12, 31)
        assert series.points[0].value == Decimal(20)
        assert series.points[0].derived is True


def test_quarterly_roe_is_not_annualized_implicitly() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed_asset(session)
        series = FinancialSeriesService(session).get_quarterly_series(
            "PETR4",
            FinancialMetric.ROE,
        )

        assert series.frequency == SeriesFrequency.QUARTERLY
        assert series.points == []
