# Service Instructions: python-agent-with-idp

Repo:

```text
/home/patex1987/development/python-agent-with-idp
```

Required branch:

```text
demo-multi-service-observability
```

Required AI context:

- Planner skill: `/home/patex1987/development/golden-path-ecs-template/.ai/skills/principal-engineer-planner`
- Review agents: `/home/patex1987/development/golden-path-ecs-template/.ai/agents`

## Why This Work Exists

This repo provides the visible "agent" part of the demo. Its job is not to be a production agent platform tonight. Its job is to demonstrate a realistic multi-service control plane:

```text
client -> agent worker -> MCP tools -> service APIs -> traces/logs/metrics
```

The agent worker should make the demo feel like a modern internal-platform workflow: the agent loads skills, discovers tools from MCP servers, reasons through a simple ReAct loop, and executes the reservation workflow while preserving observability context.

## Scope

Create a demo-focused agent worker service using:

- FastAPI for the HTTP API.
- LangGraph for a simple ReAct loop.
- FastMCP client for MCP tool discovery and invocation.
- Hardcoded demo skills.
- OpenTelemetry for traces and metrics.

Avoid finishing unrelated existing domain work in the repo.

## Current State

The repo already has:

- FastAPI application structure under `llm_agent/llm_agent`.
- A Dockerfile in `llm_agent/Dockerfile`.
- Existing `llm_agent/core/telemetry.py`, currently only a stub.
- Existing `docker-compose.yml`.

## Required Design

### HTTP API

Expose:

```text
POST /api/v1/demo/reserve-recommended-seat
GET /api/v1/demo/health
```

Suggested request body:

```json
{
  "movie_preference": "something exciting",
  "seat_preference": "aisle",
  "fault": "none"
}
```

Supported `fault` values:

- `none`
- `slow-recommendation`
- `recommendation-error`

The endpoint should create or accept:

- `traceparent`
- `tracestate`
- `X-Correlation-Id`
- `X-Request-Id`

The endpoint must propagate those fields to MCP calls.

### MCP Tool Loading

Use FastMCP client connections to:

```text
http://movie-reservation-mcp:8091/mcp
http://axum-tools-mcp:8092/mcp
```

At startup or per request:

1. Connect to both MCP servers.
2. List available tools.
3. Convert the required tools into LangGraph-callable tool wrappers.

Minimum required tools:

- `recommendation_get_movies`
- `movie_list_screenings`
- `movie_request_reservation`
- `movie_get_reservation_status`
- `movie_get_reservation_result`

If FastMCP multi-server mounting or prefixing complicates the implementation, use two explicit clients and hardcoded wrappers around `client.call_tool(...)`. The demo needs reliable execution more than elegant dynamic tool loading.

### Hardcoded Skills

Create hardcoded skills in a small module, for example:

```text
llm_agent/demo/skills.py
```

Minimum skills:

- `reservation_demo_workflow`
  - Prefer recommended movie.
  - Pick the first available screening and seat.
  - Request reservation.
  - Poll status.
  - Return result.
- `observability_demo`
  - Preserve trace/correlation/request ids.
  - Report dependency failures clearly.
  - Include tool names and outcomes in logs.

The skills should be plain strings or dataclasses. They do not need a vector store.

### LangGraph ReAct Worker

Create a small agent graph under:

```text
llm_agent/demo/agent_worker.py
```

Required graph shape:

1. `load_context`
   - Builds workflow state from request, headers, skills, and MCP tool metadata.
2. `agent_reason`
   - Produces the next action.
   - Use a real chat model if configured.
   - Use a deterministic fallback planner if no API key is present.
3. `tool_call`
   - Calls the selected MCP tool.
4. `observe`
   - Stores tool output and logs `tool_result`.
5. `finalize`
   - Returns the final response.

Conditional edge:

- Continue tool loop until reservation is confirmed, rejected, failed, or max steps is reached.

Required state fields:

- `messages`
- `skills`
- `available_tools`
- `tool_results`
- `reservation_request_id`
- `reservation_status`
- `final_answer`
- `trace_context`
- `fault`

Do not let a missing LLM key block the demo. The fallback planner can hardcode the ReAct sequence:

```text
recommendation_get_movies -> movie_list_screenings -> movie_request_reservation -> movie_get_reservation_status -> movie_get_reservation_result
```

### Structured ReAct Logs

Emit one JSON log event per step:

- `agent.workflow.started`
- `agent.thought`
- `agent.tool_call.started`
- `agent.tool_call.completed`
- `agent.tool_call.failed`
- `agent.workflow.completed`
- `agent.workflow.failed`

Each log must include:

