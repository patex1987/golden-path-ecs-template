# Demo Plan: Multi-Service Observability

Branch for every repo:

```text
demo-multi-service-observability
```

This folder contains per-repository implementation instructions for the 2026-06-11 demo.

Repos:

- `/home/patex1987/development/golden-path-ecs-template`
- `/home/patex1987/development/python-agent-with-idp`
- `/home/patex1987/development/axum_tools_random_api`
- `/home/patex1987/development/fastapi_otel_prometheus_grafana_poc`

Shared AI context paths that every implementing agent should read:

- Planner skill: `/home/patex1987/development/golden-path-ecs-template/.ai/skills/principal-engineer-planner`
- Review agents: `/home/patex1987/development/golden-path-ecs-template/.ai/agents`

## Target Demo Story

A user asks the Python agent to reserve a recommended movie seat.

1. The agent worker runs a simple LangGraph ReAct loop.
2. The agent loads hardcoded demo skills and discovers tools from two FastMCP servers.
3. The recommendation MCP server wraps the Rust Axum recommendation API.
4. The movie-reservation MCP server wraps the NestJS GraphQL movie reservation API.
5. The agent calls recommendation, catalog, reservation, polling, and result tools.
6. The Rust recommendation API contains the single poison-pill fault source for delay/error anomalies.
7. Grafana shows golden signals, trace-derived graphs, log-derived graphs, trace/log navigation, and recent failures.

## Services

| Service | Repo | Role | Port |
| --- | --- | --- | --- |
| `movie-reservation-service` | `golden-path-ecs-template` | Existing NestJS GraphQL API | `3001` |
| `movie-reservation-mcp` | `golden-path-ecs-template` | FastMCP wrapper around GraphQL API | `8091` |
| `movie-reservation-web` | `golden-path-ecs-template` | Dependent React UI that can invoke the agent once ready | `5173` |
| `movie-agent-worker` | `python-agent-with-idp` | FastAPI + LangGraph ReAct worker | `8081` |
| `axum-tools-random-api` | `axum_tools_random_api` | Rust recommendation API and poison-pill dependency | `8082` |
| `axum-tools-mcp` | `axum_tools_random_api` | FastMCP wrapper around recommendation API | `8092` |
| `grafana-stack` | `fastapi_otel_prometheus_grafana_poc` | Grafana, Prometheus, Loki, Tempo, Alloy, OTel collector | `3000`, `4317`, `4318` |

## Current Readiness Snapshot

Source of truth for current repo-level reports:

- [current-status/golden-path-ecs-template.md](current-status/golden-path-ecs-template.md)
- [current-status/python-agent-with-idp.md](current-status/python-agent-with-idp.md)
- [current-status/axum-tools-random-api.md](current-status/axum-tools-random-api.md)
- [current-status/fastapi_otel_prometheus_grafana_poc.md](current-status/fastapi_otel_prometheus_grafana_poc.md)
- [current-status/final-integrated-smoke.md](current-status/final-integrated-smoke.md)

As of the final smoke pass:

| Slice | Status | Demo risk | What this means |
| --- | --- | --- | --- |
| `movie-reservation-service` + `movie-reservation-mcp` | READY | Low | GraphQL now exposes blocked seats and the MCP endpoint is reachable from the agent container. |
| `axum-tools-random-api` | READY | Low | Recommendation API, deterministic data, slow fault, error fault, traces, metrics, and logs are implemented. |
| `axum-tools-mcp` | READY | Low | FastMCP wrapper on `8092` can call the Rust recommendation API and propagate demo fault/context headers. |
| `grafana-stack` | READY | Low | Dashboard is provisioned in Grafana and Loki/Tempo ingestion was verified with real demo traffic. |
| `movie-agent-worker` | READY | Low | Agent API, LangGraph worker, MCP clients, OTel, Docker runtime, happy path, slow path, and controlled dependency error were smoke-tested. |
| `movie-reservation-web` frontend | READY | Low | The diagnostics panel is replaced by an agent panel with prompt chips, a visible correlation boundary, and blocked-seat visualization. |

