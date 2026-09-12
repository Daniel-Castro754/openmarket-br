import asyncio
import csv
import io
from collections.abc import Sequence
from time import monotonic

import httpx

from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.entities import Company
from openmarket_api.providers.contracts import CompanyProvider


CVM_COMPANY_CSV_URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv"
CVM_COMPANY_DATASET_URL = "https://dados.cvm.gov.br/dataset/cia_aberta-cad"


class CVMCompanyProvider(CompanyProvider):
    """Company registry provider backed by CVM's official open-data CSV."""

    name = "cvm-company-registry"

    def __init__(self, *, cache_ttl_seconds: int = 6 * 60 * 60) -> None:
        self.cache_ttl_seconds = cache_ttl_seconds
        self._cache: list[Company] = []
        self._cache_loaded_at = 0.0
        self._lock = asyncio.Lock()

    async def healthcheck(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                response = await client.get(CVM_COMPANY_CSV_URL, headers={"Range": "bytes=0-64"})
                return response.status_code in {200, 206}
        except httpx.HTTPError:
            return False

    async def search_companies(self, query: str) -> Sequence[Company]:
        companies = await self._companies()
        needle = self._normalize(query)
        if not needle:
            return []

        matches: list[Company] = []
        for company in companies:
            haystacks = (
                company.legal_name,
                company.trading_name or "",
                company.cnpj or "",
                company.cvm_code or "",
            )
            if any(needle in self._normalize(value) for value in haystacks):
                matches.append(company)
            if len(matches) >= 50:
                break
        return matches

    async def _companies(self) -> list[Company]:
        if self._cache and monotonic() - self._cache_loaded_at < self.cache_ttl_seconds:
            return self._cache

        async with self._lock:
            if self._cache and monotonic() - self._cache_loaded_at < self.cache_ttl_seconds:
                return self._cache
            self._cache = await self._download()
            self._cache_loaded_at = monotonic()
            return self._cache

    async def _download(self) -> list[Company]:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            response = await client.get(CVM_COMPANY_CSV_URL)
            response.raise_for_status()

        # CVM cadastral files historically use a Latin-1-compatible encoding.
        text = response.content.decode("latin-1")
        return self.parse_csv(text)

    @classmethod
    def parse_csv(cls, text: str) -> list[Company]:
        reader = csv.DictReader(io.StringIO(text), delimiter=";")
        source = cls._source_metadata()
        companies: list[Company] = []

        for row in reader:
            legal_name = cls._clean(row.get("DENOM_SOCIAL"))
            if not legal_name:
                continue
            companies.append(
                Company(
                    legal_name=legal_name,
                    trading_name=cls._clean(row.get("DENOM_COMERC")),
                    cnpj=cls._clean(row.get("CNPJ_CIA")),
                    cvm_code=cls._clean(row.get("CD_CVM")),
                    source=source,
                )
            )
        return companies

    @staticmethod
    def _clean(value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @staticmethod
    def _normalize(value: str) -> str:
        return "".join(ch for ch in value.casefold().strip() if ch.isalnum())

    @staticmethod
    def _source_metadata() -> SourceMetadata:
        return SourceMetadata(
            provider="cvm-company-registry",
            source_name="CVM — Cias Abertas: Informação Cadastral",
            source_url=CVM_COMPANY_DATASET_URL,
            quality=DataQuality.OFFICIAL,
            license=DataLicense(
                license_id="odc-odbl",
                redistribution=RedistributionScope.ATTRIBUTION_REQUIRED,
                commercial_use_allowed=True,
                attribution_required=True,
                terms_url="https://opendatacommons.org/licenses/odbl/1-0/",
                notes="Dataset published by CVM under ODbL according to the CVM Open Data portal.",
            ),
        )
