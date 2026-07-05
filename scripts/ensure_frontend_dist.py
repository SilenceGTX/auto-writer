"""Ensure ``frontend/dist`` exists and matches the current source tree.

Development launchers call this before starting the desktop app so a stale
production bundle (missing recent UI such as assistant chat persistence) is
rebuilt automatically.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

_STATIC_BUNDLE_MARKERS = (
    "written_chapter_count",
    "/chat/messages",
    "清空记忆",
)


def _repo_root() -> Path:
    """Return the repository root directory."""
    return Path(__file__).resolve().parent.parent


def dist_is_fresh(dist: Path) -> bool:
    """Return whether *dist* looks like a current production build."""
    if not (dist / "index.html").is_file():
        return False
    js_files = sorted(dist.glob("assets/*.js"))
    if not js_files:
        return False
    bundle_text = "".join(
        path.read_text(encoding="utf-8", errors="replace") for path in js_files
    )
    return all(marker in bundle_text for marker in _STATIC_BUNDLE_MARKERS)


def missing_markers(dist: Path) -> list[str]:
    """Return marker strings absent from the bundled JS assets."""
    js_files = sorted(dist.glob("assets/*.js"))
    if not js_files:
        return list(_STATIC_BUNDLE_MARKERS)
    bundle_text = "".join(
        path.read_text(encoding="utf-8", errors="replace") for path in js_files
    )
    return [marker for marker in _STATIC_BUNDLE_MARKERS if marker not in bundle_text]


def resolve_executable(*candidates: str) -> str:
    """Return the first candidate executable found on ``PATH``."""
    for name in candidates:
        if found := shutil.which(name):
            return found
    raise SystemExit(
        f"Command not found in PATH: {candidates[0]}. "
        "Install it or ensure it is available before building."
    )


def build_frontend(repo_root: Path) -> None:
    """Run ``pnpm install`` and ``pnpm build`` for the frontend package."""
    pnpm = resolve_executable("pnpm", "pnpm.cmd", "pnpm.exe")
    frontend = repo_root / "frontend"
    for args in (["install", "--frozen-lockfile"], ["build"]):
        cmd = [pnpm, *args]
        print("+", " ".join(cmd), flush=True)
        subprocess.run(cmd, cwd=frontend, check=True)


def ensure_frontend_dist(*, check_only: bool = False) -> int:
    """Rebuild ``frontend/dist`` when missing or stale; return a shell exit code."""
    repo_root = _repo_root()
    dist = repo_root / "frontend" / "dist"
    if dist_is_fresh(dist):
        print(f"frontend/dist is up to date ({dist})", flush=True)
        return 0

    missing = missing_markers(dist)
    if missing and (dist / "index.html").is_file():
        print(
            "frontend/dist looks stale; missing markers: "
            + ", ".join(missing),
            flush=True,
        )
    elif not (dist / "index.html").is_file():
        print("frontend/dist not found; building…", flush=True)

    if check_only:
        return 1

    build_frontend(repo_root)
    if not dist_is_fresh(dist):
        still_missing = missing_markers(dist)
        print(
            "frontend build completed but bundle still missing: "
            + ", ".join(still_missing),
            file=sys.stderr,
            flush=True,
        )
        return 1
    print(f"frontend/dist rebuilt ({dist})", flush=True)
    return 0


def main() -> None:
    """Parse CLI flags and ensure the frontend production bundle is fresh."""
    parser = argparse.ArgumentParser(description="Ensure frontend/dist is current")
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Exit with code 1 when dist is stale without rebuilding",
    )
    args = parser.parse_args()
    raise SystemExit(ensure_frontend_dist(check_only=args.check_only))


if __name__ == "__main__":
    main()
