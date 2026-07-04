"""Desktop entry point: configure user data paths, serve SPA, and open the browser."""

import os
import signal
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
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


def open_browser_when_ready(url: str, health_url: str, *, timeout: float = 45.0) -> None:
    """Poll the health endpoint until the server is up, then open the browser.

    Avoids the race where the browser loads before uvicorn finishes startup and
    the user sees a connection-refused error page.
    """
    deadline = time.monotonic() + timeout
    print("Waiting for server to become ready…", flush=True)
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(health_url, timeout=0.5) as response:
                if 200 <= response.status < 300:
                    print(f"Opening browser at {url}", flush=True)
                    webbrowser.open(url)
                    return
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.15)
    print(
        f"Server not ready after {timeout:.0f}s; opening browser anyway: {url}",
        flush=True,
    )
    webbrowser.open(url)


def main() -> None:
    """Start the desktop server and open the default browser."""
    host = os.environ.get("AW_HOST", "127.0.0.1")
    data_dir, static_path = configure_desktop_env()
    port = find_free_port(host)
    url = f"http://{host}:{port}/"
    health_url = f"http://{host}:{port}/api/health"

    print("Auto-Writer desktop")
    print(f"  URL:      {url}")
    print(f"  Data dir: {data_dir}")
    print(f"  Static:   {static_path}")
    print("Press Ctrl+C to stop.")

    threading.Thread(
        target=open_browser_when_ready,
        args=(url, health_url),
        daemon=True,
        name="open-browser",
    ).start()

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
