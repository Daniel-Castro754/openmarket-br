from __future__ import annotations

import csv
import io
import zipfile
from collections.abc import Iterable, Sequence
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from enum import StrEnum

import httpx

from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.entities import Company, FinancialStatementItem
from openmarket_api.providers.contracts import FinancialProvider


CVM_DFP_DATA_URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS"
CVM_ITR_DATA_URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS"
CVM_DFP_DATASET_URL = "https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp"
CVM_ITR_DATASET_URL = "https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr"


class CVMReportKind(StrEnum):
    DFP = "dfp"
    ITR = "itr"


class CVMFinancialProvider(FinancialProvider):
    """Financial statements backed by CVM DFP and ITR annual archives."""

    name = "cvm-financial-statements"

    def __init__(self, *, timeout_seconds: float = 45.0) -> None:
        self.timeout_seconds = timeout_seconds
        self._archive_cache: dict[tuple[CVMReportKind, int], bytes] = {}

    async def healthcheck(self) -> bool:
        year = datetime.now(UTC).year
        url = self.archive_url(CVMReportKind.ITR, year)
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                response = await client.head(url)
                return response.status_code < 500
        except httpx.HTTPError:
            return False

    async def get_statements(
        self, company: Company, start: date | None = None, end: date | None = None
    ) -> Sequence[FinancialStatementItem]:
        if not company.cvm_code:
            return []

        today = datetime.now(UTC).date()
        start = start or date(today.year - 5, 1, 1)
        end = end or today
        if start > end:
            raise ValueError("start must be on or before end")

        items: list[FinancialStatementItem] = []
        for year in range(start.year, end.year + 1):
            for report_kind in (CVMReportKind.ITR, CVMReportKind.DFP):
                archive = await self._download_archive(report_kind, year)
                items.extend(
                    self.parse_archive(
                        archive,
                        company=company,
                        report_kind=report_kind,
                        start=start,
                        end=end,
                    )
                )

        return self._deduplicate(items)

    async def _download_archive(self, report_kind: CVMReportKind, year: int) -> bytes:
        key = (report_kind, year)
        if key in self._archive_cache:
            return self._archive_cache[key]

        url = self.archive_url(report_kind, year)
        async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True) as client:
            response = await client.get(url)
            if response.status_code == 404:
                return b""
            response.raise_for_status()

        self._archive_cache[key] = response.content
        return response.content

    @staticmethod
    def archive_url(report_kind: CVMReportKind, year: int) -> str:
        base = CVM_DFP_DATA_URL if report_kind == CVMReportKind.DFP else CVM_ITR_DATA_URL
        return f"{base}/{report_kind.value}_cia_aberta_{year}.zip"

    @classmethod
    def parse_archive(
        cls,
        archive: bytes,
        *,
        company: Company,
        report_kind: CVMReportKind,
        start: date,
        end: date,
    ) -> list[FinancialStatementItem]:
        if not archive or not company.cvm_code:
            return []

        result: list[FinancialStatementItem] = []
        with zipfile.ZipFile(io.BytesIO(archive)) as zf:
            for member in zf.namelist():
                statement = cls._statement_from_filename(member, report_kind)
                if statement is None:
                    continue

                consolidated = "_con_" in member.casefold()
                with zf.open(member) as raw:
                    text = cls._decode(raw.read())
                result.extend(
                    cls.parse_csv(
                        text,
                        company=company,
                        report_kind=report_kind,
                        statement=statement,
                        consolidated=consolidated,
                        start=start,
                        end=end,
                    )
                )
        return result

    @classmethod
    def parse_csv(
        cls,
        text: str,
        *,
        company: Company,
        report_kind: CVMReportKind,
        statement: str,
        consolidated: bool,
        start: date,
        end: date,
    ) -> list[FinancialStatementItem]:
        reader = csv.DictReader(io.StringIO(text), delimiter=";")
        items: list[FinancialStatementItem] = []
        expected_cvm = cls._normalize_code(company.cvm_code)

        for row in reader:
            if cls._normalize_code(row.get("CD_CVM")) != expected_cvm:
                continue

            period_end = cls._parse_date(row.get("DT_FIM_EXERC") or row.get("DT_REFER"))
            if period_end is None or not start <= period_end <= end:
                continue
            period_start = cls._parse_date(row.get("DT_INI_EXERC"))

            account_code = cls._clean(row.get("CD_CONTA"))
            account_name = cls._clean(row.get("DS_CONTA"))
            if not account_code or not account_name:
                continue

            raw_value = cls._parse_decimal(row.get("VL_CONTA"))
            if raw_value is None:
                continue

            scale = (cls._clean(row.get("ESCALA_MOEDA")) or "UNIDADE").casefold()
            value = raw_value * Decimal(1000) if "mil" in scale else raw_value

            items.append(
                FinancialStatementItem(
                    company_id=company.id,
                    period_start=period_start,
                    period_end=period_end,
                    statement=statement,
                    account_code=account_code,
                    account_name=account_name,
                    value=value,
                    currency=cls._currency(row.get("MOEDA")),
                    consolidated=consolidated,
                    source=cls._source_metadata(report_kind, period_end),
                )
            )

        return items

    @staticmethod
    def _statement_from_filename(member: str, report_kind: CVMReportKind) -> str | None:
        name = member.rsplit("/", 1)[-1].casefold()
        if not name.endswith(".csv"):
            return None

        prefix = f"{report_kind.value}_cia_aberta_"
        if not name.startswith(prefix):
            return None

        statement_tokens = (
            ("_bpa_", "BPA"),
            ("_bpp_", "BPP"),
            ("_dre_", "DRE"),
            ("_dva_", "DVA"),
            ("_dfc_md_", "DFC_MD"),
            ("_dfc_mi_", "DFC_MI"),
            ("_dmpl_", "DMPL"),
        )
        for token, statement in statement_tokens:
            if token in name:
                return statement
        return None

    @staticmethod
    def _decode(content: bytes) -> str:
        try:
            return content.decode("utf-8-sig")
        except UnicodeDecodeError:
            return content.decode("latin-1")

    @staticmethod
    def _clean(value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @staticmethod
    def _normalize_code(value: str | None) -> str:
        return (value or "").strip().lstrip("0")

    @staticmethod
    def _parse_date(value: str | None) -> date | None:
        if not value:
            return None
        try:
            return date.fromisoformat(value.strip()[:10])
        except ValueError:
            return None

    @staticmethod
    def _parse_decimal(value: str | None) -> Decimal | None:
        if value is None:
            return None
        normalized = value.strip().replace(" ", "")
        if not normalized:
            return None
        if "," in normalized and "." in normalized:
            normalized = normalized.replace(".", "").replace(",", ".")
        elif "," in normalized:
            normalized = normalized.replace(",", ".")
        try:
            return Decimal(normalized)
        except InvalidOperation:
            return None

    @staticmethod
    def _currency(value: str | None) -> str:
        value = (value or "REAL").strip().casefold()
        if value in {"real", "reais", "brl"}:
            return "BRL"
        if value in {"dolar", "dólar", "usd"}:
            return "USD"
        return value.upper()

    @staticmethod
    def _source_metadata(report_kind: CVMReportKind, reference_date: date) -> SourceMetadata:
        dataset_url = (
            CVM_DFP_DATASET_URL if report_kind == CVMReportKind.DFP else CVM_ITR_DATASET_URL
        )
        label = "DFP" if report_kind == CVMReportKind.DFP else "ITR"
        return SourceMetadata(
            provider="cvm-financial-statements",
            source_name=f"CVM — Companhias Abertas: {label}",
            source_url=dataset_url,
            reference_date=reference_date,
            quality=DataQuality.OFFICIAL,
            license=DataLicense(
                license_id="odc-odbl",
                redistribution=RedistributionScope.ATTRIBUTION_REQUIRED,
                commercial_use_allowed=True,
                attribution_required=True,
                terms_url="https://opendatacommons.org/licenses/odbl/1-0/",
                notes="Dataset published by CVM Open Data under ODbL.",
            ),
        )

    @staticmethod
    def _deduplicate(items: Iterable[FinancialStatementItem]) -> list[FinancialStatementItem]:
        deduped: dict[tuple[date | None, date, str, str, bool], FinancialStatementItem] = {}
        for item in items:
            key = (
                item.period_start,
                item.period_end,
                item.statement,
                item.account_code,
                item.consolidated,
            )
            deduped[key] = item
        return sorted(
            deduped.values(),
            key=lambda item: (
                item.period_end,
                item.period_start or item.period_end,
                item.statement,
                item.account_code,
                item.consolidated,
            ),
        )
