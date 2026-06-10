# Service Instructions: golden-path-ecs-template

Repo:

```text
/home/patex1987/development/golden-path-ecs-template
```

Required branch:

```text
demo-multi-service-observability
```

Required AI context:

- Planner skill: `/home/patex1987/development/golden-path-ecs-template/.ai/skills/principal-engineer-planner`
- Review agents: `/home/patex1987/development/golden-path-ecs-template/.ai/agents`

## Why This Work Exists

This repo provides the reliable business core for the demo: the NestJS movie reservation GraphQL API. The new work should expose that API through a FastMCP server so the LangGraph agent can call movie-reservation capabilities as tools instead of embedding GraphQL logic directly.

The demo story benefits because the audience can see a real service boundary:

```text
agent worker -> movie-reservation MCP -> movie-reservation GraphQL API -> database/worker
```

This keeps the movie domain in the existing TypeScript service, while the MCP wrapper becomes a thin integration adapter.

## Scope

Implement two service surfaces in this repo:

- Existing `movie-reservation-service`.
- New `movie-reservation-mcp` FastMCP server.

There is a separate dependent frontend plan for `movie-reservation-web`:

- [frontend-agent-integration.md](frontend-agent-integration.md)

Do not implement the frontend agent integration until the Python agent HTTP
contract and both MCP servers are ready.

Keep changes demo-focused. Do not redesign the NestJS service or rewrite GraphQL contracts.

## Current State

The movie service already has:

- GraphQL queries and mutations in `movie-reservation-service/src/presentation/graphql/movie-reservations.resolver.ts`.
- Existing OTel dependencies and instrumentation bootstrap in `movie-reservation-service/package.json`.
- Existing local observability workflow docs in `docs/workflows/local-observability.md`.
- Existing Docker Compose service `api` in `docker-compose.yml`.

## Required Design

### Movie GraphQL API

Keep the existing API running on host port `3001`.

Required GraphQL operations for the MCP wrapper:

- `me`
- `movies`
- `screenings(movieId)`
- `requestReservation(input)`
- `reservationRequestStatus(id)`
- `reservationResult(requestId)`

Do not add poison-pill logic here unless the Rust poison-pill path becomes impossible. The required anomaly source is `axum-tools-random-api`.

### Movie Reservation MCP Server

Create a new Python FastMCP service under this repo, suggested path:

```text
movie-reservation-mcp/
```

Required files:

- `movie-reservation-mcp/pyproject.toml`
- `movie-reservation-mcp/src/movie_reservation_mcp/server.py`
- `movie-reservation-mcp/src/movie_reservation_mcp/graphql_client.py`
- `movie-reservation-mcp/src/movie_reservation_mcp/telemetry.py`
- `movie-reservation-mcp/Dockerfile`
- `movie-reservation-mcp/README.md`

Use FastMCP with streamable HTTP transport. The server endpoint should be:

```text
http://movie-reservation-mcp:8091/mcp
```

Expose a custom health endpoint:

```text
GET /health
```

FastMCP supports custom routes on HTTP deployments; use that for `/health`.

### MCP Tools

Implement these tools:

- `movie_me`
  - Input: no business fields.
  - Output: authenticated demo user/provider context.
- `movie_list_movies`
  - Input: optional `limit`.
  - Output: movie ids, titles, ratings, duration.
- `movie_list_screenings`
  - Input: optional `movie_id`.
  - Output: screenings and seats.
- `movie_request_reservation`
  - Input: `screening_id`, `seat_ids`.
  - Output: reservation request id and status.
- `movie_get_reservation_status`
  - Input: `reservation_request_id`.
  - Output: current reservation request status.
- `movie_get_reservation_result`
  - Input: `reservation_request_id`.
  - Output: reservation if confirmed, otherwise null/pending result.

Every tool must:

- Accept optional metadata for `traceparent`, `tracestate`, `correlation_id`, `request_id`, and `demo_fault`.
- Forward those values to the GraphQL API as headers.
- Create a span around the downstream GraphQL call.
- Log tool start, tool success, and tool failure.

