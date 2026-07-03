@echo off
setlocal
cd /d "%~dp0\.."

if not exist "frontend\dist\index.html" (
  echo Building frontend (first run)...
  cd frontend
  call pnpm install --frozen-lockfile
  call pnpm build
  cd ..
)

set AW_DESKTOP_MODE=1
set AW_STATIC_DIR=%~dp0..\frontend\dist
cd backend
uv run python -m app.launcher
