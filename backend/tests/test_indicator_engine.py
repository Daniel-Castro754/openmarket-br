from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from openmarket_api.domain.analytics import (
    CalculationInput,
    FinancialMetric,
    SeriesFrequency,
    SeriesUnit,
)
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
from openmarket_api.domain.indicators import IndicatorGroup, IndicatorPassportStatus
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.repositories import (
    CompanyRepository,
    FinancialStatementRepository,
    InstrumentRepository,
)
from openmarket_api.services.indicator_engine import IndicatorEngine
from openmarket_api.services.indicator_passport import IndicatorPassportService
from openmarket_api.services.indicator_registry import indicator_registry


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
    rows = (
        (2020, 80, 32, 16, 8, 40, 100, 16, 24, 8),
        (2021, 90, 36, 18, 9, 45, 110, 18, 27, 9),
        (2022, 100, 40, 20, 10, 50, 120, 20, 30, 10),
        (2023, 110, 44, 22, 11, 55, 140, 22, 33, 11),
        (2024, 100, 40, 20, 10, 50, 160, 20, 30, 10),
        (2025, 120, 60, 30, 15, 70, 140, 25, 35, 15),
    )
    for (
        year,
        revenue,
        gross,
        operating,
        net_income,
        equity,
        total_assets,
        short_debt,
        long_debt,
        cash,
    ) in rows:
        facts.extend(
            [
                _fact(company, year=year, statement="DRE", account_code="3.01", value=revenue),
                _fact(company, year=year, statement="DRE", account_code="3.03", value=gross),
                _fact(company, year=year, statement="DRE", account_code="3.05", value=operating),
                _fact(company, year=year, statement="DRE", account_code="3.11", value=net_income),
                _fact(company, year=year, statement="BPP", account_code="2.03", value=equity),
                _fact(company, year=year, statement="BPA", account_code="1", value=total_assets),
                _fact(
                    company,
                    year=year,
                    statement="BPP",
                    account_code="2.01.04",
                    value=short_debt,
                ),
                _fact(
                    company,
                    year=year,
                    statement="BPP",
                    account_code="2.02.01",
                    value=long_debt,
                ),
                _fact(company, year=year, statement="BPA", account_code="1.01.01", value=cash),
            ]
        )

    FinancialStatementRepository(session).upsert_many(facts, company_id=company_record.id)
    session.commit()


def test_indicator_catalog_has_stable_groups_and_formulas() -> None:
    catalog = indicator_registry.get_catalog()

    assert [item.slug for item in catalog] == [
        "gross-margin",
        "operating-margin",
        "net-margin",
        "roe",
        "roa",
        "gross-debt",
        "net-debt",
        "net-debt-to-equity",
        "gross-debt-to-equity",
        "equity-to-assets",
        "current-ratio",
        "revenue-growth-yoy",
        "net-income-growth-yoy",
    ]
    assert catalog[0].group == IndicatorGroup.EFFICIENCY
    assert catalog[0].metric == FinancialMetric.GROSS_MARGIN
    assert catalog[0].format == "percent_2"
    assert catalog[0].dependencies == [
        FinancialMetric.GROSS_PROFIT,
        FinancialMetric.REVENUE,
    ]
    assert catalog[0].supports_history is True
    assert catalog[0].requires_market_data is False
    assert catalog[0].methodology_version == "1.0"
    assert catalog[0].group_label == "Eficiência"

    roa = next(item for item in catalog if item.slug == "roa")
    assert roa.metric is None
    assert roa.group_label == "Rentabilidade"
    assert roa.available_frequencies == [SeriesFrequency.ANNUAL]
    assert roa.dependencies == [FinancialMetric.NET_INCOME, FinancialMetric.TOTAL_ASSETS]

    current_ratio = next(item for item in catalog if item.slug == "current-ratio")
    assert current_ratio.group == IndicatorGroup.LIQUIDITY
    assert current_ratio.metric == FinancialMetric.CURRENT_RATIO
    assert current_ratio.format == "multiple_2"
    assert current_ratio.dependencies == [
        FinancialMetric.CURRENT_ASSETS,
        FinancialMetric.CURRENT_LIABILITIES,
    ]


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
        IndicatorGroup.LIQUIDITY,
        IndicatorGroup.GROWTH,
    ]

    values = {
        indicator.slug: indicator
        for group in summary.groups
        for indicator in group.indicators
    }
    assert values["gross-margin"].value == Decimal(50)
    assert values["operating-margin"].value == Decimal(25)
    assert values["net-margin"].value == Decimal("12.5")
    assert values["roe"].value == Decimal(25)
    assert values["roa"].value == Decimal(10)
    assert values["gross-debt"].value == Decimal(60)
    assert values["net-debt"].value == Decimal(45)
    assert values["net-debt-to-equity"].value is not None
    assert values["net-debt-to-equity"].value.quantize(Decimal("0.01")) == Decimal("64.29")
    assert values["gross-debt-to-equity"].value is not None
    assert values["gross-debt-to-equity"].value.quantize(Decimal("0.01")) == Decimal("85.71")
    assert values["equity-to-assets"].value == Decimal(50)
    assert values["current-ratio"].value is None
    assert values["revenue-growth-yoy"].value == Decimal(20)
    assert values["net-income-growth-yoy"].value == Decimal(50)
    assert values["gross-margin"].history_points == 6
    assert values["roe"].history_points == 5
    assert values["roa"].history_points == 5
    assert values["current-ratio"].history_points == 0
    assert values["net-income-growth-yoy"].history_points == 5
    assert values["gross-margin"].source is not None
    assert values["roa"].source is not None
    assert values["roa"].source.provider == "openmarket-derived"


