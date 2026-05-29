# Implementation Plan: Movie Reservation Platform Roadmap

## 1. Summary

Evolve the repository from a generic booking-sync demo into a movie reservation platform slice. The platform should stay small enough for learning, but realistic enough to practice NestJS GraphQL, CQRS-style status polling, auth-aware multi-tenancy, async processor contracts, persistence, observability, ECS/Fargate, and later k3d/Kubernetes.

The recommended approach is to build small, reviewable deliverables. Start with an in-memory movie reservation API and explicit processor/auth contracts. Then add local Postgres and migrations, local observability, a frontend demonstrator, a cheap ECS deployment, RDS, external worker signaling, and finally k3d.

This roadmap is intentionally a breaking replacement of the current booking-sync API. The workspace names should also become domain-specific:

- `service/` -> `movie-reservation-service/`
- `infra/` -> `ecs-infra/`

## 2. Goals

- Replace the generic booking-sync use case with a movie reservation workflow.
- Make the GraphQL API a breaking replacement instead of preserving deprecated booking fields.
- Rename the workspaces so the repository structure describes the domain and deployment target.
- Add GraphQL commands and queries that model async reservation request status.
- Support multiple-seat reservation requests from the start.
- Add authentication and authorization contracts from day one, with local/test token validation implementations first.
- Model tenant/provider scoping from the authenticated user context, not from ordinary GraphQL input.
- Start with in-memory state and an in-process processor contract before adding durable persistence.
- Add Postgres and Knex migrations through Docker Compose in a separate deliverable.
- Add OpenTelemetry instrumentation, metrics, structured logs, Tempo, Loki, and Grafana locally.
- Add a React + Vite frontend demonstrator for the reservation workflow and trace/log correlation.
- Add a small GitHub Actions CI foundation before the platform grows into Docker, ECS, RDS, and worker deliverables.
- Deploy a cheap first ECS/Fargate service behind an ALB with in-memory state before adding RDS.
- Add RDS and explicit migration tasks after the first stateless ECS deployment is understood.
- Add worker/signaling infrastructure after durable state exists.
- Add k3d/Kubernetes after the first AWS ECS deployment.

## 3. Non-goals

- Building a production cinema booking product.
- Preserving the old `booking`, `bookings`, and `requestBookingSync` GraphQL contract.
- Adding Docker Compose, Postgres, and Knex in the same implementation batch as the first in-memory movie slice.
- Adding real OIDC/JWT validation in phase 1.
- Adding payment processing in phase 1.
- Adding RDS to the first cheap ECS deployment.
- Adding deployment automation, AWS credentials, Docker image publishing, or multi-provider CI in the first CI foundation.
- Treating SQS/Rabbit as the source of truth for reservation state.
- Adding CloudFront, Cloudflare, EKS, RDS, SQS, frontend, and observability all in one step.
- Hiding AWS or Kubernetes concepts behind abstractions before they are understood.
- Using per-tenant databases before there is a concrete isolation requirement.
- Merging `yoga-studio-api`, `python-agent-with-idp`, or `throttling_sequencer_webapp` into this repository.

## 4. Current State

- The root `package.json` is an npm workspace with `movie-reservation-service` and `ecs-infra`.
- The root package does not yet expose a single `npm run ci` command.
- There is no `.github/workflows` directory and no `.circleci` directory.
- `movie-reservation-service/` is a NestJS TypeScript application using code-first GraphQL through `@nestjs/graphql` and Apollo.
- `service/src/app.module.ts` wires `GraphQLModule`, `HealthModule`, and `BookingsGraphqlModule`.
- `service/src/presentation/http/health.controller.ts` exposes `/health` and `/ready`.
- `service/src/presentation/graphql/bookings.resolver.ts` exposes `booking`, `bookings`, and `requestBookingSync`.
- `service/src/application/bookings/bookings.service.ts` is plain TypeScript and depends on a `BookingRepository` port.
- `service/src/infrastructure/repositories/in-memory/in-memory-booking.repository.ts` stores fake bookings and sync jobs in maps.
- `service/schema.gql` describes the generated GraphQL contract for `Booking`, `BookingSyncJob`, and `requestBookingSync`.
- Service tests use Vitest and Supertest. Existing coverage includes application service tests, domain tests, mapper tests, schema tests, DI composition tests, health tests, and GraphQL e2e tests.
- `ecs-infra/` is an AWS CDK TypeScript workspace. `ecs-infra/lib/infra-stack.ts` is effectively empty.
- `ecs-infra/test/infra.test.ts` contains only the default commented CDK example test.
- `docs/architecture/architecture.md` already describes the target direction: one frontend demonstrator, one NestJS service, ECS/Fargate, Docker Compose, k3d, and OpenTelemetry.
- The Python repositories at `/home/patex1987/development/yoga-studio-api`, `/home/patex1987/development/python-agent-with-idp`, and `/home/patex1987/development/throttling_sequencer_webapp` use a useful auth pattern: an auth manager contract, request context enrichment, middleware at the edge, and local/test token validation implementations injected for tests/local development.
- The observability PoC at `/home/patex1987/development/fastapi_otel_prometheus_grafana_poc` already has Docker Compose examples for an OpenTelemetry Collector, Tempo, Prometheus, and Grafana. The movie platform should reuse or adapt that setup and add Loki for structured logs.

