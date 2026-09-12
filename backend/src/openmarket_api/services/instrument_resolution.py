import unicodedata

from openmarket_api.domain.entities import Company, Instrument
from openmarket_api.providers.contracts import CompanyProvider, InstrumentProvider


class InstrumentResolutionService:
    def __init__(
        self,
        *,
        instrument_provider: InstrumentProvider,
        company_provider: CompanyProvider,
    ) -> None:
        self.instrument_provider = instrument_provider
        self.company_provider = company_provider

    async def resolve(self, ticker: str) -> tuple[Instrument, Company | None]:
        instruments = list(await self.instrument_provider.search_instruments(ticker))
        instrument = next(
            (item for item in instruments if item.ticker.upper() == ticker.strip().upper()),
            None,
        )
        if instrument is None:
            raise LookupError(f"instrument not found for ticker {ticker}")

        company = await self._resolve_company(instrument)
        if company is not None:
            instrument.company_id = company.id
        return instrument, company

    async def _resolve_company(self, instrument: Instrument) -> Company | None:
        if not instrument.issuer_name:
            return None

        candidates = list(await self.company_provider.search_companies(instrument.issuer_name))
        if not candidates:
            return None

        issuer = self._fold(instrument.issuer_name)
        exact = next(
            (
                company
                for company in candidates
                if issuer in {
                    self._fold(company.legal_name),
                    self._fold(company.trading_name or ""),
                }
            ),
            None,
        )
        if exact is not None:
            return exact

        compatible = [
            company
            for company in candidates
            if self._compatible(issuer, self._fold(company.legal_name))
        ]
        return compatible[0] if len(compatible) == 1 else None

    @staticmethod
    def _fold(value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value)
        ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
        return "".join(ch for ch in ascii_value.upper() if ch.isalnum())

    @staticmethod
    def _compatible(left: str, right: str) -> bool:
        if min(len(left), len(right)) < 8:
            return False
        return left in right or right in left
