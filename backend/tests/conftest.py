"""Pytest fixtures for the Auto-Writer backend test suite.

Points the application at an isolated SQLite test database (configured before
any app module is imported), and resets the schema with seed data before each
test for isolation.
"""

import os
import pathlib

TEST_DB_PATH = pathlib.Path(__file__).parent / "test_auto_writer.db"
os.environ["AW_DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH}"
os.environ["AW_DEBUG"] = "false"

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.database import Base, async_session, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.seed import seed_story_structures  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def _reset_database():
    """Recreate the schema and seed presets before each test."""
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        await seed_story_structures(session)
        await session.commit()

    yield


@pytest_asyncio.fixture
async def session():
    """Yield a database session bound to the test engine."""
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    """Yield an HTTP client wired to the FastAPI app via ASGI transport."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
