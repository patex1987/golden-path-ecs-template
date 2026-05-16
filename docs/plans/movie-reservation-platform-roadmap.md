# Implementation Plan: Movie Reservation Platform Roadmap

## 1. Summary

Evolve the project from a generic booking-sync demo into a movie reservation platform slice. The application should stay small enough for learning, but realistic enough to exercise GraphQL, CQRS-style status polling, async processing, persistence, ECS deployment, Kubernetes deployment, and distributed observability.

The recommended approach is to build one vertical slice locally first, then project the same app contract onto ECS and k3d.

## 2. Goals

- Replace the generic booking-sync use case with a movie reservation workflow.
- Add GraphQL commands and queries that model async reservation status.
- Start with in-memory state and an in-process processor before adding external infrastructure.
- Add Postgres and Knex migrations through Docker Compose.
- Add structured logging and OpenTelemetry before AWS deployment.
- Add a small frontend that demonstrates the reservation workflow and trace correlation.
- Deploy the service to ECS/Fargate with CDK.
- Add RDS and an explicit migration task.
- Add an SQS-backed worker for async reservation processing.
- Add k3d/Kubernetes as a second runtime target for the same containerized app.

## 3. Non-goals

- Building a production cinema booking product.
- Adding payment processing.
- Adding CloudFront, Cloudflare, EKS, RDS, SQS, and frontend work in one step.
- Hiding AWS or Kubernetes concepts behind abstractions before they are understood.
- Merging `yoga-studio-api` or `python-agent-with-idp` into this repository.

## 4. Current State

- `service/` is a NestJS TypeScript application.
- `service/src/presentation/http/health.controller.ts` exposes health/readiness behavior.
- `service/src/presentation/graphql/bookings.resolver.ts` exposes booking GraphQL operations.
- `service/src/application/bookings/bookings.service.ts` has query-like methods plus `requestBookingSync`.
- `service/src/infrastructure/repositories/in-memory/in-memory-booking.repository.ts` stores fake bookings and sync jobs.
- `service/schema.gql` currently describes `Booking`, `BookingSyncJob`, `booking`, `bookings`, and `requestBookingSync`.
- `infra/lib/infra-stack.ts` is still a mostly empty CDK stack.
- `docs/architecture/architecture.md` already points toward Docker Compose, k3d, ECS, OpenTelemetry, and future multi-app observability.

## 5. Requirements and Assumptions

### Confirmed Requirements

- The use case should become more attractive than generic booking sync.
- Movie booking/reservation is the preferred direction.
- GraphQL should include CQRS-style async behavior.
- The app should eventually be deployable to ECS/Fargate.
- Database migrations should be part of the platform story.
- Local testing should cover app behavior and enough infrastructure shape to learn safely.
- The same containerized app should eventually be runnable on k3d/Kubernetes.
- OpenTelemetry and structured logging should support trace-to-log correlation.
- A frontend should demonstrate the flow and connect frontend calls to backend traces.

### Assumptions

- Polling comes before subscriptions because it teaches the async state model with less transport complexity.
- Postgres is the database target for local and AWS persistence.
- Knex is the migration/query-builder tool.
- SQS is the first real async infrastructure boundary.
- ECS/Fargate is the primary AWS target before EKS.
- k3d is for local Kubernetes learning, not production parity.

### Open Questions

- Which frontend stack should be used?
- Should GraphQL subscriptions be implemented with WebSockets, server-sent events, or deferred until later?
- Should AWS deployment use CloudFront/Cloudflare early, or keep the first AWS path to ALB only?
- Should RDS be plain Postgres or Aurora Serverless v2?

## 6. Proposed Design

Use a movie reservation domain with these concepts:

- `Movie`: title and metadata.
- `Screening`: a movie at a specific time and auditorium.
- `Seat`: a seat in an auditorium for a screening.
- `ReservationRequest`: the async command record.
- `Reservation`: the confirmed booking result.

GraphQL should separate commands from queries:

- `requestReservation(input)` accepts a command and returns a `ReservationRequest`.
- `reservationRequest(id)` lets a client poll the command status.
- `reservation(id)` fetches the final confirmed reservation.
- `movies`, `movie`, `screenings`, and `screening` support the UI flow.

Reservation request statuses:

- `REQUESTED`
- `PROCESSING`
- `CONFIRMED`
- `REJECTED`
- `FAILED`

Start with an in-process processor that simulates state transitions. Later, replace that processor with an SQS worker without changing the public GraphQL contract.

