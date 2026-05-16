# Golden Path ECS Service Template

A platform-style learning project for ramping into a senior cloud platform engineer role in an AWS + TypeScript + CDK environment.

## Why this project exists

This project is not just a demo app.

The goal is to build a small but realistic internal platform starter that helps product teams deploy services to AWS with good defaults for security, observability, scaling, and operational clarity.

This should teach:

- TypeScript for backend and infrastructure code
- Node.js service patterns
- AWS CDK in TypeScript
- ECS/Fargate deployment
- IAM roles and least privilege
- logging, alarms, autoscaling, health checks
- reusable platform abstractions
- platform-as-a-product thinking

---

## The concept

Build a reusable CDK construct and a sample application stack that make it easy to deploy a service on ECS/Fargate.

Think of the output as:

> “Here is the paved road for creating and deploying a backend service.”

The project should include both:
1. a **platform layer**
2. one or more **consumer services** using that platform layer

---

## Core idea

Create a reusable construct called something like:

- `PlatformHttpService`

This construct should provide sane defaults for:
- ECS/Fargate service
- ALB exposure
- health checks
- CloudWatch logs
- CPU/memory defaults
- autoscaling
- alarms
- IAM task role / execution role setup
- secret/config injection
- tags / naming conventions

A product team should be able to consume it with a small amount of code.

---

## Suggested repository structure

```text
.
├── movie-reservation-service/
│   ├── src/
│   ├── test/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── ecs-infra/
│   ├── bin/
│   ├── lib/
│   │   ├── constructs/
│   │   ├── stacks/
│   │   └── config/
│   ├── package.json
│   └── cdk.json
├── docs/
│   ├── architecture.md
│   ├── golden-path.md
│   ├── runbook.md
│   ├── platform-api.md
│   └── architecture-decisions.md
├── notes.md
└── README.md
```

---

## Functional scope

## Phase 1: Basic service
Build a small NestJS + TypeScript backend with:
- `GET /health`
- `GET /ready`
- GraphQL queries for movies and screenings
- GraphQL mutation for requesting a reservation
- GraphQL query for polling reservation request status

This service can be fake. It does not need to solve a real business problem.
It only needs enough shape to look like a real internal service and teach NestJS, GraphQL, and platform health checks.

Recommended additions:
- structured logging
- request validation
- config loading from environment
- graceful shutdown
- tests

### Example business theme
Use a lightweight movie reservation concept to make the example feel operationally realistic:

- GraphQL `movies` and `screenings` return fake catalog data
- GraphQL `requestReservation` creates an async reservation request
- GraphQL `reservationRequest(id)` lets a client poll status
- a future worker processes reservation requests asynchronously
- logs, traces, and metrics show operational state

---

## Phase 2: Infrastructure
Use CDK in TypeScript to provision:
- VPC
- ECS cluster
- ECR repository
- CloudWatch log groups
- ECS task definition
- Fargate service
- Application Load Balancer
- target group + health checks
- IAM task role
- IAM execution role
- parameter or secret storage
- autoscaling
- alarms

You do not need to optimize for every AWS edge case.
You do need to make the shape clean, understandable, and reusable.

---

## Phase 3: Platform abstraction
Extract a reusable CDK construct:

### `PlatformHttpService`
Suggested constructor inputs:
- `serviceName`
- `containerPort`
- `cpu`
- `memoryMiB`
- `desiredCount`
- `environment`
- `secrets`
- `healthCheckPath`
- `public` or `internal`

Suggested defaults:
- standard log group naming
- standard health check path
- minimum autoscaling
- default alarms
- required tags
- consistent resource naming

Suggested outputs:
- service URL
- service security group
- target group
- ECS service handle
- log group

The point is not to make it infinitely flexible.
The point is to provide a paved road with good defaults.

---

## Phase 4: Second workload
Add one more workload to avoid a too-simple architecture.

Choose one:

### Option A: Worker service
- consumes jobs from SQS
- processes movie reservation requests
- logs success/failure
- can scale separately from the HTTP API

### Option B: Scheduled task
- runs every N minutes
- simulates reconciliation or cleanup
- useful for learning scheduled ECS workloads

### Option C: Internal service-to-service call
- second internal API
- the main API calls it
- useful for learning service boundaries and connectivity

Best default choice: **Option A**.

---

## Phase 5: Documentation like a real platform team
Write docs as if other engineers will consume your work.

