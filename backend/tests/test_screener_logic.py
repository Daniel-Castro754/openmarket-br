from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from openmarket_api.api.routes.screener import get_screener
from openmarket_api.domain.entities import Company, Instrument, InstrumentType
from openmarket_api.domain.screener import screener_metric_value
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.repositories import CompanyRepository, InstrumentRepository
from openmarket_api.services.screener_snapshots import ScreenerSnapshotService


def _seed_company(session: Session, ticker: str, name: str):
    company = Company(
        legal_name=name,
        trading_name=name,
    )
    company_record = CompanyRepository(session).upsert(company)
    instrument = InstrumentRepository(session).upsert(
        Instrument(
            ticker=ticker,
            exchange="B3",
            issuer_name=name,
            instrument_type=InstrumentType.STOCK,
            currency="BRL",
        ),
        company_id=company_record.id,
    )
    session.commit()
    return instrument


def test_screener_supports_and_or_logic_without_breaking_default(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        first = _seed_company(session, "AAAA3", "EMPRESA A")
        second = _seed_company(session, "BBBB3", "EMPRESA B")

        metric_values = {
            (first.id, "roe"): Decimal(20),
            (first.id, "net_margin"): Decimal(5),
            (second.id, "roe"): Decimal(10),
            (second.id, "net_margin"): Decimal(15),
        }

        def fake_ensure(self, records, metrics):
            result = {}
            for instrument, _ in records:
                for metric in metrics:
                    key = screener_metric_value(metric)
                    result[(instrument.id, metric)] = (
                        metric_values.get((instrument.id, key)),
                        None,
                    )
            return result

        monkeypatch.setattr(ScreenerSnapshotService, "ensure", fake_ensure)

        common = {
            "session": session,
            "q": None,
            "filters": ["roe:gte:15", "net_margin:gte:10"],
            "sort": "ticker",
            "direction": "asc",
            "limit": 50,
            "offset": 0,
        }
        default_and = get_screener(**common)
        explicit_and = get_screener(**common, logic="and")
        logical_or = get_screener(**common, logic="or")

    assert default_and.logic == "and"
    assert default_and.total == 0
    assert explicit_and.logic == "and"
    assert explicit_and.total == 0

    assert logical_or.logic == "or"
    assert logical_or.total == 2
    assert [row.ticker for row in logical_or.rows] == ["AAAA3", "BBBB3"]
    assert logical_or.applied_filters == 2


def test_screener_or_requires_at_least_one_matching_rule(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        instrument = _seed_company(session, "AAAA3", "EMPRESA A")

        def fake_ensure(self, records, metrics):
            return {
                (record.id, metric): (Decimal(1), None)
                for record, _ in records
                for metric in metrics
            }

        monkeypatch.setattr(ScreenerSnapshotService, "ensure", fake_ensure)

        response = get_screener(
            session=session,
            q=None,
            filters=["roe:gte:10", "net_margin:gte:10"],
            sort="ticker",
            direction="asc",
            logic="or",
            limit=50,
            offset=0,
        )

    assert instrument.ticker == "AAAA3"
    assert response.total == 0
    assert response.rows == []
