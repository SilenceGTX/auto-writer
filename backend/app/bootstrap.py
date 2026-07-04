"""Portable desktop bootstrap: load venv site-packages, then run the launcher.

Release bundles ship a self-contained CPython under ``backend/runtime/python``
and install dependencies into ``backend/.venv``. The venv's own ``python``
shim embeds absolute build-machine paths, so start scripts invoke the runtime
interpreter with this module instead.
"""

from __future__ import annotations

import runpy
import sys
from pathlib import Path


def _venv_site_packages(backend_dir: Path) -> Path | None:
    """Return the venv site-packages directory when present."""
    windows = backend_dir / ".venv" / "Lib" / "site-packages"
    if windows.is_dir():
        return windows
    lib = backend_dir / ".venv" / "lib"
    if not lib.is_dir():
        return None
    matches = sorted(lib.glob("python*/site-packages"))
    return matches[0] if matches else None


def main() -> None:
    """Insert bundled site-packages and start ``app.launcher``."""
    backend_dir = Path(__file__).resolve().parent.parent
    site = _venv_site_packages(backend_dir)
    if site is None:
        print(
            "Error: bundled dependencies not found under backend/.venv.\n"
            "Re-download the release package for this operating system.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    sys.path.insert(0, str(site))
    # Ensure the backend package root is importable when not on PYTHONPATH.
    sys.path.insert(0, str(backend_dir))
    runpy.run_module("app.launcher", run_name="__main__")


if __name__ == "__main__":
    main()
