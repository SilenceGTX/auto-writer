"""Core configuration module for the Auto-Writer backend."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "Auto-Writer"
    debug: bool = False
    database_url: str = "sqlite+aiosqlite:///./auto_writer.db"
    llm_api_base: str = ""
    llm_api_key: str = ""
    llm_model: str = "gpt-4"

    class Config:
        env_file = ".env"
        env_prefix = "AW_"


settings = Settings()
