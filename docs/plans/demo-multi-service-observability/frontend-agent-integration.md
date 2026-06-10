# Dependent Plan: Frontend Agent Integration

Repo:

```text
/home/patex1987/development/golden-path-ecs-template
```

Frontend workspace:

```text
/home/patex1987/development/golden-path-ecs-template/movie-reservation-web
```

Required branch:

```text
demo-multi-service-observability
```

Required AI context:

- Planner skill: `/home/patex1987/development/golden-path-ecs-template/.ai/skills/principal-engineer-planner`
- Review agents: `/home/patex1987/development/golden-path-ecs-template/.ai/agents`

## 1. Summary

Once the agent and MCP dependencies are running, update `movie-reservation-web` so the browser can invoke the Python agent workflow. Keep the existing direct GraphQL reservation UI working, and add a separate agent-driven demo path that calls:

```text
browser -> movie-agent-worker -> FastMCP tools -> backend services
```

The frontend should not call MCP servers directly. MCP orchestration belongs to the agent worker.

## 2. Why This Work Exists

The current frontend proves the movie reservation workflow from the browser directly to GraphQL. The demo now needs the frontend to start the multi-service agent workflow so a presenter can click once and generate the distributed trace:

```text
frontend -> agent -> recommendation MCP -> Rust API
                 -> movie MCP -> GraphQL API
```

This makes the browser part of the observability story without turning the React app into an MCP client or duplicating agent logic.

## 3. Dependency Gate

Do not start implementation until all of these are true:

- `movie-agent-worker` runs on `http://127.0.0.1:8081`.
- `POST /api/v1/demo/reserve-recommended-seat` has a stable request/response contract.
- `movie-reservation-mcp` runs on `http://127.0.0.1:8091/mcp`.
- `axum-tools-mcp` runs on `http://127.0.0.1:8092/mcp`.
- The agent happy path works through both MCP servers from a curl or script call.
- `slow-recommendation` and `recommendation-error` faults work from the agent API.

If the dependency gate is not satisfied, leave this plan as pending and keep the frontend on the direct GraphQL workflow.

## 4. Current State

Relevant existing files:

- `movie-reservation-web/src/features/movie-reservations/ui/movie-reservation-demo.tsx`
- `movie-reservation-web/src/features/movie-reservations/ui/diagnostics-panel.tsx`
- `movie-reservation-web/src/features/movie-reservations/application/movie-reservation-api.ts`
- `movie-reservation-web/src/features/movie-reservations/application/request-reservation-workflow.ts`
- `movie-reservation-web/src/features/movie-reservations/adapters/graphql/movie-reservation-api.ts`
- `movie-reservation-web/src/platform/api/graphql-client.ts`
- `movie-reservation-web/src/platform/observability/trace-context.ts`
- `movie-reservation-web/vite.config.ts`
- `movie-reservation-web/env_files/templates/local/local-dev.env.template`

The frontend already:

- uses React + Vite + TypeScript;
- has a clean feature boundary for movie reservations;
- sends `traceparent`, `X-Correlation-Id`, and `X-Request-Id` to GraphQL;
- has diagnostics for correlation id, trace id, request id, reservation request id, and GraphQL exchanges.

## 5. Requirements

Confirmed requirements:

- Add a UI path that invokes the Python agent.
- Keep the current direct GraphQL path available.
- Preserve browser-generated `traceparent`, `X-Correlation-Id`, and per-request `X-Request-Id`.
- Support the demo fault modes `none`, `slow-recommendation`, and `recommendation-error`.
- Show enough agent response detail for a presenter to explain what happened.
- Do not call MCP servers directly from the browser.

Assumptions:

- The agent endpoint is `POST /api/v1/demo/reserve-recommended-seat`.
- The agent accepts JSON with `movie_preference`, `seat_preference`, and `fault`.
- The agent returns a JSON response with workflow status, final answer, tool steps, and optional reservation ids.
- CORS is avoided locally through a Vite dev proxy.

## 6. Proposed Design

Add a separate frontend "Agent assisted reservation" path beside the existing manual reservation panels.

Recommended UI behavior:

- Add a compact panel in the right column or above the reservation panel.
- Let the user select:
  - movie preference text;
  - seat preference text;
  - fault mode segmented control or select.
- Add a primary action: `Ask agent to reserve`.
- Show:
  - workflow status;
  - final answer;
  - reservation request id if returned;
  - reservation status if returned;
  - ReAct/tool step list from the agent response;
  - latest agent HTTP exchange in diagnostics.

Do not hide the direct booking UI. For demo safety, keep both paths:

- manual GraphQL reservation path;
- agent-assisted path.

### Architecture Shape

Keep dependency direction:

```text
ui -> react adapter -> application port -> HTTP adapter -> platform fetch
```

Suggested new files:

```text
movie-reservation-web/src/features/movie-reservations/application/movie-agent-api.ts
movie-reservation-web/src/features/movie-reservations/application/request-agent-reservation-workflow.ts
movie-reservation-web/src/features/movie-reservations/adapters/http/movie-agent-api.ts
movie-reservation-web/src/features/movie-reservations/adapters/http/parsers/movie-agent-api-parsers.ts
movie-reservation-web/src/features/movie-reservations/adapters/react/use-agent-reservation-workflow.ts
movie-reservation-web/src/features/movie-reservations/ui/agent-reservation-panel.tsx
movie-reservation-web/src/platform/api/http-json-client.ts
```

