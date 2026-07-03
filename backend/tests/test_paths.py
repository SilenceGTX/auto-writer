"""Tests for cross-platform desktop data directory helpers."""

import sys
from pathlib import Path

import pytest

from app.core.paths import APP_NAME, APP_SLUG, default_user_data_dir, resolve_static_dir


def test_default_user_data_dir_honours_aw_data_dir(monkeypatch, tmp_path):
    """AW_DATA_DIR overrides the platform default."""
    custom = tmp_path / "custom-data"
    monkeypatch.setenv("AW_DATA_DIR", str(custom))
    assert default_user_data_dir() == custom.resolve()


@pytest.mark.skipif(sys.platform != "win32", reason="Windows-specific path layout")
def test_default_user_data_dir_windows(monkeypatch):
    """Windows resolves under LOCALAPPDATA/Auto-Writer."""
    monkeypatch.setattr(sys, "platform", "win32")
    monkeypatch.delenv("AW_DATA_DIR", raising=False)
    monkeypatch.setenv("LOCALAPPDATA", r"C:\Users\test\AppData\Local")
    path = default_user_data_dir()
    assert path == Path(r"C:\Users\test\AppData\Local") / APP_NAME


def test_default_user_data_dir_macos(monkeypatch):
    """macOS resolves under ~/Library/Application Support/Auto-Writer."""
    monkeypatch.setattr(sys, "platform", "darwin")
    monkeypatch.delenv("AW_DATA_DIR", raising=False)
    monkeypatch.setenv("HOME", "/Users/test")
    path = default_user_data_dir()
    assert path == Path("/Users/test/Library/Application Support") / APP_NAME


@pytest.mark.skipif(sys.platform != "linux", reason="Linux-specific path layout")
def test_default_user_data_dir_linux_xdg(monkeypatch):
    """Linux honours XDG_DATA_HOME when set."""
    monkeypatch.setattr(sys, "platform", "linux")
    monkeypatch.delenv("AW_DATA_DIR", raising=False)
    monkeypatch.setenv("XDG_DATA_HOME", "/home/test/.local/share")
    path = default_user_data_dir()
    assert path == Path("/home/test/.local/share") / APP_SLUG


def test_resolve_static_dir_prefers_aw_static_dir(monkeypatch, tmp_path):
    """AW_STATIC_DIR takes precedence over bundled paths."""
    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text("<html></html>", encoding="utf-8")
    monkeypatch.setenv("AW_STATIC_DIR", str(static))
    assert resolve_static_dir() == static.resolve()
