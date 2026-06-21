"""Pydantic schemas shared by Auto-Writer API routes."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Response body for the health check endpoint."""

    status: str
    app_name: str


class SeriesCreate(BaseModel):
    """Request body for creating a series."""

    name: str = Field(min_length=1, max_length=200)


class SeriesRead(BaseModel):
    """Serialized series data returned by the API."""

    id: int
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StoryCreate(BaseModel):
    """Request body for creating a story."""

    title: str = Field(min_length=1, max_length=240)
    description: str = ""
    structure: str = ""
    chapter_goal: int = Field(default=0, ge=0)
    series_id: int | None = None


class StoryRead(BaseModel):
    """Serialized story data returned by the API."""

    id: int
    title: str
    description: str
    structure: str
    status: str
    chapter_goal: int
    word_count: int
    series_id: int | None
    series: SeriesRead | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
