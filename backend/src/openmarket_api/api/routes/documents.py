from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from openmarket_api.api.dependencies import get_db_session
from openmarket_api.domain.documents import DocumentDetail, DocumentSummary, DocumentType
from openmarket_api.services.document_hub import DocumentHubService

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


@router.get("", response_model=list[DocumentSummary])
def list_documents(
    session: Annotated[Session, Depends(get_db_session)],
    ticker: Annotated[str | None, Query(min_length=1, max_length=32)] = None,
    document_type: Annotated[DocumentType | None, Query()] = None,
    q: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[DocumentSummary]:
    try:
        return DocumentHubService(session).list_documents(
            ticker=ticker,
            document_type=document_type,
            query_text=q,
            limit=limit,
            offset=offset,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: UUID,
    session: Annotated[Session, Depends(get_db_session)],
) -> DocumentDetail:
    try:
        return DocumentHubService(session).get_document(document_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