The app contract should stay stable across Docker Compose, ECS, and k3d:

- container image
- `PORT`
- `/health`
- `/ready`
- `DATABASE_URL`
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- structured logs with trace correlation fields

## 7. Alternatives Considered

### Alternative A: Keep Generic Booking Sync

- Pros: Minimal changes from current code.
- Cons: Less intuitive for CQRS, frontend UX, and async status transitions.
- Decision: Rejected. It is useful as a first scaffold, but less attractive as the long-term learning domain.

### Alternative B: Movie Reservation With Polling First

- Pros: Natural async flow, understandable UI, realistic conflicts, easy to test locally.
- Cons: Requires renaming existing domain files and schema.
- Decision: Recommended.

### Alternative C: Start With Full Event-Driven SQS Worker Immediately

- Pros: More production-like.
- Cons: Adds queue, worker, idempotency, retries, and deployment complexity before the domain is clear.
- Decision: Defer until after the in-process workflow and Postgres are working.

## 8. API / Interface Changes

Expected GraphQL direction:

```graphql
type Query {
  movie(id: ID!): Movie
  movies: [Movie!]!
  screening(id: ID!): Screening
  screenings(movieId: ID): [Screening!]!
  reservationRequest(id: ID!): ReservationRequest
  reservation(id: ID!): Reservation
}

type Mutation {
  requestReservation(input: RequestReservationInput!): ReservationRequest!
}
```

Future subscription, after polling works:

```graphql
type Subscription {
  reservationRequestUpdated(id: ID!): ReservationRequest!
}
```

The mutation behaves like HTTP `202 Accepted`: it confirms the request was accepted, not that the final reservation is complete.

## 9. Data Model / Persistence Changes

Initial in-memory model:

- movies
- screenings
- seats
- reservation requests
- reservations

Postgres model later:

- `movies`
- `screenings`
- `screening_seats`
- `reservation_requests`
- `reservations`
- optional `reservation_seats`

Migration strategy:

- Use Knex migrations locally first.
- Use the same migrations in AWS through a one-off ECS migration task.
- Keep migrations explicit, not hidden inside normal app startup.

## 10. Security, Privacy, and Abuse Considerations

- Validate GraphQL inputs at runtime; TypeScript types do not protect runtime requests.
- Treat customer names as user-provided input and avoid logging sensitive free-form data.
- Use parameterized queries through Knex.
- Store AWS database credentials in Secrets Manager or SSM, not plain environment values.
- Keep app task role permissions narrow.
- Keep migration task permissions separate from the normal API task where practical.
- Add rate limiting or request limits later if the public API becomes internet-facing.

## 11. Performance, Scalability, and Reliability Considerations

- Seat reservation has a natural concurrency risk: two requests can try to claim the same seat.
- In-memory state is fine for learning but does not survive restarts.
- Postgres should enforce uniqueness for confirmed reservation seats.
- SQS worker processing should be idempotent.
- Failed worker messages should go to a dead-letter queue.
- ECS API and worker services should scale independently.
- Polling should use bounded intervals from the frontend to avoid noisy traffic.

## 12. Implementation Steps

1. Reshape the domain
   - Change: Rename booking concepts into movie reservation concepts.
   - Files/modules likely affected: `service/src/domain/bookings`, `service/src/application/bookings`, `service/src/presentation/graphql`.
   - Notes: Keep the old clean architecture layering.
   - Verification: Domain and mapper tests pass.

2. Add CQRS-style GraphQL polling
   - Change: Add `requestReservation` and `reservationRequest`.
   - Files/modules likely affected: GraphQL resolver, models, inputs, mappers, application service.
   - Notes: Return a request object immediately.
   - Verification: E2E GraphQL test covers request then poll.

3. Add in-process async processor
   - Change: Simulate state transitions and seat conflicts.
   - Files/modules likely affected: application service, in-memory repository, tests.
   - Notes: Keep this intentionally fake.
   - Verification: Tests cover confirmed and rejected requests.

4. Add Postgres and Knex locally
   - Change: Add Docker Compose, Knex config, migrations, and repository adapter.
   - Files/modules likely affected: `service/`, root compose files, docs.
   - Notes: Do not remove in-memory tests.
   - Verification: Migrations run and integration tests pass against local Postgres.

5. Add local observability
   - Change: Add structured logging, OpenTelemetry bootstrap, collector config.
   - Files/modules likely affected: service bootstrap, config, Docker Compose.
   - Notes: Include trace IDs in logs.
   - Verification: One GraphQL request has correlated trace and logs.

