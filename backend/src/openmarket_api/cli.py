import argparse
import asyncio
import logging
from datetime import date

from openmarket_api.persistence.database import get_session_factory
from openmarket_api.providers.bootstrap import register_builtin_providers
from openmarket_api.providers.contracts import (
    CompanyProvider,
    FinancialProvider,
    InstrumentProvider,
)
from openmarket_api.providers.registry import registry
from openmarket_api.services.asset_sync import AssetSyncService

logger = logging.getLogger("openmarket.cli")


def _date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected date in YYYY-MM-DD format") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="openmarket", description="OpenMarket BR maintenance CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    sync = subparsers.add_parser("sync-asset", help="Synchronize one B3 asset and CVM financials")
    sync.add_argument("ticker", help="B3 ticker, for example PETR4")
    sync.add_argument("--start", type=_date, default=None, help="First reference date (YYYY-MM-DD)")
    sync.add_argument("--end", type=_date, default=None, help="Last reference date (YYYY-MM-DD)")
    return parser


async def _sync_asset(ticker: str, *, start: date | None, end: date | None) -> int:
    if start is not None and end is not None and start > end:
        raise ValueError("start must be on or before end")

    register_builtin_providers()
    instrument_provider = registry.get("b3-instruments")
    company_provider = registry.get("cvm-company-registry")
    financial_provider = registry.get("cvm-financial-statements")
    if not isinstance(instrument_provider, InstrumentProvider):
        raise TypeError("B3 instrument provider has an invalid type")
    if not isinstance(company_provider, CompanyProvider):
        raise TypeError("CVM company provider has an invalid type")
    if not isinstance(financial_provider, FinancialProvider):
        raise TypeError("CVM financial provider has an invalid type")

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


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = build_parser().parse_args()

    if args.command == "sync-asset":
        return asyncio.run(_sync_asset(args.ticker, start=args.start, end=args.end))
    raise RuntimeError(f"unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
