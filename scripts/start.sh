#!/usr/bin/env bash
# Launch Auto-Writer in desktop mode from a development checkout.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -d "$ROOT/frontend/dist" ]]; then
  echo "Building frontend (first run)…"
  (cd "$ROOT/frontend" && pnpm install --frozen-lockfile && pnpm build)
fi

export AW_DESKTOP_MODE=1
export AW_STATIC_DIR="$ROOT/frontend/dist"
cd "$ROOT/backend"
exec uv run python -m app.launcher