def test_indicator_history_applies_calendar_window_and_average() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed(session)
        history = IndicatorEngine(session).get_history(
            "PETR4",
            "gross-margin",
            years=5,
        )

    assert history.ticker == "PETR4"
    assert history.years == 5
    assert history.frequency == SeriesFrequency.ANNUAL
    assert [point.period_end.year for point in history.points] == [2021, 2022, 2023, 2024, 2025]
    assert [point.value for point in history.points] == [
        Decimal(40),
        Decimal(40),
        Decimal(40),
        Decimal(40),
        Decimal(50),
    ]
    assert history.current_value == Decimal(50)
    assert history.current_period == date(2025, 12, 31)
    assert history.historical_average == Decimal(42)
    assert history.definition.formula == "gross_profit / revenue * 100"
    assert history.points[-1].source.provider == "openmarket-derived"
    assert history.points[-1].derived is True


def test_derived_indicator_history_preserves_inputs_and_methodology() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed(session)
        history = IndicatorEngine(session).get_history("PETR4", "roa", years=5)

    assert history.current_value == Decimal(10)
    assert history.current_period == date(2025, 12, 31)
    assert history.definition.formula == "annual_net_income / average_total_assets * 100"
    assert history.definition.available_frequencies == [SeriesFrequency.ANNUAL]
    assert history.points[-1].derived is True
    assert history.points[-1].source.provider == "openmarket-derived"
    assert len(history.points[-1].input_sources) == 2
    assert {source.reference_date for source in history.points[-1].input_sources} == {
        date(2024, 12, 31),
        date(2025, 12, 31),
    }


def test_annual_only_indicator_is_unavailable_quarterly() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed(session)
        summary = IndicatorEngine(session).get_summary(
            "PETR4",
            frequency=SeriesFrequency.QUARTERLY,
        )

    values = {
        indicator.slug: indicator
        for group in summary.groups
        for indicator in group.indicators
    }
    assert values["roa"].value is None
    assert values["roa"].history_points == 0
    assert values["roe"].value is None
    assert values["roe"].history_points == 0


def test_indicator_history_supports_one_year_and_unknown_slug() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed(session)
        service = IndicatorEngine(session)
        history = service.get_history("petr4", "net-margin", years=1)

        with pytest.raises(LookupError, match="indicator not found"):
            service.get_history("PETR4", "price-to-earnings", years=5)

    assert len(history.points) == 1
    assert history.current_value == Decimal("12.5")
    assert history.historical_average == Decimal("12.5")

def test_indicator_passport_exposes_exact_calculation_inputs() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed(session)
        passport = IndicatorPassportService(session).get_passport("PETR4", "roa")

    assert passport.status == IndicatorPassportStatus.AVAILABLE
    assert passport.value == Decimal(10)
    assert passport.period_end == date(2025, 12, 31)
    assert passport.definition.methodology_version == "1.0"
    assert passport.formula == "annual_net_income / average_total_assets * 100"
    assert passport.source is not None
    assert passport.source.provider == "openmarket-derived"
    assert passport.redistribution_scope == RedistributionScope.ALLOWED
    assert [(item.metric, item.value, item.period_end) for item in passport.inputs] == [
        (FinancialMetric.TOTAL_ASSETS, Decimal(160), date(2024, 12, 31)),
        (FinancialMetric.TOTAL_ASSETS, Decimal(140), date(2025, 12, 31)),
        (FinancialMetric.NET_INCOME, Decimal(15), date(2025, 12, 31)),
    ]
    assert all(item.restricted is False for item in passport.inputs)
    assert len(passport.input_sources) == 2
    assert passport.warnings == []


def test_indicator_passport_reports_unavailable_indicator_without_guessing_inputs() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed(session)
        passport = IndicatorPassportService(session).get_passport(
            "PETR4",
            "current-ratio",
        )

    assert passport.status == IndicatorPassportStatus.UNAVAILABLE
    assert passport.value is None
    assert passport.inputs == []
    assert passport.source is None
    assert passport.warnings


def test_indicator_passport_hides_restricted_input_value() -> None:
    restricted_source = SourceMetadata(
        provider="restricted-provider",
        source_name="Restricted fixture",
        reference_date=date(2025, 12, 31),
        quality=DataQuality.LICENSED,
        license=DataLicense(
            license_id="restricted",
            redistribution=RedistributionScope.INTERNAL_ONLY,
        ),
    )
    calculation_input = CalculationInput(
        metric=FinancialMetric.REVENUE,
        label="Receita",
        unit=SeriesUnit.CURRENCY,
        value=Decimal(123),
        period_end=date(2025, 12, 31),
        source=restricted_source,
    )

    public_input = IndicatorPassportService._public_input(calculation_input)

    assert public_input.value is None
    assert public_input.restricted is True
    assert public_input.source.license.redistribution == RedistributionScope.INTERNAL_ONLY

