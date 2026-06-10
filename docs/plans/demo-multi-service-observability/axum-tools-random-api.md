# Service Instructions: axum_tools_random_api

Repo:

```text
/home/patex1987/development/axum_tools_random_api
```

Required branch:

```text
demo-multi-service-observability
```

Required AI context:

- Planner skill: `/home/patex1987/development/golden-path-ecs-template/.ai/skills/principal-engineer-planner`
- Review agents: `/home/patex1987/development/golden-path-ecs-template/.ai/agents`

## Why This Work Exists

This repo gives the demo a second real service boundary and one controlled dependency failure source.

The Rust Axum API should behave like an internal recommendation service. The FastMCP wrapper exposes recommendation as an agent tool. The poison-pill fault in the Rust API creates the slow/error dependency behavior that Grafana can show in traces, logs, and golden-signal panels.

Target flow:

```text
agent worker -> axum-tools MCP -> axum-tools Rust API
```

## Scope

Implement two services in this repo:

- `axum-tools-random-api`: Rust Axum recommendation API.
- `axum-tools-mcp`: Python FastMCP wrapper around the Rust API.

Keep fake data. Do not require TMDB or other external API credentials.

## Current State

The repo currently has:

- `Cargo.toml`
- `src/main.rs`
- `src/domain/movie.rs`
- `src/di/movie_service.rs`
- an existing `/movies` route
- fake service support through `USE_DUMMY=true`

## Required Design

### Rust API

Run on:

```text
http://127.0.0.1:8082
```

Required endpoints:

- `GET /health`
- `GET /movies`
- `GET /recommendations?limit=5`

`/recommendations` should return deterministic enough data for a repeatable demo. It can reuse the existing fake movie service and map fake movies into recommendation payloads.

Suggested recommendation payload:

```json
{
  "recommendations": [
    {
      "id": "movie-aurora",
      "title": "Aurora Protocol",
      "reason": "Matches the demo preference and has available screenings",
      "confidence": 0.92
    }
  ]
}
```

The recommendation ids do not have to match the movie reservation GraphQL ids. The agent can use the recommendation result as narrative context and then query GraphQL screenings. If time allows, include a `movie_reservation_movie_id` field mapped to seeded movie ids.

### Poison Pill

The only fault source should be this Rust API.

Read fault mode from:

- `X-Demo-Fault` header, preferred.
- `DEMO_FAULT_MODE` env var, optional fallback.

Supported values:

- `none`: normal behavior.
- `slow-recommendation`: sleep for 2 to 5 seconds before returning success.
- `recommendation-error`: return HTTP 503 with JSON error.

The MCP wrapper and agent must only propagate this fault. They should not invent separate random failures.

### Rust OpenTelemetry

Instrument:

- inbound HTTP requests;
- `/recommendations` handler;
- poison-pill delay/error branch;
- dependency-style spans if the service ever calls another API.

Suggested Rust dependencies:

- `tracing`
- `tracing-subscriber`
- `tracing-opentelemetry`
- `opentelemetry`
- `opentelemetry_sdk`
- `opentelemetry-otlp`
- `tower-http` with tracing support

Required service name:

```text
OTEL_SERVICE_NAME=axum-tools-random-api
```

Required env vars:

```text
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_RESOURCE_ATTRIBUTES=service.environment=local,demo.name=multi-service-observability
```

Also emit structured stdout logs. Minimum fields:

- `service_name=axum-tools-random-api`
- `event`
- `trace_id`
- `correlation_id`
- `request_id`
- `fault`
- `http_route`
- `http_status`
- `duration_ms`

### Axum Tools MCP Server

Create a new Python FastMCP service under this repo, suggested path:

```text
axum-tools-mcp/
```

Required files:

- `axum-tools-mcp/pyproject.toml`
- `axum-tools-mcp/src/axum_tools_mcp/server.py`
- `axum-tools-mcp/src/axum_tools_mcp/recommendation_client.py`
- `axum-tools-mcp/src/axum_tools_mcp/telemetry.py`
- `axum-tools-mcp/Dockerfile`
- `axum-tools-mcp/README.md`

Run on:

```text
http://127.0.0.1:8092/mcp
```

Expose:

```text
GET /health
```

### MCP Tools

Implement:

- `recommendation_get_movies`
  - Input: `limit`, optional `preference`, optional `fault`.
  - Calls Rust `/recommendations`.
  - Propagates observability headers and `X-Demo-Fault`.