- `service_name=movie-agent-worker`
- `trace_id`
- `correlation_id`
- `request_id`
- `workflow_id`
- `step`
- `tool_name` when relevant
- `fault`
- `outcome`

### OpenTelemetry

Instrument:

- FastAPI inbound requests.
- HTTP client calls made by FastMCP/httpx.
- Manual spans around LangGraph nodes.
- Manual spans around MCP tool invocations.

Suggested dependencies:

- `langgraph`
- `langchain-core`
- `langchain-anthropic` or a configured model package if already preferred.
- `fastmcp`
- `opentelemetry-api`
- `opentelemetry-sdk`
- `opentelemetry-exporter-otlp-proto-http`
- `opentelemetry-instrumentation-fastapi`
- `opentelemetry-instrumentation-httpx`

Required env vars:

```text
OTEL_SERVICE_NAME=movie-agent-worker
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_RESOURCE_ATTRIBUTES=service.environment=local,demo.name=multi-service-observability
MOVIE_RESERVATION_MCP_URL=http://host.docker.internal:8091/mcp
AXUM_TOOLS_MCP_URL=http://host.docker.internal:8092/mcp
```

If running all services on one Docker network, use container DNS names instead of `host.docker.internal`.

### Dockerization

Update or add Compose service:

```yaml
movie-agent-worker:
  build:
    context: ./llm_agent
    dockerfile: Dockerfile
    target: prod
  container_name: movie-agent-worker
  ports:
    - "127.0.0.1:8081:8081"
  environment:
    PORT: "8081"
    OTEL_SERVICE_NAME: movie-agent-worker
    OTEL_EXPORTER_OTLP_ENDPOINT: http://host.docker.internal:4318
    OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
    OTEL_RESOURCE_ATTRIBUTES: service.environment=local,demo.name=multi-service-observability
    MOVIE_RESERVATION_MCP_URL: http://host.docker.internal:8091/mcp
    AXUM_TOOLS_MCP_URL: http://host.docker.internal:8092/mcp
  labels:
    observability.logs: "true"
    service.name: "movie-agent-worker"
    service.environment: "local"
  extra_hosts:
    - host.docker.internal:host-gateway
```

Adjust names and build targets to match the existing Dockerfile, but preserve port `8081`, labels, and OTel/MCP env vars.

## Implementation Steps

1. Add dependencies
   - Add LangGraph, FastMCP, model client, and OTel instrumentation dependencies.
   - Prefer the repo's existing package manager/lockfile conventions.

2. Implement telemetry
   - Replace the stub in `llm_agent/core/telemetry.py`.
   - Add FastAPI and HTTPX instrumentation.
   - Add helper functions for current trace id and span attributes.

3. Add demo API route
   - Add `POST /api/v1/demo/reserve-recommended-seat`.
   - Add `GET /api/v1/demo/health`.
   - Keep it isolated under `llm_agent/demo` or `llm_agent/api/http/v1/routes/demo.py`.

4. Add MCP client wrappers
   - Connect to both MCP servers.
   - Implement typed wrappers for each required tool.
   - Add timeout handling and controlled errors.

5. Add LangGraph worker
   - Build the graph with deterministic fallback.
   - Add max steps, for example 8.
   - Add explicit final states for success, dependency failure, reservation rejected, and timeout.

6. Add logs
   - Emit ReAct step logs with trace/correlation/request ids.
   - Log tool inputs only when safe; avoid logging auth tokens.

7. Dockerize
   - Update Compose and runtime config.
   - Add Loki labels.

8. Verify
   - Run health endpoint.
   - Call happy path.
   - Call with `fault=slow-recommendation`.
   - Call with `fault=recommendation-error`.
   - Confirm spans and logs in Grafana.

## Testing Strategy

Minimum tests:

- Unit test deterministic fallback planner sequence.
- Unit test request header propagation into MCP tool metadata.
- Smoke test route with mocked MCP wrappers.

Manual demo verification:

```sh
curl -sS http://127.0.0.1:8081/api/v1/demo/health
curl -sS http://127.0.0.1:8081/api/v1/demo/reserve-recommended-seat \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: demo-manual-001" \
  -H "X-Request-Id: demo-manual-001-request" \
  -d '{"movie_preference":"exciting","seat_preference":"aisle","fault":"none"}'
```

## Done Criteria

- Agent starts on `8081`.
- Agent loads hardcoded skills.
- Agent calls both MCP servers.
- Agent uses a LangGraph ReAct-style loop, even when deterministic fallback is active.
- Happy path completes through MCP tools.
- Slow and error poison-pill paths produce visible spans/logs.
- No real LLM key is required for the demo to work.
