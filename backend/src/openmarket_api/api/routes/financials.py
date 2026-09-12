from datetime import date

from fastapi import APIRouter, HTTPException, Query

from openmarket_api.domain.entities import Company, FinancialStatementItem
from openmarket_api.providers.contracts import CompanyProvider, FinancialProvider
from openmarket_api.providers.registry import registry

router = APIRouter(prefix="/api/v1/financials", tags=["financials"])


@router.get("/{cvm_code}", response_model=list[FinancialStatementItem])
async def get_financial_statements(
    cvm_code: str,
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
) -> list[FinancialStatementItem]:
    company_provider = registry.get("cvm-company-registry")
    financial_provider = registry.get("cvm-financial-statements")

    if not isinstance(company_provider, CompanyProvider):
        raise HTTPException(status_code=500, detail="Configured provider cannot search companies")
    if not isinstance(financial_provider, FinancialProvider):
        raise HTTPException(status_code=500, detail="Configured provider cannot load financial statements")

    try:
        candidates = list(await company_provider.search_companies(cvm_code))
        company: Company | None = next(
            (candidate for candidate in candidates if (candidate.cvm_code or "").lstrip("0") == cvm_code.lstrip("0")),
            None,
        )
        if company is None:
            raise HTTPException(status_code=404, detail="Company not found for CVM code")

        return list(await financial_provider.get_statements(company, start=start, end=end))
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="CVM financial data source unavailable") from exc
