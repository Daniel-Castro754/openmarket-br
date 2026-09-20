from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from openmarket_api.domain.common import SourceMetadata
from openmarket_api.domain.documents import DocumentType
from openmarket_api.domain.events import (
    CompanyEvent,
    CompanyEventCategory,
    CompanyEventOrigin,
    CompanyEventTimeline,
    CompanyEventType,
)
from openmarket_api.persistence.event_repository import CompanyEventRepository
from openmarket_api.persistence.models import PublicDocumentRecord
from openmarket_api.persistence.repositories import InstrumentRepository


@dataclass(frozen=True)
class CompanyEventProjectionResult:
    ticker: str
    projected: int
    skipped: int


class CompanyEventProjectionService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.events = CompanyEventRepository(session)

    def project_document(self, document: PublicDocumentRecord) -> bool:
        if document.company_id is None:
            return False

        source = SourceMetadata.model_validate(document.source)
        event_date = document.published_at or source.reference_date
        if event_date is None:
            return False

        category = classify_document_category(document)
        event = CompanyEvent(
            company_id=document.company_id,
            event_date=event_date,
            event_type=classify_document_event_type(document, category=category),
            category=category,
            origin=CompanyEventOrigin.CVM_DOCUMENT,
            title=document.title,
            description=_description(document),
            reference_period=document.reference_period,
            source_document_id=document.id,
            source_url=document.source_url,
            source_classification=_source_classification(document),
            source=source,
            projected_at=datetime.now(UTC),
        )
        self.events.upsert(
            event,
            natural_key=f"cvm-document:{document.id}",
        )
        return True

    def project_for_ticker(self, ticker: str) -> CompanyEventProjectionResult:
        instrument = InstrumentRepository(self.session).get_by_ticker(ticker)
        if instrument is None:
            raise LookupError(f"asset not found for ticker {ticker.upper()}")
        if instrument.company_id is None:
            raise LookupError(f"ticker {ticker.upper()} is not linked to a company")

        documents = list(
            self.session.scalars(
                select(PublicDocumentRecord)
                .where(PublicDocumentRecord.company_id == instrument.company_id)
                .order_by(
                    PublicDocumentRecord.published_at.desc(),
                    PublicDocumentRecord.id,
                )
            )
        )
        projected = 0
        skipped = 0
        for document in documents:
            if self.project_document(document):
                projected += 1
            else:
                skipped += 1
        self.session.commit()
        return CompanyEventProjectionResult(
            ticker=instrument.ticker,
            projected=projected,
            skipped=skipped,
        )


