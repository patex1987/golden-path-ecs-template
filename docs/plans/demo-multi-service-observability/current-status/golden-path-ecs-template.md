# golden-path-ecs-template Status

Status: READY
Branch: demo-multi-service-observability
Repo path: `/home/patex1987/development/golden-path-ecs-template`
Owner/agent: Codex
Last validated: 2026-06-11 Europe/Bratislava

## Summary

This repo now owns the movie reservation API, the movie reservation FastMCP adapter, and the React demo frontend for the final multi-service observability demo.

The frontend no longer shows the local diagnostic panel. It now has an agent panel that calls the Python agent, keeps the frontend correlation boundary visible, offers prompt chips for the three demo scenarios, and displays the agent result, workflow id, trace id, request id, tool results, and error details. The seat map reads real backend reservation state and visually blocks already-reserved seats.

## What Works

- `movie-reservation-service` GraphQL API exposes `Seat.isReserved`.
- Confirmed reservations are read from Postgres/in-memory repositories and mapped into screening seats.
- Seeded Type-Safe Matinee seats A1 and A2 show as blocked; A3 remains available.
- `movie-reservation-mcp` FastMCP service requests `isReserved` from GraphQL and remains compatible with the agent.
- Docker Compose `demo` profile runs Postgres, OTel collector, API, and MCP service.
- `movie-reservation-web` calls the Python agent through `/api/v1/demo`.
- Frontend sends `traceparent`, `X-Correlation-Id`, `X-Request-Id`, and `X-Demo-Fault` to the agent.
- The agent panel prompt chips cover happy path, slow recommendation, and dependency failure.
- The frontend correlation boundary is prominent and copyable.
- Reserved seats are disabled in the seat map and excluded from manual reservation submission.
- The Vite dev proxy forwards `/graphql` to the movie API and `/api/v1/demo` to the Python agent.

## How To Run

From `/home/patex1987/development/golden-path-ecs-template`:

```sh
docker compose up -d postgres
npm -w movie-reservation-service run db:migrate:local-postgres
npm -w movie-reservation-service run db:seed:local-postgres
docker compose --profile demo up -d --build otel-collector api movie-reservation-mcp
npm -w movie-reservation-web run dev
```

Useful endpoints:

```text
Movie API health: http://127.0.0.1:3001/health
Movie MCP health: http://127.0.0.1:8091/health
Movie MCP endpoint: http://127.0.0.1:8091/mcp
Frontend: http://127.0.0.1:5173
Frontend agent proxy: http://127.0.0.1:5173/api/v1/demo/health
OTel HTTP collector: http://127.0.0.1:14318
```

Important Docker detail:

- The movie MCP port must be reachable from the Python agent container through `host.docker.internal:8091`.
- Binding `8091` only to `127.0.0.1` is not enough for the agent container on this host.

## Health / Smoke Checks

```sh
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:8091/health
curl -fsS http://127.0.0.1:5173/
curl -fsS http://127.0.0.1:5173/api/v1/demo/health
```

Seat availability smoke:

```sh
curl -fsS -X POST http://127.0.0.1:3001/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { movies { title screenings { title seats { rowNumber seatNumber isReserved } } } }"}'
```

Expected for the seeded Type-Safe Matinee screening:

- A1: `isReserved=true`
- A2: `isReserved=true`
- A3: `isReserved=false`

## Verification Already Run

```sh
npm -w movie-reservation-service run typecheck
npm -w movie-reservation-service test -- test/integration/api/graphql.test.ts test/integration/schema/schema.test.ts test/integration/infrastructure/in-memory-movie-reservation.repository.test.ts
npm -w movie-reservation-service run build
```

Result:

- Typecheck passed.
- 3 focused service test files passed, 29 tests total.
- Service build passed.

```sh
npm -w movie-reservation-web run typecheck
npm -w movie-reservation-web test -- src/platform/api/agent-client.test.ts src/features/movie-reservations/adapters/graphql/parsers/movie-reservation-api-parsers.test.ts src/features/movie-reservations/domain/movie-reservation-domain.test.ts
npm -w movie-reservation-web run build
```

Result:

- Typecheck passed.
- 3 focused web test files passed, 14 tests total.
- Web build passed.

```sh
cd /home/patex1987/development/golden-path-ecs-template/movie-reservation-mcp
uv run --python 3.12.12 pytest
```

Result:

- 6 MCP tests passed.

## Integrated Smoke Results

The full stack was run with Grafana, movie API, movie MCP, recommendation API, recommendation MCP, Python agent, and the Vite frontend.

Known-good calls:

| Scenario | Correlation id | Result | Trace id |
| --- | --- | --- | --- |
| Happy path | `smoke-happy-frontend-agent-2` | HTTP 200, confirmed reservation `b1546f5a-4d93-4be3-b77c-ba8eabb80b37` | `be00c2b9b92f0bce768eab4eb46f4743` |
| Slow dependency | `smoke-slow-frontend-agent-1` | HTTP 200 after about 2.8s, confirmed reservation `887cd0e7-e0d5-4026-a307-5b0f67ad3b92` | `575b6a6e0dc370965ecf243bc7c361ec` |
| Dependency error | `smoke-error-labelled-agent-1` | HTTP 502, `error=demo_dependency_failed` | `62c3696fc73772228537b8003e2f4e9e` |

## Observability

- API OTel service name: `movie-reservation-service`
- MCP OTel service name: `movie-reservation-mcp`
- Frontend carries a workflow-level correlation id into GraphQL and agent calls.
- MCP forwards these fields to GraphQL:
  - `traceparent`
  - `tracestate`
  - `X-Correlation-Id`
  - `X-Request-Id`
  - `X-Demo-Fault`
- MCP emits manual spans named `mcp.tool.<tool_name>`.
- HTTPX instrumentation emits downstream GraphQL client spans.
- Compose labels include `observability.logs=true`, `service.name`, and `service.environment`.

## Known Gaps

- The agent panel is intentionally demo-grade: no streaming chat, no persistent conversation history, and no auth.
- `Seat.isReserved` is a pragmatic demo read model, not a full long-term seat-availability API.
- The saturation dashboard row remains a placeholder/proxy row for this demo.

## Demo Risk

Low.

Main risk is stale seed data from repeated rehearsal reservations. Rerun the DB seed before the live demo if the blocked-seat state becomes confusing.

## Needs From Other Repos

- `python-agent-with-idp` should call `http://host.docker.internal:8091/mcp` from Docker.
- `axum-tools-mcp` should be reachable from the agent at `http://host.docker.internal:8092/mcp`.
- Grafana stack should be running before demo traffic so traces/logs are captured.
