# Implementation Plan

This is the learning and build plan for the golden path platform project.

The full roadmap for the next shape lives in:

- `docs/plans/movie-reservation-platform-roadmap.md`

The project is shifting from a small framework-neutral Node service toward a NestJS-based movie reservation service because NestJS is the framework you need to learn now. The infrastructure goal stays the same: understand TypeScript, AWS CDK, containers, ECS/Fargate, and platform engineering by building a realistic internal platform template.

The longer-term target is a small multi-app platform that can run the same workloads in:

- Docker Compose for fast local development
- k3d Kubernetes for local cluster practice
- ECS/Fargate for the AWS production-style path

The common operational thread across all three environments is end-to-end OpenTelemetry observability.

---

## Recommended Progression

This is the preferred build order for the full-blown shape:

1. Rename and reshape the fake domain into movie reservation.
2. Add CQRS-ish GraphQL operations with polling status.
3. Add a fake async processor in-process first.
4. Add Postgres and Knex with Docker Compose.
5. Add structured logging and OpenTelemetry locally.
6. Add a frontend that calls GraphQL and propagates trace context.
7. Add ECS CDK: VPC, ECS, ALB, logs, health checks.
8. Add RDS and a migration ECS task.
9. Add an SQS worker for async reservation processing.
10. Add k3d/Kubernetes deployment as a second platform target.

The order is intentional: make the app behavior clear locally before adding managed infrastructure.

---

## Current Direction

### Primary application

Use `service/` as the first NestJS application.

It should teach:

- Nest modules, controllers, providers, and dependency injection
- REST health/readiness endpoints for platform integration
- code-first GraphQL operations for business behavior
- TypeScript classes, decorators, interfaces, and explicit return types
- runtime validation at API boundaries
- structured logging and OpenTelemetry instrumentation

### First business theme

Keep the business domain deliberately small: movie reservations.

The target service should expose:

- `GET /health`
- `GET /ready`
- GraphQL query: fetch movies and screenings
- GraphQL query: fetch reservation request status
- GraphQL query: fetch a confirmed reservation
- GraphQL mutation: request a reservation

This gives the app enough shape to be useful for ECS health checks, GraphQL learning, CQRS-style command/query separation, tests, logs, traces, database migrations, and future async worker behavior.

### Future cluster applications

The long-term app cluster should include:

- this repository's NestJS service
- `/home/patex1987/development/yoga-studio-api`
- `/home/patex1987/development/python-agent-with-idp`

Treat those as future platform consumers. Do not merge them into this repository early. First build a platform contract that can run multiple independently owned apps.

---

## Phase 0: Repository Orientation

Status: completed.

### Goal

Understand the repository responsibilities.

### Current shape

- `service/` is the TypeScript application workspace.
- `infra/` is the AWS CDK workspace.
- `docs/` is the platform and learning documentation.
- `notes.md` is for personal learning notes.

### Check yourself

- What runs locally?
- What eventually gets deployed to AWS?
- Which parts should become reusable platform code?

---

## Phase 1: Convert the Service to NestJS and Reshape the Domain

Status: in progress.

### Goal

Keep the small, idiomatic NestJS application shape and move the fake business domain toward movie reservations.

### Learn first

- what a Nest module is
- what controllers and providers are
- how Nest dependency injection differs from importing a plain function
- why decorators require TypeScript compiler support
- how `app.ts` and `index.ts` should split app creation from process startup

### What to build

- `AppModule`
- `HealthModule`
- movie reservation GraphQL module
- `HealthController`
- movie reservation resolver
- movie reservation application service

### Suggested implementation order

1. Add NestJS dependencies and enable TypeScript decorators.
2. Create `AppModule`.
3. Move `/health` and `/ready` into a Nest controller.
4. Add a plain TypeScript application service with fake in-memory data.
5. Add GraphQL resolvers for movie, screening, and reservation request behavior.
6. Update tests to use Nest's HTTP server.

### Deliverable

The service runs locally as a NestJS app and has both REST health endpoints and GraphQL movie reservation operations.

### Check yourself

- Which files are framework setup?
- Which files are business behavior?
- Which files are API boundary code?
- Why does GraphQL code-first need runtime decorators if TypeScript types disappear at runtime?

---

## Phase 2: Validation, Error Handling, Logging, and Tests

### Goal

Make the NestJS service production-shaped without adding real persistence yet.

### Learn first

- compile-time types vs runtime validation
- Nest pipes and DTOs
- GraphQL input types
- exception filters
- structured logs
- test module setup

### What to build

- validation for REST params and GraphQL inputs
- consistent error responses
- structured application logging
- tests for health, readiness, GraphQL query, GraphQL mutation, and invalid input

### Recommended validation path

Start with Nest's validation pipe and DTO classes. Keep Zod as an option for explicit schema validation later.

The tradeoff:

- Nest DTO validation fits Nest examples and learning material well.
- Zod is very explicit and familiar if you think in Python/Pydantic terms.

Use the Nest path first because learning NestJS is the priority.

---

## Phase 3: Add OpenTelemetry Locally

### Goal

Introduce observability before AWS, so traces and logs are not an afterthought.

### Learn first

- trace, span, metric, and log correlation
- auto-instrumentation vs manual spans
- OTLP exporters
- why service names matter

### What to build

- OpenTelemetry bootstrap for the NestJS service
- automatic HTTP instrumentation
- GraphQL operation tracing where practical
- local collector config
- trace export to a local backend such as Jaeger, Tempo, or the OpenTelemetry demo stack