class CompanyEventService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.events = CompanyEventRepository(session)

    def timeline(
        self,
        ticker: str,
        *,
        category: CompanyEventCategory | None = None,
        event_type: CompanyEventType | None = None,
        start: date | None = None,
        end: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> CompanyEventTimeline:
        if start is not None and end is not None and start > end:
            raise ValueError("start must be on or before end")

        instrument = InstrumentRepository(self.session).get_by_ticker(ticker)
        if instrument is None:
            raise LookupError(f"asset not found for ticker {ticker.upper()}")
        if instrument.company_id is None:
            raise LookupError(f"ticker {ticker.upper()} is not linked to a company")

        return CompanyEventTimeline(
            ticker=instrument.ticker,
            events=self.events.list_for_company(
                instrument.company_id,
                category=category,
                event_type=event_type,
                start=start,
                end=end,
                limit=limit,
                offset=offset,
            ),
        )


def classify_document_event_type(
    document: PublicDocumentRecord,
    *,
    category: CompanyEventCategory | None = None,
) -> CompanyEventType:
    document_type = DocumentType(document.document_type)
    if document_type == DocumentType.MATERIAL_FACT:
        return CompanyEventType.MATERIAL_FACT
    if document_type == DocumentType.EARNINGS_RELEASE:
        return CompanyEventType.EARNINGS
    if document_type in {DocumentType.DFP, DocumentType.ITR}:
        return CompanyEventType.FILING
    if document_type == DocumentType.FRE:
        return CompanyEventType.GOVERNANCE
    if document_type == DocumentType.PRESENTATION:
        return CompanyEventType.PRESENTATION
    if document_type == DocumentType.ANNUAL_REPORT:
        return CompanyEventType.ANNUAL_REPORT
    if category == CompanyEventCategory.GOVERNANCE:
        return CompanyEventType.GOVERNANCE
    return CompanyEventType.DOCUMENT


def classify_document_category(
    document: PublicDocumentRecord,
) -> CompanyEventCategory:
    document_type = DocumentType(document.document_type)
    if document_type == DocumentType.MATERIAL_FACT:
        return CompanyEventCategory.MATERIAL
    if document_type == DocumentType.FRE:
        return CompanyEventCategory.GOVERNANCE
    if document_type in {
        DocumentType.DFP,
        DocumentType.ITR,
        DocumentType.EARNINGS_RELEASE,
        DocumentType.ANNUAL_REPORT,
        DocumentType.PRESENTATION,
    }:
        return CompanyEventCategory.RESULTS

    structured = _normalized(
        " ".join(
            value
            for value in (
                document.source_category,
                document.source_document_type,
                document.source_species,
                document.source_subject,
                document.source_presentation_type,
            )
            if value
        )
    )
    classified = _classify_text(structured)
    if classified is not None:
        return classified
    return _classify_text(_normalized(document.title)) or CompanyEventCategory.OTHER


def _classify_text(text: str) -> CompanyEventCategory | None:
    if not text:
        return None
    if _contains_any(text, ("calendario", "agenda de eventos")):
        return CompanyEventCategory.CALENDAR
    if _contains_any(
        text,
        (
            "dados economico-financeiros",
            "demonstracoes financeiras",
            "informacoes trimestrais",
            "resultado",
            "release",
            "relatorio anual",
            "relato integrado",
            "desempenho financeiro",
            "informacoes financeiras",
        ),
    ):
        return CompanyEventCategory.RESULTS
    if _contains_any(
        text,
        (
            "fato relevante",
            "comunicado ao mercado",
            "comunicado",
            "esclarecimento",
            "aviso aos acionistas",
            "aviso",
        ),
    ):
        return CompanyEventCategory.MATERIAL
    if _contains_any(
        text,
        (
            "assembleia",
            "conselho",
            "governanca",
            "transacao com parte relacionada",
            "posicao consolidada",
            "posicao individual",
            "acionista",
            "administrador",
            "estatuto",
            "capital social",
            "formulario de referencia",
        ),
    ):
        return CompanyEventCategory.GOVERNANCE
    if _contains_any(
        text,
        (
            "divida",
            "debenture",
            "captacao",
            "emissao",
            "titulos",
            "titulo global",
            "bond",
            "resgate",
            "financiamento",
            "pagamento de parcelas",
            "credito",
        ),
    ):
        return CompanyEventCategory.FINANCE
    if _contains_any(
        text,
        (
            "producao",
            "exploracao",
            "blocos exploratorios",
            "hidrocarboneto",
            "hidrocarbonetos",
            "reserva",
            "plataforma",
            "campo",
            "operacao",
            "operacional",
            "petroleo",
            "gas natural",
        ),
    ):
        return CompanyEventCategory.OPERATIONS
    if _contains_any(
        text,
        (
            "regulatorio",
            "regulacao",
            "fiscal",
            "tribut",
            "anp",
            "ibama",
            "cade",
            "sec",
        ),
    ):
        return CompanyEventCategory.REGULATORY
    return None


def _description(document: PublicDocumentRecord) -> str | None:
    subject = (document.source_subject or "").strip()
    if subject and subject != document.title:
        return subject
    return None


def _source_classification(document: PublicDocumentRecord) -> str | None:
    for value in (
        document.source_category,
        document.source_document_type,
        document.source_species,
        document.source_presentation_type,
    ):
        if value and value.strip():
            return value.strip()
    return None


def _normalized(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    text = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    ).casefold()
    return re.sub(r"\s+", " ", text).strip()


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)
