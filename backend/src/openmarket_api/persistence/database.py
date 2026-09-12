from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from openmarket_api.core.settings import Settings, get_settings


def create_database_engine(settings: Settings | None = None) -> Engine:
    resolved = settings or get_settings()
    return create_engine(resolved.database_url, pool_pre_ping=True)


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@lru_cache
def get_database_engine() -> Engine:
    return create_database_engine()


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return create_session_factory(get_database_engine())
