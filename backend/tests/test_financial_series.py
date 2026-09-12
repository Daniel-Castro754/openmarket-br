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


def _fact(
    company: Company,
    *,
    year: int,
    value: int,
    version: int = 1,
    filing_type: str = "DFP",
    exercise_order: str = "ÚLTIMO",
    statement: str = "DRE",
    account_code: str = "3.01",
    period_start: date | None = None,
    period_end: date | None = None,
) -> FinancialStatementItem:
    resolved_end = period_end or (
        date(year, 12, 31) if filing_type == "DFP" else date(year, 6, 30)
    )
    if period_start is None and statement == "DRE":
        period_start = date(year, 1, 1)
    return FinancialStatementItem(
        company_id=company.id,
        filing_type=filing_type,
        filing_reference_date=resolved_end,
        filing_version=version,
        exercise_order=exercise_order,
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


def _seed_asset(session: Session) -> tuple[Company, object]:
    company = Company(
        legal_name="PETROLEO BRASILEIRO S.A. PETROBRAS",
        trading_name="PETROBRAS",
        cvm_code="9512",
    )
    company_record = CompanyRepository(session).upsert(company)
    instrument = Instrument(
        ticker="PETR4",
        company_id=company_record.id,
        instrument_type=InstrumentType.STOCK,
    )
    InstrumentRepository(session).upsert(instrument, company_id=company_record.id)
    return company, company_record


def _store(session: Session, company_record: object, facts: list[FinancialStatementItem]) -> None:
    FinancialStatementRepository(session).upsert_many(
        facts,
        company_id=company_record.id,
    )
    session.commit()


def test_annual_revenue_uses_latest_dfp_version_only() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed_asset(session)
        _store(
            session,
            company_record,
            [
                _fact(company, year=2024, value=90),
                _fact(company, year=2025, value=110, version=1),
                _fact(company, year=2025, value=120, version=2),
                _fact(
                    company,
                    year=2025,
                    value=85,
                    version=2,
                    exercise_order="PENÚLTIMO",
                ),
                _fact(company, year=2026, value=70, version=1, filing_type="ITR"),
            ],
        )

        series = FinancialSeriesService(session).get_annual_series(
            "PETR4",
            FinancialMetric.REVENUE,
        )

        assert series.label == "Receita"
        assert series.frequency == SeriesFrequency.ANNUAL
        assert series.statement == "DRE"
        assert series.account_code == "3.01"
        assert [point.period_end for point in series.points] == [
            date(2024, 12, 31),
            date(2025, 12, 31),
        ]
        assert [point.value for point in series.points] == [Decimal(90), Decimal(120)]
        assert series.points[-1].filing_version == 2


def test_quarterly_flow_uses_isolated_itr_and_latest_version() -> None:
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
                    value=200,
                    filing_type="ITR",
                    period_start=date(2025, 1, 1),
                ),
                _fact(
                    company,
                    year=2025,
                    value=110,
                    version=1,
                    filing_type="ITR",
                    period_start=date(2025, 4, 1),
                ),
                _fact(
                    company,
                    year=2025,
                    value=120,
                    version=2,
                    filing_type="ITR",
                    period_start=date(2025, 4, 1),
                ),
            ],
        )

        series = FinancialSeriesService(session).get_quarterly_series(
            "PETR4",
            FinancialMetric.REVENUE,
        )

        assert series.frequency == SeriesFrequency.QUARTERLY
        assert len(series.points) == 1
        assert series.points[0].period_start == date(2025, 4, 1)
        assert series.points[0].period_end == date(2025, 6, 30)
        assert series.points[0].value == Decimal(120)
        assert series.points[0].filing_version == 2


def test_quarterly_stock_metric_combines_itr_and_dfp_closings() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed_asset(session)
        itr_asset = _fact(
            company,
            year=2025,
            value=500,
            filing_type="ITR",
            statement="BPA",
            account_code="1",
            period_start=None,
        )
        itr_asset.period_start = None
        dfp_asset = _fact(
            company,
            year=2025,
            value=550,
            statement="BPA",
            account_code="1",
            period_start=None,
        )
        dfp_asset.period_start = None
        _store(session, company_record, [itr_asset, dfp_asset])

        series = FinancialSeriesService(session).get_quarterly_series(
            "PETR4",
            FinancialMetric.TOTAL_ASSETS,
        )

        assert [point.period_end for point in series.points] == [
            date(2025, 6, 30),
            date(2025, 12, 31),
        ]
        assert [point.value for point in series.points] == [Decimal(500), Decimal(550)]


def test_quarterly_margin_uses_same_filing_version() -> None:
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
                    value=100,
                    version=2,
                    filing_type="ITR",
                    period_start=date(2025, 4, 1),
                ),
                _fact(
                    company,
                    year=2025,
                    value=40,
                    version=2,
                    filing_type="ITR",
                    period_start=date(2025, 4, 1),
                    account_code="3.03",
                ),
            ],
        )

        series = FinancialSeriesService(session).get_series(
            "PETR4",
            FinancialMetric.GROSS_MARGIN,
            frequency=SeriesFrequency.QUARTERLY,
        )

        assert series.unit == SeriesUnit.PERCENT
        assert series.formula == "gross_profit / revenue * 100"
        assert len(series.points) == 1
        assert series.points[0].value == Decimal(40)
        assert series.points[0].currency is None


def test_quarterly_revenue_growth_compares_same_quarter_year_over_year() -> None:
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
                    value=100,
                    filing_type="ITR",
                    period_start=date(2025, 4, 1),
                    period_end=date(2025, 6, 30),
                ),
                _fact(
                    company,
                    year=2026,
                    value=120,
                    filing_type="ITR",
                    period_start=date(2026, 4, 1),
                    period_end=date(2026, 6, 30),
                ),
            ],
        )

        series = FinancialSeriesService(session).get_series(
            "PETR4",
            FinancialMetric.REVENUE_GROWTH_YOY,
            frequency=SeriesFrequency.QUARTERLY,
        )

        assert series.unit == SeriesUnit.PERCENT
        assert len(series.points) == 1
        assert series.points[0].period_end == date(2026, 6, 30)
        assert series.points[0].value == Decimal(20)


def test_annual_stock_metric_accepts_point_in_time_statement() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed_asset(session)
        asset = _fact(
            company,
            year=2025,
            value=500,
            statement="BPA",
            account_code="1",
            period_start=None,
        )
        asset.period_start = None
        _store(session, company_record, [asset])

        series = FinancialSeriesService(session).get_annual_series(
            "PETR4",
            FinancialMetric.TOTAL_ASSETS,
        )

        assert len(series.points) == 1
        assert series.points[0].period_end == date(2025, 12, 31)
        assert series.points[0].value == Decimal(500)


def test_series_unknown_asset_raises_lookup_error() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        try:
            FinancialSeriesService(session).get_annual_series(
                "XXXX3",
                FinancialMetric.REVENUE,
            )
        except LookupError as exc:
            assert "XXXX3" in str(exc)
        else:
            raise AssertionError("unknown ticker should not resolve")
