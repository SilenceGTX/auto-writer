"""Pydantic schemas shared by Auto-Writer API routes.

Defines request/response models for the Phase 0 foundation endpoints: health,
series, story structures, and basic works management.
"""

import json

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class StoryStructureRead(BaseModel):
    """Serialized story structure with the stage list parsed from JSON."""

    id: int
    name: str
    stages: list[str]
    description: str | None
    is_preset: int

    model_config = ConfigDict(from_attributes=True)

    @field_validator("stages", mode="before")
    @classmethod
    def parse_stages(cls, value: str | list[str]) -> list[str]:
        """Parse the stages column, which is stored as a JSON text array."""
        if isinstance(value, str):
            return list(json.loads(value or "[]"))
        return value


class WorkCreate(BaseModel):
    """Request body for creating a work."""

    title: str = Field(min_length=1, max_length=240)
    series_id: int | None = None
    structure_id: int | None = None
    planned_chapter_count: int | None = Field(default=None, ge=0)
    summary: str = ""


class WorkRead(BaseModel):
    """Serialized work data returned by the API."""

    id: int
    title: str
    series_id: int | None
    structure_id: int | None
    planned_chapter_count: int | None
    actual_chapter_count: int | None
    current_chapter: int
    total_word_count: int
    status: str
    summary: str | None
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)
