from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from openmarket_api.api.routes.comparison import get_company_comparison
from openmarket_api.domain.analytics import SeriesFrequency
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
from openmarket_api.services.company_comparison import CompanyComparisonService


def _source(reference_date: date) -> SourceMetadata:
    return SourceMetadata(
        provider="cvm-financial-statements",
        source_name="CVM comparison fixture",
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
        account_name="Conta de comparação",
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
            exchange="B3",
            issuer_name=company.legal_name,
            instrument_type=InstrumentType.STOCK,
            currency="BRL",
        ),
        company_id=company_record.id,
    )

    facts: list[FinancialStatementItem] = []
    for year, revenue, net_income, equity, total_assets in [
        (2024, 100, 10, 50, 160),
        (2025, 120, 15, 70, 140),
    ]:
        facts.extend(
            [
                _fact(
                    company,
                    year=year,
                    statement="DRE",
                    account_code="3.01",
                    value=revenue,
                ),
                _fact(
                    company,
                    year=year,
                    statement="DRE",
                    account_code="3.11",
                    value=net_income,
                ),
                _fact(
                    company,
                    year=year,
                    statement="BPP",
                    account_code="2.03",
                    value=equity,
                ),
                _fact(
                    company,
                    year=year,
                    statement="BPA",
                    account_code="1",
                    value=total_assets,
                ),
            ]
        )

    FinancialStatementRepository(session).upsert_many(
        facts,
        company_id=company_record.id,
    )
    session.commit()


def test_comparison_aggregates_raw_registry_and_missing_asset() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed(session)
        response = CompanyComparisonService(session).compare(
            ["petr4", "ABCD3"],
            ["revenue", "net-margin", "roa"],
            frequency=SeriesFrequency.ANNUAL,
        )

    assert response.tickers == ["PETR4", "ABCD3"]
    assert response.frequency == SeriesFrequency.ANNUAL
    assert response.assets[0].company_name == "PETROBRAS"
    assert response.assets[0].synchronized is True
    assert response.assets[1].synchronized is False

    metrics = {item.key: item for item in response.metrics}
    assert metrics["revenue"].values["PETR4"].value == Decimal(120)
    assert metrics["net-margin"].values["PETR4"].value == Decimal("12.5")
    assert metrics["roa"].values["PETR4"].value == Decimal(10)
    assert metrics["roa"].values["PETR4"].derived is True
    assert metrics["revenue"].values["ABCD3"].value is None
    assert metrics["net-margin"].values["ABCD3"].period_end is None


def test_comparison_annual_only_indicator_is_explicitly_unavailable_quarterly() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed(session)
        response = CompanyComparisonService(session).compare(
            ["PETR4"],
            ["roa"],
            frequency=SeriesFrequency.QUARTERLY,
        )

    result = response.metrics[0].values["PETR4"]
    assert result.value is None
    assert result.period_end is None


def test_comparison_rejects_registered_indicator_metric_alias() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed(session)
        with pytest.raises(ValueError, match="use slug net-margin"):
            CompanyComparisonService(session).compare(
                ["PETR4"],
                ["net_margin"],
            )


def test_comparison_route_returns_aggregated_contract() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed(session)
        response = get_company_comparison(
            session=session,
            tickers=["PETR4"],
            metrics=["revenue", "net-margin"],
            frequency=SeriesFrequency.ANNUAL,
        )

    assert response.tickers == ["PETR4"]
    assert [item.key for item in response.metrics] == ["revenue", "net-margin"]
    assert response.metrics[1].values["PETR4"].value == Decimal("12.5")
