# Architecture

This project is a learning platform for building and operating small backend services across local development, local Kubernetes, and AWS ECS/Fargate.

The immediate architecture is intentionally small:

- one NestJS TypeScript service
- one AWS CDK infrastructure workspace
- documentation that explains the platform choices

The long-term architecture is a small multi-app cluster with shared deployment and observability conventions.

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

The first application is `service/`.

Target framework: NestJS.

Initial modules:

- `HealthModule` for `/health` and `/ready`
- `BookingsModule` for GraphQL booking operations

The health endpoints are platform-facing. ECS, Kubernetes, Docker Compose, and humans can use them to answer whether the process is alive and whether it is ready.

The booking operations are product-facing. They provide enough business behavior to practice types, validation, GraphQL, tests, logs, traces, and eventually async work.

---

## GraphQL Boundary

Use NestJS code-first GraphQL.

That means TypeScript classes describe the GraphQL schema through decorators. This is different from normal TypeScript interfaces: interfaces disappear at runtime, while decorators leave metadata that Nest can use to build the schema.

Use GraphQL first for:

- fetching a booking
- listing bookings
- requesting a booking sync

Keep health checks as REST endpoints. Load balancers and orchestrators understand simple HTTP health paths better than GraphQL operations.

---

## Infrastructure Layer

The `infra/` workspace owns AWS infrastructure through CDK.

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

Later, this should be wrapped in a reusable construct such as `PlatformHttpService`.

---

## Runtime Targets

### Docker Compose

Purpose: fast local development.

Expected responsibilities:

- build and run services
- provide local dependencies
- run an OpenTelemetry Collector
- run or connect to a local observability backend

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
- use CloudWatch logs and alarms
- integrate with OpenTelemetry export
- enforce IAM boundaries

---

## Future Multi-App Cluster

Target applications:

- `golden-path-ecs-template/service`
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
