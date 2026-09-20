from datetime import date
from decimal import Decimal, InvalidOperation
from uuid import UUID

from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.entities import Quote

B3_COTAHIST_PAGE = (
    "https://www.b3.com.br/pt_br/market-data-e-indices/"
    "servicos-de-dados/market-data/historico/mercado-a-vista/"
    "series-historicas/"
)


class B3CotahistParser:
    """Parse fixed-width COTAHIST records published by B3."""

    provider = "b3-cotahist"
    CASH_MARKET_CODE = "010"

    @classmethod
    def parse_text(
        cls,
        text: str,
        *,
        instrument_id: UUID,
        ticker: str,
        start: date | None = None,
        end: date | None = None,
    ) -> list[Quote]:
        normalized_ticker = ticker.strip().upper()
        quotes: list[Quote] = []

        for raw_line in text.splitlines():
            line = raw_line.rstrip("\r\n")
            quote = cls.parse_line(
                line,
                instrument_id=instrument_id,
                ticker=normalized_ticker,
            )
            if quote is None:
                continue
            if start is not None and quote.as_of < start:
                continue
            if end is not None and quote.as_of > end:
                continue
            quotes.append(quote)

        quotes.sort(key=lambda item: item.as_of)
        return quotes

    @classmethod
    def parse_line(
        cls,
        line: str,
        *,
        instrument_id: UUID,
        ticker: str,
    ) -> Quote | None:
        if len(line) < 245 or line[0:2] != "01":
            return None

        row_ticker = line[12:24].strip().upper()
        if row_ticker != ticker.strip().upper():
            return None

        market_type = line[24:27]
        if market_type != cls.CASH_MARKET_CODE:
            return None

        try:
            as_of = date(
                int(line[2:6]),
                int(line[6:8]),
                int(line[8:10]),
            )
            raw_price = Decimal(line[108:121].strip())
        except (ValueError, InvalidOperation):
            return None

        price = raw_price / Decimal("100")
        if price <= 0:
            return None

        currency = cls._currency(line[52:56])
        return Quote(
            instrument_id=instrument_id,
            price=price,
            currency=currency,
            as_of=as_of,
            source=cls._source_metadata(as_of),
        )

    @staticmethod
    def _currency(value: str) -> str:
        cleaned = value.strip().upper()
        if cleaned in {"R$", "REAL", "BRL"}:
            return "BRL"
        return cleaned or "BRL"

    @staticmethod
    def _source_metadata(reference_date: date) -> SourceMetadata:
        return SourceMetadata(
            provider=B3CotahistParser.provider,
            source_name="B3 — Série histórica de cotações (COTAHIST)",
            source_url=B3_COTAHIST_PAGE,
            reference_date=reference_date,
            quality=DataQuality.OFFICIAL,
            license=DataLicense(
                license_id="b3-public-historical-quotes",
                redistribution=RedistributionScope.CONDITIONAL,
                commercial_use_allowed=None,
                attribution_required=True,
                terms_url=B3_COTAHIST_PAGE,
                notes=(
                    "Preço de fechamento oficial da série histórica B3. "
                    "A série não é ajustada por inflação ou proventos."
                ),
            ),
        )
