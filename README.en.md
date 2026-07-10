# Auto-Writer

[中文](README.md) | [English](README.en.md)

[![CI](https://github.com/SilenceGTX/auto-writer/actions/workflows/ci.yml/badge.svg)](https://github.com/SilenceGTX/auto-writer/actions/workflows/ci.yml)

An LLM-assisted novel writing web app: manage works, build world settings, outline stories, write chapters, and review manuscripts—with AI collaboration throughout. Built for **single-user, local-first** use.

## Features

- **Works**: Create, edit, and delete works; create series for grouping (rename/delete for series not yet supported). Search, sort, pagination, progress visualization, and inline status changes.
- **Worldbuilding**: Manage entries by category (Character / Location / Item / Concept, plus custom categories), key–value properties, and reusable property-name suggestions within a category.
- **Outline**: Generate stage trees and chapter outlines from story structures (three-act, kishōtenketsu, hero’s journey, Save the Cat! beat sheet, or custom). Stage filters, drag-and-drop chapter reorder, and stage share stats.
- **Writing**: Chapter editor (undo/redo, timed autosave, live word count, focus mode, scroll memory), AI draft generation, local rewrite with diff preview, recap cache, and assistant-panel chat.
- **`@` mentions & inspirations**: Mention worldbuilding entries in outline / writing / review assistants so they are injected into prompts; select text anywhere to “Add to inspirations,” then manage snippets on the Inspirations page (search/filter/tags/copy/insert at chapter end/jump to source with highlight).
- **Review**: Reader (TOC, paging, reading progress) plus AI review chat; export a work as a ZIP (root folder named after the work, one `.md` per chapter, empty chapters skipped).
- **Chinese / English**: Switch UI language in the sidebar or Settings (`zh` / `en`). The same preference drives **UI copy and AI prompts** (backend picks Jinja2 templates via `Accept-Language`). User-authored content (manuscript text, entry names, inspirations, etc.) is not translated.
- **Settings**: Multiple LLM connection profiles and per-task assignment, global preferences (creativity / focus / length + advanced params), writing style, UI language, data save, typography, and one-click config import/export.
- **Export & snapshots**: From the Works page, export structured JSON (full backup/migration) or Markdown (manuscript archive); from Review, export a per-chapter ZIP. While writing, disk snapshots are written on a configurable interval (`outline.json`, chapter `.md` files, with history rotation; `scenes.json` is reserved for scene outlines—no editor yet).

## Tech stack

- **Frontend**: React 18 + TypeScript + Vite + HeroUI + Tailwind; `i18next` / `react-i18next`; pnpm, ESLint, Vitest.
- **Backend**: Python 3.11 + FastAPI + SQLAlchemy (async) + SQLite; Jinja2 prompt templates; uv, Ruff, Pytest, loguru.
- **Deploy**: Docker Compose (prod/dev) or a single-process desktop bundle (Windows / Linux / macOS).

## Quick start

### Desktop (single process, opens the browser)

No Docker required. Download the archive for your platform from [Releases](https://github.com/SilenceGTX/auto-writer/releases), extract it, then:

| Platform | How to start |
|----------|----------------|
| Windows | Double-click `start.bat` |
| macOS | Double-click `start.command`, or run `./start.sh` in a terminal |
| Linux | Run `./start.sh` in a terminal |

The browser opens a local URL (default `http://127.0.0.1:17890`). Press Ctrl+C in the terminal to stop.

The release is **self-contained**: the interpreter and dependencies live under `backend/runtime/python/`—**users do not need to install Python**. Download the matching archive (e.g. `win-x64`); do not copy bundles across platforms.

**User data directory** (database, snapshots, exports, logs; override with `AW_DATA_DIR`):

| Platform | Default path |
|----------|----------------|
| Windows | `%LOCALAPPDATA%\Auto-Writer\` |
| macOS | `~/Library/Application Support/Auto-Writer/` |
| Linux | `~/.local/share/auto-writer/` (or `$XDG_DATA_HOME/auto-writer/`) |

Run desktop mode from a source checkout (requires [uv](https://docs.astral.sh/uv/) and pnpm):

```bash
./scripts/start.sh          # Linux / macOS
scripts\start.bat           # Windows
```

Build a release directory locally (runs ``pnpm build`` automatically; no need to pre-build ``frontend/dist``):

```bash
python scripts/assemble_release.py --output dist/desktop --version dev
```

If you just ran ``pnpm build`` under ``frontend/``, pass ``--skip-frontend-build`` to skip a rebuild.

To publish a desktop release via tags:

1. **Merge** the changes into remote `main`, and make sure your local tip matches current `origin/main` (do not tag from a stale local `main`).
2. Create and push a `v*` tag on that commit (e.g. `git tag v0.4.0 && git push origin v0.4.0`).
3. The Release workflow checks that the tag is in `main` history and that key sources exist (including i18n / prompt templates), then rebuilds with `pnpm build`, assembles three platform bundles, and uploads them to GitHub Releases.

You can also run the `Release` workflow manually (`workflow_dispatch`) and set a version label.

### Docker production (one command)

```bash
docker compose up -d --build app
```

Open http://localhost:8080 (API at http://localhost:8000).

> Use `-d` to run in the background so the service keeps running after you close the terminal. Without `-d`, the terminal mostly shows nginx logs; Ctrl+C stops the frontend container. Use port **8080** (not the dev port 5173).

### Docker development (hot reload)

`docker-compose.dev.yml` is self-contained:

```bash
docker compose -f docker-compose.dev.yml up --build app
```

Open http://localhost:5173; frontend and backend reload on change.

> Production images (`auto-writer-*:prod`, nginx) and development images (`auto-writer-*:dev`, Vite HMR) use different image names and do not overwrite each other. Add `--build` after dependency changes.

### Local development (without Docker)

```bash
# Backend
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
pnpm install
pnpm dev
```

Open http://localhost:5173.

## Tests & checks

```bash
# Backend
cd backend
uv run ruff check app tests
uv run pytest

# Frontend
cd frontend
pnpm exec eslint src
pnpm exec tsc --noEmit
pnpm exec vitest run
```

## Data & storage

- **SQLite**: Dev / Docker default at `data/auto_writer.db`; desktop builds write under the user data directory above.
- **Docker and desktop data are separate**: works created in Docker do not appear in the desktop install unless you set `AW_DATA_DIR` to the same path (e.g. the project’s `data/`) before starting.
- After starting the desktop app, open `http://127.0.0.1:8000/api/health` and check `version` / `git_commit` / `built_at` to confirm you are on the expected build.
- **Snapshots**: Default path `{data dir}/snapshots/{work_id}/` (path and history depth configurable under Settings → Data save), including `outline.json` (stages and chapter summaries) and per-chapter `.md` bodies; `scenes.json` is reserved for scene outlines as a DB backup aid.
- **Exports**: Manual exports land under `data/exports/` and trigger a browser download (JSON / Markdown / chapter ZIP).
- **Logs**: loguru writes to the console and rotating files under `data/logs/`.
- `data/` is gitignored; Docker persists it via a volume mount.

## Project layout

```
├── .github/workflows/        # CI and Release packaging
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── core/             # Config, logging, paths
│   │   ├── deps/             # FastAPI dependencies (incl. locale)
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── prompts/          # Jinja2 LLM prompt templates (zh / en)
│   │   ├── routers/          # API routes (works / outline / writing / review / export / settings …)
│   │   ├── services/         # Business logic (llm / prompts / export / snapshot / chat …)
│   │   ├── frontend.py       # Static assets for desktop mode
│   │   ├── launcher.py       # Desktop launcher (browser + single process)
│   │   ├── schemas.py        # Pydantic request/response models
│   │   ├── database.py
│   │   └── main.py
│   ├── tests/                # Pytest
│   ├── Dockerfile
│   ├── .env.example
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/                 # React frontend
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── components/       # Shared layout and settings UI
│   │   ├── context/          # Global state (theme / current work / assistant / locale)
│   │   ├── hooks/            # Shared React hooks
│   │   ├── i18n/             # i18next setup
│   │   ├── locales/          # zh / en copy (by namespace)
│   │   ├── pages/            # Feature pages (outline / writing / review / …)
│   │   ├── utils/            # Pure helpers
│   │   ├── test/             # Vitest
│   │   ├── api.ts            # API client (incl. Accept-Language)
│   │   ├── App.tsx           # Root component
│   │   ├── main.tsx          # Entry
│   │   └── styles.css        # Global styles
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf            # Static hosting for the prod image
│   ├── package.json
│   └── vite.config.ts
├── designs/                  # Product & tech design docs (see designs/INDEX.md)
├── scripts/                  # Desktop packaging and launch scripts
│   ├── assemble_release.py   # Assemble three-platform release dirs
│   ├── verify_release_bundle.py
│   ├── ensure_frontend_dist.py
│   ├── start.sh              # Dev-tree desktop start (Linux / macOS)
│   ├── start.bat             # Dev-tree desktop start (Windows)
│   └── start.command         # macOS double-click start
├── docker-compose.yml        # Production compose
├── docker-compose.dev.yml    # Development compose (HMR)
├── AGENTS.md                 # Repo conventions for coding agents
├── README.md                 # Chinese README
└── README.en.md              # This file (English)
```

Runtime data (`data/` DB, snapshots, exports, logs, etc.) and local env files (`.env`, `node_modules/`, …) are listed in `.gitignore` and are not tracked.

I18n design: [`designs/I18N.md`](designs/I18N.md). Backend architecture: [`designs/BACKEND_ARCHITECTURE.md`](designs/BACKEND_ARCHITECTURE.md).

## License

[MIT](LICENSE)
