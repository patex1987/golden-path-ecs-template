# Execution Plan: Movie Reservation MCP Wrapper

## 1. Summary

Add a demo-focused `movie-reservation-mcp` Python service to this repository. The service wraps the existing NestJS GraphQL movie reservation API with FastMCP tools, forwards observability headers, emits OpenTelemetry spans and structured logs, and runs in Docker Compose beside the existing API.

This keeps the movie service as the business source of truth and makes the MCP service an adapter. That is the same boundary as a Python client library around a service API: useful for agents, but not owner of domain rules.

## 2. Goals

- Keep the existing `movie-reservation-service` GraphQL contract unchanged.
- Add `movie-reservation-mcp` under `movie-reservation-mcp/`.
- Expose MCP over HTTP on port `8091`.
- Add a `/health` endpoint for Docker health checks and manual smoke checks.
- Implement tools for `me`, `movies`, `screenings`, reservation request, reservation status, and reservation result.
- Preserve `traceparent`, `tracestate`, `X-Correlation-Id`, `X-Request-Id`, and `X-Demo-Fault`.
- Emit spans and structured JSON logs for tool calls and downstream GraphQL calls.
- Add Docker Compose wiring and Loki labels.

## 3. Non-goals

- No GraphQL schema redesign.
- No poison-pill fault injection in this repo.
- No frontend integration in this slice.
- No production auth or secret management.
- No dynamic schema introspection/code generation.

## 4. Current State

- `docker-compose.yml` already runs `postgres`, `otel-collector`, and `api`.
- The API publishes host port `3001` and listens on Compose port `3000`.
- `movie-reservation-service/schema.gql` exposes the required operations.
- `movie-reservation-service/env_files/templates/in-docker/local-postgres.env.template` already sets `OTEL_SERVICE_NAME=movie-reservation-service` and OTLP HTTP endpoint `http://otel-collector:4318`.
- `movie-reservation-service/src/infrastructure/observability/instrumentation.ts` already initializes OpenTelemetry for the NestJS service.

## 5. Requirements and Assumptions

### Confirmed Requirements

- Use FastMCP.
- Use `uv` for Python dependency management and Docker builds.
- Dockerize the MCP server.
- Instrument the MCP server with OTel.
- Preserve the movie service API.
- Add a health endpoint.
- Make the service reachable by future LangGraph agent work.

### Assumptions

- The Python package can use Python 3.12.
- The MCP server can use FastMCP streamable HTTP transport at `/mcp`.
- The local demo bearer token is `local-demo-token`.
- In Docker Compose, the GraphQL URL is `http://api:3000/graphql`.
- Host-run local fallback can use `http://127.0.0.1:3001/graphql`.

### Open Questions

- Exact FastMCP version and runtime API may need final validation during dependency install/build.
- The future agent may pass observability metadata either as MCP tool arguments or transport metadata. This implementation supports explicit tool arguments because that is the simplest stable demo contract.

## 6. Proposed Design

Create a small Python package:

```text
movie-reservation-mcp/
  Dockerfile
  README.md
  pyproject.toml
  uv.lock
  src/movie_reservation_mcp/
    __init__.py
    __main__.py
    config.py
    graphql_client.py
    logging.py
    server.py
    telemetry.py
  tests/
    test_graphql_client.py
```

Responsibilities:

- `config.py`: environment parsing.
- `graphql_client.py`: builds GraphQL operation payloads, forwards headers, parses GraphQL envelopes.
- `server.py`: FastMCP server and tool registration.
- `telemetry.py`: OTel SDK setup and helper span context functions.
- `logging.py`: JSON stdout log setup and helper.

The explicit metadata fields on each tool keep context propagation boring and testable. The future agent can map request headers into these fields before calling MCP tools.

## 7. Alternatives Considered

### Alternative A: Add MCP directly inside NestJS

- Pros: one runtime and one container.
- Cons: not FastMCP, mixes agent integration into service runtime, less useful for Python-agent demo.
- Decision: rejected.

