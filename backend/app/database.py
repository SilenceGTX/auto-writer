"""Database engine, session factory, and dependency helpers.

Configures the async SQLite engine, enables SQLite foreign-key enforcement on
every connection (required for the ON DELETE cascade/SET NULL behaviour defined
in ``designs/DATA_STORAGE_DESIGN.md``), and creates tables plus seed data on
startup.
"""

from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy import event
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


@event.listens_for(engine.sync_engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    """Enable foreign-key constraint enforcement for each SQLite connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


async def init_db() -> None:
    """Create database tables and insert seed data required by the application."""
    from app.services.seed import seed_story_structures

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        await seed_story_structures(session)
        await session.commit()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session for FastAPI dependencies."""
    async with async_session() as session:
        yield session
