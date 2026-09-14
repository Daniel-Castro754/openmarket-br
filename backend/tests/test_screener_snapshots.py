from datetime import date
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from openmarket_api.api.routes.screener import SCREENER_METRICS, get_screener
from openmarket_api.domain.analytics import FinancialMetric, SeriesFrequency
from openmarket_api.domain.entities import Company, Instrument, InstrumentType
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.models import ScreenerMetricSnapshotRecord
from openmarket_api.persistence.repositories import CompanyRepository, InstrumentRepository
from openmarket_api.services.screener_snapshots import ScreenerSnapshotService


def _seed_petr4(session: Session):
    company = Company(
        legal_name="PETROLEO BRASILEIRO S.A. PETROBRAS",
        trading_name="PETROBRAS",
        cvm_code="9512",
    )
    company_record = CompanyRepository(session).upsert(company)
    instrument_record = InstrumentRepository(session).upsert(
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
    return company_record, instrument_record


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
        _seed_petr4(session)

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


def test_screener_snapshot_upsert_updates_conflicting_key_atomically() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        _, instrument = _seed_petr4(session)
        service = ScreenerSnapshotService(session)
        key = {
            "instrument_id": instrument.id,
            "metric": FinancialMetric.REVENUE.value,
            "frequency": SeriesFrequency.ANNUAL.value,
        }

        service._upsert_rows(
            [
                {
                    "id": uuid4(),
                    **key,
                    "value": Decimal(10),
                    "period_end": date(2024, 12, 31),
                    "source_latest_period": date(2024, 12, 31),
                }
            ]
        )
        session.commit()
        service._upsert_rows(
            [
                {
                    "id": uuid4(),
                    **key,
                    "value": Decimal(20),
                    "period_end": date(2025, 12, 31),
                    "source_latest_period": date(2025, 12, 31),
                }
            ]
        )
        session.commit()

        rows = session.scalars(select(ScreenerMetricSnapshotRecord)).all()

    assert len(rows) == 1
    assert rows[0].value == Decimal("20.000000")
    assert rows[0].period_end == date(2025, 12, 31)
    assert rows[0].source_latest_period == date(2025, 12, 31)
