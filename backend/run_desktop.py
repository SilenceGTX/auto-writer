"""Self-contained desktop entrypoint.

Host machines often have a user-level ``site-packages`` (e.g. under
``%AppData%\\Python``) or a ``PYTHONPATH`` that can shadow packages bundled in
``runtime/python``. This script keeps only the release paths on ``sys.path``
before importing the app.
"""

from __future__ import annotations

import runpy
import site
import sys
from pathlib import Path


def _isolate_from_host_packages() -> None:
    """Restrict ``sys.path`` to the backend root and the bundled runtime."""
    backend = Path(__file__).resolve().parent
    runtime_home = (backend / "runtime" / "python").resolve()
    backend_str = str(backend)
    runtime_str = str(runtime_home)

    site.ENABLE_USER_SITE = False

    cleaned: list[str] = [backend_str]
    for entry in sys.path:
        if not entry or entry == ".":
            continue
        try:
            resolved = str(Path(entry).resolve())
        except OSError:
            continue
        runtime_prefix = runtime_str.rstrip("\\/")
        allowed = (
            resolved == backend_str
            or resolved == runtime_str
            or resolved.startswith(runtime_prefix + "/")
            or resolved.startswith(runtime_prefix + "\\")
        )
        if allowed and resolved not in cleaned:
            cleaned.append(resolved)

    sys.path[:] = cleaned


def main() -> None:
    """Isolate the interpreter, then start the desktop launcher."""
    _isolate_from_host_packages()
    runpy.run_module("app.launcher", run_name="__main__")


if __name__ == "__main__":
    main()