### Alternative B: Full dynamic GraphQL-to-MCP generator

- Pros: more flexible and impressive.
- Cons: too risky for overnight demo, harder to explain and test.
- Decision: rejected.

### Alternative C: Thin hand-written Python FastMCP adapter

- Pros: fast, explicit, easy to debug, mirrors the exact demo workflow.
- Cons: duplicates GraphQL operation strings.
- Decision: accepted.

## 8. API / Interface Changes

New MCP service:

- HTTP MCP endpoint: `/mcp`
- Health endpoint: `/health`

New tools:

- `movie_me`
- `movie_list_movies`
- `movie_list_screenings`
- `movie_request_reservation`
- `movie_get_reservation_status`
- `movie_get_reservation_result`

Common optional tool metadata:

- `traceparent`
- `tracestate`
- `correlation_id`
- `request_id`
- `demo_fault`

## 9. Data Model / Persistence Changes

None.

## 10. Security, Privacy, and Abuse Considerations

- Do not log bearer tokens.
- Keep the local demo token in environment variables.
- Do not accept arbitrary GraphQL query strings from MCP callers.
- Tool inputs are narrow and mapped to fixed GraphQL operation strings.
- This is a local demo service, not a public endpoint.

## 11. Performance, Scalability, and Reliability Considerations

- Use one HTTPX async client per tool call for simplicity. A shared client can be added later if needed.
- Add request timeout configuration.
- Keep GraphQL errors as controlled tool failures with useful logs.
- Do not introduce retries tonight; retries can hide the poison-pill behavior used by the demo.

## 12. Implementation Steps

1. Scaffold MCP package.
   - Change: Add `movie-reservation-mcp` package files.
   - Verification: import/package syntax check.

2. Implement GraphQL client.
   - Change: Fixed operation helpers and header propagation.
   - Verification: unit tests for request body/header construction.

3. Implement FastMCP tools.
   - Change: Register six tools and `/health`.
   - Verification: local import check and later MCP client smoke.

4. Add telemetry and logs.
   - Change: OTel bootstrap, HTTPX instrumentation, manual tool spans, JSON logs.
   - Verification: spans visible after running with collector; logs parse in Loki.

5. Dockerize and Compose wire.
   - Change: Dockerfile and `movie-reservation-mcp` service in `docker-compose.yml`.
   - Verification: container starts, `/health` returns 200.

6. Document run/smoke workflow.
   - Change: README with local commands and expected environment.
   - Verification: commands match package/Compose files.

## 13. Testing Strategy

Minimum:

- Unit tests for GraphQL client request body/header construction and GraphQL envelope error handling.
- `uv run --python 3.12.12 python -m compileall src tests scripts` from `movie-reservation-mcp/`.
- `npm -w movie-reservation-service run typecheck`.

If dependencies can be installed:

- Run local Python commands through `uv` with the pyenv-managed `3.12.12` interpreter, for example `uv run --python 3.12.12 pytest`.
- Docker build for `movie-reservation-mcp`.
- Compose health check.

## 14. Rollout / Migration Plan

- Add as a new Compose profile service. Existing API behavior remains unchanged.
- If MCP fails, the movie service and current observability demo still run.
- Rollback is deleting the new package and Compose service.

## 15. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---:|---:|---|
| FastMCP runtime API mismatch | High | Medium | Keep service code isolated and validate with dependency install/build as soon as possible. |
| Python dependencies unavailable offline | Medium | Medium | Still add package metadata and compile local code; `uv sync`/Docker build can fetch dependencies when network is allowed. |
| Agent metadata shape changes | Medium | Medium | Use explicit optional context fields; easy for the agent to map. |
| GraphQL token/config mismatch | Medium | Low | Default to local demo token and make env vars explicit. |

## 16. Done Criteria

- `movie-reservation-mcp` files exist and are documented.
- `docker-compose.yml` includes the MCP service with port `8091`, labels, and OTel env vars.
- GraphQL client tests or compile checks pass.
- NestJS typecheck still passes.
- Any dependency/build blockers are recorded clearly.