Required docs:
- `README.md`
- `docs/index.md`
- `docs/architecture/architecture.md`
- `docs/architecture/golden-path.md`
- `docs/architecture/platform-api.md`
- `docs/operations/runbook.md`
- `docs/architecture/architecture-decisions.md`
- `docs/workflows/ai-review-workflow.md`

### README should explain
- what the project is
- who it is for
- how to run it locally
- how to deploy it
- what abstractions it provides
- current limitations

### golden-path.md should explain
- what is standardized
- what consumers may customize
- what defaults exist and why

### platform-api.md should explain
- how another team would instantiate your construct
- which inputs are required
- what outputs they get
- how much they need to know about ECS internals

### runbook.md should explain
- common failure modes
- where logs are
- where alarms are
- how to check health
- how to roll back

### architecture-decisions.md should explain
- why ECS/Fargate
- why CDK
- why ALB
- why these defaults
- what you would change at larger scale

---

## Non-functional requirements

The project should demonstrate:
- sensible naming
- clear code organization
- typed infrastructure code
- typed application code
- least-privilege thinking
- basic operational maturity
- documentation discipline

---

## Iterative milestones

## Milestone 1
Local NestJS backend running with:
- health endpoint
- readiness endpoint
- GraphQL movie reservation auth and reservation operations
- config
- logging
- tests

## Milestone 2
Dockerized service runs locally

## Milestone 3
CDK app exists and can synthesize infrastructure

## Milestone 4
Service deploys to ECS/Fargate behind ALB

## Milestone 5
Secrets/config, autoscaling, and alarms are added

## Milestone 6
Reusable `PlatformHttpService` construct extracted

## Milestone 7
Second workload added

## Milestone 8
Docker Compose, k3d, and ECS paths documented

## Milestone 9
OpenTelemetry traces, logs, and metrics standardized

## Milestone 10
Docs written from platform-consumer perspective

## Milestone 11
CI, staging/prod config, and project cleanup complete

---

## Suggested technical choices

### Backend
- NestJS
- REST endpoints for health/readiness
- code-first GraphQL for movie reservation operations

Best default now: **NestJS**, because learning Nest modules, dependency injection, controllers, and resolvers is the current priority.

### Validation
- Nest validation pipes and DTO/input classes first
- Zod remains useful for explicit schema validation where it improves clarity

### Observability
- OpenTelemetry as the cross-runtime contract
- structured logs with request/trace correlation

### Testing
- Vitest or Jest

### Infra
- AWS CDK v2 in TypeScript

### Compute
- ECS on Fargate

### Async
- SQS for ECS worker workloads
- queue-backed reservation processing as the first async example

### Local and cluster runtimes
- Docker Compose
- k3d Kubernetes
- ECS/Fargate

### Secrets/config
- SSM Parameter Store or Secrets Manager

---

## Suggested initial user story

> As a product engineer, I want to create a new backend service using the company’s platform abstraction so that I get deployment, logging, health checks, scaling, and security defaults without having to wire every AWS resource myself.

That is the mindset this project should reinforce.

---

## Stretch goals

Only do these if the core is already solid:
- GitHub Actions CI/CD
- separate staging and production stacks
- dashboards
- service-to-service communication patterns
- canary or blue/green deployment notes
- cost-awareness notes
- template generation script for new services

---

## What success looks like

By the end, this project should let you say:

- I can read and write practical TypeScript backend code
- I can work with CDK in TypeScript without fear
- I understand ECS/Fargate at a useful level
- I can think like a platform engineer, not just an app developer
- I can discuss defaults, guardrails, self-service, and developer experience with credibility

---

## First implementation steps

1. Keep `movie-reservation-service/` as the NestJS app
2. Add REST health/readiness endpoints
3. Add GraphQL movie reservation query and mutation operations
4. Add Dockerfile and run locally
5. Add Docker Compose with an OpenTelemetry Collector
6. Initialize the CDK platform foundation in `ecs-infra/`
7. Add ECS cluster and deploy the service
8. Add ALB and health checks
9. Add logs, traces, alarms, autoscaling
10. Extract reusable construct
11. Add worker or scheduled task
12. Add k3d path and multi-app registration
13. Write docs like a platform team would

---

## Keep the bar realistic

This project does not need to be huge.
It needs to be coherent, operationally aware, and well-documented.

Boring and solid is better than clever and unfinished.
