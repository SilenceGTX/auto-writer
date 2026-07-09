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
    version: str | None = None
    git_commit: str | None = None
    built_at: str | None = None


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
    written_chapter_count: int = 0
    chapter_count: int = 0
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
    """Legacy single LLM connection configuration (import compatibility)."""

    url: str = ""
    api_token: str = ""
    model: str = ""


class LLMProfile(BaseModel):
    """One OpenAI-compatible LLM endpoint configuration."""

    id: str = Field(min_length=1)
    url: str = ""
    api_token: str = ""
    model: str = ""


class LLMAssignments(BaseModel):
    """Maps each generation/chat task to an LLM profile id."""

    outline_stages: str = Field(min_length=1)
    outline_chapters: str = Field(min_length=1)
    writing_draft: str = Field(min_length=1)
    writing_chat: str = Field(min_length=1)
    writing_rewrite: str = Field(min_length=1)
    review_chat: str = Field(min_length=1)


class LLMSettingsUpdate(BaseModel):
    """Request body for saving LLM profiles and task assignments."""

    profiles: list[LLMProfile] = Field(min_length=1, max_length=5)
    assignments: LLMAssignments


class StagePreference(BaseModel):
    """Sampling parameters for one generation stage (outline or writing)."""

    temperature: float = Field(default=0.7, ge=0, le=2)
    top_p: float = Field(default=0.9, ge=0, le=1)
    presence_penalty: float = Field(default=0.0, ge=-2, le=2)
    frequency_penalty: float = Field(default=0.0, ge=-2, le=2)
    max_tokens: int | None = Field(default=2048, ge=1)


def _default_review_stage_preference() -> StagePreference:
    """Return conservative defaults for review-stage LLM calls."""
    return StagePreference(
        temperature=0.3,
        top_p=0.85,
        presence_penalty=0.3,
        frequency_penalty=0.3,
        max_tokens=2048,
    )


class Preferences(BaseModel):
    """Global preferences for outline, writing, and review generation."""

    outline: StagePreference = Field(default_factory=StagePreference)
    writing: StagePreference = Field(default_factory=StagePreference)
    review: StagePreference = Field(default_factory=_default_review_stage_preference)


class WritingStyle(BaseModel):
    """Free-form writing-style text injected into the system prompt."""

    text: str = ""


class DataSaveSettings(BaseModel):
    """Auto-save and snapshot persistence options (``SYSTEM_SETTINGS`` §6)."""

    input_debounce_seconds: int = Field(default=2, ge=1, le=10)
    autosave_interval_seconds: int = Field(default=30, ge=10, le=120)
    snapshot_path: str = "snapshots"
    history_versions: int = Field(default=3, ge=0, le=10)


class TypographySettings(BaseModel):
    """Reading font, line height, and eye-care theme (``SYSTEM_SETTINGS`` §7)."""

    font_family: str = ""
    line_height: float = Field(default=1.8, ge=1.0, le=3.0)
    reading_theme: str = Field(default="sepia", pattern="^(sepia|light|dark)$")


class LocaleSettings(BaseModel):
    """UI and AI prompt language (``designs/I18N.md``)."""

    locale: str = Field(default="zh", pattern="^(zh|en)$")


class SettingsResponse(BaseModel):
    """All known settings groups returned to the client."""

    llm_profiles: list[LLMProfile]
    llm_assignments: LLMAssignments
    preferences: Preferences
    writing_style: WritingStyle
    data_save: DataSaveSettings
    typography: TypographySettings
    locale: LocaleSettings


class SettingsImport(BaseModel):
    """A configuration import payload; each group is optional (partial import)."""

    connection: ConnectionSettings | None = None
    llm_profiles: list[LLMProfile] | None = None
    llm_assignments: LLMAssignments | None = None
    preferences: Preferences | None = None
    writing_style: WritingStyle | None = None
    data_save: DataSaveSettings | None = None
    typography: TypographySettings | None = None
    locale: LocaleSettings | None = None


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


class ChapterContentRead(BaseModel):
    """Full chapter payload for the writing editor (includes body text)."""

    id: int
    work_id: int
    chapter_number: int
    title: str | None
    summary: str | None
    content: str | None
    word_count: int
    status: str

    model_config = ConfigDict(from_attributes=True)


class ChapterContentUpdate(BaseModel):
    """Request body for saving a chapter's body text."""

    content: str = ""


class DraftGenerateRequest(BaseModel):
    """Options for generating a chapter draft (optionally include the recap)."""

    include_recap: bool = False


class RecapRead(BaseModel):
    """Result of a 前情提要 lookup/generation for the previous chapter."""

    has_previous: bool
    previous_chapter_number: int | None = None
    recap: str | None = None
    cached: bool = False
    stale: bool = False


class RewriteRequest(BaseModel):
    """Request body for a local rewrite of a selected passage.

    ``preceding`` / ``following`` carry the surrounding paragraphs when the user
    enables "强化衔接" so the model can keep the rewrite cohesive with its context.
    """

    selection: str = Field(min_length=1)
    instruction: str | None = None
    context: str | None = None
    preceding: str | None = None
    following: str | None = None


class RewriteResult(BaseModel):
    """Original vs. rewritten passage for the diff preview (no DB change)."""

    original: str
    rewritten: str


class ChatMessage(BaseModel):
    """One message in the writing-assistant conversation."""

    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1)


class ChatMessageRead(BaseModel):
    """One persisted assistant message returned to the client."""

    id: int
    role: str
    content: str
    quoted: str | None = None
    created_at: str


class ChatHistoryResponse(BaseModel):
    """Persisted assistant conversation history."""

    messages: list[ChatMessageRead] = Field(default_factory=list)


class ChatSendRequest(BaseModel):
    """Request body for sending one assistant chat turn."""

    content: str = Field(min_length=1)
    chapter_id: int | None = None
    quoted: str | None = None


class ChatSendResponse(BaseModel):
    """Assistant reply plus the updated persisted conversation."""

    reply: str
    messages: list[ChatMessageRead]


class ChatRequest(BaseModel):
    """Internal chat payload assembled from persisted history for LLM calls."""

    messages: list[ChatMessage] = Field(min_length=1)
    chapter_id: int | None = None
    quoted: str | None = None


class ChatReply(BaseModel):
    """Legacy assistant reply shape (superseded by ``ChatSendResponse``)."""

    reply: str


class TagRead(BaseModel):
    """Serialized tag (id, name, optional color)."""

    id: int
    name: str
    color: str | None = None

    model_config = ConfigDict(from_attributes=True)


class TagCreate(BaseModel):
    """Request body for creating a tag (idempotent on name)."""

    name: str = Field(min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=20)


class InspirationTagsUpdate(BaseModel):
    """Replace the full set of tags attached to an inspiration."""

    tag_ids: list[int] = Field(default_factory=list)


class InspirationCreate(BaseModel):
    """Request body for adding an inspiration snippet (G3 加入灵感)."""

    content: str = Field(min_length=1)
    source_page: str | None = Field(default=None, max_length=20)
    work_id: int | None = None
    chapter_id: int | None = None


class InspirationRead(BaseModel):
    """Serialized inspiration snippet with its source references and tags."""

    id: int
    content: str
    source_page: str | None
    work_id: int | None
    chapter_id: int | None
    created_at: str
    tags: list[TagRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
