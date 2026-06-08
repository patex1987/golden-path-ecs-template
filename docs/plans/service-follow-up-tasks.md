# Service Follow-up Tasks

This file tracks intentional leftovers from the current movie reservation service work. These are useful cleanup or learning tasks, but they are not required for Deliverables 1-3.

## Movie Reservation GraphQL API

- Add the Deliverable 4 polling API: `movies`, `movie`, `screenings`, `screening`, `requestReservation`, `reservationRequestStatus`, and `reservationResult`.
- Keep `movieProviderId` out of normal GraphQL inputs. Tenant/provider identity should continue to come from `ActorContext`.
- Add mapper tests once GraphQL models for movies, screenings, reservations, and reservation requests exist.
- Add owner-only and cross-provider authorization coverage for the Deliverable 4 GraphQL reservation operations. Cover `reservationRequestStatus(id)` and `reservationResult(requestId)` for tenant-admin, tenant-scope, owner, non-owner, and other-provider actors.
- Add explicit GraphQL e2e coverage for identity propagation: JWT claims should become `authenticatedUser`, then `ActorContext`, then tenant-scoped service/repository calls. Include a case proving GraphQL input cannot override the authenticated `movieProviderId`.
- Replace the short-term nullable GraphQL read contract for protected reservation resources. `reservationRequestStatus(id)` and `reservationResult(requestId)` currently return `null` for too many cases: not found, unauthorized, not confirmed yet, rejected, failed, and possible data inconsistency. That bucket-of-nulls behavior is acceptable only as a temporary learning step. For a production-shaped API, prefer explicit GraphQL return types such as a union or typed payload that distinguishes success, not found, unauthorized/hidden, pending, rejected, and failed states while still avoiding unsafe cross-tenant information leaks.
- Move resolver-side read-model assembly into the application query/use-case
  layer. Start with `MovieReservationsResolver.screenings`, which currently
  lists screenings, batch-loads seats, and joins the nested seat data before
  mapping to GraphQL. Prefer a small application result such as
  `listScreeningsWithSeats` first; introduce a dedicated catalog query service
  only if read-model orchestration grows. Keep GraphQL classes and mappers in
  the presentation layer.
- Revisit the `screenings` read shape before production use. D6.1 removes the
  obvious per-screening seat lookup with a batch repository method, but the API
  still needs a deliberate read model, pagination, or date-window contract once
  screening volume grows.
- Replace generic `Error` throws in movie reservation application use cases with explicit application/domain errors and map them deliberately at the GraphQL boundary. Start with `MovieReservationsService.requestReservation`, where missing screenings and invalid seat selections currently throw generic errors.
- Revisit `test/schema.test.ts` once the GraphQL API grows. The current string checks are acceptable for the PoC, but later schema verification may be removed, replaced with schema snapshots, or changed to parse the schema structurally.
- Prefer ISO 8601 UTC timestamp strings for API and persistence boundaries, for example `2026-05-18T08:30:00.000Z`. Add explicit validation or a branded timestamp type before timestamps become caller-provided input.
- Add an explicit GraphQL timestamp contract soon. Replace plain `String` timestamp fields with a `DateTime` scalar or another deliberate timestamp representation, and validate/serialize ISO 8601 UTC consistently.
- Make reservation request state transitions explicit in one place before the workflow grows. A small transition map or transition engine would make the allowed state machine visible at a glance instead of spreading the rules across individual transition functions.
- Replace generic domain `Error` throws with custom domain errors before exposing reservation commands. For example, an empty seat selection should raise a specific reservation request validation error that GraphQL, logs, and tests can handle deliberately.

## Developer Documentation Style

- Add repository AI guidance or a dedicated skill for writing useful TypeScript doc comments. The style should explain domain intent, ownership boundaries, runtime/compile-time behavior, and future constraints without restating obvious property names.

## Test and Fixture Hygiene

- Keep the D6 UUID contract for service-owned IDs, but reduce repeated raw UUID
  literals in tests over time. Prefer semantic constants or small local
  factories for common movie reservation fixtures, while keeping raw UUID
  examples in tests that specifically prove UUID parsing/validation behavior.
