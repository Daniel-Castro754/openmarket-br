from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import FinancialMetric, SeriesFrequency
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
from openmarket_api.services.cash_flow_series import CashFlowSeriesService


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


def _cash_fact(
    company: Company,
    *,
    period_start: date,
    period_end: date,
    value: int,
    filing_type: str,
    version: int = 1,
    account_code: str = "6.01",
    statement: str = "DFC_MI",
) -> FinancialStatementItem:
    return FinancialStatementItem(
        company_id=company.id,
        filing_type=filing_type,
        filing_reference_date=period_end,
        filing_version=version,
        exercise_order="ÚLTIMO",
        fixed_account=True,
        statement_group=f"DF Consolidado - {statement}",
        period_start=period_start,
        period_end=period_end,
        statement=statement,
        account_code=account_code,
        account_name="Conta de fluxo de caixa",
        value=Decimal(value),
        currency="BRL",
        source=_source(period_end),
    )


def _store(session: Session, company_record: object, facts: list[FinancialStatementItem]) -> None:
    FinancialStatementRepository(session).upsert_many(
        facts,
        company_id=company_record.id,
    )
    session.commit()


def test_annual_cash_flow_uses_latest_dfp_version() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed_asset(session)
        _store(
            session,
            company_record,
            [
                _cash_fact(
                    company,
                    period_start=date(2025, 1, 1),
                    period_end=date(2025, 12, 31),
                    value=90,
                    filing_type="DFP",
                    version=1,
                ),
                _cash_fact(
                    company,
                    period_start=date(2025, 1, 1),
                    period_end=date(2025, 12, 31),
                    value=100,
                    filing_type="DFP",
                    version=2,
                ),
            ],
        )

        series = CashFlowSeriesService(session).get_series(
            "PETR4",
            FinancialMetric.OPERATING_CASH_FLOW,
            frequency=SeriesFrequency.ANNUAL,
        )

        assert len(series.points) == 1
        assert series.points[0].value == Decimal(100)
        assert series.points[0].filing_version == 2
        assert series.points[0].derived is False


def test_quarterly_cash_flow_reconstructs_isolated_quarters() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed_asset(session)
        start = date(2025, 1, 1)
        _store(
            session,
            company_record,
            [
                _cash_fact(
                    company,
                    period_start=start,
                    period_end=date(2025, 3, 31),
                    value=30,
                    filing_type="ITR",
                ),
                _cash_fact(
                    company,
                    period_start=start,
                    period_end=date(2025, 6, 30),
                    value=75,
                    filing_type="ITR",
                    version=1,
                ),
                _cash_fact(
                    company,
                    period_start=start,
                    period_end=date(2025, 6, 30),
                    value=80,
                    filing_type="ITR",
                    version=2,
                ),
                _cash_fact(
                    company,
                    period_start=start,
                    period_end=date(2025, 9, 30),
                    value=120,
                    filing_type="ITR",
                ),
                _cash_fact(
                    company,
                    period_start=start,
                    period_end=date(2025, 12, 31),
                    value=170,
                    filing_type="DFP",
                ),
            ],
        )

        series = CashFlowSeriesService(session).get_series(
            "PETR4",
            FinancialMetric.OPERATING_CASH_FLOW,
            frequency=SeriesFrequency.QUARTERLY,
        )

        assert [point.period_end for point in series.points] == [
            date(2025, 3, 31),
            date(2025, 6, 30),
            date(2025, 9, 30),
            date(2025, 12, 31),
        ]
        assert [point.value for point in series.points] == [
            Decimal(30),
            Decimal(50),
            Decimal(40),
            Decimal(50),
        ]
        assert [point.derived for point in series.points] == [False, True, True, True]
        assert series.points[1].derivation == "cumulative_current - cumulative_previous"
        assert len(series.points[1].input_sources) == 2
        assert series.points[1].source.provider == "openmarket-derived"


def test_cash_flow_supports_other_fixed_dfc_totals() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed_asset(session)
        _store(
            session,
            company_record,
            [
                _cash_fact(
                    company,
                    period_start=date(2025, 1, 1),
                    period_end=date(2025, 12, 31),
                    value=-40,
                    filing_type="DFP",
                    account_code="6.02",
                ),
                _cash_fact(
                    company,
                    period_start=date(2025, 1, 1),
                    period_end=date(2025, 12, 31),
                    value=-20,
                    filing_type="DFP",
                    account_code="6.03",
                ),
                _cash_fact(
                    company,
                    period_start=date(2025, 1, 1),
                    period_end=date(2025, 12, 31),
                    value=10,
                    filing_type="DFP",
                    account_code="6.05",
                ),
            ],
        )

        investing = CashFlowSeriesService(session).get_series(
            "PETR4",
            FinancialMetric.INVESTING_CASH_FLOW,
        )
        financing = CashFlowSeriesService(session).get_series(
            "PETR4",
            FinancialMetric.FINANCING_CASH_FLOW,
        )
        net_change = CashFlowSeriesService(session).get_series(
            "PETR4",
            FinancialMetric.NET_CHANGE_IN_CASH,
        )

        assert investing.points[0].value == Decimal(-40)
        assert financing.points[0].value == Decimal(-20)
        assert net_change.points[0].value == Decimal(10)


def test_unknown_asset_raises_lookup_error() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        try:
            CashFlowSeriesService(session).get_series(
                "XXXX3",
                FinancialMetric.OPERATING_CASH_FLOW,
            )
        except LookupError as exc:
            assert "XXXX3" in str(exc)
        else:
            raise AssertionError("unknown ticker should not resolve")
