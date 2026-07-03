"""Logging configuration for the Auto-Writer backend, built on loguru.

Configures a console sink and a rotating log file under the configured log
directory, and intercepts the standard library logging used by uvicorn /
FastAPI so all runtime events (including LLM calls) flow through loguru.
"""

import logging
import sys
from pathlib import Path

from loguru import logger

_LOG_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss}</green> "
    "<level>{level: <8}</level> "
    "<cyan>{name}</cyan> - <level>{message}</level>"
)


class InterceptHandler(logging.Handler):
    """Forward standard-library logging records to the loguru logger."""

    def emit(self, record: logging.LogRecord) -> None:
        """Re-emit a stdlib log record through loguru, preserving level/depth."""
        try:
            level: str | int = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1
        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def setup_logging(log_dir: str, level: str = "INFO") -> None:
    """Configure loguru sinks and route stdlib logging through loguru."""
    level = level.upper()
    logger.remove()
    logger.add(sys.stderr, level=level, format=_LOG_FORMAT, enqueue=True)

    try:
        directory = Path(log_dir)
        directory.mkdir(parents=True, exist_ok=True)
        logger.add(
            directory / "backend.log",
            level=level,
            format=_LOG_FORMAT,
            rotation="1 MB",
            retention=3,
            encoding="utf-8",
            enqueue=True,
        )
    except OSError:
        # Fall back to console-only logging if the log dir is not writable.
        pass

    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        intercepted = logging.getLogger(name)
        intercepted.handlers = [InterceptHandler()]
        intercepted.propagate = False