### Deliverable

One local request should produce logs and a trace that share enough context to follow the request path.

---

## Phase 4: Docker Compose Developer Environment

### Goal

Make local development easy and repeatable.

### What to build

- `Dockerfile` for the NestJS service
- `docker-compose.yml`
- local OpenTelemetry Collector
- local observability backend
- optional local dependencies as the app grows

### Design rule

Docker Compose is for developer speed, not production parity at any cost. It should be easy to start, inspect, and reset.

### Deliverable

`docker compose up` should start the service and observability stack.

---

## Phase 5: CDK Foundation

### Goal

Understand how CDK TypeScript models AWS resources.

### Learn first

- CDK `App`, `Stack`, and `Construct`
- synthesis vs deployment
- CloudFormation as the generated deployment plan
- resource naming and tags

### What to build

- base stack conventions
- VPC
- ECS cluster
- ECR repository or image publishing strategy
- CloudWatch log groups

### Deliverable

`cdk synth` produces a readable infrastructure template for the platform foundation.

---

## Phase 6: ECS Service Deployment

### Goal

Deploy the NestJS service to ECS/Fargate behind an Application Load Balancer.

### Learn first

- task definition vs ECS service
- task role vs execution role
- target groups and health checks
- ALB listener routing

### What to build

- ECS task definition
- Fargate service
- ALB listener and target group
- `/health` or `/ready` health check
- CloudWatch logs

### Deliverable

The NestJS service is reachable through an ALB and ECS can replace unhealthy tasks.

---

## Phase 7: Platform Construct

### Goal

Extract the first reusable CDK abstraction.

### What to build

Create a construct such as `PlatformHttpService`.

It should own the repeatable platform concerns:

- ECS/Fargate service setup
- container port
- health check path
- environment variables
- secrets
- log group
- CPU and memory defaults
- desired count
- autoscaling hooks
- alarms
- common tags

### Design rule

Keep the construct opinionated. A golden path should remove repeated decisions, not expose every ECS option.

### Deliverable

A consumer stack can deploy the NestJS service with a small amount of TypeScript code.

---

## Phase 8: Async Worker or Second Service

### Goal

Avoid a one-service architecture that hides platform concerns.

### Recommended first choice

Add a worker for movie reservation requests.

### What to build

- SQS queue
- GraphQL mutation creates a reservation request
- worker consumes jobs
- worker updates reservation request status
- worker emits logs, traces, and metrics
- worker scales separately from the API

### Why this matters

APIs and workers have different scaling, health, deployment, and observability needs. A platform should support both.

---

## Phase 9: k3d Kubernetes Environment

### Goal

Practice Kubernetes concepts locally without changing the app architecture.

### Learn first

- deployment
- service
- ingress
- config map
- secret
- namespace
- health probes
- OpenTelemetry Collector in-cluster

### What to build

- k3d cluster setup notes or script
- Kubernetes manifests or Helm chart
- app deployment
- local ingress route
- OpenTelemetry Collector deployment

### Deliverable

The NestJS service runs in k3d with health probes and traces exported through the collector.

---

## Phase 10: Multi-App Platform Cluster

### Goal

Turn the project from a single service demo into a small platform cluster.

### Target apps

- `golden-path-ecs-template/service`
- `/home/patex1987/development/yoga-studio-api`
- `/home/patex1987/development/python-agent-with-idp`

### What to define

- app metadata format
- per-app port, health path, runtime, and image settings
- environment-specific config
- shared observability conventions
- local Docker Compose registration
- k3d registration
- ECS/CDK registration

### Design rule

Each app should remain independently buildable. The platform owns how apps are run, observed, and deployed together.

---

## Phase 11: End-to-End OpenTelemetry

### Goal

Make observability consistent across Docker Compose, k3d, and ECS.

### What to standardize

- service names
- resource attributes
- trace propagation
- log format
- metric names
- OTLP endpoint configuration
- collector pipelines

### ECS path

Start with an OpenTelemetry Collector sidecar or FireLens-compatible logging path, then decide whether the longer-term model should use sidecars, a daemon/service collector pattern, or AWS Distro for OpenTelemetry.

### Deliverable

A request crossing multiple services can be followed through traces, logs, and metrics.

---

## Phase 12: Developer Experience and Automation

### Goal

Make the platform pleasant to use repeatedly.

### What to build

- `make` or npm scripts for common workflows
- local bootstrap command
- test command
- Docker build command
- k3d cluster command
- CDK synth/deploy commands
- docs that explain the happy path

### CDK automation ideas

- app registration config
- generated ECR repositories
- reusable service construct
- stage-aware stacks
- common tags
- outputs for service URLs and observability links

---

## Recommended Learning Rhythm

For each phase:

1. Read the relevant code.
2. Predict what it should do.
3. Implement one small change.
4. Run or test it.
5. Explain the result in your own words.
6. Write down what still feels unclear.

This matters because the goal is not only to have a working template. The goal is to be able to explain the template like a platform engineer.

---

## Current Next Steps

1. Reshape the current booking domain into movie reservation concepts.
2. Add movie/screening/reservation GraphQL models and queries.
3. Add `requestReservation` and `reservationRequest` polling.
4. Keep the in-memory repository until the workflow is clear.
5. Update tests around the new domain and GraphQL contract.
6. Add Dockerfile and Docker Compose only after the local service behavior is stable.
7. Add local OpenTelemetry before starting the ECS CDK foundation.
