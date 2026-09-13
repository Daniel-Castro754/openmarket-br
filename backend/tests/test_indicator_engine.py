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
from openmarket_api.domain.indicators import IndicatorGroup
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.repositories import (
    CompanyRepository,
    FinancialStatementRepository,
    InstrumentRepository,
)
from openmarket_api.services.indicator_engine import IndicatorEngine


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
    statement: str,
    account_code: str,
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
        statement_group=f"DF Consolidado - {statement}",
        period_start=date(year, 1, 1) if statement == "DRE" else None,
        period_end=period_end,
        statement=statement,
        account_code=account_code,
        account_name="Conta de teste",
        value=Decimal(value),
        source=_source(period_end),
    )


def _seed(session: Session) -> None:
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

    facts: list[FinancialStatementItem] = []
    for year, revenue, gross, operating, net_income, equity, short_debt, long_debt, cash in (
        (2024, 100, 40, 20, 10, 50, 20, 30, 10),
        (2025, 120, 60, 30, 15, 70, 25, 35, 15),
    ):
        facts.extend(
            [
                _fact(company, year=year, statement="DRE", account_code="3.01", value=revenue),
                _fact(company, year=year, statement="DRE", account_code="3.03", value=gross),
                _fact(company, year=year, statement="DRE", account_code="3.05", value=operating),
                _fact(company, year=year, statement="DRE", account_code="3.11", value=net_income),
                _fact(company, year=year, statement="BPP", account_code="2.03", value=equity),
                _fact(company, year=year, statement="BPP", account_code="2.01.04", value=short_debt),
                _fact(company, year=year, statement="BPP", account_code="2.02.01", value=long_debt),
                _fact(company, year=year, statement="BPA", account_code="1.01.01", value=cash),
            ]
        )

    FinancialStatementRepository(session).upsert_many(facts, company_id=company_record.id)
    session.commit()


def test_indicator_catalog_has_stable_groups_and_formulas() -> None:
    catalog = IndicatorEngine.get_catalog()

    assert [item.slug for item in catalog] == [
        "gross-margin",
        "operating-margin",
        "net-margin",
        "roe",
        "gross-debt",
        "net-debt",
        "revenue-growth-yoy",
    ]
    assert catalog[0].group == IndicatorGroup.EFFICIENCY
    assert catalog[0].metric == FinancialMetric.GROSS_MARGIN
    assert catalog[0].supports_history is True
    assert catalog[0].requires_market_data is False


def test_indicator_summary_uses_existing_financial_series_engine() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed(session)
        summary = IndicatorEngine(session).get_summary("petr4")

    assert summary.ticker == "PETR4"
    assert summary.frequency == SeriesFrequency.ANNUAL
    assert [group.group for group in summary.groups] == [
        IndicatorGroup.EFFICIENCY,
        IndicatorGroup.PROFITABILITY,
        IndicatorGroup.LEVERAGE,
        IndicatorGroup.GROWTH,
    ]

    values = {
        indicator.slug: indicator
        for group in summary.groups
        for indicator in group.indicators
    }
    assert values["gross-margin"].value == Decimal("50")
    assert values["operating-margin"].value == Decimal("25")
    assert values["net-margin"].value == Decimal("12.5")
    assert values["roe"].value == Decimal("25")
    assert values["gross-debt"].value == Decimal("60")
    assert values["net-debt"].value == Decimal("45")
    assert values["revenue-growth-yoy"].value == Decimal("20")
    assert values["gross-margin"].history_points == 2
    assert values["roe"].history_points == 1
    assert values["gross-margin"].source is not None