## 5. Requirements and Assumptions

### Confirmed Requirements

- Movie reservation is the preferred domain.
- The booking-sync GraphQL API can be replaced with a breaking movie reservation API.
- The `service` workspace should be renamed to `movie-reservation-service`.
- The `infra` workspace should be renamed to `ecs-infra`.
- Phase 1 stops at the in-memory movie reservation vertical slice with polling.
- Docker Compose, Postgres, and Knex come in a separate later deliverable.
- Multiple-seat reservations should be supported from the start.
- Auth should exist at the contract level from the beginning.
- Phase 1 auth supports two local modes before production OIDC: `local-fixed-user` for convenient development and `local-jwt` for unsigned bearer-token claim testing.
- Cognito should be considered as the preferred AWS-native OIDC option before Keycloak is added to this project.
- Authorization should be modeled from the beginning, even if the first version is a placeholder.
- Tenant identity should come from authenticated user context, not normal GraphQL input.
- Seed data should include at least two movie providers to test tenant isolation.
- The data model should start as shared storage with tenant-scoped rows using `movieProviderId`.
- Per-tenant databases should be explicitly deferred but revisited later.
- External authorization services should be studied later because platform authorization is relevant to the user's current work.
- The database is the source of truth for reservation request state once persistence exists.
- SQS/Rabbit-style systems are later signaling/wake-up mechanisms, not the state source of truth.
- Payment is deferred but should be documented as a future domain concern from day one.
- GraphQL subscriptions remain on the roadmap but come later than polling and processor basics.
- Frontend should start with React + Vite; Next.js/SSR is deferred unless server-rendering, BFF behavior, or production auth/session handling becomes necessary.
- First ECS deployment should be cheap and simple: API container behind ALB with in-memory state.
- GitHub Actions should provide the first CI foundation with formatting, linting, type checking, tests, build, and CDK synth before deployment automation is added.
- RDS should be deferred until after the stateless ECS deployment is understood.
- k3d/Kubernetes should come after the first AWS ECS deployment.
- Observability should include traces, metrics, and structured logs, not traces only.
- OpenTelemetry auto-instrumentation or known instrumentation packages should be used where practical for external boundaries such as HTTP, GraphQL, database access, queues, and outbound clients.

### Assumptions

- Polling comes before subscriptions because it teaches the async state model with less transport complexity.
- The first processor implementation is in-process and in-memory, but behind an application-level processor contract.
- Tests should trigger processor behavior deterministically instead of relying on timer-heavy background behavior.
- Postgres is the local and AWS database target once persistence is introduced.
- Knex is the planned migration/query-builder tool.
- Shared Postgres with tenant-scoped rows is the first durable multi-tenant model.
- A later user may belong to multiple movie providers; if that happens, active tenant selection should be explicit and validated against memberships.
- OIDC/JWT token claims can later map to `userId`, roles, scopes, and provider/tenant context.
- AWS Cognito is likely the first managed OIDC provider to evaluate because this platform is AWS-first.
- OpenTelemetry Collector configuration can later swap or add exporters, such as Jaeger, without changing app instrumentation.

### Open Questions

- Which exact NestJS auth mechanism should phase 1 use: guard, interceptor, middleware, or a combination?
- Should the first authorization placeholder use only roles/scopes and tenant/owner checks, or also model memberships explicitly in memory?
- Should the first durable authorization model use only `movieProviderId` columns, or introduce `movie_provider_memberships` immediately with Postgres?
- Which Cognito/OIDC token claims should become the stable application-level auth contract?
- Which authorization service should be evaluated first later: Amazon Verified Permissions/Cedar, OpenFGA, OPA, or Casbin?
- Which log shipping path should be used for local Loki: app direct OTLP logs, collector filelog receiver, Docker log driver, or Promtail?

## 6. Proposed Design

Use a movie reservation domain with these concepts:

- `MovieProvider`: the tenant/provider that owns movies, auditoriums, screenings, and reservations.
- `Movie`: title and metadata within a movie provider.
- `Auditorium`: a room within a movie provider.
- `Screening`: a movie at a specific time and auditorium.
- `Seat`: a seat in an auditorium/screening.
- `ReservationRequest`: the async command record.
- `Reservation`: the confirmed booking result.
- `AuthenticatedUser`: the normalized identity from authentication, including
  `userId`, `username`, `email`, `roles`, `scopes`, and `movieProviderId`.
- `ActorContext` or `AuthorizationContext`: the smaller application-level
  context passed into use cases so services can enforce tenant, owner, role, and
  scope checks without receiving full profile fields.

GraphQL should separate commands from queries:

- `requestReservation(input)` accepts a command and returns a `ReservationRequest`.
- `reservationRequestStatus(id)` lets a client poll command status.
- `reservationResult(requestId)` fetches the final confirmed reservation produced by a completed request.
- `movies`, `movie`, `screenings`, and `screening` support the UI flow.

Normal customer GraphQL inputs should not include `movieProviderId`. The provider/tenant comes from the authenticated user context. This mirrors the SaaS pattern where tenant identity is established by auth/session state, not by request bodies that clients can tamper with.

Reservation request statuses:

- `REQUESTED`
- `PROCESSING`
- `CONFIRMED`
- `REJECTED`
- `FAILED`