### OpenTelemetry

`movie-reservation-service` already has OTel instrumentation. Ensure these env vars are set in Docker Compose:

```text
OTEL_SERVICE_NAME=movie-reservation-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_RESOURCE_ATTRIBUTES=service.environment=local,demo.name=multi-service-observability
```

For `movie-reservation-mcp`, instrument:

- FastMCP server spans.
- HTTPX client spans for calls to GraphQL.
- Manual tool spans named `mcp.tool.<tool_name>`.

Suggested Python dependencies:

- `fastmcp`
- `httpx`
- `opentelemetry-api`
- `opentelemetry-sdk`
- `opentelemetry-exporter-otlp-proto-http`
- `opentelemetry-instrumentation-httpx`
- `structlog` or standard JSON logging

Required service name:

```text
OTEL_SERVICE_NAME=movie-reservation-mcp
```

### Dockerization

Add a Dockerfile for `movie-reservation-mcp`.

Add a Compose service to this repo's `docker-compose.yml`:

```yaml
movie-reservation-mcp:
  build:
    context: ./movie-reservation-mcp
  container_name: golden-path-movie-reservation-mcp
  profiles:
    - demo
  environment:
    MOVIE_RESERVATION_GRAPHQL_URL: http://api:3000/graphql
    MOVIE_RESERVATION_AUTH_TOKEN: local-demo-token
    OTEL_SERVICE_NAME: movie-reservation-mcp
    OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318
    OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
    OTEL_RESOURCE_ATTRIBUTES: service.environment=local,demo.name=multi-service-observability
  ports:
    - "127.0.0.1:8091:8091"
  labels:
    observability.logs: "true"
    service.name: "movie-reservation-mcp"
    service.environment: "local"
  depends_on:
    api:
      condition: service_healthy
    otel-collector:
      condition: service_started
```

The exact Compose syntax can be adjusted to match implementation constraints, but the port, labels, OTel env vars, and dependency relationship are required.

## Implementation Steps

1. Verify current movie API
   - Run the existing observability smoke script.
   - Confirm GraphQL works at `http://127.0.0.1:3001/graphql`.
   - Do not proceed with MCP work if the API is not healthy.

2. Scaffold `movie-reservation-mcp`
   - Add Python package structure.
   - Add FastMCP server with `/mcp` and `/health`.
   - Add a GraphQL client module using `httpx.AsyncClient`.

3. Implement MCP tools
   - Start with `movie_list_movies` and `movie_list_screenings`.
   - Add reservation mutation and polling tools.
   - Make every tool return compact JSON objects suitable for the agent.

4. Add OTel and logs
   - Configure OTel on startup.
   - Add per-tool spans.
   - Emit JSON logs with `service_name`, `event`, `trace_id`, `correlation_id`, `request_id`, `tool_name`, and `outcome`.

5. Dockerize
   - Add Dockerfile.
   - Add Compose service.
   - Add labels for Loki collection.

6. Verify
   - Start API and MCP.
   - Call `/health`.
   - Call at least one MCP tool through a FastMCP client.
   - Confirm spans arrive in Tempo and logs arrive in Loki.

## Testing Strategy

Minimum checks:

```sh
npm -w movie-reservation-service run typecheck
npm -w movie-reservation-service test -- -t "reservation"
```

For the MCP package:

- Add a tiny unit test for GraphQL request body construction if time allows.
- Add a smoke command that calls `movie_list_movies` against a running API.

Full check if time allows:

```sh
npm -w movie-reservation-service run check
```

## Done Criteria

- `movie-reservation-service` still passes its core checks.
- `movie-reservation-mcp` starts in Docker on port `8091`.
- The agent can discover and call movie MCP tools.
- Tool calls preserve trace/correlation/request headers.
- Tempo shows spans from `movie-reservation-mcp` and `movie-reservation-service`.
- Loki shows logs for both services.
