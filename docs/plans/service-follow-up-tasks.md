# Service Follow-up Tasks

This file tracks intentional leftovers from the current movie reservation service work. These are useful cleanup or learning tasks, but they are not required for Deliverables 1-3.

## Movie Reservation GraphQL API

- Add the Deliverable 4 polling API: `movies`, `movie`, `screenings`, `screening`, `requestReservation`, `reservationRequestStatus`, and `reservationResult`.
- Keep `movieProviderId` out of normal GraphQL inputs. Tenant/provider identity should continue to come from `ActorContext`.
- Add mapper tests once GraphQL models for movies, screenings, reservations, and reservation requests exist.
- Add owner-only and cross-provider authorization coverage for the Deliverable 4 GraphQL reservation operations. Cover `reservationRequestStatus(id)` and `reservationResult(requestId)` for tenant-admin, tenant-scope, owner, non-owner, and other-provider actors.
- Add explicit GraphQL e2e coverage for identity propagation: JWT claims should become `authenticatedUser`, then `ActorContext`, then tenant-scoped service/repository calls. Include a case proving GraphQL input cannot override the authenticated `movieProviderId`.
- Replace the short-term nullable GraphQL read contract for protected reservation resources. `reservationRequestStatus(id)` and `reservationResult(requestId)` currently return `null` for too many cases: not found, unauthorized, not confirmed yet, rejected, failed, and possible data inconsistency. That bucket-of-nulls behavior is acceptable only as a temporary learning step. For a production-shaped API, prefer explicit GraphQL return types such as a union or typed payload that distinguishes success, not found, unauthorized/hidden, pending, rejected, and failed states while still avoiding unsafe cross-tenant information leaks.
- Review the Deliverable 4 `screenings` seat-loading strategy before the Postgres adapter lands. Decide whether to use GraphQL DataLoader, a batch repository method, a read-model query, or another approach to avoid per-screening lookups with durable persistence.
- Replace generic `Error` throws in movie reservation application use cases with explicit application/domain errors and map them deliberately at the GraphQL boundary. Start with `MovieReservationsService.requestReservation`, where missing screenings and invalid seat selections currently throw generic errors.
- Revisit `test/schema.test.ts` once the GraphQL API grows. The current string checks are acceptable for the PoC, but later schema verification may be removed, replaced with schema snapshots, or changed to parse the schema structurally.
- Prefer ISO 8601 UTC timestamp strings for API and persistence boundaries, for example `2026-05-18T08:30:00.000Z`. Add explicit validation or a branded timestamp type before timestamps become caller-provided input.
- Add an explicit GraphQL timestamp contract soon. Replace plain `String` timestamp fields with a `DateTime` scalar or another deliberate timestamp representation, and validate/serialize ISO 8601 UTC consistently.
- Make reservation request state transitions explicit in one place before the workflow grows. A small transition map or transition engine would make the allowed state machine visible at a glance instead of spreading the rules across individual transition functions.
- Replace generic domain `Error` throws with custom domain errors before exposing reservation commands. For example, an empty seat selection should raise a specific reservation request validation error that GraphQL, logs, and tests can handle deliberately.

## Developer Documentation Style

- Add repository AI guidance or a dedicated skill for writing useful TypeScript doc comments. The style should explain domain intent, ownership boundaries, runtime/compile-time behavior, and future constraints without restating obvious property names.
- Revisit the service Prettier `printWidth` after the current feature work is committed. Consider changing it from 80 to 120 in a dedicated formatting/config commit so unrelated line wrapping does not pollute feature reviews.

## Local Development Runtime

- Revisit the WebStorm/local app execution setup that currently uses `tsx`. `tsx` keeps local startup simple, but it does not emit TypeScript decorator metadata, so Nest-managed constructors and some GraphQL resolver method parameters need explicit runtime metadata such as `@Inject(...)` or `@Reflect.metadata(...)`.
- Decide whether to keep the explicit metadata workaround, run local development from compiled `tsc` output, or replace the dev runner with an SWC-based runner configured for legacy decorators and decorator metadata. The goal is to remove avoidable framework/runtime surprises while keeping local execution easy from WebStorm.
- Add a small dev-runtime smoke check for the chosen local execution path. It should start the service the same way the IDE/dev script does and execute at least one GraphQL query, so constructor injection failures are caught outside the Vitest/SWC path.

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
- Document and implement a separate JWT authentication path for GraphQL WebSocket/subscription traffic before subscriptions are added. Current JWT authentication is HTTP-only middleware and does not authenticate WebSocket connection initialization.
- Do not extract the GraphQL middleware yet. First keep the boundaries clear inside this service; extract only when a second service needs the same behavior.

## Middleware and Observability Notes