Overall state: the demo path is ready for rehearsal. Keep the start order below, then use [final-demo-runbook.md](final-demo-runbook.md) for the exact smoke and presentation flow.

## Immediate Critical Path

Do these in order for rehearsal or the live demo.

1. Start the observability stack.
   - Repo: `/home/patex1987/development/fastapi_otel_prometheus_grafana_poc`
   - Command: `docker compose up -d`
   - Verify Grafana, Prometheus, Loki, Tempo, and the collector are reachable.

2. Start the movie reservation API and MCP wrapper.
   - Repo: `/home/patex1987/development/golden-path-ecs-template`
   - Commands:

```sh
docker compose up -d postgres
npm -w movie-reservation-service run db:migrate:local-postgres
npm -w movie-reservation-service run db:seed:local-postgres
docker compose --profile demo up -d --build otel-collector api movie-reservation-mcp
```

3. Start the recommendation API and MCP wrapper.
   - Repo: `/home/patex1987/development/axum_tools_random_api`
   - Command: `docker compose up --build`

4. Start the Python agent.
   - Repo: `/home/patex1987/development/python-agent-with-idp`
   - Command:

```sh
docker compose up --build movie-agent-worker
```

5. Run agent-level E2E smoke tests.

```sh
curl -fsS http://127.0.0.1:8081/api/v1/demo/health

curl -fsS -X POST http://127.0.0.1:8081/api/v1/demo/reserve-recommended-seat \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: demo-corr-happy-1' \
  -H 'X-Request-Id: demo-req-happy-1' \
  -d '{"movie_preference":"exciting","seat_preference":"aisle","fault":"none"}'

curl -fsS -X POST http://127.0.0.1:8081/api/v1/demo/reserve-recommended-seat \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: demo-corr-slow-1' \
  -H 'X-Request-Id: demo-req-slow-1' \
  -d '{"movie_preference":"exciting","seat_preference":"aisle","fault":"slow-recommendation"}'

curl -sS -i -X POST http://127.0.0.1:8081/api/v1/demo/reserve-recommended-seat \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: demo-corr-error-1' \
  -H 'X-Request-Id: demo-req-error-1' \
  -d '{"movie_preference":"exciting","seat_preference":"aisle","fault":"recommendation-error"}'
```

Expected:

- Health returns `{"status":"ok","service":"movie-agent-worker"}`.
- Happy path returns HTTP 200 with a completed or confirmed reservation outcome.
- `slow-recommendation` returns success after a visible delay.
- `recommendation-error` returns a controlled dependency-failure response, not an unhandled 500.
- Logs and traces contain the supplied `correlation_id`, `request_id`, and `fault`.

6. Open the frontend.
   - Repo: `/home/patex1987/development/golden-path-ecs-template`
   - Command: `npm -w movie-reservation-web run dev`
   - URL: `http://127.0.0.1:5173`
   - Use the prompt chips in the agent panel for happy, slow, and failing dependency flows.

7. Open Grafana and verify the dashboard with real traffic.
   - URL: `http://localhost:3000`
   - Login: `admin` / `admin`
   - Dashboard: `Multi-Service Reservation Demo`
   - Check that service logs appear in Loki and traces appear in Tempo for the three agent calls above.

## Final Smoke Handles

These are known-good examples from the integrated stack:

| Scenario | Correlation id | Trace id | Result |
| --- | --- | --- | --- |
| Happy path | `smoke-happy-frontend-agent-2` | `be00c2b9b92f0bce768eab4eb46f4743` | Confirmed reservation. |
| Slow dependency | `smoke-slow-frontend-agent-1` | `575b6a6e0dc370965ecf243bc7c361ec` | Confirmed reservation after about 2.8s. |
| Dependency error | `smoke-error-labelled-agent-1` | `62c3696fc73772228537b8003e2f4e9e` | Controlled HTTP 502 with `demo_dependency_failed`. |

