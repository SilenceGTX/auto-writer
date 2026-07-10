"""`@` reference parsing for injecting worldbuilding entries into prompts.

Implements ``GENERAL_UI_DESIGN.md`` G4 / ``OUTLINE_PAGE_DESIGN.md`` §4: text
written in the outline (stage synopses, chapter summaries) may reference setting
entries via ``@名称`` markers. This module extracts those references and
assembles a localized reference prompt block so the referenced entries' content
is sent to the LLM.
"""

import json
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.locale import normalize_locale
from app.prompts.loader import render_template
from app.services.prompts import log_assembled_prompt


@dataclass
class ReferencedEntry:
    """A worldbuilding entry resolved from an ``@`` reference, for prompting."""

    name: str
    category: str | None = None
    description: str | None = None
    properties: list[dict] | None = None


def find_referenced_names(texts: list[str], candidate_names: list[str]) -> list[str]:
    """Return candidate entity names referenced via ``@`` across the texts.

    Uses a longest-match scan so a longer name (``@张三``) is preferred over a
    shorter one that is its prefix (``@张``). Entity names may contain spaces or
    punctuation, so matching against the known candidate set is more robust than
    a generic token regex. The returned order follows ``candidate_names``.
    """
    ordered = sorted({name for name in candidate_names if name}, key=len, reverse=True)
    found: set[str] = set()
    for text in texts:
        if not text:
            continue
        index = 0
        length = len(text)
        while index < length:
            if text[index] == "@":
                rest = text[index + 1 :]
                match = next((name for name in ordered if rest.startswith(name)), None)
                if match:
                    found.add(match)
                    index += 1 + len(match)
                    continue
            index += 1
    return [name for name in candidate_names if name in found]


def build_reference_block(
    entries: list[ReferencedEntry], *, locale: str | None = None
) -> str:
    """Build the referenced-settings prompt block from the resolved entries."""
    if not entries:
        return ""
    loc = normalize_locale(locale)
    prop_sep = "；" if loc == "zh" else "; "
    prepared = []
    for entry in entries:
        prop_text = prop_sep.join(
            f"{prop.get('name')}={prop.get('value')}"
            for prop in (entry.properties or [])
            if prop.get("name")
        )
        description = (entry.description or "").strip()
        prepared.append(
            {
                "name": entry.name,
                "category": entry.category,
                "description": description or None,
                "prop_text": prop_text or None,
            }
        )
    return render_template(loc, "blocks/references.j2", entries=prepared)


async def reference_block_for_texts(
    db: AsyncSession, work_id: int, texts: list[str], *, locale: str | None = None
) -> str:
    """Resolve ``@``-referenced entries in the texts into a prompt block."""
    # Imported here to avoid a models -> services import cycle at module load.
    from app.models import EntityCategory, WorldEntity

    result = await db.execute(
        select(WorldEntity, EntityCategory.name)
        .join(EntityCategory, WorldEntity.category_id == EntityCategory.id)
        .where(WorldEntity.work_id == work_id)
    )
    rows = result.all()
    if not rows:
        return ""
    referenced = set(find_referenced_names(texts, [entity.name for entity, _ in rows]))
    entries = [
        ReferencedEntry(
            name=entity.name,
            category=category_name,
            description=entity.description,
            properties=json.loads(entity.properties or "[]"),
        )
        for entity, category_name in rows
        if entity.name in referenced
    ]
    return build_reference_block(entries, locale=locale)


def with_references(user_prompt: str, reference_block: str) -> str:
    """Prepend the reference block to a user prompt when references exist."""
    if reference_block:
        return log_assembled_prompt(
            "with_references",
            f"{reference_block}\n\n{user_prompt}",
        )
    return user_prompt
