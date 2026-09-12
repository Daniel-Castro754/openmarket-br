from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from openmarket_api.providers.contracts import (
    CompanyProvider,
    DocumentProvider,
    FinancialProvider,
    InstrumentProvider,
)
from openmarket_api.services.asset_sync import AssetSyncService
from openmarket_api.services.document_sync import DocumentSyncService


@dataclass(frozen=True)
class TickerSyncResult:
    ticker: str
    cvm_code: str
    financial_items: int
    documents: int


class TickerSyncService:
    """Synchronize one ticker through B3, CVM financials and CVM IPE metadata."""

    def __init__(
        self,
        *,
        session: Session,
        instrument_provider: InstrumentProvider,
        company_provider: CompanyProvider,
        financial_provider: FinancialProvider,
        document_provider: DocumentProvider,
    ) -> None:
        self.session = session
        self.instrument_provider = instrument_provider
        self.company_provider = company_provider
        self.financial_provider = financial_provider
        self.document_provider = document_provider

    async def sync(
        self,
        ticker: str,
        *,
        start: date | None = None,
        end: date | None = None,
    ) -> TickerSyncResult:
        if start is not None and end is not None and start > end:
            raise ValueError("start must be on or before end")

        asset = await AssetSyncService(
            session=self.session,
            instrument_provider=self.instrument_provider,
            company_provider=self.company_provider,
            financial_provider=self.financial_provider,
        ).sync(ticker, start=start, end=end)

        if not asset.cvm_code:
            raise LookupError(
                f"ticker {asset.ticker} could not be linked to a CVM company; "
                "document synchronization was not attempted"
            )

        documents = await DocumentSyncService(
            session=self.session,
            document_provider=self.document_provider,
        ).sync(ticker, start=start, end=end)

        return TickerSyncResult(
            ticker=asset.ticker,
            cvm_code=asset.cvm_code,
            financial_items=asset.financial_items,
            documents=documents.documents,
        )
