"""Load and render locale-specific Jinja2 prompt templates."""

from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.deps.locale import PromptLocale, normalize_locale

_TEMPLATES_ROOT = Path(__file__).resolve().parent / "templates"
_FALLBACK_LOCALE: PromptLocale = "zh"


@lru_cache(maxsize=4)
def _environment(locale: PromptLocale) -> Environment:
    """Return a cached Jinja2 environment for *locale*, falling back to Chinese."""
    locale_dir = _TEMPLATES_ROOT / locale
    if not locale_dir.is_dir():
        locale_dir = _TEMPLATES_ROOT / _FALLBACK_LOCALE
    return Environment(
        loader=FileSystemLoader(locale_dir),
        autoescape=select_autoescape(disabled_extensions=("j2",)),
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=False,
    )


def list_template_names(locale: str | None = None) -> list[str]:
    """Return sorted template paths for a locale (used by symmetry tests)."""
    loc = normalize_locale(locale)
    locale_dir = _TEMPLATES_ROOT / loc
    if not locale_dir.is_dir():
        return []
    return sorted(path.relative_to(locale_dir).as_posix() for path in locale_dir.rglob("*.j2"))


def render_template(locale: str | None, template_name: str, **context: object) -> str:
    """Render a locale-specific template and return trimmed text."""
    loc = normalize_locale(locale)
    try:
        template = _environment(loc).get_template(template_name)
    except Exception:
        template = _environment(_FALLBACK_LOCALE).get_template(template_name)
    return template.render(**context).strip()
