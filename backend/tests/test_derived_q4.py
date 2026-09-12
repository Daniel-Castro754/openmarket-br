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
    value: int,
    account_code: str,
    filing_type: str,
    period_start: date,
    period_end: date,
    version: int,
) -> FinancialStatementItem:
    return FinancialStatementItem(
        company_id=company.id,
        filing_type=filing_type,
        filing_reference_date=period_end,
        filing_version=version,
        exercise_order="ÚLTIMO",
        fixed_account=True,
        statement_group="DF Consolidado - DRE",
        period_start=period_start,
        period_end=period_end,
        statement="DRE",
        account_code=account_code,
        account_name="Conta de teste",
        value=Decimal(value),
        source=_source(period_end),
    )


def _seed(session: Session) -> tuple[Company, object]:
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


def test_q4_flow_is_derived_from_dfp_minus_nine_month_itr() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed(session)
        facts = [
            _fact(
                company,
                value=250,
                account_code="3.01",
                filing_type="ITR",
                period_start=date(2025, 7, 1),
                period_end=date(2025, 9, 30),
                version=3,
            ),
            _fact(
                company,
                value=700,
                account_code="3.01",
                filing_type="ITR",
                period_start=date(2025, 1, 1),
                period_end=date(2025, 9, 30),
                version=3,
            ),
            _fact(
                company,
                value=1000,
                account_code="3.01",
                filing_type="DFP",
                period_start=date(2025, 1, 1),
                period_end=date(2025, 12, 31),
                version=2,
            ),
        ]
        FinancialStatementRepository(session).upsert_many(
            facts,
            company_id=company_record.id,
        )
        session.commit()

        series = FinancialSeriesService(session).get_series(
            "PETR4",
            FinancialMetric.REVENUE,
            frequency=SeriesFrequency.QUARTERLY,
        )

        assert [point.period_end for point in series.points] == [
            date(2025, 9, 30),
            date(2025, 12, 31),
        ]
        q4 = series.points[-1]
        assert q4.value == Decimal(300)
        assert q4.period_start == date(2025, 10, 1)
        assert q4.derived is True
        assert q4.derivation == "DFP anual - ITR acumulado de 9M"
        assert q4.source.provider == "openmarket-derived"
        assert q4.source.quality == DataQuality.SECONDARY
        assert q4.filing_version is None
        assert len(q4.input_sources) == 2


def test_q4_margin_preserves_derived_input_provenance() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed(session)
        facts = [
            _fact(
                company,
                value=700,
                account_code="3.01",
                filing_type="ITR",
                period_start=date(2025, 1, 1),
                period_end=date(2025, 9, 30),
                version=3,
            ),
            _fact(
                company,
                value=1000,
                account_code="3.01",
                filing_type="DFP",
                period_start=date(2025, 1, 1),
                period_end=date(2025, 12, 31),
                version=2,
            ),
            _fact(
                company,
                value=280,
                account_code="3.03",
                filing_type="ITR",
                period_start=date(2025, 1, 1),
                period_end=date(2025, 9, 30),
                version=3,
            ),
            _fact(
                company,
                value=400,
                account_code="3.03",
                filing_type="DFP",
                period_start=date(2025, 1, 1),
                period_end=date(2025, 12, 31),
                version=2,
            ),
        ]
        FinancialStatementRepository(session).upsert_many(
            facts,
            company_id=company_record.id,
        )
        session.commit()

        series = FinancialSeriesService(session).get_series(
            "PETR4",
            FinancialMetric.GROSS_MARGIN,
            frequency=SeriesFrequency.QUARTERLY,
        )

        q4 = series.points[-1]
        assert q4.period_end == date(2025, 12, 31)
        assert q4.value == Decimal(40)
        assert q4.derived is True
        assert q4.derivation == "gross_profit / revenue * 100"
        assert q4.source.provider == "openmarket-derived"
        assert len(q4.input_sources) == 2
