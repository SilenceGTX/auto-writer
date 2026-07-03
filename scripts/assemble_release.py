"""Assemble a platform-native desktop release directory for distribution."""

from __future__ import annotations

import argparse
import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path


def _copy_backend(backend_src: Path, backend_out: Path) -> None:
    """Copy backend source files needed for a desktop bundle."""
    backend_out.mkdir(parents=True, exist_ok=True)
    ignore = shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", ".ruff_cache")
    shutil.copytree(backend_src / "app", backend_out / "app", ignore=ignore)
    for name in ("pyproject.toml", "uv.lock"):
        shutil.copy2(backend_src / name, backend_out / name)


def _write_start_sh(output: Path) -> None:
    """Write the Linux/macOS launcher script."""
    content = """#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export AW_DESKTOP_MODE=1
export AW_STATIC_DIR="$ROOT/static"
cd "$ROOT/backend"
exec .venv/bin/python -m app.launcher
"""
    path = output / "start.sh"
    path.write_text(content, encoding="utf-8", newline="\n")
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _write_start_bat(output: Path) -> None:
    """Write the Windows launcher script."""
    content = """@echo off
setlocal
cd /d "%~dp0"
set AW_DESKTOP_MODE=1
set AW_STATIC_DIR=%~dp0static
cd backend
".venv\\Scripts\\python.exe" -m app.launcher
"""
    (output / "start.bat").write_text(content, encoding="utf-8", newline="\r\n")


def _write_start_command(output: Path) -> None:
    """Write the macOS double-click launcher."""
    content = """#!/usr/bin/env bash
cd "$(dirname "$0")"
exec ./start.sh
"""
    path = output / "start.command"
    path.write_text(content, encoding="utf-8", newline="\n")
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _write_readme(output: Path, version: str) -> None:
    """Write quick-start instructions bundled with the release."""
    content = f"""Auto-Writer {version} (desktop)

Quick start
-----------
Windows : double-click start.bat
macOS   : double-click start.command (or run ./start.sh in Terminal)
Linux   : ./start.sh

Your browser opens automatically. Press Ctrl+C in the terminal to stop.

User data (database, snapshots, exports, logs)
----------------------------------------------
Windows : %LOCALAPPDATA%\\Auto-Writer\\
macOS   : ~/Library/Application Support/Auto-Writer/
Linux   : ~/.local/share/auto-writer/  (or $XDG_DATA_HOME/auto-writer/)

Override with the AW_DATA_DIR environment variable before launching.
"""
    (output / "README-DESKTOP.txt").write_text(content, encoding="utf-8")


def assemble_release(repo_root: Path, output: Path, version: str) -> None:
    """Build a release folder with static assets, backend venv, and launchers."""
    dist = repo_root / "frontend" / "dist"
    if not dist.is_dir():
        raise SystemExit("frontend/dist not found — run `pnpm build` in frontend/ first")

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    shutil.copytree(dist, output / "static")
    _copy_backend(repo_root / "backend", output / "backend")

    subprocess.run(
        ["uv", "sync", "--frozen", "--no-dev"],
        cwd=output / "backend",
        check=True,
    )

    _write_start_sh(output)
    _write_start_bat(output)
    _write_start_command(output)
    _write_readme(output, version)


def main() -> None:
    """Parse CLI arguments and assemble the desktop release bundle."""
    parser = argparse.ArgumentParser(description="Assemble Auto-Writer desktop release")
    parser.add_argument("--output", required=True, help="Output directory for the bundle")
    parser.add_argument("--version", default=os.environ.get("AW_VERSION", "dev"))
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    assemble_release(repo_root, Path(args.output).resolve(), args.version)
    print(f"Assembled desktop release at {args.output}")


if __name__ == "__main__":
    main()
