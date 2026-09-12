from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from openmarket_api.api.routes.screener import get_screener
from openmarket_api.domain.entities import Company, Instrument, InstrumentType
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.repositories import CompanyRepository, InstrumentRepository


def test_screener_lists_synchronized_assets_without_financials() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        company = Company(
            legal_name="BANCO DO BRASIL S.A.",
            trading_name="BANCO DO BRASIL",
            cvm_code="1023",
        )
        company_record = CompanyRepository(session).upsert(company)
        InstrumentRepository(session).upsert(
            Instrument(
                ticker="BBAS3",
                exchange="B3",
                issuer_name=company.legal_name,
                isin="BRBBASACNOR3",
                instrument_type=InstrumentType.STOCK,
                currency="BRL",
            ),
            company_id=company_record.id,
        )
        session.commit()

        response = get_screener(session=session, q=None, limit=80, offset=0)

    assert response.total == 1
    assert len(response.rows) == 1
    row = response.rows[0]
    assert row.ticker == "BBAS3"
    assert row.company_name == "BANCO DO BRASIL"
    assert row.cvm_code == "1023"
    assert row.financial_item_count == 0
    assert row.document_count == 0
    assert all(value is None for value in row.metrics.values())
