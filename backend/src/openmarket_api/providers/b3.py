from __future__ import annotations

import base64
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from openmarket_api.core.settings import Settings, get_settings
from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.entities import Instrument, InstrumentType
from openmarket_api.providers.contracts import InstrumentProvider

B3_PUBLIC_DATA_URL = "https://www.b3.com.br/pt_br/dados/hub-de-dados-publicos/"


class B3InstrumentProvider(InstrumentProvider):
    """Resolve listed B3 instruments from the public BDI endpoint."""

    name = "b3-instruments"

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.transport = transport

    async def healthcheck(self) -> bool:
        try:
            async with httpx.AsyncClient(
                base_url=self.settings.b3_bdi_base_url,
                timeout=self.settings.request_timeout_seconds,
                transport=self.transport,
                headers={"User-Agent": self.settings.user_agent},
            ) as client:
                response = await client.get("/")
                return response.status_code < 500
        except httpx.HTTPError:
            return False

    async def search_instruments(self, query: str) -> list[Instrument]:
        ticker = self._normalize_ticker(query)
        if not ticker:
            return []

        encoded = base64.b64encode(ticker.encode()).decode()
        timeout = httpx.Timeout(self.settings.request_timeout_seconds)
        async with httpx.AsyncClient(
            base_url=self.settings.b3_bdi_base_url,
            timeout=timeout,
            transport=self.transport,
            headers={"User-Agent": self.settings.user_agent},
        ) as client:
            for days_ago in range(1, 8):
                reference = datetime.now(UTC).date() - timedelta(days=days_ago)
                try:
                    response = await client.post(
                        f"/table/InstrumentsEquities/{reference}/{reference}/1/20",
                        params={"filter": encoded},
                        json={},
                    )
                    if response.status_code == 404:
                        continue
                    response.raise_for_status()
                    payload = response.json()
                except (httpx.HTTPError, ValueError):
                    continue

                instruments = self.parse_payload(payload, ticker=ticker, fallback_date=reference)
                if instruments:
                    return instruments
        return []

    @classmethod
    def parse_payload(
        cls,
        payload: object,
        *,
        ticker: str,
        fallback_date: date,
    ) -> list[Instrument]:
        if not isinstance(payload, dict):
            return []
        table = payload.get("table")
        if not isinstance(table, dict):
            return []

        columns = table.get("columns")
        values = table.get("values")
        if not isinstance(columns, list) or not isinstance(values, list):
            return []

        names = [
            column.get("name") if isinstance(column, dict) else None
            for column in columns
        ]
        normalized_ticker = cls._normalize_ticker(ticker)
        instruments: list[Instrument] = []

        for raw_row in values:
            if not isinstance(raw_row, list):
                continue
            row = dict(zip(names, raw_row, strict=False))
            row_ticker = cls._normalize_ticker(str(row.get("TckrSymb") or ""))
            if row_ticker != normalized_ticker:
                continue
            if str(row.get("SgmtNm") or "").strip().upper() != "CASH":
                continue

            reference_date = cls._parse_date(row.get("RptDt")) or fallback_date
            category = cls._clean(row.get("SctyCtgyNm"))
            specification = cls._clean(row.get("SpcfctnCd"))
            instruments.append(
                Instrument(
                    ticker=row_ticker,
                    exchange="B3",
                    isin=cls._clean(row.get("ISIN")),
                    issuer_name=cls._clean(row.get("CrpnNm") or row.get("AsstDesc")),
                    security_category=category,
                    specification=specification,
                    governance_level=cls._clean(row.get("CorpGovnLvlNm")),
                    instrument_type=cls._instrument_type(category, specification),
                    currency=cls._clean(row.get("TradgCcy")) or "BRL",
                    source=cls._source_metadata(reference_date),
                )
            )
        return instruments

    @staticmethod
    def _normalize_ticker(value: str) -> str:
        return "".join(ch for ch in value.strip().upper() if ch.isalnum())

    @staticmethod
    def _clean(value: Any) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @staticmethod
    def _parse_date(value: Any) -> date | None:
        if value is None:
            return None
        try:
            return date.fromisoformat(str(value).strip()[:10])
        except ValueError:
            return None

    @staticmethod
    def _instrument_type(category: str | None, specification: str | None) -> InstrumentType:
        text = f"{category or ''} {specification or ''}".upper()
        if "BDR" in text:
            return InstrumentType.BDR
        if "ETF" in text:
            return InstrumentType.ETF
        if "FII" in text or "IMOB" in text:
            return InstrumentType.FII
        if any(token in text for token in ("STOCK", "EQUITY", "ACAO", "AÇÃO", " ON", " PN")):
            return InstrumentType.STOCK
        return InstrumentType.OTHER

    @staticmethod
    def _source_metadata(reference_date: date) -> SourceMetadata:
        return SourceMetadata(
            provider="b3-instruments",
            source_name="B3 — Cadastro público de instrumentos listados",
            source_url=B3_PUBLIC_DATA_URL,
            reference_date=reference_date,
            quality=DataQuality.OFFICIAL,
            license=DataLicense(
                license_id="b3-public-data",
                redistribution=RedistributionScope.CONDITIONAL,
                commercial_use_allowed=None,
                attribution_required=True,
                terms_url=B3_PUBLIC_DATA_URL,
                notes="Public B3 data; redistribution must follow the applicable B3 data policy.",
            ),
        )
