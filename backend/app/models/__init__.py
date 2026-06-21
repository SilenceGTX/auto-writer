"""SQLAlchemy models for works, series, and writing metadata."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Series(Base):
    """A named collection that groups multiple stories."""

    __tablename__ = "series"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    stories: Mapped[list["Story"]] = relationship(
        back_populates="series",
        cascade="all, delete-orphan",
    )


class Story(Base):
    """A novel project managed by Auto-Writer."""

    __tablename__ = "stories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(240), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    structure: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(40), default="构思中")
    chapter_goal: Mapped[int] = mapped_column(Integer, default=0)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    series_id: Mapped[int | None] = mapped_column(ForeignKey("series.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )

    series: Mapped[Series | None] = relationship(back_populates="stories")