Processor design:

- `requestReservation` records a request and returns immediately.
- A `ReservationRequestProcessor` application contract owns claim/process/complete/fail behavior.
- Phase 1 provides an in-memory implementation of the processor contract.
- Tests can call the processor directly to prove state transitions without waiting on timers.
- Later, Postgres adds durable claim/lease semantics.
- Later, SQS/Rabbit can signal workers that work is available, while workers still read, claim, and update state in the database.

Auth design:

- Introduce an auth manager contract similar in spirit to the Python `AsyncAuthenticationManager`.
- Add an auth manager for JWT-shaped authentication and a local/test token validation client that decodes bearer-token claims without calling an external IdP.
- Exclude `/health` and `/ready` from auth.
- Bind authenticated user data into the GraphQL request context for presentation
  needs such as `me`.
- Pass a plain TypeScript `ActorContext` into application services rather than
  passing NestJS request objects or full user profiles inward.
- Add an application-level authorization service/policy port so authorization checks are explicit and replaceable.
- Phase 1 authorization placeholder: tenant-scoped access, owner checks for customer reservations, tenant-admin override, and scope placeholders.
- Real OIDC/JWT validation is deferred. Cognito should be evaluated before Keycloak for the AWS path.

Persistence design:

- Phase 1 uses in-memory maps only.
- Postgres phase introduces durable tables with `movie_provider_id` on tenant-scoped rows.
- Per-tenant databases are deferred. They should be reconsidered later for hard isolation, compliance, noisy-neighbor concerns, or enterprise tenant requirements.
- Do not build one monster table. Model the domain normally with tenant-scoped rows and useful indexes.

Observability design:

- Use OpenTelemetry as the cross-runtime instrumentation contract.
- Add structured logs with trace and span correlation fields.
- Add metrics, not only logs and traces.
- Use auto-instrumentation or known instrumentation packages where practical.
- Local target: service -> OpenTelemetry Collector -> Tempo for traces, Prometheus/Grafana for metrics, Loki/Grafana for logs.
- Jaeger remains a later collector/exporter configuration experiment.

The app runtime contract should stay stable across Docker Compose, ECS, and k3d:

- container image
- `PORT`
- `/health`
- `/ready`
- `DATABASE_URL` once persistence exists
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- structured logs with trace correlation fields
- auth mode/configuration

## 7. Alternatives Considered

### Alternative A: Keep Generic Booking Sync

- Pros: Minimal changes from current code.
- Cons: Less intuitive for CQRS, frontend UX, auth/tenant scoping, seat conflicts, and async status transitions.
- Decision: Rejected. It was useful as a scaffold, but less attractive as the long-term learning domain.

### Alternative B: Movie Reservation With Polling First

- Pros: Natural async flow, understandable UI, realistic conflicts, easy to test locally, good fit for GraphQL query/mutation separation.
- Cons: Requires breaking GraphQL and workspace renames.
- Decision: Recommended.

### Alternative C: Start With Full Event-Driven Worker Immediately

- Pros: More production-like.
- Cons: Adds durable claims, worker lifecycle, queue signaling, idempotency, retries, and deployment complexity before the domain is clear.
- Decision: Rejected for phase 1. Start with processor contracts and in-memory implementation.

### Alternative D: Put `movieProviderId` in GraphQL Inputs

- Pros: Simple to see and test manually.
- Cons: Lets clients request tenant scope directly; teaches the wrong security boundary for SaaS-style multi-tenancy.
- Decision: Rejected for normal customer operations. Tenant/provider identity should come from auth context.

### Alternative E: Shared Database With Tenant-Scoped Rows

- Pros: Simple local development, simple migrations, compatible with ECS and Docker Compose, easy to learn and test tenant filtering.
- Cons: Weaker isolation than per-tenant databases; every query and authorization path must respect tenant scope.
- Decision: Recommended first durable model.

### Alternative F: Per-Tenant Databases

- Pros: Strong isolation and clearer blast-radius boundaries for enterprise/compliance scenarios.
- Cons: More operational complexity, harder migrations, harder local dev, more connection management, more CDK complexity.
- Decision: Defer and revisit later.

### Alternative G: React + Vite Frontend

- Pros: Simple static frontend, fast development, enough for GraphQL workflow demos and trace propagation.
- Cons: Does not teach SSR or server-side session handling.
- Decision: Recommended first frontend.

### Alternative H: Next.js Frontend

- Pros: Useful for SSR, server components, BFF routes, and production session handling.
- Cons: Adds another server runtime and hosting model before the frontend needs it.
- Decision: Defer until server-rendering, BFF behavior, or production auth/session handling is a concrete requirement.

## 8. API / Interface Changes

Expected GraphQL direction:

```graphql
type Query {
  me: AuthenticatedUser!
  movie(id: ID!): Movie
  movies: [Movie!]!
  screening(id: ID!): Screening
  screenings(movieId: ID): [Screening!]!
  reservationRequestStatus(id: ID!): ReservationRequest
  reservationResult(requestId: ID!): Reservation
}

type Mutation {
  requestReservation(input: RequestReservationInput!): ReservationRequest!
}

input RequestReservationInput {
  screeningId: ID!
  seatIds: [ID!]!
}
```

The mutation behaves like HTTP `202 Accepted`: it confirms the request was accepted, not that the final reservation is complete.

