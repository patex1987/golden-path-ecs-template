## python-agent-with-idp

Status: READY
Branch: demo-multi-service-observability
Repo path: `/home/patex1987/development/python-agent-with-idp`
Owner/agent: Codex
Last validated: 2026-06-11 Europe/Bratislava

### Summary

The Python agent is ready for the demo. It exposes the demo API, runs a LangGraph-based reservation workflow, calls both FastMCP services, propagates trace/correlation/request/fault context, skips seats that are already reserved, and emits telemetry/logs under `movie-agent-worker`.

### What Works

- FastAPI control plane and demo agent worker run in one Docker service.
- Demo API route exists at `/api/v1/demo/reserve-recommended-seat`.
- Public demo health route exists at `/api/v1/demo/health`.
- Demo worker runtime lives under `llm_agent/agent_run_worker/demo`.
- Worker uses a LangGraph workflow with deterministic fallback planning.
- Worker loads packaged static skills from standardized `SKILL.md` files.
- MCP client discovers allowlisted tools and calls both MCP services.
- Trace, correlation, request, and fault context are propagated into MCP calls.
- Agent seat selection skips `isReserved=true` seats from the movie catalog.
- Docker service runs on host port `8081`.
- Compose labels expose the service in Loki as `service_name=movie-agent-worker`.
- OpenTelemetry instrumentation includes FastAPI, HTTPX, manual agent spans, OpenRouter model spans, MCP spans, structured logs, counters, and duration histograms.

### How To Run

```sh
cd /home/patex1987/development/python-agent-with-idp
docker compose up -d --build movie-agent-worker
```

Important Docker details:

- Compose must set `UVICORN_PORT=8081`; the env file may define `UVICORN_PORT=8080`, and the app prefers `UVICORN_PORT` over `PORT`.
- The agent container calls MCP services through:
  - `http://host.docker.internal:8091/mcp`
  - `http://host.docker.internal:8092/mcp`
- Those MCP ports must be published on the Docker host interface, not only loopback.
- For OpenRouter reasoning, keep the configured key/model in the repo's ignored env file.

### Health / Smoke Checks

```sh
curl -fsS http://127.0.0.1:8081/api/v1/demo/health

curl -fsS -X POST http://127.0.0.1:8081/api/v1/demo/reserve-recommended-seat \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: demo-corr-happy-1' \
  -H 'X-Request-Id: demo-req-happy-1' \
  -d '{"movie_preference":"exciting platform movie","seat_preference":"aisle","fault":"none"}'

time curl -fsS -X POST http://127.0.0.1:8081/api/v1/demo/reserve-recommended-seat \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: demo-corr-slow-1' \
  -H 'X-Request-Id: demo-req-slow-1' \
  -d '{"movie_preference":"exciting platform movie","seat_preference":"aisle","fault":"slow-recommendation"}'

curl -sS -i -X POST http://127.0.0.1:8081/api/v1/demo/reserve-recommended-seat \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: demo-corr-error-1' \
  -H 'X-Request-Id: demo-req-error-1' \
  -d '{"movie_preference":"exciting platform movie","seat_preference":"aisle","fault":"recommendation-error"}'
```

Expected:

- Health returns `{"status":"ok","service":"movie-agent-worker"}`.
- Happy path returns HTTP 200 with `outcome=confirmed`.
- Slow path returns HTTP 200 after a visible delay.
- Error path returns controlled HTTP 502 with `error=demo_dependency_failed`.

### Verification Already Run

```sh
cd /home/patex1987/development/python-agent-with-idp/llm_agent
uv run pytest -q tests/unit/demo/test_agent_worker.py
```

Result:

- 3 focused demo worker tests passed, including a reserved-seat skip check.

### Integrated Smoke Results

| Scenario | Correlation id | Result | Trace id |
| --- | --- | --- | --- |
| Happy path | `smoke-happy-frontend-agent-2` | HTTP 200, confirmed reservation `b1546f5a-4d93-4be3-b77c-ba8eabb80b37` | `be00c2b9b92f0bce768eab4eb46f4743` |
| Slow dependency | `smoke-slow-frontend-agent-1` | HTTP 200 after about 2.8s, confirmed reservation `887cd0e7-e0d5-4026-a307-5b0f67ad3b92` | `575b6a6e0dc370965ecf243bc7c361ec` |
| Dependency error | `smoke-error-labelled-agent-1` | HTTP 502, `error=demo_dependency_failed` | `62c3696fc73772228537b8003e2f4e9e` |

### Observability

- OTel service name: `movie-agent-worker`
- Important spans/log fields: `agent.workflow`, `agent.load_context`, `agent.reason`, `agent.tool_call`, `agent.observe`, `agent.finalize`, `llm.openrouter.chat_completion`, `mcp.tool.<tool_name>`, `trace_id`, `correlation_id`, `request_id`, `workflow_id`, `step`, `fault`, `outcome`, `tool_name`, `demo.workflow_id`, `demo.fault`, `demo.step`, `llm.provider`, `llm.request.model`, `llm.response.model`, `mcp.server.name`, `mcp.server.url`
- Loki query for `{service_name="movie-agent-worker"} |= "smoke-error-labelled-agent-1"` returned the agent error log.
- Tempo shows the agent root workflow plus MCP and downstream service spans when queried by trace id.

### Known Gaps

- The agent uses deterministic MCP execution with optional OpenRouter reasoning. It does not use provider-native LLM tool calling.
- `uv run ruff check .` cannot run unless Ruff is installed in the current project environment.
- The worktree contains uncommitted demo fixes.

### Demo Risk

Low.

Main risk is Docker reachability to host-published MCP ports. If the agent reports connection failures, verify `8091` and `8092` are reachable from inside the container and are not bound only to `127.0.0.1`.

### Needs From Other Repos

- `golden-path-ecs-template / movie-reservation-mcp` running and reachable at `http://host.docker.internal:8091/mcp` from Docker.
- `axum-tools-mcp` running and reachable at `http://host.docker.internal:8092/mcp` from Docker.
- `axum-tools-random-api` available behind `axum-tools-mcp`.
- Grafana/Tempo/Loki/OTel collector stack running before traffic if traces/logs must be captured.
- Seeded/healthy movie reservation backing services so the demo request can return a confirmed reservation.
