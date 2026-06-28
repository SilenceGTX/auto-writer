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


class StoryStructureCreate(BaseModel):
    """Request body for creating a custom (user-defined) story structure."""

    name: str = Field(min_length=1, max_length=120)
    stages: list[str] = Field(default_factory=list)
    description: str | None = None


class WorkCreate(BaseModel):
    """Request body for creating a work."""

    title: str = Field(min_length=1, max_length=240)
    series_id: int | None = None
    structure_id: int | None = None
    planned_chapter_count: int | None = Field(default=None, ge=0)
    summary: str = ""


class WorkUpdate(BaseModel):
    """Request body for partially updating a work (only set fields are applied)."""

    title: str | None = Field(default=None, min_length=1, max_length=240)
    series_id: int | None = None
    structure_id: int | None = None
    planned_chapter_count: int | None = Field(default=None, ge=0)
    status: str | None = Field(default=None, min_length=1, max_length=40)
    summary: str | None = None


class WorkRead(BaseModel):
    """Serialized work data returned by the API, including display names."""

    id: int
    title: str
    series_id: int | None
    structure_id: int | None
    series_name: str | None = None
    structure_name: str | None = None
    planned_chapter_count: int | None
    actual_chapter_count: int | None
    current_chapter: int
    total_word_count: int
    status: str
    summary: str | None
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class WorkListResponse(BaseModel):
    """Paginated list of works with the total count for the current filter."""

    items: list[WorkRead]
    total: int


class WorkStageRead(BaseModel):
    """A work stage with its derived chapter count for the outline view."""

    id: int
    work_id: int
    name: str
    overview: str | None
    sort_order: int
    chapter_count: int


class WorkStageUpdate(BaseModel):
    """Partial update for a stage (name and/or overview)."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    overview: str | None = None


class StageChapterCountUpdate(BaseModel):
    """Set the number of (empty) chapters allocated to a stage."""

    count: int = Field(ge=0, le=500)


class ChapterRead(BaseModel):
    """Serialized chapter data for the outline / writing views."""

    id: int
    work_id: int
    stage_id: int | None
    chapter_number: int
    title: str | None
    summary: str | None
    word_count: int
    status: str

    model_config = ConfigDict(from_attributes=True)


class ChapterCreate(BaseModel):
    """Request body for adding a chapter (appended, optionally to a stage)."""

    title: str | None = None
    summary: str | None = None
    stage_id: int | None = None


class ChapterUpdate(BaseModel):
    """Partial update for a chapter's outline fields."""

    title: str | None = None
    summary: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=20)
    stage_id: int | None = None


class ChapterOrderItem(BaseModel):
    """One entry in a chapter reorder request (new order + stage assignment)."""

    id: int
    stage_id: int | None = None


class ChapterReorderRequest(BaseModel):
    """Reorder request: chapters in their new top-to-bottom order."""

    items: list[ChapterOrderItem]


class OutlineRead(BaseModel):
    """Aggregate outline payload: work summary, stages, and chapters."""

    work_id: int
    title: str
    planned_chapter_count: int | None
    actual_chapter_count: int | None
    structure_name: str | None
    locked: bool
    stages: list[WorkStageRead]
    chapters: list[ChapterRead]


class ConnectionSettings(BaseModel):
    """LLM connection configuration (OpenAI-compatible endpoint)."""

    url: str = ""
    api_token: str = ""
    model: str = ""


class StagePreference(BaseModel):
    """Sampling parameters for one generation stage (outline or writing)."""

    temperature: float = Field(default=0.7, ge=0, le=2)
    top_p: float = Field(default=0.9, ge=0, le=1)
    presence_penalty: float = Field(default=0.0, ge=-2, le=2)
    frequency_penalty: float = Field(default=0.0, ge=-2, le=2)
    max_tokens: int | None = Field(default=2048, ge=1)


class Preferences(BaseModel):
    """Global preferences for the outline and writing generation stages."""

    outline: StagePreference = Field(default_factory=StagePreference)
    writing: StagePreference = Field(default_factory=StagePreference)


class WritingStyle(BaseModel):
    """Free-form writing-style text injected into the system prompt."""

    text: str = ""


class SettingsResponse(BaseModel):
    """All known settings groups returned to the client."""

    connection: ConnectionSettings
    preferences: Preferences
    writing_style: WritingStyle


class ConnectionTestResult(BaseModel):
    """Result of a lightweight LLM connection test."""

    ok: bool
    message: str
    sample: str | None = None


class EntityCategoryCreate(BaseModel):
    """Request body for creating a custom worldbuilding category."""

    name: str = Field(min_length=1, max_length=120)


class EntityCategoryRead(BaseModel):
    """Serialized worldbuilding category with its entry count."""

    id: int
    work_id: int
    name: str
    is_preset: int
    sort_order: int
    entity_count: int = 0


class EntityProperty(BaseModel):
    """A single custom key-value property on a worldbuilding entry."""

    name: str = Field(min_length=1, max_length=120)
    value: str = ""


class WorldEntityCreate(BaseModel):
    """Request body for creating a worldbuilding entry."""

    category_id: int
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    properties: list[EntityProperty] = Field(default_factory=list)


class WorldEntityUpdate(BaseModel):
    """Partial update for a worldbuilding entry (only set fields are applied)."""

    category_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    properties: list[EntityProperty] | None = None


class WorldEntityRead(BaseModel):
    """Serialized worldbuilding entry with its properties parsed from JSON."""

    id: int
    work_id: int
    category_id: int
    name: str
    description: str | None
    properties: list[EntityProperty]
    sort_order: int
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)

    @field_validator("properties", mode="before")
    @classmethod
    def parse_properties(cls, value: str | list) -> list:
        """Parse the properties column, which is stored as a JSON text array."""
        if isinstance(value, str):
            return list(json.loads(value or "[]"))
        return value


class WorldEntityListResponse(BaseModel):
    """Paginated list of worldbuilding entries for the current filter."""

    items: list[WorldEntityRead]
    total: int
