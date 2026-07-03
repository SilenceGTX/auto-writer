"""Cross-platform path helpers for desktop distribution and data storage.

Resolves the per-user data directory on Windows, macOS, and Linux, and locates
the release bundle root that contains bundled frontend static assets.
"""

import os
import sys
from pathlib import Path

APP_NAME = "Auto-Writer"
APP_SLUG = "auto-writer"


def default_user_data_dir() -> Path:
    """Return the OS-specific directory for persistent application data."""
    if custom := os.environ.get("AW_DATA_DIR"):
        return Path(custom).expanduser().resolve()

    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
        if base:
            return (Path(base) / APP_NAME).resolve()
        return (Path.home() / APP_NAME).resolve()

    if sys.platform == "darwin":
        return (Path.home() / "Library" / "Application Support" / APP_NAME).resolve()

    xdg = os.environ.get("XDG_DATA_HOME")
    if xdg:
        return (Path(xdg) / APP_SLUG).resolve()
    return (Path.home() / ".local" / "share" / APP_SLUG).resolve()


def resolve_release_root() -> Path:
    """Locate the release bundle root containing ``static/`` and ``backend/``."""
    backend_dir = Path(__file__).resolve().parent.parent.parent
    candidate = backend_dir.parent
    if (candidate / "static").is_dir():
        return candidate
    repo_root = backend_dir.parent
    if (repo_root / "frontend" / "dist").is_dir():
        return repo_root
    return candidate


def resolve_static_dir(release_root: Path | None = None) -> Path | None:
    """Return the frontend static directory when a desktop bundle is present."""
    if configured := os.environ.get("AW_STATIC_DIR"):
        path = Path(configured).expanduser().resolve()
        return path if path.is_dir() else None

    root = release_root or resolve_release_root()
    bundled = root / "static"
    if bundled.is_dir():
        return bundled

    dev_dist = root / "frontend" / "dist"
    if dev_dist.is_dir():
        return dev_dist
    return None
