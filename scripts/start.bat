@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

where python >nul 2>&1
if errorlevel 1 (
  echo Error: Python is required to verify or rebuild frontend/dist.
  pause
  exit /b 1
)

python "%~dp0ensure_frontend_dist.py"
if errorlevel 1 (
  echo Frontend build failed.
  pause
  exit /b 1
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
