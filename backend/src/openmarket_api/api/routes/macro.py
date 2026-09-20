from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from openmarket_api.api.dependencies import get_db_session
from openmarket_api.domain.macro import MacroSnapshot
from openmarket_api.services.data_platform import PersistedDataPlatformService

router = APIRouter(prefix="/api/v1/macro", tags=["macro"])


@router.get("", response_model=MacroSnapshot)
def get_macro_snapshot(
    session: Annotated[Session, Depends(get_db_session)],
) -> MacroSnapshot:
    snapshot = PersistedDataPlatformService(session).macro()
    if snapshot is None:
        raise HTTPException(
            status_code=503,
            detail="Macro snapshot is not synchronized yet",
        )
    return snapshot