- Review the current processor/repository tests that inline UUID literals such
  as `99999999-9999-4999-8999-999999999911` for request, seat, and reservation
  ids. The UUID shape protects the Postgres-compatible id contract, but the raw
  literals make the test stories harder to scan. Evaluate better options such
  as semantic fixture constants, deterministic UUID factories, per-test id
  builders, or small domain-specific test fixture objects. The goal is to keep
  valid UUIDs where they matter without hiding the business meaning of
  `firstRequest`, `secondRequest`, and their selected seats.

## Local Development Runtime

- Revisit the WebStorm/local app execution setup that currently uses `tsx`. `tsx` keeps local startup simple, but it does not emit TypeScript decorator metadata, so Nest-managed constructors and some GraphQL resolver method parameters need explicit runtime metadata such as `@Inject(...)` or `@Reflect.metadata(...)`.
- Decide whether to keep the explicit metadata workaround, run local development from compiled `tsc` output, or replace the dev runner with an SWC-based runner configured for legacy decorators and decorator metadata. The goal is to remove avoidable framework/runtime surprises while keeping local execution easy from WebStorm.
- Add a small dev-runtime smoke check for the chosen local execution path. It should start the service the same way the IDE/dev script does and execute at least one GraphQL query, so constructor injection failures are caught outside the Vitest/SWC path.
- Implement the service DI composition breakdown immediately after D6 so the minimal `PERSISTENCE_MODE` wiring from the Postgres deliverable becomes an explicit, typed composition profile contract.
- After the DI composition breakdown, decide whether reservation processing
  should move into a separate worker package/process/service. D6.1 keeps a fake
  in-process worker so local development remains simple, but the conceptual
  control-plane/data-plane split should stay visible.
- After the DI composition profile contract is in place, containerize the NestJS API for local Docker Compose. The containerized app should use the same checked-in env/profile model as host-based npm development and should be able to run against the Dockerized Postgres service.

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
- When a second service needs the same behavior, evaluate extracting an
  internal auth library/package. Treat "auth SDK" as a working shorthand only:
  the goal is a small reusable service-side auth toolkit, not a broad public SDK
  with unstable abstractions.
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
- Revisit the metric zero-initialization strategy after the observability
  foundation is reviewed. The current approach pre-creates known HTTP,
  GraphQL, and reservation workflow series so dashboards and alerts do not hide
  missing data. That is a valid early-service tradeoff, but it may not scale if
  operation lists grow or if every metric dimension gets zeroed eagerly. Prefer
  zeroing only business-critical and alerting-critical metrics unless a
  dashboard or incident workflow has a concrete need for every known series to
  exist before traffic arrives.
- Revisit the `infrastructure/observability/metrics/` module layout after this
  observability foundation is reviewed. The current split avoids one large
  `metrics.ts` file, but it still centralizes HTTP, GraphQL, and reservation
  workflow metrics under one metrics folder. Re-check whether some metric
  helpers should move closer to the code that owns the behavior, for example
  GraphQL operation metrics beside the GraphQL plugin, HTTP request metrics
  beside HTTP middleware, and reservation processor metrics beside the
  reservation observability adapter, while keeping only shared meter/bootstrap
  concerns centralized.
- Re-evaluate the OpenTelemetry service startup model after the local
  observability foundation is stable. The current approach is explicit
  `NodeSDK` setup loaded with Node's `--import` flag, plus selected
  auto-instrumentation for HTTP, Express, GraphQL, Knex, and pg. Compare that
  with OpenTelemetry JS zero-code instrumentation, `getNodeAutoInstrumentations`,
  and a dedicated bootstrap entrypoint that starts observability before
  dynamically importing the Nest app. The goal is to decide whether the current
  explicit import-time setup is still the right tradeoff, or whether another
  startup shape can reduce import-time side effects while preserving the key
  requirement that instrumentation loads before app dependencies are imported.
