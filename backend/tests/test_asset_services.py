import asyncio
from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

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
from openmarket_api.providers.contracts import CompanyProvider, FinancialProvider, InstrumentProvider
from openmarket_api.services.asset_read import AssetReadService
from openmarket_api.services.asset_sync import AssetSyncService


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
                specification="PN N2",
                governance_level="NIVEL 2",
                instrument_type=InstrumentType.STOCK,
                source=_source("fixture-b3"),
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
                legal_name="PETROLEO BRASILEIRO S.A. PETROBRAS",
                trading_name="PETROBRAS",
                cnpj="33.000.167/0001-01",
                cvm_code="9512",
                source=_source("fixture-cvm-company"),
            )
        ]


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
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
                statement="DRE",
                account_code="3.01",
                account_name="Receita",
                value=Decimal(1234567),
                source=_source("fixture-cvm-financial"),
            )
        ]


def test_asset_sync_then_read_uses_persisted_data() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        result = asyncio.run(
            AssetSyncService(
                session=session,
                instrument_provider=FakeInstrumentProvider(),
                company_provider=FakeCompanyProvider(),
                financial_provider=FakeFinancialProvider(),
            ).sync("PETR4")
        )

        assert result.ticker == "PETR4"
        assert result.cvm_code == "9512"
        assert result.financial_items == 1

        reader = AssetReadService(session)
        snapshot = reader.get_asset("petr4")
        assert snapshot.instrument.ticker == "PETR4"
        assert snapshot.company is not None
        assert snapshot.company.cvm_code == "9512"
        assert snapshot.financial_item_count == 1
        assert snapshot.latest_period == date(2026, 6, 30)
        assert snapshot.available_periods == [date(2026, 6, 30)]

        financials = reader.get_financials("PETR4", statement="dre", consolidated=True)
        assert len(financials) == 1
        assert financials[0].value == Decimal(1234567)
