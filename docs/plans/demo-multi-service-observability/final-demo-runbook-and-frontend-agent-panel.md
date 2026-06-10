# Implementation Plan: Final Demo Runbook and Frontend Agent Panel

## 1. Summary

Prepare the final multi-service observability demo by documenting the exact startup/smoke/fault workflow and updating the React UI so it can invoke the Python agent from the demo screen. The frontend should replace the local diagnostics panel with an agent panel that preserves the same workflow correlation id, shows the trace/correlation boundary clearly, includes demo prompt presets, and displays agent outcomes. The seat map should show confirmed seats as blocked using a real backend availability flag.

## 2. Goals

- Add a concise runbook for starting Grafana, movie reservation API/MCP, recommendation API/MCP, Python agent, and frontend.
- Add frontend support for `POST /api/v1/demo/reserve-recommended-seat`.
- Keep one `X-Correlation-Id` stable for the frontend workflow and create a new `X-Request-Id` for each agent call.
- Replace the diagnostics panel with an agent chat-style demo panel and prompt suggestions.
- Visualize confirmed seats as blocked and prevent selecting them.
- Run local checks and then start the full stack for happy, slow, and error smoke calls.

## 3. Non-goals

- No production chat protocol, streaming, or persistent conversation history.
- No new UI framework or client state library.
- No new random fault source outside `axum-tools-random-api`.
- No production-grade capacity/saturation modeling.

## 4. Current State

- `movie-reservation-web` already generates a workflow `traceparent`, `trace_id`, and `correlation_id` in `src/platform/observability/trace-context.ts`.
- The current diagnostics panel shows GraphQL exchange details in `src/features/movie-reservations/ui/diagnostics-panel.tsx`.
- The Vite proxy only forwards `/graphql` to `VITE_API_PROXY_TARGET`.
- The agent API is documented as ready in `current-status/python-agent-with-idp.md` and exposes `POST /api/v1/demo/reserve-recommended-seat` on `8081` for Docker.
- `Screening.seats` currently returns physical auditorium seats only. The resolver note explicitly says this is not an availability calculation.
- Confirmed reservations are stored in `reservation_seats`, and both Postgres and in-memory repositories can read confirmed reservations.

## 5. Requirements and Assumptions

### Confirmed Requirements

- Document how to run all moving pieces.
- Remove the frontend diagnostic panel.
- Add a panel to interact with the agent.
- Suggest good demo prompts.
- Show seats that are already blocked.
- Run a smoke test with frontend, agent, MCPs, and services.
- Simulate slow and failing dependency paths.
- Make the correlation-id boundary meaningful and eye-catching.

### Assumptions

- The frontend should call the agent route, not the MCP servers directly.
- The agent remains on `http://127.0.0.1:8081` for the Docker demo.
- The browser can use the Vite dev server proxy for `/api/v1/demo`.
- `isReserved` on `Seat` is acceptable as a demo-read-model extension.

### Open Questions

- None blocking. The demo deadline favors a small explicit contract over a broader availability model.

## 6. Proposed Design

Add `Seat.isReserved` to the GraphQL seat model and populate it from confirmed reservations for each screening. This keeps the UI honest without changing the reservation write flow.

Add a frontend `agent-client` module that mirrors the GraphQL client style: read runtime config, send observability headers, parse a small response DTO, and normalize errors. Add a React hook to maintain prompt text, selected fault mode, in-flight state, and recent agent responses.

Replace `DiagnosticsPanel` usage with `AgentPanel`. The panel will show:

- one visible "correlation boundary" strip for the current workflow;
- prompt presets for happy, slow, and failing demo paths;
- a textarea and fault selector;
- a run button;
- last agent answer, outcome, reservation request id, workflow id, and tool results;
- a compact recent GraphQL exchange list for continuity, but no separate diagnostics panel.

## 7. Alternatives Considered

### Alternative A: UI-only blocked seats

- Pros: fastest possible frontend change.
- Cons: visually dishonest after reload; cannot show seats blocked by agent or earlier runs unless manually tracked.
- Decision: rejected because the backend already has confirmed reservation data.

