from datetime import date
from pathlib import Path
from zipfile import BadZipFile, ZipFile

from sqlalchemy.orm import Session

from openmarket_api.domain.common import SourceMetadata
from openmarket_api.domain.performance import PriceHistory, PriceHistoryPoint, PriceImportResult
from openmarket_api.persistence.repositories import InstrumentRepository, QuoteRepository
from openmarket_api.providers.b3_cotahist import B3CotahistParser


class PriceHistoryService:
    def __init__(self, session: Session) -> None:
        self.instruments = InstrumentRepository(session)
        self.quotes = QuoteRepository(session)

    def get_history(
        self,
        ticker: str,
        *,
        start: date | None = None,
        end: date | None = None,
        provider: str = B3CotahistParser.provider,
    ) -> PriceHistory:
        normalized = ticker.strip().upper()
        instrument = self.instruments.get_by_ticker(normalized)
        if instrument is None:
            raise LookupError(f"asset not found: {normalized}")

        records = self.quotes.list_history(
            instrument.id,
            start=start,
            end=end,
            provider=provider,
        )
        points = [
            PriceHistoryPoint(
                as_of=record.as_of,
                price=record.price,
                currency=record.currency,
                source=SourceMetadata.model_validate(record.source),
            )
            for record in records
        ]
        return PriceHistory(
            ticker=normalized,
            observations=len(points),
            start=points[0].as_of if points else None,
            end=points[-1].as_of if points else None,
            points=points,
        )


class B3CotahistImportService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.instruments = InstrumentRepository(session)
        self.quotes = QuoteRepository(session)

    def import_file(
        self,
        ticker: str,
        path: str | Path,
        *,
        start: date | None = None,
        end: date | None = None,
    ) -> PriceImportResult:
        normalized = ticker.strip().upper()
        instrument = self.instruments.get_by_ticker(normalized)
        if instrument is None:
            raise LookupError(
                f"asset not found: {normalized}; synchronize the ticker before importing prices"
            )

        file_path = Path(path).expanduser().resolve()
        if not file_path.is_file():
            raise FileNotFoundError(file_path)

        quotes = []
        for text in self._read_texts(file_path):
            quotes.extend(
                B3CotahistParser.parse_text(
                    text,
                    instrument_id=instrument.id,
                    ticker=normalized,
                    start=start,
                    end=end,
                )
            )

        by_date = {quote.as_of: quote for quote in quotes}
        ordered = [by_date[key] for key in sorted(by_date)]
        persisted = self.quotes.upsert_many(ordered, instrument_id=instrument.id)
        self.session.commit()

        return PriceImportResult(
            ticker=normalized,
            provider=B3CotahistParser.provider,
            parsed_rows=len(ordered),
            persisted_rows=persisted,
            start=ordered[0].as_of if ordered else None,
            end=ordered[-1].as_of if ordered else None,
        )

    @staticmethod
    def _read_texts(path: Path) -> list[str]:
        if path.suffix.lower() != ".zip":
            return [B3CotahistImportService._decode(path.read_bytes())]

        try:
            with ZipFile(path) as archive:
                members = [
                    name
                    for name in archive.namelist()
                    if not name.endswith("/") and name.lower().endswith(".txt")
                ]
                if not members:
                    raise ValueError("COTAHIST ZIP does not contain a .txt file")
                return [
                    B3CotahistImportService._decode(archive.read(name))
                    for name in sorted(members)
                ]
        except BadZipFile as exc:
            raise ValueError(f"invalid ZIP file: {path}") from exc

    @staticmethod
    def _decode(payload: bytes) -> str:
        for encoding in ("cp1252", "latin-1", "utf-8"):
            try:
                return payload.decode(encoding)
            except UnicodeDecodeError:
                continue
        raise ValueError("unable to decode COTAHIST text")
