# Implementation Plan: Movie Reservation Frontend Observability Demo

## 1. Summary

Add a small Vite + React + TypeScript frontend workspace that lets a user browse movies, choose a screening, select seats, request a reservation, poll the async reservation status, and fetch the confirmed result. The UI will send `traceparent`, `X-Correlation-Id`, and `X-Request-Id` headers so the full browser-to-backend workflow can be traced in the local observability stack.

## 2. Goals

- Create a runnable frontend app in a new npm workspace.
- Use the existing NestJS GraphQL API without adding backend endpoints.
- Make the movie booking flow easy to demo end to end.
- Display observability ids and the latest GraphQL operation in the UI.
- Keep the implementation small enough for a learning repo.

## 3. Non-goals

- No production authentication UI.
- No real seat availability API beyond the current `screenings { seats }` contract.
- No new AWS/CDK resources.
- No design system or component-library adoption unless needed later.

## 4. Current State

- Root npm workspaces currently include `movie-reservation-service` and `ecs-infra`.
- The backend exposes GraphQL operations in `movie-reservation-service/src/presentation/graphql/movie-reservations.resolver.ts`.
- `docs/workflows/graphql-reservation-query-examples.md` documents the booking flow and seed ids.
- `docs/workflows/local-observability.md` documents propagation fields and local ports.
- The API accepts `traceparent`, optional `tracestate`, `X-Correlation-Id`, and `X-Request-Id`.

## 5. Requirements and Assumptions

### Confirmed Requirements

- Build a nice-looking frontend movie booking app.
- Run it with observability enabled.
- Showcase end-to-end tracing to a team.

### Assumptions

- The first frontend should be Vite + React, not Next.js.
- Local API runs through either the host dev profile or the Compose API profile.
- Vite proxying to `/graphql` is acceptable for local development.
- The local fixed-user or local demo token profile handles auth for demo purposes.

### Open Questions

- Which Grafana stack URL should be linked from the UI, if any? The first version will show ids instead of hard-coding dashboard URLs.

## 6. Proposed Design

Create `movie-reservation-web/` as a React workspace. The main app will load catalog data with one named GraphQL operation, present movies and screenings, render a selectable seat map, submit `requestReservation`, poll `reservationRequestStatus`, and fetch `reservationResult` after confirmation.

The frontend observability helper will own workflow-level context:

- one correlation id per demo workflow;
- one trace id per workflow through a generated W3C `traceparent`;
- one fresh request id per GraphQL HTTP call;
- latest response echo headers for verification.

## 7. Alternatives Considered

### Alternative A: Vite React Workspace

- Pros: small, fast, fits the repo, minimal framework concepts, good for a demo tool.
- Cons: no built-in SSR or server actions.
- Decision: Recommended.

### Alternative B: Next.js App

- Pros: strong full-stack frontend framework and routing.
- Cons: extra concepts and dependencies are not needed for this internal demo.
- Decision: Defer until the project has a frontend roadmap that needs SSR or file-based routing.

## 8. API / Interface Changes

- Add root npm workspace entry for `movie-reservation-web`.
- Add frontend scripts for dev, build, preview, typecheck, lint, and check.
- No backend GraphQL schema changes.

## 9. Data Model / Persistence Changes

None.

## 10. Security, Privacy, and Abuse Considerations

- Do not store tokens or secrets in browser storage.
- The diagnostics panel displays ids only, not auth headers.
- The UI sends demo headers for tracing but does not treat ids as authentication.
- User-editable API URL is not added in-app; local configuration stays in Vite env/proxy config.

## 11. Performance, Scalability, and Reliability Considerations

- Use one catalog query to avoid request waterfalls.
- Keep dependencies minimal.
- Stop polling on `CONFIRMED`, `REJECTED`, or `FAILED`.
- Show errors and retry/reload controls for demo resilience.

## 12. Implementation Steps

1. Add workspace scaffolding.
   - Change: create `movie-reservation-web` package, Vite config, TypeScript config, index HTML, and source layout.
   - Files/modules likely affected: `package.json`, `movie-reservation-web/*`, `package-lock.json`.
   - Verification: `npm install`, workspace scripts are discoverable.

2. Add GraphQL and observability helpers.
   - Change: typed GraphQL client, named operation strings, trace/correlation/request id helpers.
   - Files/modules likely affected: `movie-reservation-web/src/shared/*`.
   - Verification: typecheck and request header inspection.

3. Build booking UI.
   - Change: catalog panel, screening panel, seat picker, reservation workflow panel, diagnostics panel.
   - Files/modules likely affected: `movie-reservation-web/src/features/movie-reservations/*`, CSS.
   - Verification: click through the full flow.

4. Document run workflow.
   - Change: frontend README with observability startup commands.
   - Files/modules likely affected: `movie-reservation-web/README.md`, possibly `docs/index.md`.
   - Verification: commands are accurate.

## 13. Testing Strategy

- Run frontend typecheck and build.
- Run frontend lint if configured.
- Start the dev server and verify the app renders.
- If the backend is running, click through catalog load, reservation, polling, and result.

## 14. Rollout / Migration Plan

This is an additive workspace. Rollback is removing `movie-reservation-web`, the workspace entry, and related lockfile entries.

## 15. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---:|---:|---|
| API runs on a different port | Medium | Medium | Use Vite env variable for proxy target |
| Existing seed seat is already reserved | Low | High | UI handles rejection as a useful demo outcome |
| CORS blocks direct browser calls | Medium | Medium | Default to same-origin `/graphql` through Vite proxy |
| Frontend trace id does not create true browser spans | Low | Medium | Treat generated `traceparent` as propagation context for backend trace correlation |

## 16. Done Criteria

- Frontend workspace exists and builds.
- User can browse movies, screenings, and seats.
- User can request a reservation and see status/result.
- GraphQL requests include observability headers.
- UI displays correlation id, trace id, latest request id, latest operation, and reservation status.
- Run instructions are documented.

## 17. Review Checklist

- [x] Requirements are explicit
- [x] Non-goals are explicit
- [x] Existing code conventions were checked
- [x] Alternatives were considered
- [x] Security implications were reviewed
- [x] Scalability and reliability implications were reviewed
- [x] Testing strategy is complete
- [x] Rollout and rollback are defined
- [x] Implementation steps are ordered and concrete
