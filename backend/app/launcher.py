"""Desktop entry point: configure user data paths, serve SPA, and open the browser."""

import os
import signal
import socket
import sys
import threading
import webbrowser
from pathlib import Path

from app.core.paths import default_user_data_dir, resolve_release_root, resolve_static_dir


def find_free_port(host: str = "127.0.0.1", start: int = 17890, attempts: int = 50) -> int:
    """Pick the first available TCP port on *host* starting at *start*."""
    for port in range(start, start + attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
            except OSError:
                continue
            return port
    raise RuntimeError(f"No free port on {host} in range {start}-{start + attempts - 1}")


def configure_desktop_env(release_root: Path | None = None) -> tuple[Path, Path]:
    """Set environment variables for desktop mode before importing the FastAPI app."""
    root = release_root or resolve_release_root()
    static_path = resolve_static_dir(root)
    if static_path is None:
        print(
            "Error: frontend static files not found. Build the frontend or set AW_STATIC_DIR.",
            file=sys.stderr,
        )
        sys.exit(1)

    data_dir = default_user_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "logs").mkdir(parents=True, exist_ok=True)

    os.environ.setdefault("AW_DESKTOP_MODE", "1")
    os.environ["AW_STATIC_DIR"] = str(static_path)
    os.environ.setdefault("AW_DATA_DIR", str(data_dir))
    os.environ.setdefault("AW_DATABASE_URL", f"sqlite+aiosqlite:///{data_dir / 'auto_writer.db'}")
    os.environ.setdefault("AW_LOG_DIR", str(data_dir / "logs"))
    return data_dir, static_path


def main() -> None:
    """Start the desktop server and open the default browser."""
    host = os.environ.get("AW_HOST", "127.0.0.1")
    data_dir, static_path = configure_desktop_env()
    port = find_free_port(host)
    url = f"http://{host}:{port}/"

    print("Auto-Writer desktop")
    print(f"  URL:      {url}")
    print(f"  Data dir: {data_dir}")
    print(f"  Static:   {static_path}")
    print("Press Ctrl+C to stop.")

    threading.Timer(1.2, lambda: webbrowser.open(url)).start()

    import uvicorn

    from app.main import create_app

    app = create_app()

    def handle_signal(_signum, _frame) -> None:
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_signal)

    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
