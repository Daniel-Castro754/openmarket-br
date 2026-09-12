from fastapi import APIRouter

from .routes.companies import router as companies_router
from .routes.health import router as health_router
from .routes.meta import router as meta_router

router = APIRouter()
router.include_router(health_router)
router.include_router(companies_router)
router.include_router(meta_router)
