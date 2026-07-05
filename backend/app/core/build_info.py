"""Load build metadata embedded when assembling a desktop release bundle."""

import json
from pathlib import Path


def load_build_info() -> dict[str, str]:
    """Return build metadata from ``app/build_info.json`` when present."""
    path = Path(__file__).resolve().parent.parent / "build_info.json"
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(key): str(value) for key, value in data.items() if value is not None}
