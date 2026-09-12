from __future__ import annotations

import csv
import io
import re
import unicodedata
import zipfile
from datetime import UTC, date, datetime

import httpx

from openmarket_api.domain.common import (
    DataLicense,
    DataQuality,
    RedistributionScope,
    SourceMetadata,
)
from openmarket_api.domain.documents import (
    DocumentProcessingStatus,
    DocumentType,
    PublicDocument,
)
from openmarket_api.domain.entities import Company
from openmarket_api.providers.contracts import DocumentProvider

CVM_IPE_DATA_URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS"
CVM_IPE_DATASET_URL = "https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe"


class CVMIpeDocumentProvider(DocumentProvider):
    """Public corporate-document metadata from the CVM IPE dataset."""

    name = "cvm-ipe-documents"

    def __init__(self, *, timeout_seconds: float = 45.0) -> None:
        self.timeout_seconds = timeout_seconds
        self._archive_cache: dict[int, bytes] = {}

    async def healthcheck(self) -> bool:
        url = self.archive_url(datetime.now(UTC).year)
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                response = await client.head(url)
                return response.status_code < 500
        except httpx.HTTPError:
            return False

    async def get_documents(
        self,
        company: Company,
        start: date | None = None,
        end: date | None = None,
    ) -> list[PublicDocument]:
        if not company.cvm_code and not company.cnpj:
            return []

        today = datetime.now(UTC).date()
        start = start or date(max(today.year - 4, 2003), 1, 1)
        end = end or today
        if start > end:
            raise ValueError("start must be on or before end")

        documents: list[PublicDocument] = []
        for year in range(start.year, end.year + 1):
            archive = await self._download_archive(year)
            documents.extend(
                self.parse_archive(
                    archive,
                    company=company,
                    start=start,
                    end=end,
                )
            )
        return documents

    async def _download_archive(self, year: int) -> bytes:
        if year in self._archive_cache:
            return self._archive_cache[year]

        async with httpx.AsyncClient(
            timeout=self.timeout_seconds,
            follow_redirects=True,
        ) as client:
            response = await client.get(self.archive_url(year))
            if response.status_code == 404:
                return b""
            response.raise_for_status()

        self._archive_cache[year] = response.content
        return response.content

    @staticmethod
    def archive_url(year: int) -> str:
        return f"{CVM_IPE_DATA_URL}/ipe_cia_aberta_{year}.zip"

    @classmethod
    def parse_archive(
        cls,
        archive: bytes,
        *,
        company: Company,
        start: date,
        end: date,
    ) -> list[PublicDocument]:
        if not archive:
            return []

        documents: list[PublicDocument] = []
        with zipfile.ZipFile(io.BytesIO(archive)) as zf:
            for member in zf.namelist():
                if not member.casefold().endswith(".csv"):
                    continue
                with zf.open(member) as raw:
                    documents.extend(
                        cls.parse_csv(
                            cls._decode(raw.read()),
                            company=company,
                            start=start,
                            end=end,
                        )
                    )
        return documents

    @classmethod
    def parse_csv(
        cls,
        text: str,
        *,
        company: Company,
        start: date,
        end: date,
    ) -> list[PublicDocument]:
        reader = csv.DictReader(io.StringIO(text), delimiter=";")
        documents: list[PublicDocument] = []
        expected_cvm = cls._normalize_code(company.cvm_code)
        expected_cnpj = cls._digits(company.cnpj)

        for source_row in reader:
            row = {cls._normalize_header(key): value for key, value in source_row.items() if key}
            cvm_code = cls._normalize_code(cls._value(row, "codigo_cvm", "cd_cvm"))
            cnpj = cls._digits(cls._value(row, "cnpj_companhia", "cnpj_cia", "cnpj"))
            if expected_cvm:
                if cvm_code != expected_cvm:
                    continue
            elif expected_cnpj and cnpj != expected_cnpj:
                continue

            delivered_at = cls._parse_date(
                cls._value(row, "data_entrega", "dt_entrega", "data_recebimento")
            )
            if delivered_at is None or not start <= delivered_at <= end:
                continue

            reference_date = cls._parse_date(
                cls._value(row, "data_referencia", "dt_referencia", "data_ref")
            )
            category = cls._clean(cls._value(row, "categoria"))
            document_type_text = cls._clean(cls._value(row, "tipo"))
            species = cls._clean(cls._value(row, "especie", "especie_documento"))
            subject = cls._clean(cls._value(row, "assunto"))
            presentation_type = cls._clean(cls._value(row, "tipo_apresentacao"))
            protocol = cls._clean(cls._value(row, "protocolo_entrega", "protocolo"))
            version = cls._clean(cls._value(row, "versao", "versao_documento"))
            source_url = cls._clean(cls._value(row, "link_download", "url", "link"))

            title = cls._title(
                subject=subject,
                species=species,
                document_type=document_type_text,
                category=category,
                protocol=protocol,
            )
            notes = cls._notes(
                category=category,
                document_type=document_type_text,
                species=species,
                presentation_type=presentation_type,
                protocol=protocol,
                version=version,
            )
            documents.append(
                PublicDocument(
                    company_id=company.id,
                    title=title,
                    document_type=cls._document_type(
                        category,
                        document_type_text,
                        species,
                        subject,
                    ),
                    source_url=source_url,
                    published_at=delivered_at,
                    reference_period=reference_date.isoformat() if reference_date else None,
                    processing_status=DocumentProcessingStatus.PENDING,
                    source=cls._source_metadata(reference_date or delivered_at, notes=notes),
                )
            )

        return documents

    @classmethod
    def _document_type(cls, *parts: str | None) -> DocumentType:
        text = cls._normalize_text(" ".join(part for part in parts if part))
        if "fato relevante" in text:
            return DocumentType.MATERIAL_FACT
        if "informacoes trimestrais" in text or re.search(r"\bitr\b", text):
            return DocumentType.ITR
        if "demonstracoes financeiras padronizadas" in text or re.search(r"\bdfp\b", text):
            return DocumentType.DFP
        if "formulario de referencia" in text or re.search(r"\bfre\b", text):
            return DocumentType.FRE
        if "release" in text and "resultado" in text:
            return DocumentType.EARNINGS_RELEASE
        if "resultado" in text and any(token in text for token in ("trimestre", "exercicio", "release")):
            return DocumentType.EARNINGS_RELEASE
        if "apresentacao" in text:
            return DocumentType.PRESENTATION
        if "relatorio anual" in text or "relato integrado" in text:
            return DocumentType.ANNUAL_REPORT
        return DocumentType.OTHER

    @staticmethod
    def _title(
        *,
        subject: str | None,
        species: str | None,
        document_type: str | None,
        category: str | None,
        protocol: str | None,
    ) -> str:
        for value in (subject, species, document_type, category):
            if value:
                return value
        if protocol:
            return f"Documento CVM — protocolo {protocol}"
        return "Documento periódico/eventual CVM"

    @staticmethod
    def _notes(
        *,
        category: str | None,
        document_type: str | None,
        species: str | None,
        presentation_type: str | None,
        protocol: str | None,
        version: str | None,
    ) -> str:
        values = {
            "categoria": category,
            "tipo": document_type,
            "especie": species,
            "tipo_apresentacao": presentation_type,
            "protocolo": protocol,
            "versao": version,
        }
        return "; ".join(f"{key}={value}" for key, value in values.items() if value)

    @staticmethod
    def _source_metadata(reference_date: date, *, notes: str) -> SourceMetadata:
        return SourceMetadata(
            provider="cvm-ipe-documents",
            source_name="CVM — Documentos Periódicos e Eventuais (IPE)",
            source_url=CVM_IPE_DATASET_URL,
            reference_date=reference_date,
            quality=DataQuality.OFFICIAL,
            license=DataLicense(
                license_id="odc-odbl",
                redistribution=RedistributionScope.ATTRIBUTION_REQUIRED,
                commercial_use_allowed=True,
                attribution_required=True,
                terms_url="https://opendatacommons.org/licenses/odbl/1-0/",
                notes=notes or "Dataset published by CVM Open Data under ODbL.",
            ),
        )

    @staticmethod
    def _decode(content: bytes) -> str:
        for encoding in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                return content.decode(encoding)
            except UnicodeDecodeError:
                continue
        return content.decode("latin-1", errors="replace")

    @classmethod
    def _normalize_header(cls, value: str) -> str:
        normalized = cls._normalize_text(value)
        return re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")

    @staticmethod
    def _normalize_text(value: str) -> str:
        decomposed = unicodedata.normalize("NFKD", value)
        return "".join(char for char in decomposed if not unicodedata.combining(char)).casefold()

    @staticmethod
    def _value(row: dict[str, str | None], *names: str) -> str | None:
        for name in names:
            value = row.get(name)
            if value is not None and value.strip():
                return value
        return None

    @staticmethod
    def _clean(value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @staticmethod
    def _normalize_code(value: str | None) -> str:
        return (value or "").strip().lstrip("0")

    @staticmethod
    def _digits(value: str | None) -> str:
        return "".join(char for char in (value or "") if char.isdigit())

    @staticmethod
    def _parse_date(value: str | None) -> date | None:
        if not value:
            return None
        raw = value.strip()
        for candidate in (raw[:10], raw):
            try:
                return date.fromisoformat(candidate)
            except ValueError:
                pass
        for fmt in ("%d/%m/%Y", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(raw, fmt).date()
            except ValueError:
                continue
        return None
