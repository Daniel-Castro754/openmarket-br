import asyncio
from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.documents import DocumentType, PublicDocument
from openmarket_api.domain.entities import (
    Company,
    FinancialStatementItem,
    Instrument,
    InstrumentType,
)
from openmarket_api.persistence.base import Base
from openmarket_api.persistence.models import FinancialStatementRecord, PublicDocumentRecord
from openmarket_api.providers.contracts import (
    CompanyProvider,
    DocumentProvider,
    FinancialProvider,
    InstrumentProvider,
)
from openmarket_api.services.ticker_sync import TickerSyncService


def _source(provider: str) -> SourceMetadata:
    return SourceMetadata(
        provider=provider,
        source_name=f"{provider} fixture",
        reference_date=date(2026, 6, 30),
        quality=DataQuality.OFFICIAL,
        license=DataLicense(
            license_id="fixture",
            redistribution=RedistributionScope.ALLOWED,
        ),
    )


class FakeInstrumentProvider(InstrumentProvider):
    name = "fixture-b3"

    async def healthcheck(self) -> bool:
        return True

    async def search_instruments(self, query: str) -> Sequence[Instrument]:
        if query.strip().upper() != "PETR4":
            return []
        return [
            Instrument(
                ticker="PETR4",
                isin="BRPETRACNPR6",
                issuer_name="PETROLEO BRASILEIRO S.A. PETROBRAS",
                instrument_type=InstrumentType.STOCK,
                source=_source(self.name),
            )
        ]


class FakeCompanyProvider(CompanyProvider):
    name = "fixture-cvm-company"

    async def healthcheck(self) -> bool:
        return True

    async def search_companies(self, query: str) -> Sequence[Company]:
        if "PETRO" not in query.upper():
            return []
        return [
            Company(
                legal_name="PETRÓLEO BRASILEIRO S.A. - PETROBRAS",
                trading_name="PETROBRAS",
                cnpj="33.000.167/0001-01",
                cvm_code="9512",
                source=_source(self.name),
            )
        ]


class EmptyCompanyProvider(CompanyProvider):
    name = "empty-cvm-company"

    async def healthcheck(self) -> bool:
        return True

    async def search_companies(self, query: str) -> Sequence[Company]:
        return []


class FakeFinancialProvider(FinancialProvider):
    name = "fixture-cvm-financial"

    async def healthcheck(self) -> bool:
        return True

    async def get_statements(
        self,
        company: Company,
        start: date | None = None,
        end: date | None = None,
    ) -> Sequence[FinancialStatementItem]:
        return [
            FinancialStatementItem(
                company_id=company.id,
                filing_type="ITR",
                filing_reference_date=date(2026, 6, 30),
                filing_version=1,
                exercise_order="ÚLTIMO",
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
                statement="DRE",
                account_code="3.01",
                account_name="Receita",
                value=Decimal("1234567"),
                consolidated=True,
                source=_source(self.name),
            )
        ]


class FakeDocumentProvider(DocumentProvider):
    name = "fixture-cvm-ipe"

    async def healthcheck(self) -> bool:
        return True

    async def get_documents(
        self,
        company: Company,
        start: date | None = None,
        end: date | None = None,
    ) -> list[PublicDocument]:
        return [
            PublicDocument(
                company_id=company.id,
                title="Resultados do segundo trimestre",
                document_type=DocumentType.EARNINGS_RELEASE,
                source_url="https://example.test/petr4-2t26.pdf",
                published_at=date(2026, 8, 7),
                reference_period="2026-06-30",
                source=_source(self.name),
            )
        ]


def _service(session: Session, *, company_provider: CompanyProvider) -> TickerSyncService:
    return TickerSyncService(
        session=session,
        instrument_provider=FakeInstrumentProvider(),
        company_provider=company_provider,
        financial_provider=FakeFinancialProvider(),
        document_provider=FakeDocumentProvider(),
    )


def test_ticker_sync_persists_financials_and_documents_end_to_end() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        result = asyncio.run(_service(session, company_provider=FakeCompanyProvider()).sync("PETR4"))

        financial_count = session.scalar(select(func.count()).select_from(FinancialStatementRecord))
        document_count = session.scalar(select(func.count()).select_from(PublicDocumentRecord))

        assert result.ticker == "PETR4"
        assert result.cvm_code == "9512"
        assert result.financial_items == 1
        assert result.documents == 1
        assert financial_count == 1
        assert document_count == 1


def test_ticker_sync_fails_fast_when_ticker_is_not_linked_to_cvm_company() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        try:
            asyncio.run(_service(session, company_provider=EmptyCompanyProvider()).sync("PETR4"))
        except LookupError as exc:
            assert "could not be linked to a CVM company" in str(exc)
        else:
            raise AssertionError("end-to-end sync should fail when the CVM company link is missing")
