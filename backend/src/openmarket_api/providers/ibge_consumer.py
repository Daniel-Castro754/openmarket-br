from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

import httpx

from openmarket_api.core.settings import Settings, get_settings
from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.insights import (
    ConsumptionItem,
    ConsumptionProfile,
    ConsumerInsightSnapshot,
    EconomicTrend,
    InsightPoint,
)

SIDRA_BASE_URL = "https://apisidra.ibge.gov.br/values"
IBGE_POF_URL = "https://www.ibge.gov.br/estatisticas/sociais/saude/24786-pof-2017-2018.html"
IBGE_SIDRA_URL = "https://sidra.ibge.gov.br/"


@dataclass(frozen=True)
class TrendSpec:
    key: str
    label: str
    description: str
    unit: str
    path: str
    transform: str = "identity"


TRENDS: tuple[TrendSpec, ...] = (
    TrendSpec(
        key="retail_yoy",
        label="Varejo",
        description="Variação do volume de vendas contra o mesmo mês do ano anterior.",
        unit="% a/a",
        path="/t/8880/n1/1/v/11709/p/last%2024/c11046/56734",
    ),
    TrendSpec(
        key="services_yoy",
        label="Serviços",
        description="Variação do volume de serviços contra o mesmo mês do ano anterior.",
        unit="% a/a",
        path=(
            "/t/8688/n1/1/v/11624/p/last%2024/c11046/56726/"
            "c12355/107071"
        ),
    ),
    TrendSpec(
        key="industry_yoy",
        label="Indústria",
        description="Variação estimada a partir do índice de produção física industrial.",
        unit="% a/a",
        path="/t/8888/n1/1/v/12606/p/last%2024/c544/129314",
        transform="yoy_from_index",
    ),
    TrendSpec(
        key="ipca_monthly",
        label="IPCA",
        description="Variação mensal do índice oficial de preços ao consumidor amplo.",
        unit="% no mês",
        path="/t/1737/n1/1/v/63/p/last%2024",
    ),
)

CONSUMPTION_SHARES: dict[str, tuple[str, Decimal | None, tuple[str, ...]]] = {
    "brasil": (
        "Brasil",
        Decimal("3764.51"),
        ("17.5", "36.6", "4.3", "18.1", "3.6", "8.0", "4.7", "2.6", "0.5", "1.3", "3.0"),
    ),
    "urbana": (
        "Urbana",
        Decimal("4020.98"),
        ("16.9", "37.1", "4.2", "17.9", "3.6", "8.0", "4.9", "2.6", "0.5", "1.3", "3.0"),
    ),
    "rural": (
        "Rural",
        Decimal("2158.83"),
        ("23.8", "30.9", "4.7", "20.0", "4.5", "8.0", "2.3", "1.8", "0.5", "0.9", "2.5"),
    ),
    "norte": (
        "Norte",
        None,
        ("21.0", "36.4", "5.3", "16.6", "5.7", "5.4", "3.2", "2.5", "0.3", "1.1", "2.4"),
    ),
    "nordeste": (
        "Nordeste",
        None,
        ("22.0", "32.4", "5.1", "16.2", "5.0", "8.0", "4.7", "2.5", "0.4", "1.3", "2.4"),
    ),
    "sudeste": (
        "Sudeste",
        None,
        ("15.8", "39.0", "3.7", "17.5", "3.0", "8.5", "5.1", "2.5", "0.5", "1.3", "3.0"),
    ),
    "sul": (
        "Sul",
        None,
        ("17.1", "35.7", "4.5", "20.6", "3.3", "7.3", "3.7", "2.6", "0.6", "1.2", "3.3"),
    ),
    "centro_oeste": (
        "Centro-Oeste",
        None,
        ("16.6", "33.4", "4.5", "21.0", "3.6", "8.0", "4.7", "2.7", "0.4", "1.3", "3.8"),
    ),
}

CONSUMPTION_CATEGORIES: tuple[tuple[str, str], ...] = (
    ("food", "Alimentação"),
    ("housing", "Habitação"),
    ("clothing", "Vestuário"),
    ("transport", "Transporte"),
    ("personal_care", "Higiene e cuidados pessoais"),
    ("health", "Saúde"),
    ("education", "Educação"),
    ("recreation", "Recreação e cultura"),
    ("tobacco", "Fumo"),
    ("personal_services", "Serviços pessoais"),
    ("other", "Despesas diversas"),
)


