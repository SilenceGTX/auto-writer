"""Assemble a self-contained desktop release for Windows, Linux, and macOS.

Layout of the release directory::

    start.bat / start.sh / start.command
    static/                 # Vite production build
    backend/
      app/                  # application source
      runtime/python/       # portable CPython + site-packages (no system Python)

Dependencies are installed directly into the bundled interpreter. No ``.venv``
and no build-machine absolute paths are required at runtime.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import stat
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

PYTHON_VERSION = "3.11"

# Markers that must appear in a fresh frontend production bundle.
_STATIC_BUNDLE_MARKERS = (
    "written_chapter_count",
    "/chat/messages",
    "清空记忆",
)


def _copy_backend(backend_src: Path, backend_out: Path) -> None:
    """Copy backend source files needed for a desktop bundle."""
    backend_out.mkdir(parents=True, exist_ok=True)
    ignore = shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", ".ruff_cache")
    shutil.copytree(backend_src / "app", backend_out / "app", ignore=ignore)
    for name in ("pyproject.toml", "uv.lock", "run_desktop.py"):
        shutil.copy2(backend_src / name, backend_out / name)


def _run(cmd: list[str], *, cwd: Path, env: dict[str, str] | None = None) -> None:
    """Run a subprocess and fail the build on non-zero exit."""
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True, env=env)


def _git_commit(repo_root: Path) -> str:
    """Return the current git commit hash, or ``unknown`` when unavailable."""
    result = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    commit = result.stdout.strip()
    return commit if result.returncode == 0 and commit else "unknown"


def _build_frontend(repo_root: Path) -> None:
    """Build the Vite production bundle into ``frontend/dist``."""
    frontend = repo_root / "frontend"
    _run(["pnpm", "install", "--frozen-lockfile"], cwd=frontend)
    _run(["pnpm", "build"], cwd=frontend)


def _verify_static_bundle(static_dir: Path) -> None:
    """Fail the build when the bundled frontend looks stale or incomplete."""
    js_files = sorted(static_dir.glob("assets/*.js"))
    if not js_files:
        raise SystemExit(f"No JS assets under {static_dir / 'assets'}")

    bundle_text = "".join(
        path.read_text(encoding="utf-8", errors="replace") for path in js_files
    )
    missing = [marker for marker in _STATIC_BUNDLE_MARKERS if marker not in bundle_text]
    if missing:
        raise SystemExit(
            "Frontend bundle looks stale or incomplete; missing markers: "
            f"{', '.join(missing)}. Run `pnpm build` in frontend/ and retry."
        )


def _write_build_info(path: Path, *, version: str, git_commit: str) -> None:
    """Write build metadata for runtime health checks and debugging."""
    payload = {
        "version": version,
        "git_commit": git_commit,
        "built_at": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _remove_path(path: Path) -> None:
    """Remove a file, symlink, junction, or directory tree."""
    if not path.exists() and not path.is_symlink():
        return
    # Windows junctions/symlinks: rmtree raises; unlink works.
    if path.is_symlink() or path.is_file():
        path.unlink()
        return
    try:
        shutil.rmtree(path)
    except OSError:
        path.unlink()


def _find_runtime_python(python_home: Path) -> Path:
    """Locate the interpreter executable inside a managed Python install."""
    candidates = [
        python_home / "python.exe",
        python_home / "python3.exe",
        python_home / "bin" / "python3",
        python_home / "bin" / "python",
        python_home / "python",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise SystemExit(f"Could not find a Python executable under {python_home}")


def _discover_install_roots(staging: Path) -> list[Path]:
    """Return unique resolved install directories under a uv python install-dir."""
    roots: dict[Path, Path] = {}
    for entry in staging.iterdir():
        if entry.name.startswith("."):
            continue
        if not (entry.is_dir() or entry.is_symlink()):
            continue
        resolved = entry.resolve()
        if not resolved.is_dir():
            continue
        # Keep the entry with the longest name for each real path.
        current = roots.get(resolved)
        if current is None or len(entry.name) > len(current.name):
            roots[resolved] = entry
    return list(roots.keys())


def _install_portable_python(backend_out: Path) -> Path:
    """Copy a managed CPython into ``backend/runtime/python`` (no symlinks)."""
    runtime_root = backend_out / "runtime"
    if runtime_root.exists():
        _remove_path(runtime_root)
    runtime_root.mkdir(parents=True)

    with tempfile.TemporaryDirectory(prefix="aw-python-") as tmp:
        staging = Path(tmp)
        _run(
            ["uv", "python", "install", PYTHON_VERSION, "--install-dir", str(staging)],
            cwd=backend_out,
        )
        installs = _discover_install_roots(staging)
        if not installs:
            raise SystemExit(f"No Python install found under {staging}")
        # Prefer the most specific install directory name.
        source = max(installs, key=lambda path: (len(path.name), path.name))
        target = runtime_root / "python"
        # Dereference symlinks so the bundle is fully self-contained.
        shutil.copytree(source, target, symlinks=False, dirs_exist_ok=False)

    # Allow installing packages into this private copy (uv marks managed installs).
    for marker in target.rglob("EXTERNALLY-MANAGED"):
        marker.unlink(missing_ok=True)

    return target


def _install_dependencies(backend_out: Path, runtime_python: Path) -> None:
    """Install locked runtime dependencies into the bundled interpreter."""
    requirements = backend_out / "requirements.desktop.txt"
    _run(
        [
            "uv",
            "export",
            "--frozen",
            "--no-dev",
            "--no-emit-project",
            "--no-hashes",
            "-o",
            str(requirements),
        ],
        cwd=backend_out,
    )
    _run(
        [
            "uv",
            "pip",
            "install",
            "--python",
            str(runtime_python),
            "--break-system-packages",
            "--link-mode",
            "copy",
            "-r",
            str(requirements),
        ],
        cwd=backend_out,
    )
    requirements.unlink(missing_ok=True)


def _runtime_python_relpath(runtime_python: Path, backend_out: Path) -> str:
    """Return a POSIX-style path to the runtime interpreter relative to backend/."""
    return runtime_python.relative_to(backend_out).as_posix()


def _write_start_sh(output: Path, runtime_python_rel: str) -> None:
    """Write the Linux/macOS launcher script."""
    content = f"""#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"

