from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from openmarket_api.api.router import router
from openmarket_api.core.settings import get_settings
from openmarket_api.providers.bootstrap import register_builtin_providers

settings = get_settings()
register_builtin_providers()

app = FastAPI(
    title="OpenMarket BR API",
    version="0.1.0-dev",
    description="API pública e extensível para dados do mercado financeiro brasileiro.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(router)