### Alternative B: Dedicated availability query

- Pros: cleaner long-term read model.
- Cons: larger resolver/application contract during demo crunch.
- Decision: defer. `Seat.isReserved` is the smallest useful v1.

## 8. API / Interface Changes

- GraphQL `Seat` gains `isReserved: Boolean!`.
- Frontend env gains `VITE_AGENT_PROXY_TARGET` and optional `VITE_AGENT_URL`.
- Frontend calls `POST /api/v1/demo/reserve-recommended-seat`.

## 9. Data Model / Persistence Changes

None. Existing `reservation_seats` data is read to derive `isReserved`.

## 10. Security, Privacy, and Abuse Considerations

- The frontend only sends demo text, fault mode, and observability headers.
- No bearer token or secrets are displayed in the UI.
- The agent endpoint is assumed local/demo-only in this branch.
- Correlation ids are debugging handles, not authorization controls.

## 11. Performance, Scalability, and Reliability Considerations

- The availability calculation should be bounded to the screenings returned in the catalog query.
- The agent call should show a clear in-flight state because `slow-recommendation` intentionally waits.
- Fault responses should remain visible as controlled dependency errors, not generic browser failures.

## 12. Implementation Steps

1. Expose reserved seats
   - Change: add repository method to find confirmed seat ids by screening ids, service wrapper, resolver mapping, and `Seat.isReserved`.
   - Files/modules likely affected: repository port, Postgres repo, in-memory repo, service, GraphQL models/mappers/resolver, schema tests.
   - Verification: service integration/schema tests and typecheck.

2. Update frontend domain/parsing/seat map
   - Change: parse `isReserved`, disable blocked seats, add legend and visual state.
   - Files/modules likely affected: frontend domain, GraphQL query/parser/tests, seat selection, seat map, CSS.
   - Verification: web tests and typecheck.

3. Add agent client and panel
   - Change: add agent API module, hook, UI panel, Vite proxy/env docs.
   - Files/modules likely affected: `movie-reservation-web/src/platform/api`, feature adapters/ui, `vite.config.ts`, env templates.
   - Verification: web tests, build, browser smoke.

4. Add final runbook and prompt suggestions
   - Change: add single-command-ish run order, health checks, smoke calls, failure simulation steps, Grafana checks.
   - Files/modules likely affected: demo plan folder and frontend README.
   - Verification: commands copied from current-status docs and tested where possible.

5. Full-stack smoke
   - Change: start sibling stacks and run happy/slow/error agent calls.
   - Verification: health endpoints, curl responses, frontend dev server reachable, Grafana stack reachable.

## 13. Testing Strategy

- `npm -w movie-reservation-service run typecheck`
- Focused service integration/schema tests for GraphQL contract.
- `npm -w movie-reservation-web run typecheck`
- `npm -w movie-reservation-web test`
- `npm -w movie-reservation-web run build`
- Full local curl smoke for health, happy path, slow path, and dependency error.

## 14. Rollout / Migration Plan

This is a demo branch. Rollback is to remove `isReserved` from the GraphQL selection and swap the panel import back to `DiagnosticsPanel`. No database migration is needed.

## 15. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---:|---:|---|
| Agent CORS/proxy mismatch | Frontend cannot call agent | Medium | Use Vite proxy `/api/v1/demo` to `8081`. |
| Existing confirmed seed data blocks the expected happy seat | Happy path rejects | Medium | Runbook includes DB reset/seed before rehearsal. |
| Slow fault looks like a hung UI | Demo confusion | Medium | Agent panel shows explicit running state and fault mode. |
| Availability query adds too much backend work | Demo slip | Low | Use existing confirmed reservation table and simple set lookup. |

## 16. Done Criteria

- Runbook tells the presenter how to start, smoke, and stop all services.
- Frontend can call the agent and show success/failure results.
- Seat map visibly marks blocked seats and blocks clicks.
- Correlation id boundary is prominent and copyable.
- Happy, slow, and error smoke calls run against the integrated services.
