# syntax=docker/dockerfile:1.7

ARG UV_IMAGE=ghcr.io/astral-sh/uv:python3.12-bookworm-slim
FROM ${UV_IMAGE} AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/venv \
    VIRTUAL_ENV=/venv \
    PATH=/venv/bin:$PATH

WORKDIR /app

FROM base AS dependencies

COPY pyproject.toml uv.lock README.md ./

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-install-project --no-dev --frozen || \
    uv sync --no-install-project --no-dev

FROM dependencies AS build

COPY src ./src

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --compile-bytecode --no-editable

FROM base AS runtime

COPY --from=build /venv /venv
COPY --from=build /app /app

RUN useradd -r -u 10001 appuser && chown -R appuser:appuser /app /venv
USER appuser

EXPOSE 8091

CMD ["python", "-m", "movie_reservation_mcp"]
