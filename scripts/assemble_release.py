"""Assemble a platform-native desktop release directory for distribution.

Bundles a self-contained CPython under ``backend/runtime/python`` and installs
dependencies into ``backend/.venv``. Start scripts invoke the runtime
interpreter with ``python -m app.bootstrap`` so the package does not depend on
build-machine absolute paths (the usual failure mode of a plain ``uv sync``
venv on Windows CI).
"""

from __future__ import annotations

import argparse
import os
import shutil
import stat
import subprocess
from pathlib import Path

PYTHON_VERSION = "3.11"


def _copy_backend(backend_src: Path, backend_out: Path) -> None:
    """Copy backend source files needed for a desktop bundle."""
    backend_out.mkdir(parents=True, exist_ok=True)
    ignore = shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", ".ruff_cache")
    shutil.copytree(backend_src / "app", backend_out / "app", ignore=ignore)
    for name in ("pyproject.toml", "uv.lock"):
        shutil.copy2(backend_src / name, backend_out / name)


def _run(cmd: list[str], *, cwd: Path) -> None:
    """Run a subprocess and fail the build on non-zero exit."""
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def _install_portable_python(backend_out: Path) -> Path:
    """Install a managed CPython into ``backend/runtime/python`` and return it."""
    runtime_root = backend_out / "runtime"
    if runtime_root.exists():
        shutil.rmtree(runtime_root)
    runtime_root.mkdir(parents=True)

    _run(
        ["uv", "python", "install", PYTHON_VERSION, "--install-dir", str(runtime_root)],
        cwd=backend_out,
    )

    # Newer uv versions may create both a versioned install and a shorter alias
    # (often a symlink), e.g. cpython-3.11.15-... and cpython-3.11-....
    entries = [
        path
        for path in runtime_root.iterdir()
        if path.is_dir() and not path.name.startswith(".")
    ]
    if not entries:
        raise SystemExit(f"No Python install found under {runtime_root}")

    # Prefer a real directory over aliases, and the most specific name.
    real_installs = [path for path in entries if not path.is_symlink()]
    candidates = real_installs or entries
    source = max(candidates, key=lambda path: (len(path.name), path.name))

    target = runtime_root / "python"
    for path in entries:
        if path == source:
            continue
        if path.is_symlink() or path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path)

    source.rename(target)
    return target


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


def _install_dependencies(backend_out: Path, runtime_python: Path) -> None:
    """Create a venv for site-packages and install locked dependencies into it."""
    venv_dir = backend_out / ".venv"
    if venv_dir.exists():
        shutil.rmtree(venv_dir)

    _run(
        [
            "uv",
            "venv",
            str(venv_dir),
            "--python",
            str(runtime_python),
            "--link-mode",
            "copy",
        ],
        cwd=backend_out,
    )
    _run(
        [
            "uv",
            "sync",
            "--frozen",
            "--no-dev",
            "--python",
            str(runtime_python),
            "--link-mode",
            "copy",
        ],
        cwd=backend_out,
    )


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
if [[ ! -x "$PYTHON" ]]; then
  echo "Error: bundled Python not found at backend/{runtime_python_rel}" >&2
  echo "You do not need to install Python yourself." >&2
  echo "Re-download the release built for this OS." >&2
  exit 1
fi

if [[ ! -d "$ROOT/backend/.venv" ]]; then
  echo "Error: bundled dependencies not found at backend/.venv" >&2
  exit 1
fi

export AW_DESKTOP_MODE=1
export AW_STATIC_DIR="$ROOT/static"
cd "$ROOT/backend"
exec "$PYTHON" -m app.bootstrap
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

if not exist "backend\\.venv" (
  echo Error: bundled dependencies not found at backend\\.venv
  echo.
  pause
  exit /b 1
)

set "AW_DESKTOP_MODE=1"
set "AW_STATIC_DIR=%~dp0static"
cd /d "%~dp0backend"
"{win_python}" -m app.bootstrap
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

Python is NOT required. Each release embeds a portable CPython under
backend/runtime/python/ plus dependencies under backend/.venv/.
Use the archive built for your OS (win-x64 / linux-x64 / macos-arm64).

If start.bat shows an error about hostedtoolcache or a missing Python path,
you have an old build — download a newer release.

User data (database, snapshots, exports, logs)
----------------------------------------------
Windows : %LOCALAPPDATA%\\Auto-Writer\\
macOS   : ~/Library/Application Support/Auto-Writer/
Linux   : ~/.local/share/auto-writer/  (or $XDG_DATA_HOME/auto-writer/)

Override with the AW_DATA_DIR environment variable before launching.
"""
    (output / "README-DESKTOP.txt").write_text(content, encoding="utf-8")


def assemble_release(repo_root: Path, output: Path, version: str) -> None:
    """Build a release folder with static assets, portable Python, and launchers."""
    dist = repo_root / "frontend" / "dist"
    if not dist.is_dir():
        raise SystemExit("frontend/dist not found — run `pnpm build` in frontend/ first")

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    shutil.copytree(dist, output / "static")
    backend_out = output / "backend"
    _copy_backend(repo_root / "backend", backend_out)

    python_home = _install_portable_python(backend_out)
    runtime_python = _find_runtime_python(python_home)
    _install_dependencies(backend_out, runtime_python)

    runtime_rel = _runtime_python_relpath(runtime_python, backend_out)
    _write_start_sh(output, runtime_rel)
    _write_start_bat(output, runtime_rel)
    _write_start_command(output)
    _write_readme(output, version)

    # Smoke-check: runtime interpreter + venv site-packages resolve after packaging.
    smoke = subprocess.run(
        [
            str(runtime_python),
            "-c",
            "from pathlib import Path; import sys; "
            "backend = Path('.').resolve(); "
            "site = backend / '.venv' / 'Lib' / 'site-packages'; "
            "matches = sorted((backend / '.venv' / 'lib').glob('python*/site-packages')) "
            "if not site.is_dir() else [site]; "
            "sys.path[:0] = [str(matches[0]), str(backend)]; "
            "import fastapi, app.launcher; print('smoke-ok')",
        ],
        cwd=backend_out,
        capture_output=True,
        text=True,
        check=False,
    )
    if smoke.returncode != 0 or "smoke-ok" not in smoke.stdout:
        raise SystemExit(f"Smoke test failed:\n{smoke.stdout}\n{smoke.stderr}")


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
