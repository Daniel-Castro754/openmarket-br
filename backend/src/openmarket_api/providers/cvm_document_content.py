from __future__ import annotations

from urllib.parse import urljoin, urlsplit

import httpx

from openmarket_api.core.settings import Settings, get_settings
from openmarket_api.domain.common import RedistributionScope
from openmarket_api.domain.documents import PublicDocument
from openmarket_api.providers.contracts import DocumentContent, DocumentContentProvider

TRUSTED_CVM_HOSTS = frozenset(
    {
        "dados.cvm.gov.br",
        "rad.cvm.gov.br",
        "www.rad.cvm.gov.br",
        "sistemas.cvm.gov.br",
    }
)
REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})
MAX_REDIRECTS = 5
RAD_PDF_MIME_COMPAT_HOSTS = frozenset({"rad.cvm.gov.br", "www.rad.cvm.gov.br"})
PDF_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "application/octet-stream",
        "application/download",
        "application/x-download",
        "application/force-download",
        "binary/octet-stream",
    }
)


class CVMDocumentContentProvider(DocumentContentProvider):
    """Fetch document bytes only from persisted, trusted CVM public links."""

    name = "cvm-document-content"

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
                timeout=self.settings.document_timeout_seconds,
                transport=self.transport,
                headers={"User-Agent": self.settings.user_agent},
            ) as client:
                response = await client.head("https://dados.cvm.gov.br/")
                return response.status_code < 500
        except httpx.HTTPError:
            return False

    async def fetch(self, document: PublicDocument) -> DocumentContent:
        self._validate_document(document)
        assert document.source_url is not None

        current_url = document.source_url
        async with httpx.AsyncClient(
            timeout=self.settings.document_timeout_seconds,
            transport=self.transport,
            headers={"User-Agent": self.settings.user_agent},
        ) as client:
            for _ in range(MAX_REDIRECTS + 1):
                self._validate_url(current_url)
                async with client.stream("GET", current_url, follow_redirects=False) as response:
                    if response.status_code in REDIRECT_STATUSES:
                        location = response.headers.get("location")
                        if not location:
                            raise RuntimeError("CVM document redirect has no Location header")
                        current_url = urljoin(str(response.url), location)
                        continue

                    response.raise_for_status()
                    self._validate_content_length(response.headers.get("content-length"))
                    content = await self._read_limited(response)
                    content_type = self._content_type(response.headers.get("content-type"))
                    normalized_content_type = self._validate_pdf(
                        content,
                        content_type,
                        final_url=str(response.url),
                    )
                    return DocumentContent(
                        content=content,
                        content_type=normalized_content_type,
                        final_url=str(response.url),
                    )

        raise RuntimeError(f"CVM document exceeded {MAX_REDIRECTS} redirects")

    def _validate_document(self, document: PublicDocument) -> None:
        if document.source.provider != "cvm-ipe-documents":
            raise ValueError(
                "document content fetch is restricted to persisted CVM IPE documents"
            )
        if not document.source_url:
            raise ValueError("document has no source_url")
        if document.source.license.redistribution not in {
            RedistributionScope.ALLOWED,
            RedistributionScope.ATTRIBUTION_REQUIRED,
        }:
            raise PermissionError(
                "document license does not allow persisted extracted content"
            )
        self._validate_url(document.source_url)

    @staticmethod
    def _validate_url(url: str) -> None:
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"}:
            raise ValueError("document URL must use HTTP(S)")
        hostname = (parsed.hostname or "").casefold()
        if hostname not in TRUSTED_CVM_HOSTS:
            raise ValueError(f"untrusted CVM document host: {hostname or '-'}")
        if parsed.username or parsed.password:
            raise ValueError("document URL must not contain credentials")

    def _validate_content_length(self, raw_value: str | None) -> None:
        if raw_value is None:
            return
        try:
            size = int(raw_value)
        except ValueError as exc:
            raise ValueError("invalid Content-Length for CVM document") from exc
        if size < 0:
            raise ValueError("invalid negative Content-Length for CVM document")
        if size > self.settings.document_max_bytes:
            raise ValueError(
                f"CVM document exceeds maximum size of {self.settings.document_max_bytes} bytes"
            )

    async def _read_limited(self, response: httpx.Response) -> bytes:
        data = bytearray()
        async for chunk in response.aiter_bytes():
            data.extend(chunk)
            if len(data) > self.settings.document_max_bytes:
                raise ValueError(
                    f"CVM document exceeds maximum size of {self.settings.document_max_bytes} bytes"
                )
        if not data:
            raise ValueError("CVM document response is empty")
        return bytes(data)

    @staticmethod
    def _content_type(raw_value: str | None) -> str:
        return (raw_value or "application/octet-stream").split(";", 1)[0].strip().casefold()

    @staticmethod
    def _validate_pdf(
        content: bytes,
        content_type: str,
        *,
        final_url: str,
    ) -> str:
        if b"%PDF-" not in content[:1024]:
            raise ValueError(
                f"CVM document is not a PDF (content-type={content_type or 'unknown'})"
            )

        if content_type in PDF_CONTENT_TYPES:
            return "application/pdf"

        hostname = (urlsplit(final_url).hostname or "").casefold()
        if content_type == "text/html" and hostname in RAD_PDF_MIME_COMPAT_HOSTS:
            return "application/pdf"

        raise ValueError(f"unsupported CVM document content-type: {content_type}")
