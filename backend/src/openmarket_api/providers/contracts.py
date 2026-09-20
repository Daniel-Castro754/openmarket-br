from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from openmarket_api.domain.documents import PublicDocument
from openmarket_api.domain.entities import Company, FinancialStatementItem, Instrument, Quote
from openmarket_api.domain.insights import ConsumerInsightSnapshot
from openmarket_api.domain.macro import MacroSnapshot


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


class DocumentProvider(Provider):
    @abstractmethod
    async def get_documents(
        self,
        company: Company,
        start: date | None = None,
        end: date | None = None,
    ) -> Sequence[PublicDocument]:
        raise NotImplementedError


class MacroProvider(Provider):
    @abstractmethod
    async def snapshot(self) -> MacroSnapshot:
        raise NotImplementedError


class ConsumerInsightProvider(Provider):
    @abstractmethod
    async def snapshot(self) -> ConsumerInsightSnapshot:
        raise NotImplementedError


@dataclass(frozen=True)
class DocumentContent:
    content: bytes
    content_type: str
    final_url: str


class DocumentContentProvider(Provider):
    @abstractmethod
    async def fetch(self, document: PublicDocument) -> DocumentContent:
        raise NotImplementedError