Tenant/provider identity is intentionally absent from `RequestReservationInput`. The application derives `movieProviderId` from authenticated context.

Future subscription, after polling and worker/signaling are understood:

```graphql
type Subscription {
  reservationRequestUpdated(id: ID!): ReservationRequest!
}
```

Application-level interfaces to introduce:

- Authentication manager contract: validates or supplies an `AuthenticatedUser`.
- Actor/auth context type: carries user, role, scope, and tenant/provider identity into use cases.
- Authorization service/policy port: answers whether an actor can perform an operation on a resource.
- Reservation repository port: tenant-aware movie/screening/reservation request/reservation access.
- Reservation request processor contract: claims/processes/completes/fails pending work.

Workspace/package changes:

- Rename root workspace entry from `service` to `movie-reservation-service`.
- Rename root workspace entry from `infra` to `ecs-infra`.
- Update package names, README/docs, commands, and imports accordingly.

## 9. Data Model / Persistence Changes

Initial in-memory model:

- movie providers
- movies
- auditoriums
- screenings
- seats
- reservation requests
- reservations
- local/test JWT claim profiles

Postgres model later:

- `movie_providers`
- `movies`
- `auditoriums`
- `screenings`
- `screening_seats`
- `reservation_requests`
- `reservation_request_seats`
- `reservations`
- `reservation_seats`
- optional `movie_provider_memberships`

Tenant-scoped tables should include `movie_provider_id`. Reservation-related rows should also include owner/customer identity such as `user_id` so owner checks are possible.

Concurrency constraints to add in the Postgres phase:

- Prevent two confirmed reservations from claiming the same seat for the same screening.
- Track request state transitions durably.
- Add a Postgres-owned internal `reservation_requests.sequence` for FIFO worker claiming.
- Add indexes for `movie_provider_id`, request status, owner `user_id`, and worker claim fields.
- Defer a dedicated work queue table until retries, leases, delayed work, dead-letter behavior, or multiple worker types require it.

Migration strategy:

- Use Knex migrations locally first.
- Use the same migrations in AWS through a one-off ECS migration task after RDS exists.
- Keep migrations explicit, not hidden inside normal app startup.
- Keep in-memory tests even after the Postgres repository exists.

Payment:

- Payment is a documented future domain concern.
- Do not add `paymentStatus` in phase 1.
- Add payment state only when there is a dedicated payment phase.

## 10. Security, Privacy, and Abuse Considerations

- Treat the GraphQL API replacement as a breaking change and update tests/docs accordingly.
- Validate GraphQL inputs at runtime; TypeScript types do not protect runtime requests.
- Require auth for GraphQL operations from the beginning.
- Exclude only platform health endpoints from auth.
- Do not accept tenant/provider identity from normal customer GraphQL inputs.
- Keep tenant/provider identity in authenticated context.
- Model owner checks and tenant-admin override from the start.
- Avoid logging sensitive free-form user input.
- Include user and tenant identifiers in logs only when safe and useful for debugging/audit.
- Use parameterized queries through Knex when Postgres is added.
- Store future AWS database credentials in Secrets Manager or SSM, not plain environment values.
- When real OIDC exists, keep local/fake auth implementations out of production artifacts where practical. Runtime config guards are useful, but the production image should also make wrong auth wiring impossible or fail closed.
- Keep app task role permissions narrow.
- Keep migration task permissions separate from the normal API task where practical.
- Add rate limiting or request limits later if the public API becomes internet-facing.
- Research externalized authorization as a platform concern instead of hand-rolling a long-term platform authz system.

Authorization research candidates:

- Amazon Verified Permissions / Cedar for AWS-native fine-grained authorization.
- OpenFGA for relationship-based authorization.
- OPA for broader policy-as-code across services/infrastructure.
- Casbin for app-local RBAC/ABAC learning and simpler embedded policy checks.

## 11. Performance, Scalability, and Reliability Considerations

- Seat reservation has a natural concurrency risk: two requests can try to claim the same seat.
- In-memory state is fine for learning but does not survive restarts.
- Shared database multi-tenancy requires consistent tenant filtering and useful indexes.
- Postgres should enforce uniqueness for confirmed reservation seats.
- The database should be the source of truth for request state once persistence exists.
- Queue systems should signal/wake workers, not own reservation truth.
- Processor work should be idempotent.
- D6 should use transactions and row locks for request claiming instead of generic optimistic-locking version columns. Revisit optimistic locking later for mutable catalog/admin workflows or explicit compare-and-swap state transitions.
- Keep liveness, platform readiness, and business/dependency readiness separate. Postgres dependency health should be observable, but it should not automatically make platform probes remove every API task/pod from service during a dependency outage.
- Worker claims should have leases/timeouts once durable processing exists.
- Failed worker messages should eventually go to a dead-letter queue when SQS/Rabbit is added.
- ECS API and worker services should scale independently after the worker exists.
- Polling should use bounded frontend intervals to avoid noisy traffic.
- OpenTelemetry instrumentation should cover incoming HTTP/GraphQL, outbound HTTP, database access, queue clients, and runtime metrics as those boundaries appear.

## 12. Deliverables

### Deliverable 1: Rename Workspaces