if [[ ! -f "$ROOT/static/index.html" ]]; then
  echo "Error: static/index.html not found. This release package is incomplete." >&2
  exit 1
fi

PYTHON="$ROOT/backend/{runtime_python_rel}"
if [[ ! -x "$PYTHON" && ! -f "$PYTHON" ]]; then
  echo "Error: bundled Python not found at backend/{runtime_python_rel}" >&2
  echo "You do not need to install Python yourself." >&2
  echo "Re-download the release built for this OS." >&2
  exit 1
fi

export AW_DESKTOP_MODE=1
export AW_STATIC_DIR="$ROOT/static"
export PYTHONNOUSERSITE=1
unset PYTHONPATH || true
cd "$ROOT/backend"
exec "$PYTHON" -s run_desktop.py
"""
    path = output / "start.sh"
    path.write_text(content, encoding="utf-8", newline="\n")
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _write_start_bat(output: Path, runtime_python_rel: str) -> None:
    """Write the Windows launcher script."""
    win_python = runtime_python_rel.replace("/", "\\")
    content = f"""@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "static\\index.html" (
  echo Error: static\\index.html not found. This release package is incomplete.
  echo.
  pause
  exit /b 1
)

if not exist "backend\\{win_python}" (
  echo Error: bundled Python not found at backend\\{win_python}
  echo.
  echo You do NOT need to install Python yourself.
  echo Use the Windows release zip from GitHub Releases ^(win-x64^).
  echo.
  pause
  exit /b 1
)

set "AW_DESKTOP_MODE=1"
set "AW_STATIC_DIR=%~dp0static"
set "PYTHONNOUSERSITE=1"
set "PYTHONPATH="
cd /d "%~dp0backend"
"{win_python}" -s run_desktop.py
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Auto-Writer exited with error code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
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

This package is self-contained. Python is NOT required on the host machine.
Everything lives under backend/runtime/python/ (interpreter + dependencies).
Use the archive built for your OS (win-x64 / linux-x64 / macos-arm64).

User data (database, snapshots, exports, logs)
----------------------------------------------
Windows : %LOCALAPPDATA%\\Auto-Writer\\
macOS   : ~/Library/Application Support/Auto-Writer/
Linux   : ~/.local/share/auto-writer/  (or $XDG_DATA_HOME/auto-writer/)

