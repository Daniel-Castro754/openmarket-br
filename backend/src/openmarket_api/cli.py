import argparse
import asyncio
import logging
from datetime import date
from pathlib import Path
from uuid import UUID

from openmarket_api.persistence.database import get_session_factory
from openmarket_api.providers.bootstrap import register_builtin_providers
from openmarket_api.providers.contracts import (
    CompanyProvider,
    ConsumerInsightProvider,
    DocumentContentProvider,
    DocumentProvider,
    FinancialProvider,
    InstrumentProvider,
    MacroProvider,
)
from openmarket_api.providers.registry import registry
from openmarket_api.services.asset_sync import AssetSyncService
from openmarket_api.services.company_events import CompanyEventProjectionService
from openmarket_api.services.data_platform import DataPlatformSyncService
from openmarket_api.services.document_processing import DocumentProcessingService
from openmarket_api.services.document_sync import DocumentSyncService
from openmarket_api.services.price_history import B3CotahistImportService
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

    import_cotahist = subparsers.add_parser(
        "import-cotahist",
        help="Import persisted daily prices from an official B3 COTAHIST .TXT or .ZIP file",
    )
    import_cotahist.add_argument("ticker", help="Persisted B3 ticker, for example PETR4")
    import_cotahist.add_argument("path", type=Path, help="Path to COTAHIST .TXT or .ZIP")
    _add_date_range_arguments(import_cotahist)

    subparsers.add_parser(
        "sync-macro",
        help="Synchronize and persist official Banco Central macroeconomic snapshots",
    )
    subparsers.add_parser(
        "sync-consumer-insights",
        help="Synchronize and persist official IBGE consumer/economic snapshots",
    )
    subparsers.add_parser(
        "sync-data-platform",
        help="Synchronize all persisted macro and consumer datasets",
    )

    process_document = subparsers.add_parser(
        "process-document",
        help="Download and extract one persisted CVM PDF outside the request path",
    )
    process_document.add_argument("document_id", type=UUID, help="Persisted document UUID")
    process_document.add_argument(
        "--force",
        action="store_true",
        help="Reprocess even when the document is already ready",
    )

    process_documents = subparsers.add_parser(
        "process-documents",
        help="Process pending/failed CVM PDFs for one persisted ticker",
    )
    process_documents.add_argument("--ticker", required=True, help="B3 ticker, for example PETR4")
    process_documents.add_argument("--limit", type=int, default=10, help="Maximum documents to attempt")
    process_documents.add_argument(
        "--pending-only",
        action="store_true",
        help="Do not retry documents already marked failed",
    )

    project_events = subparsers.add_parser(
        "project-events",
        help="Backfill/update the unified company-event timeline from persisted documents",
    )
    project_events.add_argument("--ticker", required=True, help="B3 ticker, for example PETR4")
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


def _document_content_provider() -> DocumentContentProvider:
    register_builtin_providers()
    provider = registry.get("cvm-document-content")
    if not isinstance(provider, DocumentContentProvider):
        raise TypeError("CVM document content provider has an invalid type")
    return provider


def _data_platform_providers() -> tuple[MacroProvider, ConsumerInsightProvider]:
    register_builtin_providers()
    macro_provider = registry.get("bcb-macro")
    consumer_provider = registry.get("ibge-consumer")
    if not isinstance(macro_provider, MacroProvider):
        raise TypeError("BCB macro provider has an invalid type")
    if not isinstance(consumer_provider, ConsumerInsightProvider):
        raise TypeError("IBGE consumer provider has an invalid type")
    return macro_provider, consumer_provider


async def _sync_macro() -> int:
    macro_provider, _ = _data_platform_providers()
    factory = get_session_factory()
    with factory() as session:
        result = await DataPlatformSyncService(session).sync_macro(macro_provider)
    logger.info(
        "synchronized provider=%s dataset=%s items=%s",
        result.provider,
        result.dataset,
        result.item_count,
    )
    return 0


async def _sync_consumer_insights() -> int:
    _, consumer_provider = _data_platform_providers()
    factory = get_session_factory()
    with factory() as session:
        result = await DataPlatformSyncService(session).sync_consumer_insights(consumer_provider)
    logger.info(
        "synchronized provider=%s dataset=%s items=%s",
        result.provider,
        result.dataset,
        result.item_count,
    )
    return 0


async def _sync_data_platform() -> int:
    macro_provider, consumer_provider = _data_platform_providers()
    factory = get_session_factory()
    with factory() as session:
        service = DataPlatformSyncService(session)
        macro_result = await service.sync_macro(macro_provider)
        consumer_result = await service.sync_consumer_insights(consumer_provider)
    logger.info(
        "synchronized data platform macro_items=%s consumer_items=%s",
        macro_result.item_count,
        consumer_result.item_count,
    )
    return 0


async def _process_document(document_id: UUID, *, force: bool) -> int:
    factory = get_session_factory()
    with factory() as session:
        result = await DocumentProcessingService(
            session=session,
            content_provider=_document_content_provider(),
        ).process_document(document_id, force=force)

    logger.info(
        "processed document=%s status=%s pages=%s sections=%s skipped=%s",
        result.document_id,
        result.status.value,
        result.page_count,
        result.sections,
        result.skipped,
    )
    return 0


async def _process_documents(
    ticker: str,
    *,
    limit: int,
    include_failed: bool,
) -> int:
    factory = get_session_factory()
    with factory() as session:
        result = await DocumentProcessingService(
            session=session,
            content_provider=_document_content_provider(),
        ).process_for_ticker(
            ticker,
            limit=limit,
            include_failed=include_failed,
        )

    logger.info(
        "processed documents ticker=%s attempted=%s ready=%s failed=%s skipped=%s",
        result.ticker,
        result.attempted,
        result.ready,
        result.failed,
        result.skipped,
    )
    for error in result.errors:
        logger.warning("processing error: %s", error)

    if result.attempted > 0 and result.ready == 0 and result.skipped == 0:
        return 2
    return 0


def _project_events(ticker: str) -> int:
    factory = get_session_factory()
    with factory() as session:
        result = CompanyEventProjectionService(session).project_for_ticker(ticker)

    logger.info(
        "projected company events ticker=%s projected=%s skipped=%s",
        result.ticker,
        result.projected,
        result.skipped,
    )
    return 0


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


def _import_cotahist(
    ticker: str,
    path: Path,
    *,
    start: date | None,
    end: date | None,
) -> int:
    if start is not None and end is not None and start > end:
        raise ValueError("start must be on or before end")

    factory = get_session_factory()
    with factory() as session:
        result = B3CotahistImportService(session).import_file(
            ticker,
            path,
            start=start,
            end=end,
        )

    logger.info(
        "imported COTAHIST ticker=%s provider=%s rows=%s period=%s..%s",
        result.ticker,
        result.provider,
        result.persisted_rows,
        result.start,
        result.end,
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
    if args.command == "import-cotahist":
        return _import_cotahist(
            args.ticker,
            args.path,
            start=args.start,
            end=args.end,
        )
    if args.command == "sync-macro":
        return asyncio.run(_sync_macro())
    if args.command == "sync-consumer-insights":
        return asyncio.run(_sync_consumer_insights())
    if args.command == "sync-data-platform":
        return asyncio.run(_sync_data_platform())
    if args.command == "process-document":
        return asyncio.run(_process_document(args.document_id, force=args.force))
    if args.command == "process-documents":
        return asyncio.run(
            _process_documents(
                args.ticker,
                limit=args.limit,
                include_failed=not args.pending_only,
            )
        )
    if args.command == "project-events":
        return _project_events(args.ticker)
    raise RuntimeError(f"unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
