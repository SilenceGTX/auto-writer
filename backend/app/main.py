"""FastAPI application entry point for the Auto-Writer backend."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import settings
from app.database import Base, engine
from app.routers import chapters, llm, plot_items, scenes, series, stories, world


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stories.router)
app.include_router(series.router)
app.include_router(chapters.router)
app.include_router(scenes.router)
app.include_router(plot_items.router)
app.include_router(world.router)
app.include_router(llm.router)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}