Override with the AW_DATA_DIR environment variable before launching.

Docker vs desktop data
----------------------
Docker stores data in the project ``data/`` folder (or a mounted volume).
The desktop app uses the user data paths above by default. They are separate
databases — writing in Docker does not appear in the desktop app unless you
point AW_DATA_DIR at the same folder before launching.

Verify your build
-----------------
Open http://127.0.0.1:8000/api/health after starting. When built from a recent
release, the response includes version, git_commit, and built_at fields.
"""
    (output / "README-DESKTOP.txt").write_text(content, encoding="utf-8")


def assemble_release(
    repo_root: Path,
    output: Path,
    version: str,
    *,
    skip_frontend_build: bool = False,
) -> None:
    """Build a release folder with static assets, portable Python, and launchers."""
    if skip_frontend_build:
        dist = repo_root / "frontend" / "dist"
        if not dist.is_dir():
            raise SystemExit(
                "frontend/dist not found — run `pnpm build` in frontend/ first, "
                "or omit --skip-frontend-build"
            )
    else:
        print("Building frontend (pnpm build)...", flush=True)
        _build_frontend(repo_root)
        dist = repo_root / "frontend" / "dist"

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    shutil.copytree(dist, output / "static")
    _verify_static_bundle(output / "static")

    backend_out = output / "backend"
    _copy_backend(repo_root / "backend", backend_out)
    commit = _git_commit(repo_root)
    _write_build_info(output / "BUILD_INFO.json", version=version, git_commit=commit)
    _write_build_info(backend_out / "app" / "build_info.json", version=version, git_commit=commit)

    python_home = _install_portable_python(backend_out)
    runtime_python = _find_runtime_python(python_home)
    _install_dependencies(backend_out, runtime_python)

    # Drop packaging metadata that is not needed at runtime.
    for name in ("pyproject.toml", "uv.lock"):
        (backend_out / name).unlink(missing_ok=True)

    runtime_rel = _runtime_python_relpath(runtime_python, backend_out)
    _write_start_sh(output, runtime_rel)
    _write_start_bat(output, runtime_rel)
    _write_start_command(output)
    _write_readme(output, version)

    smoke_env = {
        **os.environ,
        "PYTHONNOUSERSITE": "1",
        "PYTHONPATH": "",
        "AW_DESKTOP_MODE": "1",
        "AW_STATIC_DIR": str(output / "static"),
        "AW_DATA_DIR": str(output / ".smoke-data"),
    }
    import_check = subprocess.run(
        [
            str(runtime_python),
            "-s",
            "-c",
            "import run_desktop; run_desktop._isolate_from_host_packages(); "
            "import fastapi, pydantic, app.launcher; "
            "from app.services import assistant_conversation_service, work_stats; "
            "from app.core.build_info import load_build_info; "
            "info = load_build_info(); "
            "assert info.get('git_commit'), 'build_info.json missing in bundle'; "
            "print('smoke-ok', pydantic.__file__)",
        ],
        cwd=backend_out,
        env=smoke_env,
        capture_output=True,
        text=True,
        check=False,
    )
    if import_check.returncode != 0 or "smoke-ok" not in import_check.stdout:
        raise SystemExit(
            f"Smoke test failed:\n{import_check.stdout}\n{import_check.stderr}"
        )
    pydantic_path = import_check.stdout.strip().split("smoke-ok", 1)[-1].strip()
    runtime_prefix = str((backend_out / "runtime" / "python").resolve())
    if not pydantic_path.startswith(runtime_prefix):
        raise SystemExit(
            f"Smoke test failed: pydantic loaded from host path {pydantic_path!r}"
        )


def main() -> None:
    """Parse CLI arguments and assemble the desktop release bundle."""
    parser = argparse.ArgumentParser(description="Assemble Auto-Writer desktop release")
    parser.add_argument("--output", required=True, help="Output directory for the bundle")
    parser.add_argument("--version", default=os.environ.get("AW_VERSION", "dev"))
    parser.add_argument(
        "--skip-frontend-build",
        action="store_true",
        help="Use existing frontend/dist (CI sets this after pnpm build)",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    assemble_release(
        repo_root,
        Path(args.output).resolve(),
        args.version,
        skip_frontend_build=args.skip_frontend_build,
    )
    print(f"Assembled desktop release at {args.output}")


if __name__ == "__main__":
    main()