- Implement the production dashboard follow-up in
  [production-observability-dashboard.md](production-observability-dashboard.md).
  The local observability foundation covers traffic, latency, and errors well
  enough for a v1 dashboard, but saturation still needs reservation backlog,
  worker pressure, database pool pressure, Node/process pressure, and ECS/ALB
  platform pressure signals before the project can claim a full operational
  dashboard and procedure.
- Review duplicated observability static strings after this branch settles.
  Likely candidates include log event names, log field names, metric names,
  metric label names, span names, span attribute names, business operation
  names, and test assertion strings. Extract constants only where it improves
  contract stability or removes meaningful drift risk; avoid creating a large
  constants file that makes call sites harder to read.

## Persistence Preparation

- Keep the in-memory repository as a fast fake even after Postgres exists.
- Make the in-memory repository reject duplicate IDs in constructor seed data, not only during `saveReservationRequest`, so bad fixtures cannot be silently hidden by `Map` overwrites.
- Add Postgres tables with `movie_provider_id` on tenant-scoped rows in the later Knex deliverable.
- When reservation processing is added, prevent double-booking with database-backed guarantees such as a transaction plus a unique constraint on confirmed seats, for example `(screening_id, seat_id)`.
- Decide the D5 processing trigger before adding durable persistence: worker polling, transactional outbox, queue-first processing, or synchronous processing. Use an outbox if saving a reservation request must reliably signal another process.
- Decide the durable ordering metadata for reservation processing. The D5 in-memory sequence is operational metadata, not customer/domain API data; a production implementation may use a database identity, timestamp plus id tie-breaker, queue signal, or claim table, but operators still need a visible ordering/correlation signal in logs, traces, metrics, or support tooling.
- D6 should start with a Postgres-owned internal `reservation_requests.sequence` for FIFO claiming. Do not add a dedicated work queue table until retries, leases, delayed work, dead-letter behavior, or multiple worker types make that separation concrete. Keep the work repository port intent-shaped so the adapter can move to a queue/work table later without changing application code.
- Do not add generic optimistic-locking `version` columns to reservation tables until a concrete lost-update workflow appears. The D6 processor path should use transactions and row locks for claim/confirm behavior. Revisit optimistic locking for future admin edits, mutable catalog workflows, or compare-and-swap state transitions.
- Split reservation processing into a stronger control-plane/data-plane shape
  after durable state exists. The GraphQL API should own request creation and
  status/result reads, while a separate worker runtime should claim, process,
  retry, and emit operator observability for reservation work. D6.1 models this
  concept inside one process only.
- Revisit the worker persistence boundary after D6.1. The current Postgres
  `ReservationRequestWorkRepository` is intentionally workflow-shaped so the
  application processor does not know about row locks, leases, claim tokens, and
  transaction details. Before adding a real worker runtime, queue, payment flow,
  provider inventory integration, or richer retry taxonomy, re-check that
  business policy still lives in the application/domain layer and that the
  Postgres helpers own only atomic persistence mechanics. Rename the port to a
  clearer gateway/store term if `Repository` starts hiding that distinction.
- Revisit whether reservation processor observability should stay as direct
  calls to an application-layer port or move to application events. The current
  `MovieReservationObservability` port keeps Pino/OpenTelemetry details out of
  the processor while still recording semantic workflow events. If reservation
  processing later needs multiple subscribers, durable event handling, an
  outbox, or richer worker-side reactions, prefer explicit application events
  with observability as one subscriber instead of growing observability calls
  throughout the processor.
- Revisit the mode-specific persistence exports in
  `MovieReservationsCompositionModule`. The module currently exports
  `IN_MEMORY_MOVIE_RESERVATION_STORE` or `POSTGRES_KNEX` through
  `createPersistenceExports(...)` for tests and local composition visibility.
  A stricter production-style module should prefer exporting only stable
  application-facing tokens such as `MOVIE_RESERVATION_REPOSITORY` and
  `RESERVATION_REQUEST_WORK_REPOSITORY`, while keeping persistence internals
  private. Before changing this, find a cleaner test or diagnostics seam that
  does not require importing those backing resources directly.
