# Golden Path

The golden path is the opinionated route for creating, running, observing, and deploying backend services.

It should feel like a platform product: a service team should make a few meaningful choices, while the platform provides the repetitive operational wiring.

---

## What Is Standardized

Every service should have:

- a container image
- a stable service name
- `GET /health`
- `GET /ready`
- structured logs
- OpenTelemetry traces
- environment-specific config
- clear secret handling
- tests for the public API boundary
- a documented local run path
- OpenTelemetry resource attributes that identify service, environment, and version

For NestJS services, the expected shape is:

- modules for feature boundaries
- controllers for REST endpoints
- resolvers for GraphQL endpoints
- providers for business behavior and integrations
- DTO/input classes for runtime API boundaries

---

## What Consumers May Customize

A consuming app may customize:

- app name
- container port
- CPU and memory
- desired count
- public vs internal exposure
- health check path if needed
- environment variables
- secret references
- autoscaling limits
- GraphQL schema and business modules

The platform should expose these as explicit inputs, not as scattered copy-paste changes.

---

## What The Platform Owns

The platform should own:

- Docker Compose service wiring
- k3d cluster conventions
- ECS/Fargate service defaults
- ALB routing defaults
- CloudWatch log groups
- IAM execution role defaults
- task role attachment points
- OpenTelemetry collector configuration
- standard tags and names
- basic alarms
- runbook expectations

The platform should not own business logic.

---

## First Golden Path Consumer

The first consumer is this repo's `movie-reservation-service/` app.

It should prove:

- NestJS app startup
- REST health checks
- GraphQL movie reservation operations
- CQRS-style request/status polling
- local Postgres persistence and Knex migrations
- testable module boundaries
- local Docker execution
- telemetry export
- frontend-to-backend trace correlation
- ECS deployment

Do not optimize this app as if it were the final product. Its job is to teach and validate the platform shape.

The recommended product slice is:

1. list movies and screenings
2. select seats
3. request a reservation
4. poll reservation request status
5. confirm or reject the reservation asynchronously

---

## Future Consumers

Future consumers:

- `/home/patex1987/development/yoga-studio-api`
- `/home/patex1987/development/python-agent-with-idp`

The important platform lesson is that not every service will be NestJS. A golden path can have a preferred path while still supporting other runtimes through the same container, health, config, and telemetry contracts.

---

## Developer Experience Target

The desired workflow should eventually look like:

```text
make dev
make test
make docker-up
make migrate
make otel-up
make k3d-up
make synth
make deploy
```

The exact command names can change. The goal is that the repeated work is documented and automated.

---

## Guardrails

Avoid these early:

- a generic platform abstraction before one real service works
- too many AWS features at once
- hiding ECS concepts so deeply that they cannot be learned
- treating observability as a final polish step
- merging unrelated apps into this repo before the platform contract is clear
- adding GraphQL subscriptions before request/status polling works
- adding SQS before the in-process reservation workflow is understood

Prefer small working increments with clear explanations.

---

## Runtime Contract

Every app should eventually be runnable by Docker Compose, k3d, and ECS through the same basic contract:

- container image
- container port
- `/health`
- `/ready`
- `DATABASE_URL` when persistence is needed
- `OTEL_SERVICE_NAME`
- `OTEL_RESOURCE_ATTRIBUTES`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- structured logs with trace correlation fields

The platform wiring changes per runtime. The application contract should not.
