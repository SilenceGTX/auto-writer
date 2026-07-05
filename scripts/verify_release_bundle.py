"""Validate an assembled desktop release directory before upload or publish."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))
from ensure_frontend_dist import dist_is_fresh, missing_markers, resolve_executable


def _repo_root() -> Path:
    """Return the repository root directory."""
    return Path(__file__).resolve().parent.parent


def current_git_commit(repo_root: Path) -> str:
    """Return the short git commit hash for *repo_root*."""
    git = resolve_executable("git", "git.exe")
    result = subprocess.run(
        [git, "rev-parse", "--short", "HEAD"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    commit = result.stdout.strip()
    if result.returncode != 0 or not commit:
        raise SystemExit("Could not resolve git commit for release verification")
    return commit


def verify_release_bundle(
    bundle_dir: Path,
    *,
    expected_commit: str | None = None,
) -> None:
    """Fail when *bundle_dir* is incomplete or does not match *expected_commit*."""
    bundle_dir = bundle_dir.resolve()
    static_dir = bundle_dir / "static"
    build_info_path = bundle_dir / "BUILD_INFO.json"
    backend_marker = (
        bundle_dir / "backend" / "app" / "services" / "assistant_conversation_service.py"
    )

    if not static_dir.is_dir():
        raise SystemExit(f"Missing static directory: {static_dir}")
    if not dist_is_fresh(static_dir):
        missing = missing_markers(static_dir)
        raise SystemExit(
            "Release static bundle is stale or incomplete; missing markers: "
            + ", ".join(missing)
        )
    if not build_info_path.is_file():
        raise SystemExit(f"Missing BUILD_INFO.json: {build_info_path}")
    if not backend_marker.is_file():
        raise SystemExit(f"Missing backend module in bundle: {backend_marker}")

    try:
        build_info = json.loads(build_info_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid BUILD_INFO.json: {exc}") from exc

    bundled_commit = str(build_info.get("git_commit", "")).strip()
    if not bundled_commit:
        raise SystemExit("BUILD_INFO.json is missing git_commit")

    commit = expected_commit or current_git_commit(_repo_root())
    if not bundled_commit.startswith(commit) and commit != bundled_commit:
        if not commit.startswith(bundled_commit):
            raise SystemExit(
                f"BUILD_INFO git_commit {bundled_commit!r} does not match {commit!r}"
            )

    print(
        "Release bundle verified:",
        f"version={build_info.get('version')}",
        f"git_commit={bundled_commit}",
        f"static={static_dir}",
        flush=True,
    )


def main() -> None:
    """Parse CLI arguments and verify a desktop release directory."""
    parser = argparse.ArgumentParser(description="Verify an assembled desktop release")
    parser.add_argument("bundle_dir", help="Path to the assembled release directory")
    parser.add_argument(
        "--commit",
        help="Expected short git commit hash (defaults to current HEAD)",
    )
    args = parser.parse_args()
    verify_release_bundle(Path(args.bundle_dir), expected_commit=args.commit)
    print("verify-ok", flush=True)


if __name__ == "__main__":
    main()
