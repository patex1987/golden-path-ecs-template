# Final Integrated Smoke Status

Status: PASSED
Date: 2026-06-11 Europe/Bratislava
Repo coordinator: `/home/patex1987/development/golden-path-ecs-template`

## Services Verified

| Service | URL | Result |
| --- | --- | --- |
| Grafana | `http://127.0.0.1:3000/api/health` | Healthy. |
| Movie reservation API | `http://127.0.0.1:3001/health` | Healthy. |
| Movie reservation MCP | `http://127.0.0.1:8091/health` | Healthy. |
| Recommendation API | `http://127.0.0.1:8082/health` | Healthy. |
| Recommendation MCP | `http://127.0.0.1:8092/health` | Healthy. |
| Python agent | `http://127.0.0.1:8081/api/v1/demo/health` | Healthy. |
| Frontend | `http://127.0.0.1:5173/` | Healthy. |
| Frontend agent proxy | `http://127.0.0.1:5173/api/v1/demo/health` | Healthy. |

## Functional Smoke

| Scenario | Correlation id | Expected dashboard story | Result |
| --- | --- | --- | --- |
| Happy path | `smoke-happy-frontend-agent-2` | Normal traffic across agent, recommendation MCP/API, movie MCP/API. | HTTP 200, reservation confirmed. |
| Slow dependency | `smoke-slow-frontend-agent-1` | Latency spike on recommendation service and downstream spans. | HTTP 200 after about 2.8s. |
| Dependency error | `smoke-error-labelled-agent-1` | Error row/logs show controlled recommendation dependency failure. | HTTP 502 with `demo_dependency_failed`. |

## Trace Handles

| Scenario | Trace id |
| --- | --- |
| Happy path | `be00c2b9b92f0bce768eab4eb46f4743` |
| Slow dependency | `575b6a6e0dc370965ecf243bc7c361ec` |
| Dependency error | `62c3696fc73772228537b8003e2f4e9e` |

## Observability Checks

- Grafana dashboard `Multi-Service Reservation Demo` is provisioned with UID `multi-service-reservation-demo`.
- Loki labels include `movie-agent-worker`, `movie-reservation-mcp`, `movie-reservation-service`, `axum-tools-mcp`, and `axum-tools-random-api`.
- Loki query `{service_name="movie-agent-worker"} |= "smoke-error-labelled-agent-1"` returned the labelled agent failure log.
- Loki query `{service_name="axum-tools-random-api"} |= "recommendation-error"` returned the recommendation fault log.
- Tempo direct API returned the happy-path trace, including spans from the agent, both MCP servers, recommendation API, and movie reservation API.

## Demo Notes

- Use the frontend "Correlation boundary" value as the business workflow handle in Grafana/Loki.
- Use the trace id as the technical join key in Tempo.
- The frontend shows confirmed seats as blocked; seeded Type-Safe Matinee seats A1 and A2 should be blocked before any new demo reservation.
- The only poison-pill fault source is `axum-tools-random-api`.
