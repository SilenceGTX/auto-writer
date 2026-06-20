"""SQLAlchemy ORM models for series, stories, characters, chapters, scenes, and plot items."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base

# Plot item type constants
PLOT_ITEM_TYPES = ["目标", "铺垫", "推进", "冲突", "反转", "高潮", "结尾"]


class Series(Base):
    """A series that groups multiple stories (e.g. a trilogy)."""

    __tablename__ = "series"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stories = relationship("Story", back_populates="series", cascade="all, delete-orphan")


class Story(Base):
    """A novel or story project."""

    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, index=True)
    series_id = Column(Integer, ForeignKey("series.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    genre = Column(String(100), default="")
    status = Column(String(20), default="连载")  # 连载 / 完结
    structure = Column(String(100), default="")
    chapter_goal = Column(Integer, default=0)
    word_count = Column(Integer, default=0)
    current_chapter = Column(Integer, default=0)
    save_path = Column(String(512), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    series = relationship("Series", back_populates="stories")
    chapters = relationship("Chapter", back_populates="story", cascade="all, delete-orphan")
    characters = relationship("Character", back_populates="story", cascade="all, delete-orphan")


class Chapter(Base):
    """A chapter within a story."""

    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, default="")
    order = Column(Integer, default=0)
    summary = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    story = relationship("Story", back_populates="chapters")
    scenes = relationship("Scene", back_populates="chapter", cascade="all, delete-orphan", order_by="Scene.order")


class Character(Base):
    """A character in a story."""

    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    role = Column(String(100), default="")
    traits = Column(Text, default="")
    background = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    story = relationship("Story", back_populates="characters")


class Scene(Base):
    """A scene plan or outline entry within a chapter, containing plot items."""

    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chapter = relationship("Chapter", back_populates="scenes")
    plot_items = relationship("PlotItem", back_populates="scene", cascade="all, delete-orphan", order_by="PlotItem.order")


class PlotItem(Base):
    """A plot element within a scene (goal, foreshadowing, climax, etc.)."""

    __tablename__ = "plot_items"

    id = Column(Integer, primary_key=True, index=True)
    scene_id = Column(Integer, ForeignKey("scenes.id"), nullable=False)
    item_type = Column(String(20), nullable=False, default="推进")  # 目标/铺垫/推进/冲突/反转/高潮/结尾
    description = Column(Text, default="")
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scene = relationship("Scene", back_populates="plot_items")


class WorldEntity(Base):
    """A world-building entity (character, location, item, organization, etc.)."""

    __tablename__ = "world_entities"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    entity_type = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    properties = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    story = relationship("Story")

# Default world entity types
DEFAULT_ENTITY_TYPES = ["chara", "location", "item", "org"]
ENTITY_TYPE_LABELS: dict[str, str] = {
    "chara": "人物",
    "location": "地点",
    "item": "物品",
    "org": "组织",
}
