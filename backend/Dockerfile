FROM python:3.11-slim AS base
WORKDIR /app
COPY pyproject.toml uv.lock ./

# --- production stage ---
FROM base AS prod
RUN pip install uv && uv sync --frozen --no-dev
COPY app/ ./app/
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# --- development stage ---
FROM base AS dev
RUN pip install uv && uv sync --frozen
COPY app/ ./app/
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
