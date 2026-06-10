from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    service_name: str
    host: str
    port: int
    mcp_path: str
    mcp_transport: str
    graphql_url: str
    auth_token: str | None
    request_timeout_seconds: float


def load_settings() -> Settings:
    return Settings(
        service_name=os.getenv("OTEL_SERVICE_NAME", "movie-reservation-mcp"),
        host=os.getenv("MCP_HOST", "0.0.0.0"),
        port=read_int_env("MCP_PORT", 8091),
        mcp_path=os.getenv("MCP_PATH", "/mcp"),
        mcp_transport=os.getenv("MCP_TRANSPORT", "http"),
        graphql_url=os.getenv(
            "MOVIE_RESERVATION_GRAPHQL_URL",
            "http://127.0.0.1:3001/graphql",
        ),
        auth_token=read_optional_env("MOVIE_RESERVATION_AUTH_TOKEN"),
        request_timeout_seconds=read_float_env(
            "MOVIE_RESERVATION_GRAPHQL_TIMEOUT_SECONDS",
            10.0,
        ),
    )


def read_optional_env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return None
    return value.strip()


def read_int_env(name: str, fallback: int) -> int:
    value = os.getenv(name)
    if value is None:
        return fallback

    try:
        parsed = int(value)
    except ValueError:
        return fallback

    return parsed if parsed > 0 else fallback


def read_float_env(name: str, fallback: float) -> float:
    value = os.getenv(name)
    if value is None:
        return fallback

    try:
        parsed = float(value)
    except ValueError:
        return fallback

    return parsed if parsed > 0 else fallback
