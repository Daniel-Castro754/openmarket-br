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
from openmarket_api.domain.indicators import IndicatorGroup
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.repositories import (
    CompanyRepository,
    FinancialStatementRepository,
    InstrumentRepository,
)
from openmarket_api.services.indicator_engine import IndicatorEngine
from openmarket_api.services.liquidity_series import LiquidityFinancialSeriesService


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
    account_name: str,
    value: int,
    filing_type: str = "DFP",
    period_end: date | None = None,
    version: int = 1,
) -> FinancialStatementItem:
    resolved_end = period_end or date(year, 12, 31)
    return FinancialStatementItem(
        company_id=company.id,
        filing_type=filing_type,
        filing_reference_date=resolved_end,
        filing_version=version,
        exercise_order="ÚLTIMO",
        fixed_account=True,
        statement_group=f"DF Consolidado - {statement}",
        period_start=None,
        period_end=resolved_end,
        statement=statement,
        account_code=account_code,
        account_name=account_name,
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


def test_current_ratio_uses_validated_current_balance_totals() -> None:
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
                    account_code="1.01",
                    account_name="Ativo Circulante",
                    value=250,
                ),
                _fact(
                    company,
                    year=2025,
                    statement="BPP",
                    account_code="2.01",
                    account_name="Passivo Circulante",
                    value=100,
                ),
            ],
        )

        service = LiquidityFinancialSeriesService(session)
        assets = service.get_annual_series("PETR4", FinancialMetric.CURRENT_ASSETS)
        liabilities = service.get_annual_series("PETR4", FinancialMetric.CURRENT_LIABILITIES)
        ratio = service.get_annual_series("PETR4", FinancialMetric.CURRENT_RATIO)

        assert assets.account_code == "1.01"
        assert assets.points[0].value == Decimal(250)
        assert liabilities.account_code == "2.01"
        assert liabilities.points[0].value == Decimal(100)
        assert ratio.unit == SeriesUnit.MULTIPLE
        assert ratio.formula == "current_assets / current_liabilities"
        assert ratio.points[0].value == Decimal("2.5")
        assert ratio.points[0].currency is None
        assert ratio.points[0].derived is True
        assert ratio.points[0].source.provider == "openmarket-derived"
        assert len(ratio.points[0].input_sources) == 1


def test_current_ratio_rejects_codes_with_incompatible_account_labels() -> None:
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
                    account_code="1.01",
                    account_name="Caixa e Equivalentes de Caixa",
                    value=250,
                ),
                _fact(
                    company,
                    year=2025,
                    statement="BPP",
                    account_code="2.01",
                    account_name="Passivos Financeiros a Valor Justo",
                    value=100,
                ),
            ],
        )

        service = LiquidityFinancialSeriesService(session)
        assert service.get_annual_series("PETR4", FinancialMetric.CURRENT_ASSETS).points == []
        assert service.get_annual_series("PETR4", FinancialMetric.CURRENT_LIABILITIES).points == []
        assert service.get_annual_series("PETR4", FinancialMetric.CURRENT_RATIO).points == []


def test_current_ratio_skips_zero_current_liabilities() -> None:
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
                    account_code="1.01",
                    account_name="Ativo Circulante",
                    value=250,
                ),
                _fact(
                    company,
                    year=2025,
                    statement="BPP",
                    account_code="2.01",
                    account_name="Passivo Circulante",
                    value=0,
                ),
            ],
        )

        ratio = LiquidityFinancialSeriesService(session).get_annual_series(
            "PETR4",
            FinancialMetric.CURRENT_RATIO,
        )
        assert ratio.points == []


def test_quarterly_current_ratio_uses_itr_balance_snapshot() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company, company_record = _seed_asset(session)
        period_end = date(2026, 6, 30)
        _store(
            session,
            company_record,
            [
                _fact(
                    company,
                    year=2026,
                    filing_type="ITR",
                    period_end=period_end,
                    statement="BPA",
                    account_code="1.01",
                    account_name="  ativo   circulante ",
                    value=180,
                ),
                _fact(
                    company,
                    year=2026,
                    filing_type="ITR",
                    period_end=period_end,
                    statement="BPP",
                    account_code="2.01",
                    account_name="PASSIVO CIRCULANTE",
                    value=120,
                ),
            ],
        )

        ratio = LiquidityFinancialSeriesService(session).get_quarterly_series(
            "PETR4",
            FinancialMetric.CURRENT_RATIO,
        )

        assert ratio.frequency == SeriesFrequency.QUARTERLY
        assert ratio.points[0].period_end == period_end
        assert ratio.points[0].value == Decimal("1.5")


def test_indicator_engine_exposes_liquidity_group_and_history() -> None:
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
                    statement="BPA",
                    account_code="1.01",
                    account_name="Ativo Circulante",
                    value=200,
                ),
                _fact(
                    company,
                    year=2024,
                    statement="BPP",
                    account_code="2.01",
                    account_name="Passivo Circulante",
                    value=100,
                ),
                _fact(
                    company,
                    year=2025,
                    statement="BPA",
                    account_code="1.01",
                    account_name="Ativo Circulante",
                    value=300,
                ),
                _fact(
                    company,
                    year=2025,
                    statement="BPP",
                    account_code="2.01",
                    account_name="Passivo Circulante",
                    value=200,
                ),
            ],
        )

        indicator_engine = IndicatorEngine(session)
        summary = indicator_engine.get_summary("PETR4")
        liquidity_group = next(group for group in summary.groups if group.group == IndicatorGroup.LIQUIDITY)
        current_ratio = next(item for item in liquidity_group.indicators if item.slug == "current-ratio")

        assert current_ratio.value == Decimal("1.5")
        assert current_ratio.unit == SeriesUnit.MULTIPLE
        assert current_ratio.derived is True
        assert current_ratio.history_points == 2

        history = indicator_engine.get_history("PETR4", "current-ratio", years=5)
        assert history.definition.dependencies == [
            FinancialMetric.CURRENT_ASSETS,
            FinancialMetric.CURRENT_LIABILITIES,
        ]
        assert history.current_value == Decimal("1.5")
        assert history.historical_average == Decimal("1.75")
        assert [point.value for point in history.points] == [Decimal("2"), Decimal("1.5")]
