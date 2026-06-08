# Implementation Plan: Local Observability Foundation

## 1. Summary

Add a D7 observability foundation for `movie-reservation-service` that gives the
NestJS API structured stdout JSON logs, OpenTelemetry traces and metrics,
request/correlation headers, minimal production-shaped API containerization, and
an app-local collector path that can connect to the external Grafana stack.

Recommended approach:

- Use Pino directly with a small service logging wrapper and `AsyncLocalStorage`
  request context.
- Keep logs as stdout JSON for ECS/CloudWatch compatibility; do not export logs
  through OTLP.
- Use OpenTelemetry for traces and metrics through a hybrid approach: selected
  auto-instrumentation plus manual GraphQL and reservation workflow
  instrumentation.
- Add minimal API containerization now so local Docker logs can be scraped by
  the external Grafana Alloy/Loki stack.
- Add an app-local OpenTelemetry Collector config in this repo. The collector
  receives OTLP from the API, exports traces to the external Tempo path, and
  exposes a Prometheus scrape endpoint for metrics.
- Document frontend and load-balancer correlation now, but leave the React
  frontend implementation for the next task.

This branch is `issue-4_observability-foundation`, linked to GitHub issue
`#4 D7: Add Local Observability`.

## 2. Goals

- Emit structured JSON logs from the NestJS service to stdout.
- Enrich relevant logs with standardized fields:
  - `time`
  - `level`
  - `event`
  - `message`, when useful
  - `service_name`
  - `service_version`
  - `environment`
  - `code_location`, when the wrapper can provide it without brittle stack
    parsing
  - `trace_id`
  - `correlation_id`
  - `request_id`
  - `http_method`
  - `http_route` or request path
  - `graphql_operation_name`
  - `graphql_operation_type`
  - bounded `business_operation`
  - identity fields after authentication, such as `user_id`,
    `movie_provider_id`, and `movie_provider_code`
  - `aws_x_amzn_trace_id`, when the request contains `X-Amzn-Trace-Id`
- Accept and propagate W3C `traceparent` and `tracestate` through OpenTelemetry.
- Accept or generate `X-Correlation-Id` and `X-Request-Id` for every inbound HTTP
  request.
- Return `X-Correlation-Id` and `X-Request-Id` response headers for every HTTP
  response path, including `/health`, `/ready`, GraphQL errors, and `401`
  responses.
- Capture `X-Amzn-Trace-Id` as an AWS edge/load-balancer signal when present,
  without treating it as the service's primary trace or correlation contract.
- Add OpenTelemetry traces for incoming HTTP/GraphQL requests and key
  reservation workflow operations.
- Add OpenTelemetry metrics for GraphQL success/failure rate, request duration,
  reservation processor outcomes, and diagnostic exception counts.
- Zero-initialize bounded GraphQL and reservation processor metric series.
- Add internal async propagation metadata to reservation work:
  - `correlation_id`
  - `request_id`
  - `traceparent`
  - optional `tracestate`
- Store that propagation metadata in Postgres and in-memory workflow metadata,
  but do not expose it through GraphQL.
- Add a production-shaped Dockerfile/runtime path for the API.
- Add local compose wiring for the API, Postgres, and app-local collector.
- Document how the external observability stack should scrape stdout JSON logs
  with Grafana Alloy and send them to Loki.
- Add a scripted smoke check that exercises a GraphQL request and verifies local
  signal emission at the API/collector level.
- Document manual Grafana/Tempo/Loki/Prometheus verification.

## 3. Non-goals

- Do not build the React frontend in D7.
- Do not add GraphQL `extensions` with correlation IDs in D7. Use HTTP headers
  now; GraphQL response extensions are a later convenience feature.
- Do not introduce `causation_id` yet. It belongs with later outbox, events,
  queues, or richer async workflow metadata.
- Do not export logs through OpenTelemetry logs in D7.
- Do not vendor the full Grafana, Loki, Tempo, and Prometheus backend stack into
  this repo. The external observability stack remains the backend owner.
- Do not add AWS X-Ray, AWS ADOT, ECS FireLens, CloudWatch alarms, or CDK
  observability resources in D7.
- Do not add a development container target in D7. Document it as a later
  convenience option.
- Do not add full automated observability e2e that queries Loki, Tempo, and
  Prometheus APIs. D7 should add a scripted smoke check; full backend-querying
  e2e comes later.
- Do not add broad custom persistence metrics. Use selected `knex`/`pg`
  instrumentation if compatible and keep custom business metrics at the
  GraphQL/reservation workflow level.
- Do not log raw bearer tokens, authorization headers, cookies, raw headers,
  full GraphQL query text, full request bodies, full GraphQL variables, or
  database URLs.

## 4. Current State

Repository and docs:

- `docs/architecture/architecture.md` already describes the target system as a
  frontend, Movie Reservation API, OpenTelemetry Collector, and observability
  backend.
- `docs/architecture/architecture-decisions.md` has `ADR 005: Standardize On
OpenTelemetry`.
- `docs/architecture/golden-path.md` lists structured logs, OpenTelemetry
  traces, resource attributes, and frontend-to-backend trace correlation as
  golden-path expectations.
- `docs/plans/movie-reservation-platform-roadmap.md` defines Deliverable 7 as
  adding OpenTelemetry SDK setup, auto-instrumentation, structured logging,
  metrics, collector config, Tempo, Loki, Prometheus, and Grafana.
- `docs/plans/service-follow-up-tasks.md` explicitly calls for structured JSON
  logging, Pino evaluation, request-scoped logging context similar to Python
  `structlog.contextvars`, GraphQL operation logging cleanup, and alert metrics
  that include auth failures.
- `docs/operations/runbook.md` already lists future observability checks:
  collector running, backend receiving traces, GraphQL producing traces, and
  logs including trace correlation fields.

Service startup and configuration:

- `movie-reservation-service/src/app.ts` creates the Nest app and configures the
  current basic Nest logger. It has a TODO to move logging to structured
  logging.
- `movie-reservation-service/src/config.ts` parses flat environment variables
  with Zod. It currently covers service port/host, log level, composition
  profile, Postgres settings, fake worker settings, `NODE_ENV`, and GraphiQL.
  It does not yet include observability settings.
- `movie-reservation-service/src/index.ts` imports the config and starts the
  Nest server.

GraphQL request path:

- `docs/architecture/graphql-request-flow.md` documents the current sequence:
  Nest middleware authenticates, Apollo creates context, resolvers call
  application services.