- Change: Rename `service/` to `movie-reservation-service/` and `infra/` to `ecs-infra/`.
- Files/modules likely affected: root `package.json`, workspace package names, docs, scripts, imports, README references, generated guidance references if needed.
- Notes: This is mechanical but high-churn. Keep it separate so later domain changes are easier to review.
- Verification:
  - `npm run build`
  - `npm test`
  - `npm run lint`

### Deliverable 2: Replace Booking Domain With Movie Reservation Domain

- Change: Replace booking domain types and fake data with movie provider, movie, auditorium, screening, seat, reservation request, and reservation types.
- Files/modules likely affected: `movie-reservation-service/src/domain`, `movie-reservation-service/src/application`, `movie-reservation-service/src/infrastructure/repositories/in-memory`, tests under `movie-reservation-service/test`.
- Notes: This is a breaking replacement. Do not preserve old booking GraphQL fields.
- Verification:
  - Domain tests cover IDs, statuses, multiple-seat requests, and valid/invalid state transitions.
  - In-memory repository tests cover at least two movie providers.
  - `npm -w movie-reservation-service test`

### Deliverable 3: Add Auth Context and Authorization Placeholder

- Change: Add auth manager contract, local/test JWT token validation implementation, actor context, and authorization service/policy placeholder.
- Files/modules likely affected: `movie-reservation-service/src/domain/authentication`, `movie-reservation-service/src/application/authentication`, `movie-reservation-service/src/application/authorization`, `movie-reservation-service/src/presentation/graphql`, DI composition modules, tests.
- Notes: Mirror the useful Python pattern: auth contract, edge binding, and replaceable token validation through DI. Real OIDC validation is deferred.
- Verification:
  - Tests prove `/health` and `/ready` stay unauthenticated.
  - GraphQL e2e tests prove authenticated bearer-token claims are available through `me`.
  - Tests prove one provider cannot read another provider's reservation data.
  - Tests prove owner-only access and tenant-admin override placeholders.

### Deliverable 4: Add Movie Reservation GraphQL Polling API

- Change: Add code-first GraphQL models, inputs, mappers, resolver operations, and schema tests for movie reservation operations.
- Files/modules likely affected: `movie-reservation-service/src/presentation/graphql`, `movie-reservation-service/schema.gql`, `movie-reservation-service/test/e2e`, `movie-reservation-service/test/schema.test.ts`.
- Notes: Commands and queries should pass `ActorContext` into application services.
- Verification:
  - GraphQL e2e covers `movies`, `screenings`, `requestReservation`, `reservationRequestStatus`, and `reservationResult`.
  - Schema test asserts old booking fields are gone and movie reservation fields exist.
  - `npm -w movie-reservation-service run check`

### Deliverable CI-1: Add GitHub Actions CI Foundation

- Change: Add a root `npm run ci` command and a small GitHub Actions workflow for pull requests and pushes to `main`.
- Files/modules likely affected: root `package.json`, `.nvmrc`, `movie-reservation-service/package.json`, `movie-reservation-service/test/**`, `ecs-infra/package.json`, `.github/workflows/ci.yml`, `README.md`, `docs/index.md`, `docs/workflows/ci-workflow.md`, `docs/plans/github-actions-ci-foundation.md`.
- Notes: Keep this credential-free and deployment-free. The first workflow should run formatting, linting, type checking, tests, builds, and CDK synth using existing npm workspace scripts. Detailed implementation guidance lives in `docs/plans/github-actions-ci-foundation.md`.
- Verification:
  - `npm -w movie-reservation-service run test:unit`
  - `npm -w movie-reservation-service run test:integration`
  - `npm -w ecs-infra run ci`
  - `npm run ci`
  - GitHub Actions passes on the implementation pull request.

### Deliverable 5: Add In-Process Processor Contract

- Change: Add `ReservationRequestProcessor` contract and in-memory implementation for claiming/processing pending reservation requests.
- Files/modules likely affected: application processor contract, in-memory processor/repository adapter, reservation service, tests.
- Notes: Avoid timer-heavy tests. Tests should drive the processor deterministically.
- Verification:
  - Tests cover `REQUESTED -> PROCESSING -> CONFIRMED`.
  - Tests cover rejection when requested seats are already taken.
  - Tests cover idempotent processing behavior for already-terminal requests.

### Deliverable 6: Add Docker Compose, Postgres, and Knex

- Change: Add local Postgres, Knex config, migrations, and Postgres repository adapter.
- Files/modules likely affected: root compose files, `movie-reservation-service/package.json`, service config, migrations, repository adapter, docs/operations.
- Notes: Keep in-memory tests and add focused Testcontainers e2e tests against Postgres. Keep an external/manual database e2e mode for Docker Compose or developer-managed Postgres.
- Verification:
  - Migrations run locally.
  - E2E tests pass against Testcontainers Postgres.
  - Constraints prevent double-confirming the same screening seat.

### Deliverable DI-1: Refine Service DI Composition Profiles

