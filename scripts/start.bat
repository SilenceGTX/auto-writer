@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

if not exist "frontend\dist\index.html" (
  echo Building frontend (first run)...
  cd frontend
  where pnpm >nul 2>&1
  if errorlevel 1 (
    echo Error: pnpm is required for the development launcher.
    echo Install Node.js and pnpm, or use a prebuilt release package instead.
    pause
    exit /b 1
  )
  call pnpm install --frozen-lockfile
  if errorlevel 1 (
    echo Frontend install failed.
    pause
    exit /b 1
  )
  call pnpm build
  if errorlevel 1 (
    echo Frontend build failed.
    pause
    exit /b 1
  )
  cd ..
)

where uv >nul 2>&1
if errorlevel 1 (
  echo Error: uv is required for the development launcher.
  echo Install uv from https://docs.astral.sh/uv/ or use a prebuilt release package.
  echo Release packages do NOT require uv or a system Python install.
  pause
  exit /b 1
)

set "AW_DESKTOP_MODE=1"
set "AW_STATIC_DIR=%~dp0..\frontend\dist"
cd /d "%~dp0..\backend"
uv run python -m app.launcher
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Auto-Writer exited with error code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
