# Movie Reservation MCP

FastMCP adapter around the local NestJS movie reservation GraphQL API.

This service is intentionally thin:

- it owns MCP tool definitions;
- it forwards calls to the existing GraphQL API;
- it preserves trace/correlation/request headers;
- it emits structured logs and OpenTelemetry spans;
- it does not own movie reservation business rules.

## Local Runtime

Install/sync dependencies through `uv`, using the pyenv-managed Python:

```sh
pyenv local 3.12.12
uv sync --python 3.12.12
uv run --python 3.12.12 pytest
```

Default host-run settings:

```sh
export MOVIE_RESERVATION_GRAPHQL_URL=http://127.0.0.1:3001/graphql
export MOVIE_RESERVATION_AUTH_TOKEN=local-demo-token
export OTEL_SERVICE_NAME=movie-reservation-mcp
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:14318
uv run --python 3.12.12 python -m movie_reservation_mcp
```

Docker Compose runs the service on:

```text
http://127.0.0.1:8091/mcp
```

Health endpoint:

```text
GET http://127.0.0.1:8091/health
```

## Docker Compose

From the repo root:

```sh
docker compose --profile demo up -d --build postgres otel-collector api movie-reservation-mcp
```

Then:

```sh
curl -sS http://127.0.0.1:8091/health
```

If the package dependencies are installed locally, run a tool smoke check:

```sh
MOVIE_RESERVATION_MCP_URL=http://127.0.0.1:8091/mcp uv run --python 3.12.12 python scripts/smoke_call_tool.py
```

## Tools

- `movie_me`
- `movie_list_movies`
- `movie_list_screenings`
- `movie_request_reservation`
- `movie_get_reservation_status`
- `movie_get_reservation_result`

Each tool accepts optional observability metadata:

- `traceparent`
- `tracestate`
- `correlation_id`
- `request_id`
- `demo_fault`

The future agent should map inbound workflow headers into these fields.
