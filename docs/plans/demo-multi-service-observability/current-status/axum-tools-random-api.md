## axum-tools-random-api

Status: READY
Branch: demo-multi-service-observability
Latest commit: 3bd61f8 docs: document demo service runbook
Owner/agent: Codex

### What Works
- Rust Axum API runs on port `8082`.
- `GET /health` returns healthy JSON.
- `GET /movies` returns the seeded movie catalog.
- `GET /recommendations?limit=5&preference=...` returns deterministic heuristic-ranked recommendations.
- Seed data includes the movie reservation demo catalog and `movie_reservation_movie_id` mappings.
- `X-Demo-Fault: slow-recommendation` delays only the recommendation endpoint and then succeeds.
- `X-Demo-Fault: recommendation-error` returns HTTP 503 with compact JSON.
- Structured stdout logs include request ids, correlation ids, route, status, duration, and fault.
- Rust OpenTelemetry trace spans and custom metrics are wired for OTLP HTTP export when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
- Dockerfile and `docker-compose.yml` are present.

### How To Run
```sh
cd /home/patex1987/development/axum_tools_random_api
USE_DUMMY=true PORT=8082 cargo run
```

Or with Compose:

```sh
cd /home/patex1987/development/axum_tools_random_api
docker compose up --build axum-tools-random-api
```

### Health / Smoke Checks
```sh
curl -sS -i 'http://127.0.0.1:8082/health'
# expected: HTTP/1.1 200 OK with {"status":"ok","service_name":"axum-tools-random-api"}

curl -sS 'http://127.0.0.1:8082/recommendations?limit=2&preference=sci-fi'
# expected: JSON recommendations array with movie_reservation_movie_id values

curl -sS -i -H 'X-Demo-Fault: recommendation-error' 'http://127.0.0.1:8082/recommendations'
# expected: HTTP/1.1 503 Service Unavailable with error.code=recommendation_unavailable

time curl -sS -H 'X-Demo-Fault: slow-recommendation' 'http://127.0.0.1:8082/recommendations?limit=1'
# expected: successful JSON response after about 2 seconds
```

### Observability
- OTel service name: `axum-tools-random-api`
- Important spans/log fields: `http.request`, `recommendations.rank`, `recommendations.fault_delay`, `service_name`, `event`, `trace_id`, `correlation_id`, `request_id`, `fault`, `http_route`, `http_status`, `duration_ms`
- Grafana/Loki/Tempo expectations: Tempo should show inbound HTTP request spans and recommendation/fault child spans when OTLP is configured. Loki should show structured JSON stdout logs with the same correlation/request/fault fields. Custom metrics include request count, request duration, returned recommendation count, and fault count.

### Known Gaps
- Rust OTLP export is enabled when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; local no-collector runs intentionally skip exporter setup.
- No live reservation-service availability lookup; ranking uses deterministic local heuristics.

### Demo Risk
Low

### Needs From Other Repos
- Grafana/Tempo/Loki/OTel collector stack reachable at the configured OTLP endpoint.
- Movie reservation service should keep seeded movie ids aligned with this repo's `movie_reservation_movie_id` mappings.

## axum-tools-mcp

Status: READY
Branch: demo-multi-service-observability
Latest commit: 3bd61f8 docs: document demo service runbook
Owner/agent: Codex

### What Works
- Python FastMCP wrapper runs on port `8092` using `uv` and pyenv Python 3.12.
- `.python-version` pins the MCP package to Python `3.12` and the local environment was verified with pyenv Python `3.12.12`.
- `GET /health` returns MCP health plus downstream Rust API health.
- MCP HTTP transport is served at `/mcp`.
- `recommendation_get_movies` calls Rust `GET /recommendations`.
- `recommendation_health` calls Rust `GET /health`.
- Tool calls forward `traceparent`, `tracestate`, `X-Correlation-Id`, `X-Request-Id`, and `X-Demo-Fault`.
- `fault` input is propagated as `X-Demo-Fault` for the demo.
- Downstream Rust 503 errors are returned as compact `ok:false` tool payloads rather than separate wrapper failures.
- Structured stdout logs and Python OpenTelemetry setup are present.
- Dockerfile and Compose service are present.

### How To Run
```sh
cd /home/patex1987/development/axum_tools_random_api
USE_DUMMY=true PORT=8082 cargo run

cd /home/patex1987/development/axum_tools_random_api/axum-tools-mcp
AXUM_TOOLS_API_URL=http://127.0.0.1:8082 HOST=0.0.0.0 PORT=8092 uv run axum-tools-mcp
```

Or with Compose:

```sh
cd /home/patex1987/development/axum_tools_random_api
docker compose up --build
```

### Health / Smoke Checks
```sh
curl -sS -i 'http://127.0.0.1:8092/health'
# expected: HTTP/1.1 200 OK with status=ok and downstream.service_name=axum-tools-random-api

cd /home/patex1987/development/axum_tools_random_api/axum-tools-mcp
uv run python -c 'import asyncio; exec("""from fastmcp import Client

async def main():
    async with Client("http://127.0.0.1:8092/mcp") as client:
        result = await client.call_tool("recommendation_get_movies", {"limit": 2, "preference": "platform deployment demo"})
        print(result.data)

asyncio.run(main())
""")'
# expected: ok=true with recommendations such as Fargate at Midnight / The Type-Safe Matinee

uv run python -c 'import asyncio; exec("""from fastmcp import Client

async def main():
    async with Client("http://127.0.0.1:8092/mcp") as client:
        result = await client.call_tool("recommendation_get_movies", {"limit": 2, "fault": "recommendation-error"})
        print(result.data)

asyncio.run(main())
""")'
# expected: ok=false, status_code=503, error.code=recommendation_unavailable
```

### Observability
- OTel service name: `axum-tools-mcp`
- Important spans/log fields: `mcp.tool.recommendation_get_movies`, `mcp.tool.recommendation_health`, `mcp.tool.name`, `demo.fault`, `service_name`, `event`, `tool_name`, `fault`, `correlation_id`, `request_id`, `http_status`, `recommendation_count`
- Grafana/Loki/Tempo expectations: Tempo should show MCP tool spans and HTTPX downstream calls to the Rust API when OTLP is configured. Loki should show JSON tool start/success/failure logs. Metrics include MCP tool call count and duration.

### Known Gaps
- Local `uv` environment must use pyenv Python, not system Python. The package has `.python-version` set to `3.12`.
- No full agent end-to-end run was executed from this repo; MCP tool smoke was executed directly with a FastMCP client.

### Demo Risk
Low

### Needs From Other Repos
- Rust `axum-tools-random-api` reachable at `AXUM_TOOLS_API_URL`.
- Python agent repo must discover/call `http://127.0.0.1:8092/mcp` or the container service equivalent.
- Grafana/Tempo/Loki/OTel collector stack reachable at the configured OTLP endpoint.