## Shared Runtime Contract

Headers to preserve across all service calls:

- `traceparent`
- `tracestate`
- `X-Correlation-Id`
- `X-Request-Id`
- `X-Demo-Fault`

Poison-pill fault values:

- `none`
- `slow-recommendation`
- `recommendation-error`

The poison pill belongs only in `axum-tools-random-api`. Other services must propagate the header and report the fault in spans/logs, but should not introduce additional random failures.

OpenTelemetry defaults:

```text
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=none
OTEL_RESOURCE_ATTRIBUTES=service.environment=local,demo.name=multi-service-observability
```

Every container that should be visible in Loki must have Docker labels:

```yaml
labels:
  observability.logs: "true"
  service.name: "<service-name>"
  service.environment: "local"
```

## Plan Files

- [final-demo-runbook.md](final-demo-runbook.md)
- [final-demo-runbook-and-frontend-agent-panel.md](final-demo-runbook-and-frontend-agent-panel.md)
- [golden-path-ecs-template.md](golden-path-ecs-template.md)
- [frontend-agent-integration.md](frontend-agent-integration.md)
- [python-agent-with-idp.md](python-agent-with-idp.md)
- [axum-tools-random-api.md](axum-tools-random-api.md)
- [fastapi-otel-prometheus-grafana-poc.md](fastapi-otel-prometheus-grafana-poc.md)

## Frontend Workstream

The React frontend integration is complete for the demo branch.

- The browser calls the agent through the Vite proxy at `/api/v1/demo`.
- The agent panel preserves the frontend workflow correlation id and creates a fresh request id per agent call.
- Prompt chips drive the three demo scenarios: happy path, slow dependency, and dependency failure.
- The "Correlation boundary" strip is the business workflow id to search in Loki/Grafana.
- The trace id remains the technical execution join key for Tempo.
- Confirmed seats are rendered as blocked and cannot be selected.

## Reference Docs Used

- FastMCP server, tools, HTTP transport, and custom-route behavior: `https://gofastmcp.com/servers/server`
- FastMCP HTTP runtime behavior and `/mcp` endpoint: `https://gofastmcp.com/deployment/running-server`
- FastMCP OpenTelemetry behavior and custom spans: `https://gofastmcp.com/servers/telemetry`
- LangGraph Graph API ReAct loop structure: `https://docs.langchain.com/oss/python/langgraph/quickstart`

## Minimum End-to-End Done Criteria

- `movie-reservation-service`, `movie-reservation-mcp`, `movie-agent-worker`, `axum-tools-random-api`, and `axum-tools-mcp` all emit OTel traces.
- All services emit structured stdout logs with `service_name`, `trace_id`, `correlation_id`, `request_id`, and `event`.
- The agent can complete one happy-path reservation workflow through MCP tools.
- After dependency gate completion, the frontend can invoke the agent workflow and preserve trace/correlation/request context.
- The agent can trigger `slow-recommendation` and show slow spans/logs.
- The agent can trigger `recommendation-error` and show failed dependency spans/logs.
- Grafana has four collapsible golden-signal sections.
- Each golden-signal section includes at least one Prometheus metric panel and at least one graph/table derived from Tempo traces or Loki logs.

## Current Go / No-Go Criteria

Go for the demo only when these checks pass in the final rehearsal:

- All service health endpoints return 200.
- One happy-path agent call completes through both MCP servers.
- One `slow-recommendation` call produces a visibly slower recommendation span.
- One `recommendation-error` call produces a controlled failed dependency span/log, not an unhandled crash.
- Grafana dashboard opens and shows the four collapsible golden-signal rows.
- At least one trace can be opened in Tempo and connected to Loki logs by `trace_id` or `correlation_id`.
- The frontend either successfully invokes the agent or is explicitly skipped in favor of curl-driven demo traffic.
