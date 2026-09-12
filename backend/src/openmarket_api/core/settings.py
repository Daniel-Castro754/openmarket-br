from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OPENMARKET_", env_file=".env", extra="ignore")

    env: str = "development"
    database_url: str = "postgresql+psycopg://openmarket:openmarket@localhost:5432/openmarket"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    b3_bdi_base_url: str = "https://arquivos.b3.com.br/bdi"
    request_timeout_seconds: float = 15.0
    user_agent: str = "OpenMarketBR/0.1 (+https://github.com/Daniel-Castro754/openmarket-br)"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