- `movie-reservation-service/src/presentation/graphql/movie-reservations-graphql.module.ts`
  applies `GraphqlAuthenticationMiddleware` to the `graphql` route.
- `movie-reservation-service/src/presentation/graphql/middleware/graphql-authentication.middleware.ts`
  extracts the bearer token, authenticates, and attaches `req.authenticatedUser`
  and `req.actor`.
- `movie-reservation-service/src/presentation/graphql/graphql-context.ts`
  defines the minimal HTTP request shape and GraphQL context.
- `movie-reservation-service/src/app.module.ts` wires Apollo
  `GraphQLModule.forRoot(...)`, builds GraphQL context, and installs
  `createGraphqlOperationLoggingPlugin(...)`.
- `movie-reservation-service/src/presentation/graphql/plugins/graphql-operation-logging.plugin.ts`
  currently emits one-line string logs with key-value formatting. Its tests note
  that these assertions are intentionally brittle and should be replaced during
  the observability deliverable.

Application and workflow:

- `movie-reservation-service/src/application/movie-reservations/movie-reservations.service.ts`
  owns movie/reservation use cases and creates `ReservationRequest` values.
- `movie-reservation-service/src/application/movie-reservations/in-process-reservation-request-processor.ts`
  claims pending work and records confirmed, rejected, retryable failure, failed,
  and no-pending outcomes.
- `movie-reservation-service/src/application/movie-reservations/ports/reservation-request-work-repository.ts`
  is the workflow-shaped port for claiming, heartbeating, confirming, rejecting,
  retrying, failing, and reading processing attempts.
- `movie-reservation-service/src/application/movie-reservations/claimed-reservation-request.ts`
  carries a claimed work item with reservation request, sequence, claim owner,
  lease timestamps, and failure counters.

Persistence:

- `movie-reservation-service/src/infrastructure/database/migrations/202605290001_create_movie_reservation_schema.ts`
  creates `reservation_requests` with operational columns such as `sequence`,
  `claimed_by`, `claim_token`, lease timestamps, retry counters, and
  `processed_at`.
- The same migration creates `reservation_request_processing_attempts`.
- `movie-reservation-service/src/infrastructure/repositories/in-memory/in-memory-movie-reservation.store.ts`
  stores request work metadata separately from domain request data.
- `movie-reservation-service/src/infrastructure/repositories/postgres/postgres-reservation-request-claimer.ts`
  maps claimed row state into `ClaimedReservationRequest`.
- `movie-reservation-service/src/infrastructure/repositories/postgres/postgres-reservation-request-state-store.ts`
  owns request status transitions and processing attempt inserts.
- `movie-reservation-service/src/infrastructure/repositories/postgres/postgres-mappers.ts`
  maps Postgres rows to domain/application types.

Docker and local runtime:

- Root `docker-compose.yml` currently starts only Postgres.
- There is no `movie-reservation-service/Dockerfile` yet.
- `movie-reservation-service/DEVELOPMENT.md` documents host-npm development and
  Postgres Compose dependencies. The API still runs on the host today.
- Env files exist for host and in-docker profiles under
  `movie-reservation-service/env_files/`, including `local-postgres.env`
  variants.

External examples:

- `/home/patex1987/development/fastapi_otel_prometheus_grafana_poc` has a
  collector that receives OTLP metrics/traces, exposes a Prometheus metrics
  endpoint on `:8889`, and exports traces to Tempo.
- The same PoC has Tempo, Prometheus, and Grafana examples, but it does not
  currently provide the complete Loki/stdout-log shipping path needed here.
- `/home/patex1987/development/python-agent-with-idp` and
  `/home/patex1987/development/yoga-studio-api` show the Python pattern of
  request-scoped context enrichment with `structlog.contextvars`.

Reference standards and docs:

- W3C Trace Context standardizes `traceparent` and `tracestate` HTTP headers for
  distributed trace propagation.
- AWS ALB request tracing adds or updates `X-Amzn-Trace-Id` before forwarding a
  request to the target, and ALB access logs can include that header.
- Grafana Promtail is EOL as of March 2, 2026; future development is in Grafana
  Alloy. The local log shipping plan should use Alloy rather than Promtail.
- OpenTelemetry Node.js docs recommend SDK initialization before application
  code and show the `--import` startup shape for instrumentation setup.

## 5. Requirements and Assumptions

### Confirmed Requirements

- Scope is backend observability foundation only. Frontend/LB correlation should
  be documented, not implemented.
- Logs must be ECS/CloudWatch-compatible stdout JSON, not OTLP logs.
- The service should use `traceparent`, `X-Correlation-Id`, and `X-Request-Id`.
- `X-Amzn-Trace-Id` must be documented and captured when present as an AWS edge
  signal.
- Structured logging should use Pino directly with a small wrapper and
  `AsyncLocalStorage`.
- OpenTelemetry should use hybrid instrumentation:
  - selected auto-instrumentation for useful framework/database coverage;
  - manual GraphQL and business instrumentation;
  - later ability to remove noisy auto-instrumentation.
- Include `knex`/`pg` instrumentation if compatible with service startup and
  package versions.
- GraphQL success/error metrics should use bounded business operations:
  `me`, `movies`, `screenings`, `requestReservation`,
  `reservationRequestStatus`, and `reservationResult`.
- Client-provided GraphQL operation names should be logged and traced, but not
  used as unbounded metric labels.
- Business observability should include GraphQL boundary metrics/spans plus
  reservation workflow internals.
- Local observability should use an app-local collector owned by this repo, with
  configurable export to the external Grafana stack.
- Metrics path should follow the FastAPI PoC shape: service sends OTLP metrics
  to the app-local collector, collector exposes a Prometheus scrape endpoint,
  external Prometheus scrapes it.
- Trace export from collector to Tempo should be configurable; the service to
  collector path should have a stable documented default.
- Logs should be collected by the external observability stack using Grafana
  Alloy scraping Docker/container stdout logs and sending them to Loki.
- D7 should include minimal API containerization so Loki log verification is
  possible.
- The API container should be production-shaped: compile TypeScript and run
  `node dist/src/index.js`.
- A future dev-container target should be documented but not implemented now.
- Sensitive logging policy should use a broad explicit allow-list initially:
  loose enough for learning/debugging, but no arbitrary object spreading and no
  known secret/header/body fields.
- Async reservation processing should preserve the original request's
  correlation metadata by storing internal workflow propagation metadata.
- Persist minimal async metadata only:
  `correlation_id`, `request_id`, `traceparent`, and optional `tracestate`.
- Do not include `causation_id` in D7.
- Use snake_case field names for logs and OTel semantic/project attributes for
  spans/metrics.