- Prefer transport-specific middleware or integration hooks when behavior depends on HTTP, GraphQL, or WebSocket details. Avoid one generic middleware that branches over every transport until multiple transports prove the need.
- Keep GraphQL-specific middleware under `presentation/graphql/middleware/`. If REST-specific middleware appears later, prefer a separate `presentation/http/middleware/` folder.
- For future GraphQL subscriptions or WebSocket APIs, plan a separate token extraction/auth path instead of assuming HTTP bearer-token middleware applies unchanged.
- Observability will likely need several hooks rather than one middleware: HTTP/Nest middleware or interceptors for request ids and basic timing, GraphQL/Apollo plugins or GraphQL-specific interceptors for operation names and resolver/error metadata, OpenTelemetry instrumentation for spans, and structured logging helpers for actor/request/tenant fields.
- Consider splitting future request processing into focused middleware or hooks: business context extraction, alert/metric emission, authentication, and OpenTelemetry instrumentation. That ordering can preserve visibility into failures that happen before or during authentication, including `401` responses and malformed tokens.
- Business context middleware should only extract safe context available before authentication, such as request ids, route or operation names, raw tenant hints when explicitly allowed, and token presence. Authenticated identity and trusted tenant/provider context should still come from validated claims.
- During the observability deliverable, design a request-scoped logging context similar to the Python `structlog.contextvars` pattern used in `python-agent-with-idp`. In NestJS/Node, the likely equivalent is Pino structured logging plus `AsyncLocalStorage` or a Nest wrapper such as `nestjs-pino`.
- Consider an execution/business-context middleware split: an early middleware binds request-safe fields such as `requestId`, transport, and route/operation hints; the authentication middleware then adds trusted auth-derived fields such as `userId`, `movieProviderId`, roles, and scopes after token validation. Those fields should become automatic log attributes for the rest of the request and be cleared when the request finishes.
- Keep GraphQL operation logging responsible for GraphQL-specific lifecycle facts such as operation name, operation type, duration, and GraphQL errors. Do not force each plugin/helper to manually repeat request-scoped fields once structured logging context exists.
- Replace the current GraphQL operation logging tests that assert formatted strings with structured-log assertions once Pino or another structured logger is introduced. The current string-containment tests are intentionally short-term and brittle.
- Alert metrics should be initialized early enough to record both server-side failures and client-side failures such as unauthenticated or malformed requests. This avoids a blind spot where auth middleware rejects a request before metrics are emitted.
- Revisit the middleware/observability folder structure during the OpenTelemetry deliverable, when the actual logging and tracing tools are in place.

## Persistence Preparation

- Keep the in-memory repository as a fast fake even after Postgres exists.
- Make the in-memory repository reject duplicate IDs in constructor seed data, not only during `saveReservationRequest`, so bad fixtures cannot be silently hidden by `Map` overwrites.
- Add Postgres tables with `movie_provider_id` on tenant-scoped rows in the later Knex deliverable.
- When reservation processing is added, prevent double-booking with database-backed guarantees such as a transaction plus a unique constraint on confirmed seats, for example `(screening_id, seat_id)`.
- Decide the D5 processing trigger before adding durable persistence: worker polling, transactional outbox, queue-first processing, or synchronous processing. Use an outbox if saving a reservation request must reliably signal another process.
- Decide the durable ordering metadata for reservation processing. The D5 in-memory sequence is operational metadata, not customer/domain API data; a production implementation may use a database identity, timestamp plus id tie-breaker, queue signal, or claim table, but operators still need a visible ordering/correlation signal in logs, traces, metrics, or support tooling.
- Split reservation processing into a control-plane/data-plane shape after durable state exists. The GraphQL API should own request creation and status/result reads, while a separate worker runtime should claim, process, retry, and emit operator observability for reservation work.
- Make terminal reservation request transitions and processing attempt recording atomic, or introduce an outbox/observability pipeline. The current in-process implementation guards against misclassifying already-terminal requests, but it is not a production transaction boundary.
- Replace repeated reservation processing outcome/reason string literals with shared constants or enums once they are used across processor code, tests, persistence mapping, and observability. Keep the discriminated union behavior, but avoid duplicating values such as `failed`, `seat-conflict`, and `unexpected-error` in many places.
- Add idempotency handling for reservation commands before exposing them to retrying clients, so repeated client submissions can be distinguished from conflicting duplicate work.

## Configuration and Logging

- Evolve `src/config.ts` from flat environment parsing into an explicit configuration contract as modes grow. Future settings such as OIDC, Postgres, SQS, and observability endpoints should document which values are required for each selected mode.
- Prefer discriminated Zod schemas or focused cross-field validation when settings become conditional, for example `AUTH_MODE=oidc` requiring issuer, audience, and JWKS settings.
- Add table-driven config tests for valid and invalid profile combinations once the dependency matrix grows beyond the current flat settings.
- Replace shallow env-template static assertions with more meaningful runtime profile smoke tests. Static checks such as "template contains `ENABLE_GRAPHIQL=false`" are acceptable short-term guardrails, but profile behavior is better protected by starting the app with representative profiles and verifying auth, GraphiQL exposure, logging, and health behavior through the public boundaries.
- Add structured JSON application logging before production-like deployment work. Prefer evaluating Pino as the default NestJS logger because it is a common Node production choice and fits container log collection. Logs should be suitable for container platforms and local observability tooling, with request correlation fields where practical.
- When Pino is introduced, replace ad hoc key-value log string formatting with structured log objects and define a small application logging interface that can be tested without depending directly on the concrete Pino logger.

## Runtime Lifecycle

- Add graceful shutdown handling when the service starts owning resources that need cleanup, such as database pools, worker clients, message consumers, or OpenTelemetry exporters.
- Define failed-readiness semantics before adding real dependency checks. Decide whether `/ready` returns HTTP 503, a `not-ready` response body, per-check failure details, or a combination that works cleanly for ECS, Kubernetes, Docker Compose, and humans.