- Change: Refactor the NestJS composition wiring after D6 so auth and persistence choices are selected through explicit typed composition profiles instead of growing one large conditional module.
- Files/modules likely affected: `movie-reservation-service/src/config.ts`, `movie-reservation-service/src/app.module.ts`, `movie-reservation-service/src/di/movie-reservations`, service env files/templates, composition/config tests, `docs/plans/service-di-composition-breakdown.md`.
- Notes: Preserve D6 behavior. This is a behavior-preserving cleanup that normalizes the minimal `PERSISTENCE_MODE` wiring introduced by Postgres. Do not add new Postgres behavior, OIDC, workers, or observability here.
- Verification:
  - Config tests cover valid and invalid profile combinations.
  - Composition tests prove in-memory and Postgres repository modes still resolve.
  - Existing GraphQL and health behavior remains unchanged.
  - `npm -w movie-reservation-service run check`

### Deliverable Docker-1: Containerize the NestJS API for Local Compose

- Change: Add a local Docker image/runtime path for the NestJS API after the DI profile contract is explicit.
- Files/modules likely affected: service Dockerfile or Docker build config, root compose files, service env files/templates, local run docs, docs/operations.
- Notes: The containerized API should use the same checked-in env/profile model as host-based npm development and should run against Dockerized Postgres. Keep observability out until Deliverable 7.
- Verification:
  - Docker Compose can start Postgres and the API together.
  - API container returns `/health` and `/ready`.
  - API container can run a GraphQL smoke query against Postgres-backed persistence.
  - Local docs include the host-npm and Compose-container run paths.

### Deliverable 7: Add Local Observability

- Change: Add OpenTelemetry SDK setup, auto-instrumentation where practical, structured logging, metrics, collector config, Tempo, Loki, Prometheus, and Grafana.
- Files/modules likely affected: service bootstrap/config, Docker Compose, observability config folders, docs/operations.
- Notes: Reuse or adapt `/home/patex1987/development/fastapi_otel_prometheus_grafana_poc`. Add Loki because logs are required.
- Verification:
  - One GraphQL request produces a trace in Tempo.
  - The same request has correlated structured logs in Loki.
  - Basic HTTP/GraphQL metrics are visible in Grafana/Prometheus.
  - Trace IDs and span IDs appear in logs.

### Deliverable 8: Add React + Vite Frontend Demonstrator

- Change: Add a frontend workspace for movie, screening, seat selection, reservation request, and polling status.
- Files/modules likely affected: new frontend workspace, root `package.json`, Docker Compose, docs.
- Notes: This is a workflow demonstrator, not a marketing page. Next.js/SSR is deferred.
- Verification:
  - Browser flow can request a reservation and poll status.
  - Frontend-originated request can be found in backend traces/logs.

### Deliverable 9: Add Cheap ECS CDK Foundation

- Change: Add explicit CDK resources for VPC, ECS cluster, ALB, task definition, Fargate service, log group, health checks, execution role, and task role.
- Files/modules likely affected: `ecs-infra/lib`, `ecs-infra/test`, docs/operations.
- Notes: First AWS deployment uses in-memory state and no RDS to keep cost low and focus on CDK/ECS/ALB learning.
- Verification:
  - `npm -w ecs-infra run build`
  - `npm -w ecs-infra test`
  - `npm -w ecs-infra run cdk -- synth`
  - CDK assertions cover ALB, service, health check paths, log group, and IAM basics.

### Deliverable 10: Add RDS and Migration Task

- Change: Add RDS Postgres, secrets/config, networking, and one-off ECS migration task.
- Files/modules likely affected: `ecs-infra/lib`, service env config, docs/operations.
- Notes: Document deployment order and rollback/removal path.
- Verification:
  - CDK synth and assertions pass.
  - Migration task can run before API service uses DB.
  - API can read/write through Postgres after migrations.

### Deliverable 11: Add Durable Worker Signaling

- Change: Add worker runtime and SQS/Rabbit-style signaling after durable DB-backed claim/lease processing exists.
- Files/modules likely affected: service worker entrypoint, processor adapters, infra queue/signaling resources, docs.
- Notes: DB remains source of truth. Queue messages wake workers or signal available work.
- Verification:
  - API records request.
  - Signal is emitted.
  - Worker claims pending request from DB and updates status.
  - Failed messages have retry/DLQ behavior once SQS exists.

### Deliverable 12: Add k3d/Kubernetes Target

- Change: Add Kubernetes manifests or Helm chart and local collector setup.
- Files/modules likely affected: k8s manifests, docs/operations.
- Notes: Same app image and runtime contract as ECS. Comes after first AWS ECS deployment.
- Verification:
  - k3d deployment passes `/health` and `/ready` probes.
  - App emits traces, metrics, and logs through local collector path.

### Deliverable 13: Research and Harden Authorization

- Change: Evaluate externalized authorization options and decide whether to keep app-local checks or adopt a policy service/library.
- Files/modules likely affected: docs/architecture/architecture-decisions.md, docs/plans, auth/authorization interfaces, possibly infra later.
- Notes: This is a platform-learning deliverable. Compare Amazon Verified Permissions/Cedar, OpenFGA, OPA, and Casbin.
- Verification:
  - ADR records problem statement, options, recommendation, and migration path.
  - Prototype or spike proves one realistic authorization scenario.

### Deliverable 14: Add GraphQL Subscriptions

- Change: Add subscription support for reservation request updates.
- Files/modules likely affected: GraphQL module config, resolver, auth context for WebSocket/subscription transport, processor notification path, tests.
- Notes: Comes after polling and processor basics. Auth for WebSocket/subscription transport needs explicit design.
- Verification:
  - Subscription receives reservation request status updates.
  - Unauthorized subscription attempts fail.
  - Polling API remains supported.