- `recommendation_health`
  - Calls Rust `/health`.

Every tool must:

- Create a span named `mcp.tool.<tool_name>`.
- Forward `traceparent`, `tracestate`, `X-Correlation-Id`, `X-Request-Id`, and `X-Demo-Fault`.
- Log start, success, and failure.
- Return compact JSON for the agent.

### FastMCP OTel

Suggested Python dependencies:

- `fastmcp`
- `httpx`
- `opentelemetry-api`
- `opentelemetry-sdk`
- `opentelemetry-exporter-otlp-proto-http`
- `opentelemetry-instrumentation-httpx`

Required service name:

```text
OTEL_SERVICE_NAME=axum-tools-mcp
```

## Dockerization

Add Dockerfiles for:

- Rust API.
- FastMCP wrapper.

Add a local Compose file if the repo does not already have one:

```yaml
services:
  axum-tools-random-api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: axum-tools-random-api
    environment:
      USE_DUMMY: "true"
      PORT: "8082"
      OTEL_SERVICE_NAME: axum-tools-random-api
      OTEL_EXPORTER_OTLP_ENDPOINT: http://host.docker.internal:4318
      OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
      OTEL_RESOURCE_ATTRIBUTES: service.environment=local,demo.name=multi-service-observability
    ports:
      - "127.0.0.1:8082:8082"
    labels:
      observability.logs: "true"
      service.name: "axum-tools-random-api"
      service.environment: "local"
    extra_hosts:
      - host.docker.internal:host-gateway

  axum-tools-mcp:
    build:
      context: ./axum-tools-mcp
      dockerfile: Dockerfile
    container_name: axum-tools-mcp
    environment:
      AXUM_TOOLS_API_URL: http://axum-tools-random-api:8082
      OTEL_SERVICE_NAME: axum-tools-mcp
      OTEL_EXPORTER_OTLP_ENDPOINT: http://host.docker.internal:4318
      OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
      OTEL_RESOURCE_ATTRIBUTES: service.environment=local,demo.name=multi-service-observability
    ports:
      - "127.0.0.1:8092:8092"
    labels:
      observability.logs: "true"
      service.name: "axum-tools-mcp"
      service.environment: "local"
    extra_hosts:
      - host.docker.internal:host-gateway
    depends_on:
      - axum-tools-random-api
```

## Implementation Steps

1. Stabilize Rust routes
   - Change runtime port to `8082`.
   - Add `/health`.
   - Add `/recommendations`.
   - Keep `/movies` if useful.

2. Add poison pill
   - Read `X-Demo-Fault`.
   - Implement deterministic slow and error branches only in `/recommendations`.
   - Add logs and span attributes for the selected fault.

3. Add Rust OTel
   - Initialize tracing and OTLP exporter during startup.
   - Add request tracing middleware.
   - Ensure trace context extraction from inbound headers.
   - Ensure graceful tracer shutdown on process exit if practical.

4. Create FastMCP wrapper
   - Scaffold `axum-tools-mcp`.
   - Add `/mcp` server and `/health` route.
   - Implement `recommendation_get_movies`.

5. Instrument FastMCP wrapper
   - Add HTTPX instrumentation.
   - Add manual tool spans.
   - Add structured logs.

6. Dockerize both services
   - Add Dockerfiles.
   - Add Compose file.
   - Add Loki labels and OTel env vars.

7. Verify
   - `GET /health` returns 200.
   - `/recommendations` returns data.
   - `X-Demo-Fault: slow-recommendation` delays visibly.
   - `X-Demo-Fault: recommendation-error` returns 503.
   - MCP tool surfaces both normal and error behavior to the agent.

## Testing Strategy

Minimum Rust checks:

```sh
cargo fmt --check
cargo test
cargo clippy --all-targets --all-features
```

If clippy is not already installed or takes too long, document that and run:

```sh
cargo check
```

Minimum MCP checks:

- `/health` returns 200.
- Tool call to `recommendation_get_movies` returns recommendation data.
- Tool call with `fault=recommendation-error` returns a controlled tool error, not a process crash.

## Done Criteria

- Rust API runs on `8082`.
- FastMCP wrapper runs on `8092`.
- Poison pill works only in Rust API.
- Both services emit OTel traces.
- Both services emit structured stdout logs.
- Agent can call recommendation MCP tool.
- Slow and error paths are visible in Grafana.
