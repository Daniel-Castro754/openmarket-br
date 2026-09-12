from abc import ABC, abstractmethod
from datetime import date
from typing import Sequence

from openmarket_api.domain.entities import Company, FinancialStatementItem, Instrument, Quote


class Provider(ABC):
    """Base contract for every external data source."""

    name: str

    @abstractmethod
    async def healthcheck(self) -> bool:
        raise NotImplementedError


class CompanyProvider(Provider):
    @abstractmethod
    async def search_companies(self, query: str) -> Sequence[Company]:
        raise NotImplementedError


class InstrumentProvider(Provider):
    @abstractmethod
    async def search_instruments(self, query: str) -> Sequence[Instrument]:
        raise NotImplementedError


class QuoteProvider(Provider):
    @abstractmethod
    async def get_quote(self, instrument: Instrument) -> Quote:
        raise NotImplementedError

    @abstractmethod
    async def get_history(
        self, instrument: Instrument, start: date, end: date
    ) -> Sequence[Quote]:
        raise NotImplementedError


class FinancialProvider(Provider):
    @abstractmethod
    async def get_statements(
        self, company: Company, start: date | None = None, end: date | None = None
    ) -> Sequence[FinancialStatementItem]:
        raise NotImplementedError