### Deliverable 15: Explore Payments

- Change: Document and later design payment state and reservation/payment coordination.
- Files/modules likely affected: docs/plans, domain model, API contract.
- Notes: Payment is a future domain concern only until explicitly planned.
- Verification:
  - Separate plan exists before any payment fields are added.

## 13. Testing Strategy

- Unit tests for domain state transitions, value-object validation, tenant scoping helpers, and authorization policy decisions.
- Application tests with fake repositories and local/test JWT claim profiles for reservation request/status behavior.
- Thin integration tests for GraphQL resolver mapping and DI composition.
- E2E tests for GraphQL request and poll flows using Supertest.
- Schema contract tests proving old booking fields are gone and new movie reservation fields exist.
- Tenant isolation tests using at least two seeded movie providers.
- Processor tests that drive the in-memory processor deterministically.
- Migration tests against local Postgres once Knex exists.
- Repository integration tests for uniqueness constraints and tenant filtering.
- Observability smoke tests for trace/log correlation and metrics.
- CDK assertion tests for key ECS, ALB, health check, IAM, log group, RDS, migration task, and queue resources as they are introduced.
- CI workflow check for pull requests and pushes to `main`, starting with formatting, linting, type checking, tests, build, and CDK synth.
- Docker Compose smoke tests for service, database, collector, Tempo, Loki, Prometheus, and Grafana.
- k3d smoke tests for Deployment, Service, Ingress, probes, and telemetry after k3d exists.
- AWS smoke tests for ALB response, ECS running count, target group health, logs, and migration task success.

Expected commands after relevant phases:

```bash
npm run ci
npm -w movie-reservation-service run check
npm -w ecs-infra run build
npm -w ecs-infra test
npm -w ecs-infra run cdk -- synth
npm run build
npm test
npm run lint
```

## 14. Rollout / Migration Plan

This is a learning repo, so rollout means keeping each phase reversible, reviewable, and understandable.

- First rename workspaces as a mechanical change.
- Then replace booking with movie reservation as a breaking API change.
- Add GitHub Actions CI before adding Docker, ECS, RDS, workers, or deployment automation.
- Keep `/health` and `/ready` stable throughout.
- Keep GraphQL polling before subscriptions.
- Keep auth contract, `local-fixed-user`, and `local-jwt` modes before real OIDC.
- Keep in-memory state before Postgres.
- Keep the processor contract before durable workers.
- Add Postgres behind repository interfaces.
- Refine service DI composition profiles after Postgres so auth and persistence mode selection stays explicit and testable.
- Containerize the local NestJS API after the DI profile contract exists.
- Keep migrations explicit, not automatic app startup side effects.
- Deploy a cheap ECS API-only service before adding RDS.
- Add RDS only after ECS/ALB basics are understood.
- Add SQS/Rabbit-style signaling only after DB-backed state and claim behavior exist.
- Keep explicit CDK resources before extracting reusable constructs.
- Add k3d after ECS to compare runtime models.
- Add CloudFront/Cloudflare only after ALB and ECS are understood.
- Revisit per-tenant databases later only when there is a concrete isolation requirement.

Rollback/removal guidance:

- In-memory phase rollback is a git revert of the movie domain change.
- Postgres phase rollback should preserve the in-memory adapter and tests.
- ECS phase rollback should document CDK destroy steps and cost cleanup.
- RDS phase rollback should include snapshot/removal decisions before deployment.
- Worker/signaling rollback should leave polling and DB-backed request status intact.
- CI rollback is a git revert of the workflow and root script; it should not affect runtime behavior or deployed infrastructure.

## 15. Risks and Mitigations

| Risk                                                   | Impact | Likelihood | Mitigation                                                                                                                                                                             |
| ------------------------------------------------------ | -----: | ---------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope grows too fast                                   |   High |       High | Keep deliverables small and reviewable; do not combine phase 1 with Postgres or ECS.                                                                                                   |
| Workspace rename creates noisy diffs                   | Medium |       High | Do rename as its own deliverable before domain edits.                                                                                                                                  |
| CI blocks work because the first workflow is too broad | Medium |     Medium | Keep the first workflow to local-equivalent checks only; defer deploy, Docker publishing, security gates, and matrices.                                                                |
| Auth becomes too real too early                        | Medium |     Medium | Add contract and fake implementation first; defer OIDC/Cognito.                                                                                                                        |
| Production runs with local auth wiring                 |   High |        Low | Block local auth modes in production config now; later exclude local/fake auth implementations from production images and add CI checks that production artifacts cannot resolve them. |
| Authorization placeholder becomes permanent            |   High |     Medium | Track explicit authorization research deliverable and ADR.                                                                                                                             |
| Tenant scoping is missed in queries                    |   High |     Medium | Pass `ActorContext` into use cases and make repository methods tenant-aware.                                                                                                           |
| Shared DB model leaks cross-tenant data                |   High |     Medium | Add tenant isolation tests and indexes; evaluate RLS later.                                                                                                                            |
| CQRS becomes abstract ceremony                         | Medium |     Medium | Keep it tied to reservation request status, processor contract, and seat conflicts.                                                                                                    |
| Async processing is hidden behind timers               | Medium |     Medium | Model processor contract explicitly and drive tests deterministically.                                                                                                                 |
| Seat conflicts are mishandled under concurrency        |   High |     Medium | Use Postgres uniqueness constraints and idempotent processor behavior once persistence exists.                                                                                         |
| Infra costs surprise you                               |   High |     Medium | Start ECS with in-memory API only; defer RDS; set AWS Budgets before real deploys.                                                                                                     |
| Observability becomes bolted on late                   | Medium |       High | Add local OTel, metrics, structured logs, Tempo, Loki, and Grafana before complex AWS worker paths.                                                                                    |
| CDK abstraction hides learning                         | Medium |     Medium | Create explicit resources first, then extract constructs later.                                                                                                                        |
| Kubernetes and ECS drift                               | Medium |     Medium | Preserve the same app contract across runtimes.                                                                                                                                        |

