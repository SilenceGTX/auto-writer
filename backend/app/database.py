"""Database engine, session factory, and dependency helpers."""

from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core import settings


class Base(DeclarativeBase):
    """Base class for SQLAlchemy ORM models."""


def ensure_sqlite_parent_directory(database_url: str) -> None:
    """Create the parent directory for file-based SQLite database URLs."""
    prefix = "sqlite+aiosqlite:///"
    if not database_url.startswith(prefix):
        return

    database_path = database_url.removeprefix(prefix)
    if database_path == ":memory:":
        return

    Path(database_path).expanduser().parent.mkdir(parents=True, exist_ok=True)


ensure_sqlite_parent_directory(settings.database_url)
engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    """Create database tables required by the application."""
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session for FastAPI dependencies."""
    async with async_session() as session:
        yield session
