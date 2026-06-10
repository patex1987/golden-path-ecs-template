# Architecture

This project is a learning platform for building and operating small backend services across local development, local Kubernetes, and AWS ECS/Fargate.

The immediate architecture is intentionally small:

- one frontend workflow demonstrator
- one NestJS TypeScript service
- one AWS CDK infrastructure workspace
- documentation that explains the platform choices

The long-term architecture is a small multi-app cluster with shared deployment and observability conventions.

---

## Frontend Layer

The first frontend is `movie-reservation-web/`.

Target framework: React with Vite and TypeScript.

The frontend follows a feature-first clean architecture shape:

- `src/features/movie-reservations/domain` for plain TypeScript rules and
  domain-facing types
- `src/features/movie-reservations/application` for use cases and ports
- `src/features/movie-reservations/adapters` for React hooks, GraphQL
  operations, runtime parsers, and error mapping
- `src/features/movie-reservations/ui` for React components
- `src/platform` for cross-cutting browser/runtime capabilities such as the
  GraphQL transport helper and observability context construction

The dependency direction mirrors the backend principle in a frontend-sized way:
domain and application code do not import React, browser APIs, Vite env,
`fetch`, or platform helpers. Outer adapters translate those runtime details
into application/domain models.

See [frontend-architecture.md](frontend-architecture.md) for the folder
structure, Mermaid diagrams, testing convention, and frontend-specific
tradeoffs.

---

## System Context

```text
Developer
  |
  | local commands
  v
Golden Path Platform Repo
  |
  | runs one or more apps through common platform targets
  v
Frontend
  |
  | GraphQL over HTTP with trace context
  v
Movie Reservation API
  |
  | SQL / async jobs
  v
Docker Compose / k3d / ECS
  |
  | emits telemetry
  v
OpenTelemetry Collector
  |
  | exports logs, metrics, traces
  v
Observability Backend
```

The same app should not need a different architecture for every runtime target. The platform should adapt the runtime environment around the app.

---

## Application Layer

The first application is `movie-reservation-service/`.

Target framework: NestJS.

Initial modules:

- `HealthModule` for `/health` and `/ready`
- `MovieReservationsGraphqlModule` for the current movie reservation GraphQL boundary

The service keeps NestJS at the outer edge. Domain types, application services,
and in-memory repository adapters are plain TypeScript; Nest modules and
decorators live in bootstrap, dependency composition, and presentation files.

The health endpoints are platform-facing. ECS, Kubernetes, Docker Compose, and humans can use them to answer whether the process is alive and whether it is ready.

The movie reservation operations are product-facing. They provide enough business behavior to practice types, validation, GraphQL, tests, logs, traces, database migrations, and eventually async worker behavior.

Target domain concepts:

- `Movie`
- `Screening`
- `Seat`
- `ReservationRequest`
- `Reservation`

The first async workflow is a reservation request. A client asks for seats, the API returns an accepted request immediately, and the client polls status until the request is confirmed, rejected, or failed.

---

## GraphQL Boundary

Use NestJS code-first GraphQL.

That means TypeScript classes describe the GraphQL schema through decorators. This is different from normal TypeScript interfaces: interfaces disappear at runtime, while decorators leave metadata that Nest can use to build the schema.

Use GraphQL first for:

- fetching movies and screenings
- requesting a reservation
- polling a reservation request status
- fetching a confirmed reservation

The reservation mutation should not pretend the final reservation is complete. It should return a request object, similar in spirit to HTTP `202 Accepted`.

GraphQL subscriptions are a later enhancement. Polling is the first implementation because it teaches the state model without adding WebSocket transport complexity.

Keep health checks as REST endpoints. Load balancers and orchestrators understand simple HTTP health paths better than GraphQL operations.

---

## Infrastructure Layer

The `ecs-infra/` workspace owns AWS infrastructure through CDK.

The first AWS target is ECS/Fargate behind an Application Load Balancer.

Core resources:

- VPC
- ECS cluster
- ECR repository or image asset flow
- task definition
- Fargate service
- ALB listener and target group
- CloudWatch log group
- IAM execution role
- IAM task role
- RDS Postgres after the first stateless ECS service works
- one-off ECS migration task after RDS exists
- SQS queue and worker after the in-process reservation processor is understood

Later, this should be wrapped in a reusable construct such as `PlatformHttpService`.

---

## Runtime Targets

### Docker Compose

Purpose: fast local development.

Expected responsibilities:

- build and run services
- provide local dependencies such as Postgres
- run Knex migrations
- run an OpenTelemetry Collector
- run or connect to a local observability backend
- support the frontend workflow demonstrator

### k3d

Purpose: learn Kubernetes locally.

Expected responsibilities:

- run apps as Kubernetes deployments
- expose services through ingress
- configure probes
- run an OpenTelemetry Collector in-cluster

### ECS/Fargate

Purpose: learn AWS production-style service deployment.

Expected responsibilities:

- run containerized services without managing EC2 hosts
- expose HTTP services through ALB
- run one-off database migration tasks
- run API and worker workloads separately
- use CloudWatch logs and alarms
- integrate with OpenTelemetry export
- enforce IAM boundaries

---

## Future Multi-App Cluster

Target applications:

- `golden-path-ecs-template/movie-reservation-service`
- `/home/patex1987/development/yoga-studio-api`
- `/home/patex1987/development/python-agent-with-idp`

Each app should provide metadata the platform can consume:

- app name
- container image or build context
- port
- health path
- runtime type
- environment variables
- secret references
- telemetry service name

The platform should own the common operational wiring. Each app should own its code and domain behavior.

---

## Observability

OpenTelemetry should become the common contract across all runtimes.

Standardize:

- service name
- environment name
- trace propagation
- log correlation
- OTLP endpoint
- collector pipeline

The useful end state is not `we installed an agent`. The useful end state is that a request can be followed across services and runtimes with traces, logs, and metrics.