class IBGEConsumerProvider:
    name = "ibge-consumer"

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.transport = transport

    async def snapshot(self) -> ConsumerInsightSnapshot:
        results = await asyncio.gather(
            *(self._fetch_trend(spec) for spec in TRENDS),
            return_exceptions=True,
        )
        trends = [item for item in results if isinstance(item, EconomicTrend)]
        return ConsumerInsightSnapshot(
            consumption_profiles=self._consumption_profiles(),
            trends=trends,
            notes=[
                "Consumo estrutural: POF 2017-2018; não representa o orçamento atual em reais.",
                "Tendências conjunturais: séries oficiais mensais do SIDRA/IBGE.",
                "Valores regionais da POF são exibidos como participação; o valor mensal só é calculado onde a média oficial foi publicada no recorte usado.",
            ],
        )

    async def _fetch_trend(self, spec: TrendSpec) -> EconomicTrend:
        async with httpx.AsyncClient(
            timeout=self.settings.request_timeout_seconds,
            transport=self.transport,
            headers={"User-Agent": self.settings.user_agent},
        ) as client:
            response = await client.get(f"{SIDRA_BASE_URL}{spec.path}")
            response.raise_for_status()
            payload = response.json()

        points = self._parse_sidra(payload)
        if spec.transform == "yoy_from_index":
            points = self._year_over_year(points)
        if not points:
            raise LookupError(f"IBGE SIDRA returned no usable data for {spec.key}")
        latest = points[-1]
        return EconomicTrend(
            key=spec.key,
            label=spec.label,
            description=spec.description,
            unit=spec.unit,
            latest_value=latest.value,
            latest_period=latest.period,
            points=points[-24:],
            source=self._sidra_source(latest.period),
        )

    @classmethod
    def _consumption_profiles(cls) -> list[ConsumptionProfile]:
        source = cls._pof_source()
        profiles: list[ConsumptionProfile] = []
        for key, (label, monthly_total, shares) in CONSUMPTION_SHARES.items():
            items: list[ConsumptionItem] = []
            for (item_key, item_label), share_text in zip(CONSUMPTION_CATEGORIES, shares, strict=True):
                share = Decimal(share_text)
                monthly_value = (
                    (monthly_total * share / Decimal(100)).quantize(Decimal("0.01"))
                    if monthly_total is not None
                    else None
                )
                items.append(
                    ConsumptionItem(
                        key=item_key,
                        label=item_label,
                        share_percent=share,
                        monthly_value=monthly_value,
                    )
                )
            profiles.append(
                ConsumptionProfile(
                    key=key,
                    label=label,
                    description="Distribuição da despesa de consumo monetária e não monetária média mensal.",
                    average_monthly_consumption=monthly_total,
                    items=items,
                    source=source,
                )
            )
        return profiles

    @staticmethod
    def _parse_sidra(payload: object) -> list[InsightPoint]:
        if not isinstance(payload, list) or len(payload) < 2:
            return []
        points: list[InsightPoint] = []
        for row in payload[1:]:
            if not isinstance(row, dict):
                continue
            value = IBGEConsumerProvider._decimal(row.get("V"))
            period = IBGEConsumerProvider._period(row)
            if value is None or period is None:
                continue
            points.append(InsightPoint(period=period, value=value))
        points.sort(key=lambda point: point.period)
        return points

    @staticmethod
    def _period(row: dict[str, object]) -> str | None:
        for key, value in row.items():
            if not key.endswith("C"):
                continue
            text = str(value)
            if re.fullmatch(r"\d{6}", text):
                return text
        return None

    @staticmethod
    def _year_over_year(points: list[InsightPoint]) -> list[InsightPoint]:
        if len(points) <= 12:
            return []
        transformed: list[InsightPoint] = []
        for index in range(12, len(points)):
            prior = points[index - 12].value
            if prior == 0:
                continue
            value = ((points[index].value / prior) - 1) * Decimal(100)
            transformed.append(
                InsightPoint(period=points[index].period, value=value.quantize(Decimal("0.01")))
            )
        return transformed

    @staticmethod
    def _decimal(value: object) -> Decimal | None:
        if value is None:
            return None
        text = str(value).strip().replace(",", ".")
        if text in {"", "-", "..", "...", "x"}:
            return None
        try:
            return Decimal(text)
        except InvalidOperation:
            return None

    @staticmethod
    def _license(notes: str) -> DataLicense:
        return DataLicense(
            license_id="ibge-public-data",
            redistribution=RedistributionScope.ATTRIBUTION_REQUIRED,
            attribution_required=True,
            notes=notes,
        )

    @classmethod
    def _pof_source(cls) -> SourceMetadata:
        return SourceMetadata(
            provider="ibge-pof",
            source_name="IBGE — Pesquisa de Orçamentos Familiares 2017-2018",
            source_url=IBGE_POF_URL,
            reference_date=date(2018, 7, 10),
            quality=DataQuality.OFFICIAL,
            license=cls._license("Dados públicos do IBGE; preservar atribuição e referência da pesquisa."),
        )

    @classmethod
    def _sidra_source(cls, period: str) -> SourceMetadata:
        reference_date = None
        if re.fullmatch(r"\d{6}", period):
            year, month = int(period[:4]), int(period[4:])
            if 1 <= month <= 12:
                reference_date = date(year, month, 1)
        return SourceMetadata(
            provider="ibge-sidra",
            source_name="IBGE — SIDRA",
            source_url=IBGE_SIDRA_URL,
            reference_date=reference_date,
            quality=DataQuality.OFFICIAL,
            license=cls._license("Séries públicas oficiais do SIDRA/IBGE; preservar atribuição."),
        )
