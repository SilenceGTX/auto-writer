"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the Auto-Writer backend."""

    app_name: str = "Auto-Writer"
    debug: bool = False
    database_url: str = "sqlite+aiosqlite:///../data/auto_writer.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]

    model_config = SettingsConfigDict(env_file=".env", env_prefix="AW_")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        """Parse comma-separated CORS origins from environment values."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()


settings = get_settings()
