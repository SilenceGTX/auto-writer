"""SQLAlchemy ORM models for Auto-Writer.

Defines the full persistence schema described in
``designs/DATA_STORAGE_DESIGN.md``: works domain (series, story structures,
works, stages, chapters, scenes), worldbuilding domain (entity categories and
entities), inspiration domain (inspirations, tags), and the key-value settings
store. Timestamps are stored as ISO text to match the design conventions.
"""

from datetime import UTC, datetime

from sqlalchemy import (
    Column as SAColumn,
)
from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow_iso() -> str:
    """Return the current UTC time as an ISO-like text timestamp."""
    return datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")


_SERVER_NOW = text("(datetime('now'))")


class Series(Base):
    """A named collection that groups multiple works."""

    __tablename__ = "series"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    created_at: Mapped[str] = mapped_column(
        Text, default=utcnow_iso, server_default=_SERVER_NOW, nullable=False
    )
    updated_at: Mapped[str] = mapped_column(
        Text,
        default=utcnow_iso,
        onupdate=utcnow_iso,
        server_default=_SERVER_NOW,
        nullable=False,
    )

    works: Mapped[list["Work"]] = relationship(back_populates="series")


class StoryStructure(Base):
    """A reusable narrative framework composed of ordered stages."""

    __tablename__ = "story_structures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    stages: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'[]'"))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_preset: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    works: Mapped[list["Work"]] = relationship(back_populates="structure")


class Work(Base):
    """A novel project managed by Auto-Writer."""

    __tablename__ = "works"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(240), nullable=False, index=True)
    series_id: Mapped[int | None] = mapped_column(
        ForeignKey("series.id", ondelete="SET NULL"), nullable=True
    )
    structure_id: Mapped[int | None] = mapped_column(
        ForeignKey("story_structures.id", ondelete="SET NULL"), nullable=True
    )
    planned_chapter_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_chapter_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_chapter: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    total_word_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    status: Mapped[str] = mapped_column(String(40), nullable=False, server_default=text("'创作中'"))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(
        Text, default=utcnow_iso, server_default=_SERVER_NOW, nullable=False
    )
    updated_at: Mapped[str] = mapped_column(
        Text,
        default=utcnow_iso,
        onupdate=utcnow_iso,
        server_default=_SERVER_NOW,
        nullable=False,
    )

    series: Mapped[Series | None] = relationship(back_populates="works")
    structure: Mapped[StoryStructure | None] = relationship(back_populates="works")
    stages: Mapped[list["WorkStage"]] = relationship(
        back_populates="work", cascade="all, delete-orphan", passive_deletes=True
    )
    chapters: Mapped[list["Chapter"]] = relationship(
        back_populates="work", cascade="all, delete-orphan", passive_deletes=True
    )
    categories: Mapped[list["EntityCategory"]] = relationship(
        back_populates="work", cascade="all, delete-orphan", passive_deletes=True
    )
    entities: Mapped[list["WorldEntity"]] = relationship(
        back_populates="work", cascade="all, delete-orphan", passive_deletes=True
    )


class WorkStage(Base):
    """A per-work instantiation of a story structure stage (holds the synopsis)."""

    __tablename__ = "work_stages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    work_id: Mapped[int] = mapped_column(ForeignKey("works.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[str] = mapped_column(
        Text, default=utcnow_iso, server_default=_SERVER_NOW, nullable=False
    )
    updated_at: Mapped[str] = mapped_column(
        Text,
        default=utcnow_iso,
        onupdate=utcnow_iso,
        server_default=_SERVER_NOW,
        nullable=False,
    )

    work: Mapped[Work] = relationship(back_populates="stages")
    chapters: Mapped[list["Chapter"]] = relationship(back_populates="stage")