- Logs should include `trace_id`. Do not log raw propagation ballast such as
  `traceparent`, `tracestate`, `trace_flags`, or `parent_span_id` by default.
- Error metrics should have both:
  - low-cardinality alert metrics;
  - bounded diagnostic exception metrics.
- Logs/traces should include raw exception constructor names when safe.
- Metrics should be zero-initialized for all current bounded GraphQL operations
  and reservation processor outcomes.
- D7 should add a scripted smoke check, with full Loki/Tempo/Prometheus e2e
  deferred.
- Dependency selection may include Pino and official OpenTelemetry SDK/exporter/
  instrumentation packages. Exact package selection can be finalized during
  implementation after compatibility checks.

### Assumptions

- The external Grafana stack can be updated separately to include Loki and
  Grafana Alloy, or already has them by the time D7 verification runs.
- The app-local collector can push traces and metrics to the external stack
  collector over OTLP when running locally.
- The external stack can scrape Docker container logs by label or container name.
- The Docker runtime uses standard container stdout logging that Alloy can read.
- The repository's Node version supports the `--import` pattern used by current
  `tsx` scripts and recommended by OpenTelemetry Node.js docs.
- OTel auto-instrumentation can be configured selectively. If a particular
  instrumentation is noisy or incompatible, it can be disabled without blocking
  the rest of D7.
- `X-Request-Id` is a conventional header rather than a formal universal
  standard. D7 uses it as the per-inbound-HTTP-request id.
- `X-Correlation-Id` is the business/user-action/workflow grouping id.
- `traceparent` is the technical distributed trace propagation contract.
- `X-Amzn-Trace-Id` is not transformed into the primary trace id. It is logged
  as AWS edge metadata only.

### Open Questions

- Exact external observability stack URLs/ports for Tempo, Loki, and Prometheus
  need to be confirmed during implementation against
  `/home/patex1987/development/fastapi_otel_prometheus_grafana_poc` or the
  current external stack.
- Exact OpenTelemetry package versions and instrumentations need to be finalized
  after checking compatibility with current Node, TypeScript, NestJS, Apollo,
  Knex, and Postgres package versions.
- Whether the app-local collector should export traces to external Tempo over
  OTLP gRPC or OTLP HTTP is intentionally configurable and should be set by env
  or collector config.
- Whether the smoke script should be a TypeScript script, shell script, or npm
  script should be decided by implementation ergonomics.

## 6. Proposed Design

### Request Context And Header Contract

Add an early HTTP request context middleware that runs before GraphQL
authentication and any request-specific logging.

Responsibilities:

- Read incoming `traceparent` and `tracestate` headers. OTel owns validation and
  span context extraction.
- Read incoming `X-Correlation-Id`; generate a new UUID if missing or invalid.
- Read incoming `X-Request-Id`; generate a new UUID if missing or invalid.
- Read incoming `X-Amzn-Trace-Id`; store it as optional edge metadata.
- Bind request context with `AsyncLocalStorage`.
- Add `X-Correlation-Id` and `X-Request-Id` to all responses.
- Make request context available to logging, GraphQL plugins, auth middleware,
  application services, and reservation workflow propagation.

The practical mental model is the Python `structlog.contextvars` pattern, but
implemented through Node's `AsyncLocalStorage`.

Header semantics:

| Header             | Owner                          | D7 behavior                                                                                                 |
| ------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `traceparent`      | W3C/OpenTelemetry              | Extract and propagate through OTel. Do not manually generate unless using OTel propagation APIs.            |
| `tracestate`       | W3C/OpenTelemetry/vendor state | Preserve when present through OTel propagation. Store optional value in async work metadata.                |
| `X-Correlation-Id` | Application/platform           | Accept or generate. Use to group user actions/workflows across services and async work. Return on response. |
| `X-Request-Id`     | Application/platform           | Accept or generate. Use for one inbound HTTP request. Return on response.                                   |
| `X-Amzn-Trace-Id`  | AWS ALB edge                   | Capture/log when present. Do not treat as primary trace/correlation contract.                               |

### Structured Logging

Add a small logging module under a location such as
`src/infrastructure/observability/logging/` or
`src/presentation/observability/`, with final placement chosen to preserve
clean architecture boundaries.

Recommended shape:

- `logger.ts` or `application-logger.ts`: focused wrapper around Pino.
- `request-context.ts`: `AsyncLocalStorage` store and helpers.
- `log-fields.ts`: typed field contracts and allow-list helpers.
- `nest-logger.adapter.ts`: optional Nest `LoggerService` adapter so Nest
  framework logs go through Pino.

The wrapper should make the safe path easy:

- `logger.info(event, fields)`
- `logger.warn(event, fields)`
- `logger.error(event, fields, error)`
- `withRequestContext(context, fn)`
- `enrichRequestContext(fields)` after authentication.

Do not allow arbitrary spreading of request objects, headers, GraphQL variables,
or exception objects into log fields.

Log field naming:

- Use snake_case in logs.
- Include `trace_id` when an active OTel span exists.
- Do not log raw propagation ballast such as `traceparent`, `tracestate`,
  `trace_flags`, or `parent_span_id` by default.
- Include request/correlation fields from `AsyncLocalStorage`.
- Include identity fields only after authentication.
- Include GraphQL operation metadata at the GraphQL boundary.

### OpenTelemetry Startup

Add OpenTelemetry SDK bootstrap before the Nest app imports and starts.

Likely files:

- `movie-reservation-service/src/observability/instrumentation.ts`
- package scripts updated to run:
  - host development: `node --env-file=... --watch --import tsx --import ./src/observability/instrumentation.ts src/index.ts`
    or an equivalent compatible order
  - compiled container: `node --import dist/src/observability/instrumentation.js dist/src/index.js`

Implementation must verify import ordering. OTel instrumentation should load
before modules such as Express, Nest, Apollo, Knex, or `pg` if those libraries
need patching.

Configuration should support:

