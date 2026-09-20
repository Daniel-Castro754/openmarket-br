from fastapi import APIRouter

from .routes.assets import router as assets_router
from .routes.companies import router as companies_router
from .routes.comparison import router as comparison_router
from .routes.documents import router as documents_router
from .routes.events import router as events_router
from .routes.financials import router as financials_router
from .routes.health import router as health_router
from .routes.indicators import router as indicators_router
from .routes.insights import router as insights_router
from .routes.instruments import router as instruments_router
from .routes.macro import router as macro_router
from .routes.meta import router as meta_router
from .routes.performance import router as performance_router
from .routes.screener import router as screener_router

router = APIRouter()
router.include_router(health_router)
router.include_router(assets_router)
router.include_router(companies_router)
router.include_router(comparison_router)
router.include_router(documents_router)
router.include_router(events_router)
router.include_router(financials_router)
router.include_router(indicators_router)
router.include_router(instruments_router)
router.include_router(macro_router)
router.include_router(meta_router)
router.include_router(performance_router)
router.include_router(screener_router)
router.include_router(insights_router)