class Chapter(Base):
    """A chapter within a work, holding its outline summary and body text."""

    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    work_id: Mapped[int] = mapped_column(ForeignKey("works.id", ondelete="CASCADE"), nullable=False)
    stage_id: Mapped[int | None] = mapped_column(
        ForeignKey("work_stages.id", ondelete="SET NULL"), nullable=True
    )
    chapter_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    word_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    status: Mapped[str] = mapped_column(String(20), server_default=text("'草稿'"))
    recap: Mapped[str | None] = mapped_column(Text, nullable=True)
    recap_generated_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(
        Text, default=utcnow_iso, server_default=_SERVER_NOW, nullable=False
    )
    updated_at: Mapped[str] = mapped_column(
        Text,
        default=utcnow_iso,
        onupdate=utcnow_iso,
        server_default=_SERVER_NOW,
        nullable=False,
    )

    work: Mapped[Work] = relationship(back_populates="chapters")
    stage: Mapped[WorkStage | None] = relationship(back_populates="chapters")
    scenes: Mapped[list["Scene"]] = relationship(
        back_populates="chapter", cascade="all, delete-orphan", passive_deletes=True
    )


class Scene(Base):
    """A scene within a chapter (scene-level outline / 细纲)."""

    __tablename__ = "scenes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[str] = mapped_column(
        Text, default=utcnow_iso, server_default=_SERVER_NOW, nullable=False
    )
    updated_at: Mapped[str] = mapped_column(
        Text,
        default=utcnow_iso,
        onupdate=utcnow_iso,
        server_default=_SERVER_NOW,
        nullable=False,
    )

    chapter: Mapped[Chapter] = relationship(back_populates="scenes")


class EntityCategory(Base):
    """A worldbuilding category (e.g. 人物) scoped to a single work."""

    __tablename__ = "entity_categories"
    __table_args__ = (UniqueConstraint("work_id", "name", name="uq_entity_categories_work_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    work_id: Mapped[int] = mapped_column(ForeignKey("works.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_preset: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[str] = mapped_column(
        Text, default=utcnow_iso, server_default=_SERVER_NOW, nullable=False
    )

    work: Mapped[Work] = relationship(back_populates="categories")
    entities: Mapped[list["WorldEntity"]] = relationship(
        back_populates="category", cascade="all, delete-orphan", passive_deletes=True
    )


class WorldEntity(Base):
    """A worldbuilding entry with free-form key-value properties (JSON)."""

    __tablename__ = "world_entities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    work_id: Mapped[int] = mapped_column(ForeignKey("works.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("entity_categories.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    properties: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'[]'"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[str] = mapped_column(
        Text, default=utcnow_iso, server_default=_SERVER_NOW, nullable=False
    )
    updated_at: Mapped[str] = mapped_column(
        Text,
        default=utcnow_iso,
        onupdate=utcnow_iso,
        server_default=_SERVER_NOW,
        nullable=False,
    )

    work: Mapped[Work] = relationship(back_populates="entities")
    category: Mapped[EntityCategory] = relationship(back_populates="entities")


inspiration_tags = Table(
    "inspiration_tags",
    Base.metadata,
    SAColumn(
        "inspiration_id",
        ForeignKey("inspirations.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    SAColumn("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Inspiration(Base):
    """A saved inspiration snippet (global clipboard with source references)."""

    __tablename__ = "inspirations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_page: Mapped[str | None] = mapped_column(String(20), nullable=True)
    work_id: Mapped[int | None] = mapped_column(
        ForeignKey("works.id", ondelete="SET NULL"), nullable=True
    )
    chapter_id: Mapped[int | None] = mapped_column(
        ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[str] = mapped_column(
        Text, default=utcnow_iso, server_default=_SERVER_NOW, nullable=False
    )

    tags: Mapped[list["Tag"]] = relationship(
        secondary=inspiration_tags, back_populates="inspirations"
    )


class Tag(Base):
    """A reusable, colored tag for classifying inspirations."""

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    inspirations: Mapped[list[Inspiration]] = relationship(
        secondary=inspiration_tags, back_populates="tags"
    )


class AppSetting(Base):
    """A key-value store row for global single-user application settings."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(
        Text,
        default=utcnow_iso,
        onupdate=utcnow_iso,
        server_default=_SERVER_NOW,
        nullable=False,
    )
