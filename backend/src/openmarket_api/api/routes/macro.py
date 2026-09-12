from fastapi import APIRouter, HTTPException

from openmarket_api.domain.macro import MacroSnapshot
from openmarket_api.providers.bcb_macro import BCBMacroProvider

router = APIRouter(prefix="/api/v1/macro", tags=["macro"])


@router.get("", response_model=MacroSnapshot)
async def get_macro_snapshot() -> MacroSnapshot:
    try:
        return await BCBMacroProvider().snapshot()
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
