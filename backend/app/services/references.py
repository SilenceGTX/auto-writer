"""`@` reference parsing for injecting worldbuilding entries into prompts.

Implements ``GENERAL_UI_DESIGN.md`` G4 / ``OUTLINE_PAGE_DESIGN.md`` §4: text
written in the outline (stage synopses, chapter summaries) may reference setting
entries via ``@名称`` markers. This module extracts those references and
assembles a ``【引用设定】`` prompt block so the referenced entries' content is
sent to the LLM.
"""

from dataclasses import dataclass


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


def build_reference_block(entries: list[ReferencedEntry]) -> str:
    """Build the ``【引用设定】`` prompt block from the referenced entries."""
    if not entries:
        return ""
    lines = [
        "【引用设定】",
        "以下是正文中通过 @ 引用的设定条目，请在创作时保持与其设定一致：",
    ]
    for entry in entries:
        header = f"- {entry.name}"
        if entry.category:
            header += f"（{entry.category}）"
        description = (entry.description or "").strip()
        if description:
            header += f"：{description}"
        lines.append(header)
        prop_text = "；".join(
            f"{prop.get('name')}={prop.get('value')}"
            for prop in (entry.properties or [])
            if prop.get("name")
        )
        if prop_text:
            lines.append(f"  属性：{prop_text}")
    return "\n".join(lines)
