# Service Follow-up Tasks

This file tracks intentional leftovers from the current movie reservation service work. These are useful cleanup or learning tasks, but they are not required for Deliverables 1-3.

## Movie Reservation GraphQL API

- Add the Deliverable 4 polling API: `movies`, `movie`, `screenings`, `screening`, `requestReservation`, `reservationRequest`, and `reservation`.
- Keep `movieProviderId` out of normal GraphQL inputs. Tenant/provider identity should continue to come from `ActorContext`.
- Add mapper tests once GraphQL models for movies, screenings, reservations, and reservation requests exist.
- Revisit `test/schema.test.ts` once the GraphQL API grows. The current string checks are acceptable for the PoC, but later schema verification may be removed, replaced with schema snapshots, or changed to parse the schema structurally.
- Prefer ISO 8601 UTC timestamp strings for API and persistence boundaries, for example `2026-05-18T08:30:00.000Z`. Add explicit validation or a branded timestamp type before timestamps become caller-provided input.
- Make reservation request state transitions explicit in one place before the workflow grows. A small transition map or transition engine would make the allowed state machine visible at a glance instead of spreading the rules across individual transition functions.
- Replace generic domain `Error` throws with custom domain errors before exposing reservation commands. For example, an empty seat selection should raise a specific reservation request validation error that GraphQL, logs, and tests can handle deliberately.

## Developer Documentation Style

- Add repository AI guidance or a dedicated skill for writing useful TypeScript doc comments. The style should explain domain intent, ownership boundaries, runtime/compile-time behavior, and future constraints without restating obvious property names.

## Authorization Hardening

- Replace the placeholder authorization service with a clearer policy object or port once more operations exist.
- Decide whether scope checks should be purely additive or whether roles and scopes should both be required for tenant-admin behavior.
- Model provider memberships when a user can belong to more than one movie provider.
- Decide the API semantics for unauthorized reads per use case. For public tenant-scoped reads, returning `null` can avoid leaking whether another tenant's resource exists; for commands and internal/admin APIs, explicit authorization errors may be more useful.
- Preserve the ownership split between persistence, authorization, application semantics, and transport mapping:
  - Repositories return entities or `null` based on data existence and query scope. They should not own business authorization decisions.
  - Authorization services answer policy questions such as `canReadReservation(actor, reservation)`.
  - Application services decide use-case semantics, including whether unauthorized access is hidden as `null` or surfaced as an explicit authorization error.
  - GraphQL resolvers map application results and errors to the API response shape. They should not invent authorization rules.

## Shared Authentication Library Preparation

- Keep JWT and authentication transport concerns isolated so they can later move into a reusable auth library shared across services.
- Good future library candidates include standards-aware bearer-token extraction from HTTP headers, WebSocket token extraction, JWT/OIDC verification, JWKS caching, issuer/audience/expiry checks, and common authentication error mapping.
- The current bearer-token helper is intentionally simple for the PoC. A shared implementation should handle more malformed header cases, document whether duplicate or comma-joined authorization headers are accepted, and treat the authentication scheme according to HTTP semantics.
- Add focused tests for malformed bearer-token and JWT inputs when hardening the shared parser/validator. Keep the current PoC tests focused on the supported happy path and missing-token behavior.
- Keep service-specific claim mapping separate from generic token mechanics. For this service, `movie_provider_id` to `movieProviderId`, app roles, and actor context construction remain movie-reservation-specific until multiple services prove a shared contract is needed.
- Do not extract the GraphQL middleware yet. First keep the boundaries clear inside this service; extract only when a second service needs the same behavior.

## Middleware and Observability Notes

- Prefer transport-specific middleware or integration hooks when behavior depends on HTTP, GraphQL, or WebSocket details. Avoid one generic middleware that branches over every transport until multiple transports prove the need.
- Keep GraphQL-specific middleware under `presentation/graphql/middleware/`. If REST-specific middleware appears later, prefer a separate `presentation/http/middleware/` folder.
- For future GraphQL subscriptions or WebSocket APIs, plan a separate token extraction/auth path instead of assuming HTTP bearer-token middleware applies unchanged.
- Observability will likely need several hooks rather than one middleware: HTTP/Nest middleware or interceptors for request ids and basic timing, GraphQL/Apollo plugins or GraphQL-specific interceptors for operation names and resolver/error metadata, OpenTelemetry instrumentation for spans, and structured logging helpers for actor/request/tenant fields.
- Consider splitting future request processing into focused middleware or hooks: business context extraction, alert/metric emission, authentication, and OpenTelemetry instrumentation. That ordering can preserve visibility into failures that happen before or during authentication, including `401` responses and malformed tokens.
- Business context middleware should only extract safe context available before authentication, such as request ids, route or operation names, raw tenant hints when explicitly allowed, and token presence. Authenticated identity and trusted tenant/provider context should still come from validated claims.
- Alert metrics should be initialized early enough to record both server-side failures and client-side failures such as unauthenticated or malformed requests. This avoids a blind spot where auth middleware rejects a request before metrics are emitted.
- Revisit the middleware/observability folder structure during the OpenTelemetry deliverable, when the actual logging and tracing tools are in place.

## Persistence Preparation

- Keep the in-memory repository as a fast fake even after Postgres exists.
- Add Postgres tables with `movie_provider_id` on tenant-scoped rows in the later Knex deliverable.

## Configuration and Logging

- Evolve `src/config.ts` from flat environment parsing into an explicit configuration contract as modes grow. Future settings such as OIDC, Postgres, SQS, and observability endpoints should document which values are required for each selected mode.
- Prefer discriminated Zod schemas or focused cross-field validation when settings become conditional, for example `AUTH_MODE=oidc` requiring issuer, audience, and JWKS settings.
- Add table-driven config tests for valid and invalid profile combinations once the dependency matrix grows beyond the current flat settings.
- Add structured JSON application logging before production-like deployment work. Logs should be suitable for container platforms and local observability tooling, with request correlation fields where practical.

## Runtime Lifecycle

- Add graceful shutdown handling when the service starts owning resources that need cleanup, such as database pools, worker clients, message consumers, or OpenTelemetry exporters.
- Define failed-readiness semantics before adding real dependency checks. Decide whether `/ready` returns HTTP 503, a `not-ready` response body, per-check failure details, or a combination that works cleanly for ECS, Kubernetes, Docker Compose, and humans.
