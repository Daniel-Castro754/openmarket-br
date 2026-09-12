from uuid import UUID

from sqlalchemy.orm import Session

from openmarket_api.domain.documents import DocumentDetail, DocumentSummary, DocumentType
from openmarket_api.persistence.document_repository import PublicDocumentRepository


class DocumentHubService:
    def __init__(self, session: Session) -> None:
        self.documents = PublicDocumentRepository(session)

    def list_documents(
        self,
        *,
        ticker: str | None = None,
        document_type: DocumentType | None = None,
        query_text: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[DocumentSummary]:
        company_id = None
        if ticker:
            company_id = self.documents.company_id_for_ticker(ticker)
            if company_id is None:
                return []
        return self.documents.list_documents(
            company_id=company_id,
            document_type=document_type.value if document_type else None,
            query_text=query_text,
            limit=limit,
            offset=offset,
        )

    def get_document(self, document_id: UUID) -> DocumentDetail:
        document = self.documents.get_document(document_id)
        if document is None:
            raise LookupError(f"document not found: {document_id}")
        return document
