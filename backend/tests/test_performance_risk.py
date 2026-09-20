from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from openmarket_api.api.routes.performance import get_asset_performance, get_asset_prices
from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.entities import Instrument, InstrumentType, Quote
from openmarket_api.domain.performance import PerformanceStatus, PerformanceWindow
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.models import QuoteRecord
from openmarket_api.persistence.repositories import InstrumentRepository, QuoteRepository
from openmarket_api.providers.b3_cotahist import B3CotahistParser
from openmarket_api.services.performance_risk import PerformanceRiskService
from openmarket_api.services.price_history import B3CotahistImportService


def _source(reference_date: date) -> SourceMetadata:
    return SourceMetadata(
        provider="b3-cotahist",
        source_name="B3 test fixture",
        reference_date=reference_date,
        quality=DataQuality.OFFICIAL,
        license=DataLicense(
            license_id="fixture",
            redistribution=RedistributionScope.CONDITIONAL,
            attribution_required=True,
        ),
    )


def _instrument(session: Session, ticker: str):
    record = InstrumentRepository(session).upsert(
        Instrument(
            ticker=ticker,
            exchange="B3",
            issuer_name=ticker,
            instrument_type=InstrumentType.STOCK,
            currency="BRL",
        )
    )
    session.commit()
    return record


def _cotahist_line(ticker: str, as_of: date, close: Decimal) -> str:
    chars = [" "] * 245

    def put(start: int, end: int, value: str) -> None:
        width = end - start
        chars[start:end] = list(value[:width].ljust(width))

    put(0, 2, "01")
    put(2, 10, as_of.strftime("%Y%m%d"))
    put(10, 12, "02")
    put(12, 24, ticker)
    put(24, 27, "010")
    put(27, 39, "EMPRESA")
    put(39, 49, "ON")
    put(52, 56, "R$")
    raw_close = str(int(close * 100)).zfill(13)
    put(108, 121, raw_close)
    put(230, 242, "BRTEST000001")
    return "".join(chars)


def _seed_quotes(
    session: Session,
    ticker: str,
    prices: list[Decimal],
    *,
    start: date = date(2025, 1, 2),
) -> None:
    instrument = _instrument(session, ticker)
    quotes = [
        Quote(
            instrument_id=instrument.id,
            price=price,
            currency="BRL",
            as_of=start + timedelta(days=index),
            source=_source(start + timedelta(days=index)),
        )
        for index, price in enumerate(prices)
    ]
    QuoteRepository(session).upsert_many(quotes, instrument_id=instrument.id)
    session.commit()


def test_cotahist_parser_reads_cash_market_close_price() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        instrument = _instrument(session, "PETR4")
        line = _cotahist_line("PETR4", date(2025, 1, 3), Decimal("37.42"))
        quotes = B3CotahistParser.parse_text(
            line,
            instrument_id=instrument.id,
            ticker="PETR4",
        )

    assert len(quotes) == 1
    assert quotes[0].as_of == date(2025, 1, 3)
    assert quotes[0].price == Decimal("37.42")
    assert quotes[0].currency == "BRL"
    assert quotes[0].source.provider == "b3-cotahist"
    assert "não é ajustada" in (quotes[0].source.license.notes or "")


def test_cotahist_parser_ignores_other_tickers_and_non_cash_market() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        instrument = _instrument(session, "PETR4")
        other = _cotahist_line("VALE3", date(2025, 1, 3), Decimal("50"))
        fractional = list(_cotahist_line("PETR4", date(2025, 1, 3), Decimal("37")))
        fractional[24:27] = list("020")

        quotes = B3CotahistParser.parse_text(
            "\n".join([other, "".join(fractional)]),
            instrument_id=instrument.id,
            ticker="PETR4",
        )

    assert quotes == []


def test_cotahist_import_is_idempotent(tmp_path: Path) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    fixture = tmp_path / "COTAHIST.2025.TXT"
    fixture.write_text(
        "\n".join(
            [
                _cotahist_line("PETR4", date(2025, 1, 2), Decimal("35.10")),
                _cotahist_line("PETR4", date(2025, 1, 3), Decimal("36.20")),
            ]
        ),
        encoding="cp1252",
    )

    with Session(engine) as session:
        _instrument(session, "PETR4")
        service = B3CotahistImportService(session)
        first = service.import_file("PETR4", fixture)
        second = service.import_file("PETR4", fixture)
        count = session.scalar(select(func.count()).select_from(QuoteRecord))

    assert first.parsed_rows == 2
    assert second.parsed_rows == 2
    assert count == 2


def test_performance_metrics_are_calculated_from_persisted_prices() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed_quotes(
            session,
            "PETR4",
            [Decimal("100"), Decimal("110"), Decimal("99"), Decimal("120")],
        )
        snapshot = PerformanceRiskService(session).get_snapshot(
            "PETR4",
            window=PerformanceWindow.MAX,
        )

    assert snapshot.status == PerformanceStatus.AVAILABLE
    assert snapshot.observations == 4
    assert snapshot.total_return_percent == Decimal("20.000000")
    assert snapshot.max_drawdown_percent == Decimal("-10.000000")
    assert snapshot.best_day_percent == Decimal("21.212121")
    assert snapshot.worst_day_percent == Decimal("-10.000000")
    assert snapshot.annualized_volatility_percent is not None
    assert snapshot.sharpe_ratio is not None
    assert snapshot.points[-1].normalized_value == Decimal("120.000000")
    assert any("não ajustados" in warning for warning in snapshot.warnings)


def test_performance_returns_explicit_insufficient_state() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed_quotes(session, "PETR4", [Decimal("100")])
        snapshot = PerformanceRiskService(session).get_snapshot(
            "PETR4",
            window=PerformanceWindow.MAX,
        )

    assert snapshot.status == PerformanceStatus.INSUFFICIENT_DATA
    assert snapshot.total_return_percent is None
    assert snapshot.observations == 1
    assert len(snapshot.warnings) >= 2


def test_performance_supports_persisted_benchmark() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed_quotes(session, "PETR4", [Decimal("100"), Decimal("120")])
        _seed_quotes(session, "BOVA11", [Decimal("100"), Decimal("110")])
        snapshot = PerformanceRiskService(session).get_snapshot(
            "PETR4",
            window=PerformanceWindow.MAX,
            benchmark_ticker="BOVA11",
        )

    assert snapshot.benchmark is not None
    assert snapshot.benchmark.ticker == "BOVA11"
    assert snapshot.benchmark.total_return_percent == Decimal("10.000000")


def test_performance_and_price_routes_use_persisted_data_only() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _seed_quotes(session, "PETR4", [Decimal("100"), Decimal("105")])
        history = get_asset_prices(
            ticker="PETR4",
            session=session,
            start=None,
            end=None,
        )
        snapshot = get_asset_performance(
            ticker="PETR4",
            session=session,
            window=PerformanceWindow.MAX,
            risk_free_rate=Decimal("0"),
            benchmark=None,
        )

    assert history.observations == 2
    assert snapshot.status == PerformanceStatus.AVAILABLE
    assert snapshot.total_return_percent == Decimal("5.000000")
