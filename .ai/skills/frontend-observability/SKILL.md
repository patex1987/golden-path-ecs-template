---
name: frontend-observability
description: Use when building or reviewing frontend behavior that should create, preserve, or display observability context such as traceparent, tracestate, correlation ids, request ids, GraphQL operation names, logs, metrics, or demo workflows.
---

# Frontend Observability

Use this skill when frontend work should help test or demonstrate the service observability stack.

## Repository Context

The movie reservation backend accepts and echoes:

- `traceparent`
- `tracestate`
- `X-Correlation-Id`
- `X-Request-Id`

The current local observability workflow is documented in:

- `docs/workflows/local-observability.md`
- `docs/workflows/observability-manager-demo.md`
- `docs/architecture/observability-log-contract.md`

Read those files before changing frontend observability behavior.

## Browser Propagation Contract

For a user workflow:

- Generate or preserve one `X-Correlation-Id` for the whole workflow.
- Give each backend HTTP request its own `X-Request-Id`.
- Preserve an existing `traceparent` when continuing a workflow.
- Generate a valid W3C `traceparent` when starting a new local demo workflow.
- Preserve `tracestate` only when present; do not invent vendor state.

In TypeScript terms, treat these as runtime values, not just strings. Validate or construct them through small helper functions so malformed ids do not silently break correlation.

## GraphQL Guidelines

- Give every operation a stable, meaningful operation name.
- Prefer GraphQL variables over interpolated ids.
- Keep operation names aligned with the business workflow, for example:
  - `ReservationUiCatalog`
  - `ReservationUiRequestReservation`
  - `ReservationUiReservationStatus`
  - `ReservationUiReservationResult`
- Log or display the active workflow ids in a compact developer panel when useful.
- Do not expose secrets, bearer tokens, or raw auth internals in UI diagnostics.

## UI Behavior For Observability Demos

The UI should make it easy to create visible backend signals:

- load catalog data;
- select a screening and seat;
- submit a reservation request;
- poll request status;
- show confirmed, rejected, failed, and not-yet-confirmed states;
- fetch the final reservation result after confirmation;
- repeat the workflow with a new correlation id.

Include a compact diagnostics area for:

- correlation id;
- latest request id;
- trace id extracted from `traceparent`;
- last GraphQL operation;
- latest reservation request id;
- current reservation status.

This diagnostics area is for local development and demos. Do not design it as user-facing production observability.

## Error And Privacy Rules

- Show user-friendly errors, plus developer details only in explicitly local/dev UI.
- Never put tokens, credentials, or full auth headers in browser storage or visible diagnostics.
- Do not store high-cardinality ids in durable frontend storage unless the user explicitly needs a saved demo session.
- Treat ids as copyable debugging handles, not as security controls.

## Testing And Verification

Verify with browser devtools or Playwright:

- every GraphQL request includes `X-Correlation-Id`, `X-Request-Id`, and `traceparent`;
- each request id changes per request;
- the correlation id remains stable through one workflow;
- polling stops on terminal reservation states;
- operation names appear in backend logs/traces;
- the diagnostics panel matches the latest request and reservation state.

For backend correlation, run the local observability stack and search by `correlation_id`, `request_id`, or `trace_id` according to `docs/workflows/local-observability.md`.