If time is short, combine the parser and adapter into one file, but do not put raw `fetch` in JSX.

## 7. Agent API Contract

Target request:

```json
{
  "movie_preference": "something exciting",
  "seat_preference": "aisle",
  "fault": "none"
}
```

Required headers:

- `Content-Type: application/json`
- `traceparent`
- `X-Correlation-Id`
- `X-Request-Id`
- `X-Demo-Fault`

Target response:

```json
{
  "workflow_id": "agent-demo-123",
  "status": "completed",
  "final_answer": "Reserved a recommended screening.",
  "reservation_request_id": "optional",
  "reservation_status": "CONFIRMED",
  "trace_id": "optional",
  "correlation_id": "booking-demo-...",
  "steps": [
    {
      "kind": "tool_call",
      "tool_name": "recommendation_get_movies",
      "outcome": "success",
      "summary": "Found recommendations"
    }
  ]
}
```

The parser should be tolerant of extra fields but strict about core fields:

- `status` must be a known string such as `completed`, `failed`, `dependency_failed`, or `timed_out`.
- `steps` must be an array when present.
- IDs must be strings when present.

## 8. Runtime Configuration

Add local env template values:

```text
VITE_AGENT_API_PROXY_TARGET=http://127.0.0.1:8081
# Optional direct browser-visible URL. Leave unset when using the Vite proxy.
# VITE_AGENT_API_URL=http://127.0.0.1:8081
```

Update `movie-reservation-web/vite.config.ts` with a proxy:

```text
/api/v1/demo -> VITE_AGENT_API_PROXY_TARGET
```

The default browser URL should be:

```text
/api/v1/demo/reserve-recommended-seat
```

This avoids local CORS work during the demo.

## 9. Observability Requirements

Use the existing `DemoTraceContext` for the agent call:

- same `traceparent` for the UI workflow;
- same `X-Correlation-Id` for the UI workflow;
- fresh `X-Request-Id` for the agent HTTP request;
- `X-Demo-Fault` matching the selected fault mode.

Extend diagnostics carefully:

- show latest backend exchange regardless of whether it is GraphQL or agent HTTP;
- keep trace id and correlation id copyable;
- show latest request id;
- show latest agent workflow id when available.

Do not display secrets or raw auth headers.

## 10. Implementation Steps

1. Confirm dependency gate
   - Curl the agent happy path.
   - Curl `slow-recommendation`.
   - Curl `recommendation-error`.
   - Save the final request/response shape in this plan or a local note if it differs from the assumed shape.

2. Add runtime config
   - Update `movie-reservation-web/env_files/templates/local/local-dev.env.template`.
   - Update `movie-reservation-web/vite.config.ts` with the agent proxy.

3. Add platform JSON client
   - Create `platform/api/http-json-client.ts`.
   - Reuse `createRequestId`.
   - Capture exchange metadata similar to `GraphqlExchange`.
   - Send observability headers.

4. Add agent application port
   - Create `application/movie-agent-api.ts`.
   - Define request, response, step, status, and fault types.

5. Add HTTP adapter and parser
   - Implement `adapters/http/movie-agent-api.ts`.
   - Validate response payload at runtime.
   - Normalize errors to user-facing messages in the existing error adapter or a new small function.

6. Add React controller hook
   - Implement `use-agent-reservation-workflow`.
   - Track `idle`, `submitting`, `success`, and `error`.
   - Ignore stale responses when a new workflow starts.

7. Add UI panel
   - Add `AgentReservationPanel`.
   - Wire it into `movie-reservation-demo.tsx`.
   - Keep manual GraphQL panels untouched.

8. Extend diagnostics
   - Support agent HTTP exchanges in addition to GraphQL exchanges.
   - Show workflow id and tool steps where useful.

9. Verify in browser
   - Run the frontend dev server.
   - Invoke happy path.
   - Invoke slow recommendation.
   - Invoke recommendation error.
   - Confirm Grafana can find the frontend-started correlation id in agent, MCP, Rust, and movie-service telemetry.

## 11. Testing Strategy

Add focused tests:

- parser test for successful agent response;
- parser test for dependency failure response;
- request client test that verifies headers include `traceparent`, `X-Correlation-Id`, `X-Request-Id`, and `X-Demo-Fault`;
- hook or workflow test for stale response handling if time allows.

Run:

```sh
npm -w movie-reservation-web run typecheck
npm -w movie-reservation-web test
```

Full check if time allows:

```sh
npm -w movie-reservation-web run check
```

## 12. Done Criteria

- Frontend still supports the direct GraphQL reservation flow.
- Frontend can invoke the agent endpoint from the browser.
- Frontend sends the required observability headers to the agent.
- Frontend can trigger `none`, `slow-recommendation`, and `recommendation-error`.
- Agent response steps are visible enough for a presenter to explain the workflow.
- Diagnostics show correlation id, trace id, latest request id, and agent workflow id.
- Grafana can find frontend-started workflows by correlation id and trace id.