- Revisit the reservation request state machine before adding a real queue,
  separate worker process, or multiple worker types. D6.1 keeps public states
  simple and stores lease/retry behavior as worker metadata.
- Expand retry policy design before production use: classify retryable vs
  non-retryable exceptions, choose fixed/exponential backoff and jitter, define
  max attempts per failure type, and design dead-letter/manual intervention
  behavior.
- Revisit targeted seat validation as a long-term boundary decision. D6.1
  validates only requested seats, but future availability, pricing, holds, or
  partial acceptance workflows may need a richer command model.
- Revisit the full Postgres relational model before adding more writers or
  runtimes. D6.1 tightens critical provider/screening relationships, but it is
  still an early schema.
- Make terminal reservation request transitions and processing attempt recording atomic, or introduce an outbox/observability pipeline. The current in-process implementation guards against misclassifying already-terminal requests, but it is not a production transaction boundary.
- Replace repeated reservation processing outcome/reason string literals with shared constants or enums once they are used across processor code, tests, persistence mapping, and observability. Keep the discriminated union behavior, but avoid duplicating values such as `failed`, `seat-conflict`, and `unexpected-error` in many places.
- Add idempotency handling for reservation commands before exposing them to retrying clients, so repeated client submissions can be distinguished from conflicting duplicate work.

## Configuration and Logging

- Evolve `src/config.ts` from flat environment parsing into an explicit configuration contract as modes grow. Future settings such as OIDC, Postgres, SQS, and observability endpoints should document which values are required for each selected mode.
- Defer production database dependency discovery until there is a concrete
  production runtime and ownership model. Current local and D6 profiles
  intentionally use an explicit `DATABASE_URL`, but a production platform should
  provide database connection metadata through a deliberate discovery,
  configuration, or secrets contract instead of hardcoding database hosts in
  rendered env files. Candidate mechanisms include AWS Cloud Map, Secrets
  Manager, SSM Parameter Store, Kubernetes Services/Secrets, or an internal
  platform dependency registry.
- Prefer discriminated Zod schemas or focused cross-field validation when settings become conditional, for example `AUTH_MODE=oidc` requiring issuer, audience, and JWKS settings.
- Add table-driven config tests for valid and invalid profile combinations once the dependency matrix grows beyond the current flat settings.
- Move local Postgres credentials into an untracked local env/secrets flow or
  otherwise improve local secret handling soon. D6.1 only reduces exposure by
  binding Compose Postgres to localhost.
- Replace shallow env-template static assertions with more meaningful runtime profile smoke tests. Static checks such as "template contains `ENABLE_GRAPHIQL=false`" are acceptable short-term guardrails, but profile behavior is better protected by starting the app with representative profiles and verifying auth, GraphiQL exposure, logging, and health behavior through the public boundaries.
- Add structured JSON application logging before production-like deployment work. Prefer evaluating Pino as the default NestJS logger because it is a common Node production choice and fits container log collection. Logs should be suitable for container platforms and local observability tooling, with request correlation fields where practical.
- When Pino is introduced, replace ad hoc key-value log string formatting with structured log objects and define a small application logging interface that can be tested without depending directly on the concrete Pino logger.

## Runtime Lifecycle

- Add graceful shutdown handling when the service starts owning resources that need cleanup, such as database pools, worker clients, message consumers, or OpenTelemetry exporters.
- Preserve a three-layer health model: `/health` answers process liveness, `/ready` answers platform traffic readiness, and business/dependency readiness answers whether required dependencies can currently support the service's business purpose.
- Define failed-readiness semantics before adding real platform readiness checks. Do not automatically make every dependency failure remove the service from load balancer or Kubernetes readiness; database outages should be visible through dependency probing and observability without necessarily causing process restarts or readiness flapping.
- During D6/D7, add Postgres as a business dependency check in Postgres mode and report its status through diagnostics/observability. Keep platform probe behavior explicit and conservative.
- Add migration/seed CLI smoke tests and runtime profile smoke tests once the
  DI composition/profile refactor has made the runtime matrix explicit.
