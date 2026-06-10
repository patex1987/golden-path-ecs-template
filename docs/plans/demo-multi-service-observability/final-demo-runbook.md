# Final Demo Runbook: Multi-Service Observability

Use this runbook for the final rehearsal and the live demo. It assumes all repos are on branch `demo-multi-service-observability`.

## 0. Preflight

This demo uses one browser frontend plus five service containers and the observability stack. Start them in the order below.

Important local Docker details:

- The Python agent container calls the two MCP servers through `host.docker.internal`.
- The MCP servers on `8091` and `8092` must be published on the Docker host interface, not only `127.0.0.1`, or the agent container cannot reach them.
- The Python agent compose service must run on `8081`; set `UVICORN_PORT=8081` in the compose environment because the repo env file may also define `UVICORN_PORT`.
- Containers that should appear in Loki need these labels: `observability.logs=true`, `service.name=<service-name>`, and `service.environment=local`.

## 1. Start Order

### 1. Grafana stack

```sh
cd /home/patex1987/development/fastapi_otel_prometheus_grafana_poc
docker compose up -d
```

Verify:

```sh
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:9090/-/ready
curl -fsS http://127.0.0.1:3200/ready
curl -fsS http://127.0.0.1:3100/ready
```

Grafana:

```text
http://127.0.0.1:3000
admin / admin
Dashboard: Multi-Service Reservation Demo
```

### 2. Movie reservation API and MCP

```sh
cd /home/patex1987/development/golden-path-ecs-template
docker compose up -d postgres
npm -w movie-reservation-service run db:migrate:local-postgres
npm -w movie-reservation-service run db:seed:local-postgres
docker compose --profile demo up -d --build otel-collector api movie-reservation-mcp
```

Verify:

```sh
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:8091/health
```

### 3. Recommendation API and MCP

```sh
cd /home/patex1987/development/axum_tools_random_api
docker compose up -d --build
```

Verify:

```sh
curl -fsS http://127.0.0.1:8082/health
curl -fsS http://127.0.0.1:8092/health
```

### 4. Python agent

Make sure `/home/patex1987/development/python-agent-with-idp/configuration/env_files/in-docker/local-production.env` contains the local demo settings and any OpenRouter key needed by that repo.

```sh
cd /home/patex1987/development/python-agent-with-idp
docker compose up -d --build movie-agent-worker
```

Verify:

```sh
curl -fsS http://127.0.0.1:8081/api/v1/demo/health
```

### 5. Frontend

```sh
cd /home/patex1987/development/golden-path-ecs-template
mkdir -p movie-reservation-web/env_files/local
cp movie-reservation-web/env_files/templates/local/local-dev.env.template movie-reservation-web/env_files/local/local-dev.env
npm -w movie-reservation-web run dev
```

Open:

```text
http://127.0.0.1:5173
```

The frontend proxies:

- `/graphql` to `http://127.0.0.1:3001`
- `/api/v1/demo` to `http://127.0.0.1:8081`

## 2. Validated Smoke Results

The integrated stack was smoke-tested with the frontend, agent, both MCP servers, the movie API, recommendation API, Grafana stack, Loki, and Tempo running.

Known-good handles from the smoke run:

| Scenario | Correlation id | Expected result | Trace id |
| --- | --- | --- | --- |
| Happy path | `smoke-happy-frontend-agent-2` | HTTP 200, `outcome=confirmed` | `be00c2b9b92f0bce768eab4eb46f4743` |
| Slow recommendation | `smoke-slow-frontend-agent-1` | HTTP 200 after about 2.8s | `575b6a6e0dc370965ecf243bc7c361ec` |
| Dependency error | `smoke-error-labelled-agent-1` | HTTP 502, `error=demo_dependency_failed` | `62c3696fc73772228537b8003e2f4e9e` |

Tempo direct lookup was verified for the happy trace. Loki labels were verified for:

- `movie-agent-worker`
- `movie-reservation-mcp`
- `movie-reservation-service`
- `axum-tools-mcp`
- `axum-tools-random-api`