- `OTEL_SERVICE_NAME`
- `OTEL_RESOURCE_ATTRIBUTES`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_PROTOCOL`
- `OTEL_TRACES_EXPORTER`
- `OTEL_METRICS_EXPORTER`
- `OTEL_PROPAGATORS`
- app-specific toggles if needed, such as
  `OBSERVABILITY_ENABLED=true|false` and
  `OBSERVABILITY_DIAGNOSTIC_EXPORTERS_ENABLED=true|false`

Use official OpenTelemetry packages. Prefer selected instrumentation over
turning every auto-instrumentation on blindly.

Initial instrumentation target:

- HTTP/Express incoming requests.
- Apollo/GraphQL if a suitable official/contrib instrumentation is compatible.
- `knex` and/or `pg` instrumentation if compatible.
- Manual GraphQL operation spans and metrics.
- Manual reservation workflow spans and metrics.

### GraphQL Observability

Replace the current string-based GraphQL logging plugin with a structured
observability plugin or refactor it into a structured plugin.

Responsibilities:

- Record operation start/finish/failure structured logs.
- Add GraphQL attributes to the active span:
  - `graphql.operation.name`
  - `graphql.operation.type`
  - project-specific bounded `business.operation`
- Emit metrics:
  - `graphql_operation_total`
  - `graphql_operation_errors_total`
  - `graphql_operation_duration_ms` or equivalent histogram
  - bounded diagnostic exception counter
- Use bounded business operation labels, not arbitrary client operation names,
  for metrics.
- Keep client operation name in logs/traces.
- Classify failures with both:
  - low-cardinality `error_family` for alerting;
  - bounded `exception_type` mapping for diagnostic metrics.
- Preserve raw exception constructor name in logs/spans where safe.

Bounded GraphQL business operations:

- `me`
- `movies`
- `screenings`
- `requestReservation`
- `reservationRequestStatus`
- `reservationResult`
- `unknown`

### Reservation Workflow Observability

Instrument application-level reservation workflow without pushing observability
concerns into domain entities.

Recommended files:

- `movie-reservation-service/src/application/movie-reservations/movie-reservations.service.ts`
- `movie-reservation-service/src/application/movie-reservations/in-process-reservation-request-processor.ts`
- new observability helper/type files under application or infrastructure,
  depending on dependency direction

Metrics:

- `reservation_request_created_total`
- `reservation_processor_claim_total`
- `reservation_processor_outcome_total`
- `reservation_processor_duration_ms` or equivalent histogram
- diagnostic exception counter for bounded known exceptions

Processor outcomes to initialize:

- `no-pending-request`
- `confirmed`
- `rejected`
- `retryable-failure`
- `failed`

Spans:

- `movie_reservation.request_reservation`
- `movie_reservation.processor.process_next_pending`
- `movie_reservation.processor.claim`
- `movie_reservation.processor.confirm`
- `movie_reservation.processor.reject`
- `movie_reservation.processor.retry`
- `movie_reservation.processor.fail`

These span names can change during implementation if a local convention emerges,
but they should stay explicit and business-readable.

### Async Propagation Metadata

Add an internal metadata type, for example:

```ts
export interface ReservationWorkObservabilityContext {
  readonly correlationId: string;
  readonly requestId: string;
  readonly traceparent: string;
  readonly tracestate?: string;
}
```

Do not add this to the domain `ReservationRequest` type or GraphQL models.

Instead, carry it through the application workflow boundary and persistence
metadata:

- Extend request creation flow so `MovieReservationsService.requestReservation`
  can attach the current context to saved work.
- Extend `MovieReservationRepository.saveReservationRequest(...)` or introduce a
  more specific application port method if the current repository interface
  would become confused.
- Extend in-memory work metadata to store the context.
- Add nullable Postgres columns on `reservation_requests`:
  - `correlation_id`
  - `request_id`
  - `traceparent`
  - `tracestate`
- Extend Postgres row/mappers and claim path so `ClaimedReservationRequest`
  can expose this metadata to the processor.

Recommended shape:

- `ClaimedReservationRequest` gains optional
  `observabilityContext?: ReservationWorkObservabilityContext`.
- Processor logs/spans use this metadata when present.
- If metadata is missing, processor generates fresh request-local context and
  logs a warning or uses an `observability_context_missing=true` field.

### Containerization And Compose

Add minimal production-shaped API containerization:

- `movie-reservation-service/Dockerfile`
- `.dockerignore` as needed
- compiled app runtime: `npm run build`, then `node dist/src/index.js`
- production-shaped image target only
- no source-mounted dev target in D7

Update compose wiring:

- Keep Postgres service.
- Add API service profile, likely `api`.
- Add app-local collector service profile, likely `observability`.
- Add labels to API container so external Alloy can filter/scrape it, for
  example:
  - `observability.logs=true`
  - `service.name=movie-reservation-service`
  - `service.environment=local`
- API env should use `env_files/in-docker/local-postgres.env`.
- API `DATABASE_URL` should point to `postgres:5432`.
- API `OTEL_EXPORTER_OTLP_ENDPOINT` should point to the app-local collector.
- API should depend on Postgres health and collector startup where practical.

Collector:

- Add `observability/otel-collector.yaml` or similar.
- Receiver: OTLP HTTP/gRPC.
- Processor: batch.
- Trace exporter: configurable OTLP to external Tempo.
- Metrics exporters: local Prometheus endpoint for debugging and configurable
  OTLP forwarding to the external stack collector.
- Optional debug exporter behind config or comment for local troubleshooting.

External stack:

- This repo should not own Loki/Grafana/Tempo/Prometheus backend containers in
  D7.
- Docs should show how to run or adapt the external stack.
- External stack should run Grafana Alloy to scrape Docker logs and send them to
  Loki.
- External Prometheus should scrape the external stack collector. This repo's
  app-local collector should push OTLP metrics to that external collector.

### Frontend And Load Balancer Correlation Documentation

Add a docs section that future frontend work can implement:

- Browser/frontend should preserve or create a user-action `X-Correlation-Id`.
- Browser/frontend OTel should send W3C `traceparent` when frontend tracing is
  enabled.
- Backend returns `X-Correlation-Id` and `X-Request-Id`.
- Playwright should capture response headers and attach these IDs to failure
  reports.
- A failing UI flow can be debugged by:
  1. checking Playwright response headers;
  2. searching Loki by `correlation_id` or `request_id`;
  3. opening Tempo by `trace_id`;
  4. checking Prometheus/Grafana error-rate panels by bounded business
     operation.
- In ECS/ALB later, capture `X-Amzn-Trace-Id` from incoming requests and map it
  to `aws_x_amzn_trace_id` in logs. Use it to join ALB access logs with backend
  logs when needed.

## 7. Alternatives Considered

### Alternative A: OTLP Logs Instead Of Stdout JSON

- Pros:
  - One telemetry protocol for logs, metrics, and traces.
  - Collector can theoretically own all signal routing.
- Cons:
  - Worse fit for ECS/CloudWatch's normal container log path.
  - OTel JS logging adds complexity early.
  - User's prior LGTM experience did not rely on OTel logs.
- Decision:
  - Rejected for D7. Use stdout JSON logs and external log shipping.

### Alternative B: `nestjs-pino`

- Pros:
  - Common Nest production integration.
  - Less custom adapter code for Nest request logging.
  - Helps route Nest framework logs through Pino.
- Cons:
  - Adds a Nest-specific abstraction.
  - Still requires custom request/auth/trace enrichment.
  - Less explicit learning value around platform logging contract.
- Decision:
  - Rejected for D7. Use Pino directly with a small wrapper and
    `AsyncLocalStorage`.

### Alternative C: No API Containerization In D7

- Pros:
  - Keeps D7 focused on host-npm service observability.
  - Avoids pulling Dockerfile work into observability.
- Cons:
  - Cannot realistically verify Docker stdout logs in Loki.
  - D7's "logs visible in Loki" outcome depends on later container work.
- Decision:
  - Rejected. Include minimal production-shaped API containerization as enabling
    work.

### Alternative D: App Repo Owns Full Grafana Stack

- Pros:
  - Self-contained local demo.
  - Easier to run one repo and verify everything.
- Cons:
  - Duplicates the external observability project.
  - Less realistic ownership: observability backend should be a platform/shared
    concern.
- Decision:
  - Rejected. This repo owns the API, telemetry contract, and app-local
    collector. External stack owns backends and log collection.

### Alternative E: Store GraphQL And Identity Metadata In Async Work

- Pros:
  - Processor logs would have all context without looking at the reservation
    request.
  - Easy to inspect one work metadata object.
- Cons:
  - Duplicates fields already present on `ReservationRequest`.
  - Makes workflow metadata heavier than needed.
  - Feels unlike the user's prior experience and is unnecessary for D7.
- Decision:
  - Rejected. Persist only propagation metadata:
    `correlation_id`, `request_id`, `traceparent`, and optional `tracestate`.

### Alternative F: Raw Exception Class Names As Metric Labels

- Pros:
  - Fine-grained diagnostic metrics with little mapping code.
  - Worked in the user's prior experience.
- Cons:
  - Metric cardinality can grow accidentally.
  - Refactors can rename classes and break dashboard continuity.
- Decision:
  - Use bounded diagnostic exception labels for metrics. Keep raw constructor
    names in logs/traces.

## 8. API / Interface Changes

HTTP headers:

- Accept inbound `X-Correlation-Id`.
- Accept inbound `X-Request-Id`.
- Return `X-Correlation-Id` on all HTTP responses.
- Return `X-Request-Id` on all HTTP responses.
- Accept `traceparent`/`tracestate` through OTel propagation.
- Capture inbound `X-Amzn-Trace-Id` as `aws_x_amzn_trace_id` when present.

GraphQL:

- No schema changes.
- No GraphQL response `extensions` changes in D7.
- Current GraphQL operation logging plugin behavior changes from string log
  messages to structured logs and metrics.

Internal TypeScript interfaces:

- Add request context types.
- Add logging field types.
- Add `ReservationWorkObservabilityContext`.
- Extend reservation request save/claim workflow interfaces to carry internal
  propagation metadata.
- Extend `ClaimedReservationRequest` to carry optional observability context.

Configuration:

- Add observability-related env vars to `src/config.ts` and env files/templates.
- Add OTel env vars to in-docker and local env profiles.
- Add Docker/collector endpoints to compose/env docs.

NPM scripts:

- Update dev/start scripts to preload OTel instrumentation where enabled.
- Add container build/run scripts only if useful beyond compose.
- Add a smoke script for observability.

Docker/Compose:

- Add API service and collector service.
- Add service labels for log scraping.
- Add collector config file.

## 9. Data Model / Persistence Changes

Add nullable columns to `reservation_requests`:

- `correlation_id text null`
- `request_id text null`
- `traceparent text null`
- `tracestate text null`

Rationale:

- `reservation_requests` already holds internal operational workflow metadata:
  sequence, claims, leases, retry counters, processed timestamps.
- These columns preserve correlation after retries, process restarts, and future
  worker separation.
- They are not domain/customer fields and must not be exposed through GraphQL.

Migration:

- Because current local schema has one migration, implementation can either:
  - add a new migration for the columns, preferred for realistic migration
    practice; or
  - modify the existing early migration only if the project has not yet treated
    it as durable.
- Prefer a new migration for D7 to practice real schema evolution.

Compatibility:

- Existing rows can have null metadata.
- Processor should handle missing metadata gracefully.

Rollback:

- Remove code use of metadata.
- Drop nullable columns.
- Existing business data remains valid because the fields are operational only.

## 10. Security, Privacy, And Abuse Considerations

- Do not log raw `Authorization` headers, bearer tokens, cookies, raw headers,
  full request bodies, full GraphQL queries, full GraphQL variables, or
  `DATABASE_URL`.
- Use a broad explicit allow-list for log fields. Do not spread arbitrary
  request, response, error, GraphQL context, or database objects into logs.
- Treat incoming `X-Correlation-Id` and `X-Request-Id` as untrusted:
  - validate length and allowed characters;
  - generate a fresh id when invalid;
  - avoid using them in SQL without parameterization;
  - avoid using them as authorization data.
- Treat incoming `traceparent`, `tracestate`, and `X-Amzn-Trace-Id` as
  untrusted telemetry data.
- Do not trust caller-supplied sampling intent blindly for security decisions.
- Avoid unbounded metric labels:
  - bounded business operations;
  - bounded error families;
  - bounded diagnostic exception labels.
- Auth-derived identity fields are added only after successful authentication.
- Auth failures should still have request/correlation ids, but should not include
  trusted user/provider fields.
- GraphQL error messages may include sensitive details in the future. D7 may
  keep sanitized exception messages for learning/debugging, but the plan should
  include a follow-up to tighten production error scrubbing.
- `X-Amzn-Trace-Id` is logged only as edge metadata. It should not become an
  auth, tenant, or business routing input.

## 11. Performance, Scalability, And Reliability Considerations

- Pino is chosen because it is a common low-overhead structured logger for Node.
- `AsyncLocalStorage` has overhead but is appropriate for request-scoped
  context. Keep context small and avoid storing large objects.
- OTel auto-instrumentation can be noisy. Start with selected instrumentations
  and document how to disable noisy ones.
- Batch OTel exporters through the SDK/collector to avoid blocking request paths.
- If collector/backend is unavailable:
  - service should continue serving requests;
  - telemetry export failures should not fail business requests;
  - logs should still be emitted to stdout.
- Initialize metric series to zero so alert/dashboard queries do not miss series
  until the first event.
- Keep Prometheus labels bounded to avoid cardinality explosions.
- App-local collector scrape endpoint should be exposed only locally in D7.
- Docker health checks should remain simple and not depend on observability
  backends.
- Graceful shutdown should flush OTel exporters where practical, without hanging
  indefinitely.
- Minimal API containerization should use production-shaped startup to match ECS
  expectations: compiled app, stdout logs, env config, no source mounts.

## 12. Implementation Steps

1. Add observability configuration
   - Change:
     - Extend `movie-reservation-service/src/config.ts` with observability
       settings and OTel-related defaults where app-specific parsing is needed.
     - Update env files/templates under `movie-reservation-service/env_files/`.
   - Files/modules likely affected:
     - `movie-reservation-service/src/config.ts`
     - `movie-reservation-service/env_files/local/*.env`
     - `movie-reservation-service/env_files/in-docker/*.env`
     - `movie-reservation-service/env_files/templates/**`
     - `movie-reservation-service/test/unit/config/env-profiles.test.ts`
   - Notes:
     - Prefer standard OTel env vars for OTel settings.
     - Add app-specific toggles only when standard OTel vars are not enough.
   - Verification:
     - `npm -w movie-reservation-service run test:unit -- test/unit/config/env-profiles.test.ts`

2. Add request context and header middleware
   - Change:
     - Add `AsyncLocalStorage` request context helpers.
     - Add early middleware that accepts/generates `correlation_id` and
       `request_id`, captures `X-Amzn-Trace-Id`, and writes response headers.
     - Ensure it runs before `GraphqlAuthenticationMiddleware`.
   - Files/modules likely affected:
     - `movie-reservation-service/src/presentation/http/**` or
       `movie-reservation-service/src/presentation/observability/**`
     - `movie-reservation-service/src/presentation/graphql/movie-reservations-graphql.module.ts`
     - `movie-reservation-service/src/app.module.ts`
     - `movie-reservation-service/src/presentation/graphql/graphql-context.ts`
   - Notes:
     - Use runtime validation for inbound ids.
     - Do not require auth for context creation.
   - Verification:
     - Integration tests prove `/health`, `/ready`, GraphQL success, GraphQL
       error, and `401` responses return both headers.

3. Add Pino structured logging wrapper
   - Change:
     - Add Pino dependency.
     - Add logging wrapper, field allow-list helpers, OTel trace field reader,
       and optional Nest logger adapter.
     - Replace basic Nest logger setup in `src/app.ts`.
   - Files/modules likely affected:
     - `movie-reservation-service/package.json`
     - `movie-reservation-service/src/app.ts`
     - new `movie-reservation-service/src/**/observability/logging/**`
   - Notes:
     - Logs use snake_case.
     - Logs include `trace_id` when available.
     - Logs do not include raw propagation ballast such as `traceparent`,
       `tracestate`, `trace_flags`, or `parent_span_id` by default.
     - Avoid arbitrary object spreading.
   - Verification:
     - Unit tests for log field construction and sensitive-field rejection.
     - Integration test with captured logger verifies structured fields.

4. Add OpenTelemetry SDK bootstrap
   - Change:
     - Add official OTel SDK/exporter/instrumentation dependencies.
     - Add instrumentation preload file.
     - Update dev/start scripts to load instrumentation before app code.
   - Files/modules likely affected:
     - `movie-reservation-service/package.json`
     - `movie-reservation-service/src/observability/instrumentation.ts`
     - `movie-reservation-service/package.json` scripts
   - Notes:
     - Use official OTel docs for startup ordering.
     - Keep instrumentation configurable.
   - Verification:
     - Typecheck.
     - Local startup with instrumentation enabled and disabled.

5. Replace GraphQL string logging with structured observability plugin
   - Change:
     - Refactor or replace `createGraphqlOperationLoggingPlugin`.
     - Emit structured logs, span attributes, alert metrics, diagnostic metrics,
       and duration histograms.
   - Files/modules likely affected:
     - `movie-reservation-service/src/presentation/graphql/plugins/graphql-operation-logging.plugin.ts`
     - `movie-reservation-service/src/app.module.ts`
     - `movie-reservation-service/test/integration/api/graphql.test.ts`
   - Notes:
     - Metrics labels use bounded business operations.
     - Client operation names stay in logs/traces only.
   - Verification:
     - Update current brittle string tests to structured assertions.

6. Add business metrics/spans for reservation use cases and processor
   - Change:
     - Instrument request creation and processor outcomes.
     - Initialize bounded metric series for current operations/outcomes.
   - Files/modules likely affected:
     - `movie-reservation-service/src/application/movie-reservations/movie-reservations.service.ts`
     - `movie-reservation-service/src/application/movie-reservations/in-process-reservation-request-processor.ts`
     - new observability helper modules
     - `movie-reservation-service/test/integration/application/reservation-request-processor.test.ts`
   - Notes:
     - Keep domain types free from OTel/Pino imports.
     - Prefer small injected observability helper interfaces if direct OTel use
       would couple application code too strongly.
   - Verification:
     - Unit/integration tests using fakes or in-memory metric reader where
       practical.

7. Add async propagation metadata to reservation work
   - Change:
     - Add `ReservationWorkObservabilityContext`.
     - Capture current request context when creating a reservation request.
     - Store context in in-memory metadata and Postgres `reservation_requests`.
     - Return context on claimed work items.
   - Files/modules likely affected:
     - `movie-reservation-service/src/application/movie-reservations/claimed-reservation-request.ts`
     - `movie-reservation-service/src/application/movie-reservations/ports/movie-reservation-repository.ts`
     - `movie-reservation-service/src/application/movie-reservations/movie-reservations.service.ts`
     - `movie-reservation-service/src/infrastructure/repositories/in-memory/in-memory-movie-reservation.store.ts`
     - `movie-reservation-service/src/infrastructure/repositories/postgres/postgres-mappers.ts`
     - `movie-reservation-service/src/infrastructure/repositories/postgres/postgres-movie-reservation.repository.ts`
     - `movie-reservation-service/src/infrastructure/repositories/postgres/postgres-reservation-request-claimer.ts`
   - Notes:
     - If changing `MovieReservationRepository.saveReservationRequest` becomes
       confusing, introduce a focused application workflow port instead of
       overloading a generic repository method.
   - Verification:
     - In-memory tests prove metadata survives create -> claim.
     - Postgres e2e proves metadata persists and is returned on claim.

8. Add Postgres migration for propagation columns
   - Change:
     - Add migration with nullable `correlation_id`, `request_id`,
       `traceparent`, and `tracestate` columns.
   - Files/modules likely affected:
     - `movie-reservation-service/src/infrastructure/database/migrations/*.ts`
     - `movie-reservation-service/test/e2e/postgres-movie-reservations.test.ts`
   - Notes:
     - Prefer a new migration to practice schema evolution.
   - Verification:
     - `npm -w movie-reservation-service run test:e2e`

9. Add production-shaped API containerization
   - Change:
     - Add service Dockerfile and `.dockerignore`.
     - Ensure container builds, runs compiled JS, and uses env-file config.
   - Files/modules likely affected:
     - `movie-reservation-service/Dockerfile`
     - `movie-reservation-service/.dockerignore`
     - root `docker-compose.yml`
     - `movie-reservation-service/DEVELOPMENT.md`
     - `docs/operations/runbook.md`
   - Notes:
     - No dev target in D7.
   - Verification:
     - Docker build succeeds.
     - Container returns `/health` and `/ready`.

10. Add app-local collector config and compose profile
    - Change:
      - Add collector config.
      - Add collector service to compose.
      - Wire API OTLP endpoint to collector.
      - Expose collector Prometheus scrape endpoint for external Prometheus.
    - Files/modules likely affected:
      - root `docker-compose.yml`
      - `observability/otel-collector.yaml`
      - env files/templates
      - docs
    - Notes:
      - Collector-to-Tempo exporter protocol is configurable.
      - Metrics keep a local Prometheus debug endpoint and also push to the
        external stack collector over OTLP.
    - Verification:
      - Collector starts.
      - Collector metrics endpoint is reachable.

11. Document external Grafana stack integration
    - Change:
      - Document expected external stack responsibilities.
      - Document Alloy Docker log scraping by container label.
      - Document Loki, Tempo, Prometheus, and Grafana manual checks.
    - Files/modules likely affected:
      - `docs/operations/runbook.md`
      - possibly `docs/workflows/local-observability.md`
      - `movie-reservation-service/DEVELOPMENT.md`
    - Notes:
      - Link to external project path:
        `/home/patex1987/development/fastapi_otel_prometheus_grafana_poc`.
      - Note that Promtail is EOL and Alloy should be used.
    - Verification:
      - Docs contain runnable command sequence.

12. Add scripted observability smoke check
    - Change:
      - Add a script that sends representative GraphQL requests and checks local
        signal surfaces such as response headers and collector/Prometheus metric
        names.
    - Files/modules likely affected:
      - `movie-reservation-service/package.json` or root `package.json`
      - possible `movie-reservation-service/scripts/observability-smoke.ts`
    - Notes:
      - Do not require full Grafana/Loki/Tempo API assertions in D7.
      - Include a success request and a failure request.
    - Verification:
      - Script passes against local compose API + collector.

13. Update docs and runbook
    - Change:
      - Document log field contract.
      - Document frontend/LB correlation contract.
      - Document local commands and manual checks.
      - Update docs index.
    - Files/modules likely affected:
      - `docs/index.md`
      - `docs/operations/runbook.md`
      - `movie-reservation-service/DEVELOPMENT.md`
      - optional `docs/architecture/graphql-request-flow.md`
    - Notes:
      - Include Playwright/header capture guidance for future frontend.
      - Include ALB `X-Amzn-Trace-Id` notes for future ECS.
    - Verification:
      - Documentation paths are linked and commands are current.

14. Run verification
    - Change:
      - Run focused tests while iterating, then full relevant checks.
    - Files/modules likely affected:
      - none beyond changed files
    - Notes:
      - Use narrow checks first, then full service check.
    - Verification:
      - `npm -w movie-reservation-service run test:unit`
      - `npm -w movie-reservation-service run test:integration`
      - `npm -w movie-reservation-service run test:e2e`
      - `npm -w movie-reservation-service run check`
      - Docker build/run smoke
      - Observability smoke script

## 13. Testing Strategy

Unit tests:

- `parseConfig` covers new observability env settings and defaults.
- Request id/correlation id validation accepts safe ids and regenerates invalid
  ids.
- Logging field builder includes request/trace fields and excludes forbidden
  fields.
- Error classification maps known exceptions to bounded labels and unknown
  exceptions to `unexpected_error`.
- Business operation mapping converts current GraphQL resolver/top-level fields
  into bounded metric labels.

Integration tests:

- `/health` and `/ready` responses include `X-Correlation-Id` and
  `X-Request-Id`.
- GraphQL success response includes headers and structured logs.
- GraphQL failure response includes headers, structured failure log, and
  bounded error metrics.
- `401` authentication failure includes headers and logs without trusted
  identity fields.
- GraphQL operation logging tests no longer assert string fragments. They assert
  structured fields.
- Reservation processor tests assert outcome metric/log calls where practical.

Persistence/e2e tests:

- In-memory repository/work tests prove observability context survives
  reservation request creation and claim.
- Postgres e2e proves nullable columns persist metadata and claim returns it.
- Existing reservation workflow e2e remains green.

Docker/observability smoke:

- Build API image.
- Start Postgres, API, and collector.
- Run migrations/seed if needed.
- Send one successful GraphQL operation.
- Send one failing GraphQL operation.
- Assert response headers are present.
- Assert local collector/Prometheus endpoint exposes expected metric names.
- Manually verify in Grafana:
  - trace in Tempo;
  - logs in Loki with matching `trace_id`/`correlation_id`;
  - metrics in Prometheus/Grafana.

Deferred tests:

- Full automated Loki/Tempo/Prometheus API e2e.
- Frontend-to-backend Playwright trace correlation.
- ECS/ALB/CloudWatch correlation tests.

## 14. Rollout / Migration Plan

Local rollout:

1. Add code behind config with observability enabled for local profiles.
2. Keep tests using `NODE_ENV=test` quiet by default unless a test explicitly
   captures logs/metrics.
3. Add Postgres nullable migration.
4. Add Dockerfile and compose profiles.
5. Add collector config and smoke docs.

Backward compatibility:

- GraphQL schema remains unchanged.
- Existing GraphQL operation behavior remains unchanged.
- Existing health endpoints remain unchanged except for additional response
  headers.
- Existing host-npm development should continue to work.
- Existing Postgres rows remain valid with null observability columns.

Rollback:

- Disable OTel exporters via env.
- Use log wrapper with stdout JSON only if OTel is failing.
- Remove or ignore app-local collector compose profile.
- Drop nullable Postgres observability columns if needed.
- Revert Docker API service without affecting Postgres-only compose.

Operational checks:

- Service starts without collector available.
- Logs still emit to stdout if OTel export fails.
- Collector starts and exposes health/metrics.
- External Grafana stack can scrape logs/metrics/traces when configured.

## 15. Risks And Mitigations

| Risk                                                              | Impact | Likelihood | Mitigation                                                                                                           |
| ----------------------------------------------------------------- | -----: | ---------: | -------------------------------------------------------------------------------------------------------------------- |
| OTel instrumentation import order is wrong, causing missing spans |   High |     Medium | Add instrumentation preload before app imports; verify with smoke request.                                           |
| Auto-instrumentation produces noisy spans                         | Medium |       High | Enable selected instrumentations and document how to disable noisy ones.                                             |
| Metric label cardinality grows                                    |   High |     Medium | Use bounded business operations, error families, and diagnostic exception mapping.                                   |
| Logs leak secrets or raw request data                             |   High |     Medium | Use explicit field allow-list and tests for forbidden fields.                                                        |
| Collector/backend outage affects API                              |   High |        Low | Use non-blocking exporters and verify app runs without collector.                                                    |
| API containerization expands D7 scope                             | Medium |     Medium | Keep production-shaped container only; no dev target or platform abstraction.                                        |
| External Grafana stack lacks Loki/Alloy                           | Medium |     Medium | Document external stack requirements and keep app repo responsible only for stdout JSON and labels.                  |
| Postgres metadata columns are mistaken for business fields        | Medium |        Low | Keep them nullable/internal, do not expose through domain GraphQL models, document as workflow propagation metadata. |
| Request/correlation ids are trusted incorrectly                   |   High |        Low | Validate and treat ids as untrusted observability metadata only.                                                     |
| Tests become brittle around concrete logs                         | Medium |     Medium | Test structured fields and behavior, not exact serialized JSON ordering.                                             |
| OTel package compatibility changes                                | Medium |     Medium | Allow official package-family selection during implementation; stop if unsupported dependency is needed.             |

## 16. Done Criteria

- `issue-4_observability-foundation` contains an implementation following this
  plan.
- API emits structured JSON logs to stdout.
- Logs include request/correlation ids and `trace_id` when available.
- All HTTP response paths include `X-Correlation-Id` and `X-Request-Id`.
- GraphQL success/failure logs are structured, not string key-value logs.
- OTel traces and metrics emit through app-local collector.
- Current bounded GraphQL operations and processor outcomes have
  zero-initialized metrics.
- Reservation work stores and returns minimal propagation metadata in in-memory
  and Postgres modes.
- Minimal API Dockerfile and compose API service exist and run the compiled app.
- App-local collector config exists and can receive OTLP from API.
- External Grafana stack integration is documented, including Alloy/Loki log
  scraping and ALB `X-Amzn-Trace-Id` notes.
- Scripted observability smoke check exists and passes locally.
- Relevant tests and checks pass:
  - `npm -w movie-reservation-service run test:unit`
  - `npm -w movie-reservation-service run test:integration`
  - `npm -w movie-reservation-service run test:e2e`
  - `npm -w movie-reservation-service run check`

## 17. Review Checklist

- [ ] Requirements are explicit
- [ ] Non-goals are explicit
- [ ] Existing code conventions were checked
- [ ] Alternatives were considered
- [ ] Security implications were reviewed
- [ ] Scalability and reliability implications were reviewed
- [ ] Testing strategy is complete
- [ ] Rollout and rollback are defined
- [ ] Implementation steps are ordered and concrete

## 18. Handoff Prompt For Implementation Agent

Copy/paste this prompt into a coding agent:

```text
Implement the plan in docs/plans/local-observability-foundation.md.

Constraints:
- Stay within the scope of the plan.
- Do not introduce new dependencies unless the plan explicitly allows it.
- Allowed dependency families are Pino and official OpenTelemetry SDK/exporter/
  instrumentation packages, with exact package selection finalized after
  compatibility checks.
- Preserve existing GraphQL schema and public behavior unless the plan
  explicitly changes headers/logging/telemetry.
- Logs must remain stdout JSON, not OTLP logs.
- Do not log raw tokens, raw authorization headers, cookies, raw headers, full
  GraphQL queries, full request bodies, full GraphQL variables, or DATABASE_URL.
- Follow existing NestJS, TypeScript, clean-architecture, and Vitest
  conventions.
- Keep domain types free of Pino/OpenTelemetry dependencies.
- Update tests and docs described in the plan.
- If implementation reality differs from the plan, stop and update the plan or
  ask for approval before changing scope.

Relevant files/modules:
- movie-reservation-service/src/app.ts
- movie-reservation-service/src/index.ts
- movie-reservation-service/src/config.ts
- movie-reservation-service/src/app.module.ts
- movie-reservation-service/src/presentation/graphql/movie-reservations-graphql.module.ts
- movie-reservation-service/src/presentation/graphql/middleware/graphql-authentication.middleware.ts
- movie-reservation-service/src/presentation/graphql/plugins/graphql-operation-logging.plugin.ts
- movie-reservation-service/src/presentation/graphql/graphql-context.ts
- movie-reservation-service/src/application/movie-reservations/movie-reservations.service.ts
- movie-reservation-service/src/application/movie-reservations/in-process-reservation-request-processor.ts
- movie-reservation-service/src/application/movie-reservations/claimed-reservation-request.ts
- movie-reservation-service/src/application/movie-reservations/ports/
- movie-reservation-service/src/infrastructure/database/migrations/
- movie-reservation-service/src/infrastructure/repositories/in-memory/
- movie-reservation-service/src/infrastructure/repositories/postgres/
- movie-reservation-service/test/unit/config/env-profiles.test.ts
- movie-reservation-service/test/integration/api/graphql.test.ts
- movie-reservation-service/test/integration/api/health.test.ts
- movie-reservation-service/test/integration/application/reservation-request-processor.test.ts
- movie-reservation-service/test/integration/infrastructure/in-memory-movie-reservation.repository.test.ts
- movie-reservation-service/test/e2e/postgres-movie-reservations.test.ts
- movie-reservation-service/package.json
- root docker-compose.yml
- movie-reservation-service/DEVELOPMENT.md
- docs/operations/runbook.md
- docs/index.md

Expected verification commands:
- npm -w movie-reservation-service run test:unit
- npm -w movie-reservation-service run test:integration
- npm -w movie-reservation-service run test:e2e
- npm -w movie-reservation-service run check
- Docker build/run smoke for the API container
- Observability smoke script added by the implementation
```
