from collections.abc import Sequence

from openmarket_api.domain.entities import Company, Instrument, InstrumentType
from openmarket_api.providers.contracts import CompanyProvider, InstrumentProvider
from openmarket_api.services.instrument_resolution import InstrumentResolutionService


class FakeInstrumentProvider(InstrumentProvider):
    name = "fake-instrument"

    async def healthcheck(self) -> bool:
        return True

    async def search_instruments(self, query: str) -> Sequence[Instrument]:
        if query.strip().upper() != "PETR4":
            return []
        return [
            Instrument(
                ticker="PETR4",
                issuer_name="PETROLEO BRASILEIRO S.A. PETROBRAS",
                instrument_type=InstrumentType.STOCK,
            )
        ]


class FakeCompanyProvider(CompanyProvider):
    name = "fake-company"

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
            )
        ]


async def test_resolve_ticker_links_b3_instrument_to_cvm_company() -> None:
    service = InstrumentResolutionService(
        instrument_provider=FakeInstrumentProvider(),
        company_provider=FakeCompanyProvider(),
    )

    instrument, company = await service.resolve("PETR4")

    assert company is not None
    assert company.cvm_code == "9512"
    assert instrument.company_id == company.id


async def test_resolve_unknown_ticker_fails_without_guessing() -> None:
    service = InstrumentResolutionService(
        instrument_provider=FakeInstrumentProvider(),
        company_provider=FakeCompanyProvider(),
    )

    try:
        await service.resolve("XXXX3")
    except LookupError as exc:
        assert "XXXX3" in str(exc)
    else:
        raise AssertionError("unknown ticker should not resolve")
