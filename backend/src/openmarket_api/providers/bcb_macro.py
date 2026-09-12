from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from openmarket_api.core.settings import Settings, get_settings
from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.macro import MacroExpectation, MacroIndicator, MacroSeriesPoint, MacroSnapshot

BCB_SGS_BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs"
BCB_SGS_PORTAL_URL = "https://dadosabertos.bcb.gov.br/"
BCB_FOCUS_BASE_URL = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"
BCB_FOCUS_PORTAL_URL = "https://dadosabertos.bcb.gov.br/dataset/expectativas-mercado"


@dataclass(frozen=True)
class MacroSeriesSpec:
    key: str
    code: int
    label: str
    description: str
    unit: str
    frequency: str


SERIES: tuple[MacroSeriesSpec, ...] = (
    MacroSeriesSpec(
        key="selic_target",
        code=432,
        label="Selic",
        description="Meta da taxa Selic definida pelo Copom.",
        unit="% a.a.",
        frequency="diária",
    ),
    MacroSeriesSpec(
        key="ipca_12m",
        code=13522,
        label="IPCA 12 meses",
        description="Inflação oficial acumulada nos últimos 12 meses.",
        unit="%",
        frequency="mensal",
    ),
    MacroSeriesSpec(
        key="usd_brl",
        code=1,
        label="Dólar comercial",
        description="Taxa de câmbio livre do dólar americano para venda.",
        unit="R$/US$",
        frequency="diária",
    ),
    MacroSeriesSpec(
        key="igpm_monthly",
        code=189,
        label="IGP-M",
        description="Variação mensal do Índice Geral de Preços - Mercado.",
        unit="% no mês",
        frequency="mensal",
    ),
    MacroSeriesSpec(
        key="ibc_br",
        code=24363,
        label="IBC-Br",
        description="Índice mensal de atividade econômica do Banco Central.",
        unit="índice",
        frequency="mensal",
    ),
)


@dataclass(frozen=True)
class FocusSpec:
    key: str
    indicator: str
    label: str
    unit: str
    detail: str | None = None


FOCUS: tuple[FocusSpec, ...] = (
    FocusSpec(key="ipca", indicator="IPCA", label="IPCA", unit="%"),
    FocusSpec(key="gdp", indicator="PIB Total", label="PIB", unit="%"),
    FocusSpec(
        key="selic",
        indicator="Meta para taxa over-selic",
        label="Selic",
        unit="% a.a.",
        detail="Fim do ano",
    ),
    FocusSpec(
        key="exchange",
        indicator="Taxa de câmbio",
        label="Câmbio",
        unit="R$/US$",
        detail="Fim do ano",
    ),
)