6. Add frontend demonstrator
   - Change: Add UI for movie, screening, seat selection, request, and status.
   - Files/modules likely affected: new frontend workspace or app folder.
   - Notes: The UI is a workflow demonstrator, not a marketing page.
   - Verification: Browser action can be found in backend traces.

7. Add ECS CDK foundation
   - Change: Add VPC, ECS cluster, ALB, task definition, Fargate service, logs, health checks.
   - Files/modules likely affected: `infra/lib`.
   - Notes: Keep CDK resources explicit before extracting constructs.
   - Verification: `cdk synth` and CDK assertions pass.

8. Add RDS and migration task
   - Change: Add database resources and one-off migration task.
   - Files/modules likely affected: `infra/lib`, service env config, docs/runbook.
   - Notes: Document deployment order.
   - Verification: Migration task can run before API service uses DB.

9. Add SQS worker
   - Change: Move async reservation processing from in-process to queue and worker.
   - Files/modules likely affected: service worker entrypoint, infra queue, application ports.
   - Notes: Preserve public GraphQL contract.
   - Verification: API publishes, worker consumes, status updates.

10. Add k3d target
    - Change: Add Kubernetes manifests or Helm chart and local collector.
    - Files/modules likely affected: new k8s manifests, docs/runbook.
    - Notes: Same app image and runtime contract.
    - Verification: k3d deployment passes probes and emits traces.

## 13. Testing Strategy

- Unit tests for domain state transitions and value-object validation.
- Application tests with fake repositories for request/status behavior.
- Thin integration tests for GraphQL resolver mappings.
- E2E tests for GraphQL request and poll flows.
- Migration tests against local Postgres once Knex exists.
- CDK assertion tests for key resources, health checks, IAM, and log groups.
- Docker Compose smoke test for service, database, and collector.
- k3d smoke tests for Deployment, Service, Ingress, probes, and telemetry.
- AWS smoke tests for ALB response, ECS running count, target group health, logs, and migration task success.

## 14. Rollout / Migration Plan

This is a learning repo, so rollout means keeping each phase reversible and understandable.

- Keep the existing in-memory path until Postgres is working.
- Add Postgres behind a repository interface.
- Keep polling before subscriptions.
- Keep the in-process processor before SQS.
- Keep explicit CDK resources before extracting `PlatformHttpService`.
- Add CloudFront/Cloudflare only after ALB and ECS are understood.

## 15. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---:|---:|---|
| Scope grows too fast | High | High | Follow the ten-step progression and finish one vertical slice at a time. |
| Infra costs surprise you | High | Medium | Use Docker Compose and CDK synth first; set AWS Budgets before real deploys. |
| CQRS becomes abstract ceremony | Medium | Medium | Keep it tied to reservation request status and seat conflicts. |
| Observability becomes bolted on late | Medium | High | Add local OTel before ECS. |
| CDK abstraction hides learning | Medium | Medium | Create explicit resources first, then extract constructs. |
| Kubernetes and ECS drift | Medium | Medium | Preserve the same app contract across runtimes. |

## 16. Done Criteria

- Movie reservation GraphQL operations replace generic booking sync operations.
- A reservation request can be created and polled.
- Local Postgres persistence works through Knex migrations.
- Logs and traces correlate for at least one GraphQL request.
- Frontend interaction appears in backend traces.
- CDK can synthesize an ECS service behind an ALB.
- AWS database migrations have an explicit run path.
- SQS worker processes reservation requests.
- k3d can run the same app image with health probes.

## 17. Review Checklist

- [ ] Requirements are explicit.
- [ ] Non-goals are explicit.
- [ ] Existing code conventions were checked.
- [ ] Alternatives were considered.
- [ ] Security implications were reviewed.
- [ ] Scalability and reliability implications were reviewed.
- [ ] Testing strategy is complete.
- [ ] Rollout and rollback are defined.
- [ ] Implementation steps are ordered and concrete.

## 18. Handoff Prompt for Implementation Agent

```text
Implement the plan in docs/plans/movie-reservation-platform-roadmap.md.

Constraints:
- Keep NestJS at the presentation/composition boundary.
- Keep domain and application code as plain TypeScript where possible.
- Preserve REST /health and /ready endpoints.
- Start with polling before GraphQL subscriptions.
- Start with in-memory state before Postgres.
- Start with an in-process processor before SQS.
- Do not extract CDK platform constructs until explicit ECS resources exist.
- Add or update tests with each phase.
```