## 16. Done Criteria

- Workspaces are renamed to `movie-reservation-service` and `ecs-infra`.
- Movie reservation GraphQL operations replace generic booking sync operations.
- GraphQL requires auth context for product operations while `/health` and `/ready` remain simple HTTP endpoints.
- Local/test auth wiring can be selected through DI: `local-fixed-user` provides a convenient development identity, while `local-jwt` keeps request identity in bearer-token claims.
- Tenant/provider identity comes from auth context, not ordinary GraphQL input.
- At least two movie providers are seeded and tenant isolation is tested.
- A multiple-seat reservation request can be created and polled.
- GitHub Actions runs the root CI command on pull requests and pushes to `main`.
- An in-process processor contract can confirm or reject requests deterministically.
- Local Postgres persistence works through Knex migrations in a later deliverable.
- Logs, traces, and metrics are visible locally and can be correlated for at least one GraphQL request.
- Frontend interaction appears in backend traces/logs.
- CDK can synthesize an ECS API service behind an ALB without RDS in the first AWS phase.
- AWS database migrations have an explicit run path after RDS is introduced.
- Worker signaling processes reservation requests while DB remains the source of truth.
- k3d can run the same app image with health probes after ECS.
- Authorization research is captured in an ADR before choosing a platform-level solution.

## 17. Review Checklist

- [ ] Requirements are explicit.
- [ ] Non-goals are explicit.
- [ ] Existing code conventions were checked.
- [ ] Workspace rename is separated from domain implementation.
- [ ] CI foundation is small, credential-free, and based on existing npm scripts.
- [ ] Alternatives were considered.
- [ ] Auth and authorization implications were reviewed.
- [ ] Tenant scoping is modeled explicitly.
- [ ] Persistence and migration strategy is explicit.
- [ ] Processor/control-plane responsibilities are explicit.
- [ ] Observability includes traces, metrics, and logs.
- [ ] Scalability and reliability implications were reviewed.
- [ ] Testing strategy is complete.
- [ ] Rollout and rollback are defined.
- [ ] Implementation steps are ordered and concrete.

## 18. Handoff Prompt for Implementation Agent

```text
Implement the plan in docs/plans/movie-reservation-platform-roadmap.md.

Start with the smallest deliverable that has not been completed. Do not combine deliverables unless explicitly approved.

Constraints:
- Treat the movie reservation API as a breaking replacement for the current booking-sync API.
- Rename `service/` to `movie-reservation-service/`.
- Rename `infra/` to `ecs-infra/`.
- Keep NestJS at the presentation/composition boundary.
- Keep domain and application code as plain TypeScript where possible.
- Preserve REST /health and /ready endpoints.
- Add auth and authorization contracts from the beginning, but use fake/local auth before real OIDC.
- Derive tenant/provider identity from authenticated context, not normal GraphQL inputs.
- Seed at least two movie providers and test tenant isolation.
- Support multiple-seat reservation requests.
- Start with polling before GraphQL subscriptions.
- Start with in-memory state before Postgres.
- Start with an in-process processor contract before durable worker signaling.
- Treat the database as the future source of truth; queues are later wake-up/signaling mechanisms.
- Do not add Docker Compose, Postgres, or Knex to phase 1.
- Do not add RDS to the first ECS deployment.
- Do not extract CDK platform constructs until explicit ECS resources exist.
- Add or update tests with each phase.
- If implementation reality differs from the plan, stop and update the plan or ask for approval before changing scope.

Relevant starting files/modules:
- Root package/workspace config: package.json
- Current service workspace: service/
- Current service app module: service/src/app.module.ts
- Current GraphQL resolver: service/src/presentation/graphql/bookings.resolver.ts
- Current application service: service/src/application/bookings/bookings.service.ts
- Current repository port: service/src/application/bookings/ports/booking-repository.ts
- Current in-memory repository: service/src/infrastructure/repositories/in-memory/in-memory-booking.repository.ts
- Current generated schema: service/schema.gql
- Current service tests: service/test/
- Current infra workspace: infra/
- Current CDK stack: infra/lib/infra-stack.ts
- Current infra tests: infra/test/infra.test.ts

Expected verification commands after the relevant rename/update:
- npm run ci
- npm -w movie-reservation-service run check
- npm -w ecs-infra run build
- npm -w ecs-infra test
- npm -w ecs-infra run cdk -- synth
- npm run build
- npm test
- npm run lint
```