class BCBMacroProvider:
    """Macroeconomic snapshot backed only by official BCB open-data endpoints."""

    name = "bcb-macro"

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.transport = transport

    async def snapshot(self) -> MacroSnapshot:
        indicator_results = await asyncio.gather(
            *(self._fetch_series(spec) for spec in SERIES),
            return_exceptions=True,
        )
        indicators = [item for item in indicator_results if isinstance(item, MacroIndicator)]

        focus_results = await asyncio.gather(
            *(self._fetch_focus(spec) for spec in FOCUS),
            return_exceptions=True,
        )
        expectations = [
            expectation
            for item in focus_results
            if isinstance(item, list)
            for expectation in item
        ]
        expectations.sort(key=lambda item: (item.reference_year, item.label))

        if not indicators and not expectations:
            raise RuntimeError("Banco Central macroeconomic sources are unavailable")
        return MacroSnapshot(indicators=indicators, expectations=expectations)

    async def _fetch_series(self, spec: MacroSeriesSpec) -> MacroIndicator:
        today = datetime.now(UTC).date()
        start = today - timedelta(days=365 * 5 + 2)
        params = {
            "formato": "json",
            "dataInicial": start.strftime("%d/%m/%Y"),
            "dataFinal": today.strftime("%d/%m/%Y"),
        }
        async with httpx.AsyncClient(
            timeout=self.settings.request_timeout_seconds,
            transport=self.transport,
            headers={"User-Agent": self.settings.user_agent},
        ) as client:
            response = await client.get(f"{BCB_SGS_BASE_URL}.{spec.code}/dados", params=params)
            response.raise_for_status()
            payload = response.json()

        points = self._parse_sgs(payload)
        if not points:
            raise LookupError(f"BCB SGS series {spec.code} returned no points")

        latest = points[-1]
        previous = points[-2] if len(points) > 1 else None
        return MacroIndicator(
            key=spec.key,
            label=spec.label,
            description=spec.description,
            unit=spec.unit,
            frequency=spec.frequency,
            latest_value=latest.value,
            previous_value=previous.value if previous else None,
            reference_date=latest.reference_date,
            change=latest.value - previous.value if previous else None,
            points=self._compress(points),
            source=self._sgs_source(spec, latest.reference_date),
        )

    async def _fetch_focus(self, spec: FocusSpec) -> list[MacroExpectation]:
        today = datetime.now(UTC).date()
        start = today - timedelta(days=45)
        clauses = [
            f"Indicador eq '{spec.indicator}'",
            "baseCalculo eq 0",
            f"Data ge '{start.isoformat()}'",
        ]
        if spec.detail:
            clauses.append(f"IndicadorDetalhe eq '{spec.detail}'")
        params = {
            "$format": "json",
            "$select": (
                "Indicador,IndicadorDetalhe,Data,DataReferencia,Mediana,Minimo,Maximo,"
                "numeroRespondentes"
            ),
            "$filter": " and ".join(clauses),
            "$orderby": "Data desc",
            "$top": "400",
        }
        async with httpx.AsyncClient(
            timeout=self.settings.request_timeout_seconds,
            transport=self.transport,
            headers={"User-Agent": self.settings.user_agent},
        ) as client:
            response = await client.get(
                f"{BCB_FOCUS_BASE_URL}/ExpectativasMercadoAnuais",
                params=params,
            )
            response.raise_for_status()
            payload = response.json()

        rows = payload.get("value") if isinstance(payload, dict) else None
        if not isinstance(rows, list) or not rows:
            return []

        latest_date = max(
            parsed
            for row in rows
            if isinstance(row, dict)
            if (parsed := self._parse_iso_date(row.get("Data"))) is not None
        )
        allowed_years = {today.year, today.year + 1, today.year + 2}
        expectations: list[MacroExpectation] = []
        seen: set[int] = set()
        for row in rows:
            if not isinstance(row, dict):
                continue
            observation_date = self._parse_iso_date(row.get("Data"))
            if observation_date != latest_date:
                continue
            try:
                reference_year = int(str(row.get("DataReferencia") or ""))
            except ValueError:
                continue
            if reference_year not in allowed_years or reference_year in seen:
                continue
            median = self._decimal(row.get("Mediana"))
            if median is None:
                continue
            seen.add(reference_year)
            expectations.append(
                MacroExpectation(
                    key=spec.key,
                    label=spec.label,
                    reference_year=reference_year,
                    median=median,
                    minimum=self._decimal(row.get("Minimo")),
                    maximum=self._decimal(row.get("Maximo")),
                    respondents=self._int(row.get("numeroRespondentes")),
                    observation_date=observation_date,
                    unit=spec.unit,
                    source=self._focus_source(observation_date),
                )
            )
        return expectations

    @staticmethod
    def _parse_sgs(payload: object) -> list[MacroSeriesPoint]:
        if not isinstance(payload, list):
            return []
        points: list[MacroSeriesPoint] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            raw_date = item.get("data")
            value = BCBMacroProvider._decimal(item.get("valor"))
            if value is None or not isinstance(raw_date, str):
                continue
            try:
                reference_date = datetime.strptime(raw_date, "%d/%m/%Y").date()
            except ValueError:
                continue
            points.append(MacroSeriesPoint(reference_date=reference_date, value=value))
        points.sort(key=lambda point: point.reference_date)
        return points

    @staticmethod
    def _compress(points: list[MacroSeriesPoint], limit: int = 72) -> list[MacroSeriesPoint]:
        if len(points) <= limit:
            return points
        step = (len(points) - 1) / (limit - 1)
        indexes = {round(index * step) for index in range(limit)}
        indexes.add(len(points) - 1)
        return [point for index, point in enumerate(points) if index in indexes]

    @staticmethod
    def _decimal(value: Any) -> Decimal | None:
        if value is None:
            return None
        try:
            return Decimal(str(value).replace(",", "."))
        except InvalidOperation:
            return None

    @staticmethod
    def _int(value: Any) -> int | None:
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _parse_iso_date(value: Any) -> date | None:
        if value is None:
            return None
        try:
            return date.fromisoformat(str(value)[:10])
        except ValueError:
            return None

    @staticmethod
    def _license(source_url: str) -> DataLicense:
        return DataLicense(
            license_id="odc-odbl",
            redistribution=RedistributionScope.ATTRIBUTION_REQUIRED,
            commercial_use_allowed=True,
            attribution_required=True,
            terms_url="https://opendatacommons.org/licenses/odbl/1-0/",
            notes=f"Dados abertos do Banco Central do Brasil. Catálogo: {source_url}",
        )

    @classmethod
    def _sgs_source(cls, spec: MacroSeriesSpec, reference_date: date) -> SourceMetadata:
        return SourceMetadata(
            provider="bcb-sgs",
            source_name=f"Banco Central do Brasil — SGS {spec.code}",
            source_url=BCB_SGS_PORTAL_URL,
            reference_date=reference_date,
            quality=DataQuality.OFFICIAL,
            license=cls._license(BCB_SGS_PORTAL_URL),
        )

    @classmethod
    def _focus_source(cls, reference_date: date) -> SourceMetadata:
        return SourceMetadata(
            provider="bcb-focus",
            source_name="Banco Central do Brasil — Expectativas de Mercado (Focus)",
            source_url=BCB_FOCUS_PORTAL_URL,
            reference_date=reference_date,
            quality=DataQuality.OFFICIAL,
            license=cls._license(BCB_FOCUS_PORTAL_URL),
        )
