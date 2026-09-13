from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from openmarket_api.api.routes.screener import SCREENER_METRICS, get_screener
from openmarket_api.domain.entities import Company, Instrument, InstrumentType
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.repositories import CompanyRepository, InstrumentRepository
from openmarket_api.services.screener_snapshots import ScreenerSnapshotService


def test_screener_reuses_persistent_metric_snapshots(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    calls = 0

    def fake_latest_metric(self, ticker, metric):
        nonlocal calls
        calls += 1
        return Decimal(10), date(2025, 12, 31)

    monkeypatch.setattr(ScreenerSnapshotService, "_latest_metric", fake_latest_metric)

    with Session(engine) as session:
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
                isin="BRPETRACNPR6",
                instrument_type=InstrumentType.STOCK,
                currency="BRL",
            ),
            company_id=company_record.id,
        )
        session.commit()

        first = get_screener(
            session=session,
            q=None,
            filters=None,
            sort="ticker",
            direction="asc",
            limit=50,
            offset=0,
        )
        first_call_count = calls
        second = get_screener(
            session=session,
            q=None,
            filters=None,
            sort="ticker",
            direction="asc",
            limit=50,
            offset=0,
        )

    assert first_call_count == len(SCREENER_METRICS)
    assert calls == first_call_count
    assert first.rows[0].metrics["roe"] == Decimal(10)
    assert second.rows[0].metrics["roe"] == Decimal(10)