## 3. Agent Smoke Calls

Run these after all backend services are healthy.

Happy path:

```sh
curl -fsS -X POST http://127.0.0.1:8081/api/v1/demo/reserve-recommended-seat \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: demo-corr-happy-1' \
  -H 'X-Request-Id: demo-req-happy-1' \
  -d '{"movie_preference":"exciting platform movie","seat_preference":"aisle","fault":"none"}' | jq .
```

Slow dependency:

```sh
time curl -fsS -X POST http://127.0.0.1:8081/api/v1/demo/reserve-recommended-seat \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: demo-corr-slow-1' \
  -H 'X-Request-Id: demo-req-slow-1' \
  -d '{"movie_preference":"exciting platform movie","seat_preference":"aisle","fault":"slow-recommendation"}' | jq .
```

Failing dependency:

```sh
curl -sS -i -X POST http://127.0.0.1:8081/api/v1/demo/reserve-recommended-seat \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: demo-corr-error-1' \
  -H 'X-Request-Id: demo-req-error-1' \
  -d '{"movie_preference":"exciting platform movie","seat_preference":"aisle","fault":"recommendation-error"}'
```

Expected:

- Happy path returns HTTP 200 and `outcome` similar to `confirmed`.
- Slow path returns HTTP 200 after a visible delay.
- Error path returns a controlled dependency failure, usually HTTP 502, with `error=demo_dependency_failed`.

## 4. Frontend Demo Prompts

Use the prompt chips first; they set the matching fault mode automatically.

Good manual prompts:

- `Find me an exciting platform-themed movie and reserve a good available aisle seat.`
- `Recommend an exciting movie, but trigger the slow recommendation path so we can inspect latency.`
- `Try to recommend a movie while the recommendation service is failing, then explain what broke.`
- `Reserve a seat for the type-safe movie demo and keep the same correlation id across the workflow.`

What to point out in the UI:

- The "Correlation boundary" strip is the business workflow id. Use it in Loki/Grafana searches.
- The trace id is the technical execution join key for Tempo.
- A1 and A2 should show as blocked in the Type-Safe Matinee screening because they are confirmed in seed data.
- After a successful agent reservation, reload/observe the seat map: the newly confirmed seat should become blocked.

## 5. Grafana Checks

Open `Multi-Service Reservation Demo`.

Check rows:

- Traffic
- Errors
- Latency
- Saturation

Use variables:

- `service=movie-agent-worker` for the agent entry point.
- `fault=slow-recommendation` for the latency story.
- `fault=recommendation-error` for the dependency-failure story.
- `correlation_id=demo-corr-happy-1`, `demo-corr-slow-1`, or the frontend boundary id.

Trace/log navigation story:

1. Start with the agent request in Traffic or Errors.
2. Open the trace in Tempo.
3. Show spans for `movie-agent-worker`, `axum-tools-mcp`, `axum-tools-random-api`, `movie-reservation-mcp`, and `movie-reservation-service`.
4. Jump to Loki logs by `trace_id` or filter logs by `correlation_id`.

## 6. Failure Simulation

The only poison pill is the recommendation service.

| Fault | Header/body value | Expected visual |
| --- | --- | --- |
| Normal | `none` | Successful agent workflow and confirmed reservation. |
| Slow | `slow-recommendation` | Latency panels spike; trace shows slow recommendation span. |
| Error | `recommendation-error` | Error panels/logs show controlled dependency failure; trace has failed recommendation span. |

From the frontend, choose the matching prompt chip. From curl, set body field `fault`.

## 7. Stop Everything

```sh
cd /home/patex1987/development/golden-path-ecs-template
docker compose --profile demo down

cd /home/patex1987/development/axum_tools_random_api
docker compose down

cd /home/patex1987/development/python-agent-with-idp
docker compose down

cd /home/patex1987/development/fastapi_otel_prometheus_grafana_poc
docker compose down
```

Stop the Vite dev server with `Ctrl-C` in its terminal.
