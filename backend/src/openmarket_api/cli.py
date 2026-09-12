import argparse
import asyncio
import logging
from datetime import date

from openmarket_api.persistence.database import get_session_factory
from openmarket_api.providers.bootstrap import register_builtin_providers
from openmarket_api.providers.contracts import (
    CompanyProvider,
    DocumentProvider,
    FinancialProvider,
    InstrumentProvider,
)
from openmarket_api.providers.registry import registry
from openmarket_api.services.asset_sync import AssetSyncService
from openmarket_api.services.document_sync import DocumentSyncService
from openmarket_api.services.ticker_sync import TickerSyncService

logger = logging.getLogger("openmarket.cli")


def _date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected date in YYYY-MM-DD format") from exc


def _add_date_range_arguments(parser: argparse.ArgumentParser, *, delivery: bool = False) -> None:
    start_label = "First delivery date" if delivery else "First reference date"
    end_label = "Last delivery date" if delivery else "Last reference date"
    parser.add_argument("--start", type=_date, default=None, help=f"{start_label} (YYYY-MM-DD)")
    parser.add_argument("--end", type=_date, default=None, help=f"{end_label} (YYYY-MM-DD)")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="openmarket", description="OpenMarket BR maintenance CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    sync = subparsers.add_parser("sync-asset", help="Synchronize one B3 asset and CVM financials")
    sync.add_argument("ticker", help="B3 ticker, for example PETR4")
    _add_date_range_arguments(sync)

    sync_documents = subparsers.add_parser(
        "sync-documents",
        help="Synchronize CVM public-document metadata for one persisted B3 asset",
    )
    sync_documents.add_argument("ticker", help="B3 ticker, for example PETR4")
    _add_date_range_arguments(sync_documents, delivery=True)

    sync_ticker = subparsers.add_parser(
        "sync-ticker",
        help="Synchronize one ticker end-to-end: B3, CVM financials and CVM IPE documents",
    )
    sync_ticker.add_argument("ticker", help="B3 ticker, for example PETR4")
    _add_date_range_arguments(sync_ticker)
    return parser


def _providers() -> tuple[InstrumentProvider, CompanyProvider, FinancialProvider, DocumentProvider]:
    register_builtin_providers()
    instrument_provider = registry.get("b3-instruments")
    company_provider = registry.get("cvm-company-registry")
    financial_provider = registry.get("cvm-financial-statements")
    document_provider = registry.get("cvm-ipe-documents")
    if not isinstance(instrument_provider, InstrumentProvider):
        raise TypeError("B3 instrument provider has an invalid type")
    if not isinstance(company_provider, CompanyProvider):
        raise TypeError("CVM company provider has an invalid type")
    if not isinstance(financial_provider, FinancialProvider):
        raise TypeError("CVM financial provider has an invalid type")
    if not isinstance(document_provider, DocumentProvider):
        raise TypeError("CVM IPE document provider has an invalid type")
    return instrument_provider, company_provider, financial_provider, document_provider


async def _sync_asset(ticker: str, *, start: date | None, end: date | None) -> int:
    if start is not None and end is not None and start > end:
        raise ValueError("start must be on or before end")

    instrument_provider, company_provider, financial_provider, _ = _providers()
    factory = get_session_factory()
    with factory() as session:
        result = await AssetSyncService(
            session=session,
            instrument_provider=instrument_provider,
            company_provider=company_provider,
            financial_provider=financial_provider,
        ).sync(ticker, start=start, end=end)

    logger.info(
        "synchronized ticker=%s cvm_code=%s financial_items=%s",
        result.ticker,
        result.cvm_code,
        result.financial_items,
    )
    return 0


async def _sync_documents(ticker: str, *, start: date | None, end: date | None) -> int:
    _, _, _, document_provider = _providers()
    factory = get_session_factory()
    with factory() as session:
        result = await DocumentSyncService(
            session=session,
            document_provider=document_provider,
        ).sync(ticker, start=start, end=end)

    logger.info(
        "synchronized documents ticker=%s cvm_code=%s documents=%s",
        result.ticker,
        result.cvm_code,
        result.documents,
    )
    return 0


async def _sync_ticker(ticker: str, *, start: date | None, end: date | None) -> int:
    instrument_provider, company_provider, financial_provider, document_provider = _providers()
    factory = get_session_factory()
    with factory() as session:
        result = await TickerSyncService(
            session=session,
            instrument_provider=instrument_provider,
            company_provider=company_provider,
            financial_provider=financial_provider,
            document_provider=document_provider,
        ).sync(ticker, start=start, end=end)

    logger.info(
        "synchronized end-to-end ticker=%s cvm_code=%s financial_items=%s documents=%s",
        result.ticker,
        result.cvm_code,
        result.financial_items,
        result.documents,
    )
    return 0


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = build_parser().parse_args()

    if args.command == "sync-asset":
        return asyncio.run(_sync_asset(args.ticker, start=args.start, end=args.end))
    if args.command == "sync-documents":
        return asyncio.run(_sync_documents(args.ticker, start=args.start, end=args.end))
    if args.command == "sync-ticker":
        return asyncio.run(_sync_ticker(args.ticker, start=args.start, end=args.end))
    raise RuntimeError(f"unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
