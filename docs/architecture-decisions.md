# Architecture Decisions

This file records current architectural direction and the tradeoffs behind it.

---

## ADR 001: Use NestJS For The TypeScript Service

Status: accepted.

### Decision

Use NestJS as the primary TypeScript backend framework in `service/`.

### Reason

The immediate learning goal is NestJS. Nest also gives useful structure for a platform-style service:

- modules for boundaries
- dependency injection for providers
- controllers for REST endpoints
- resolvers for GraphQL endpoints
- testing utilities for app/module setup

### Tradeoff

NestJS has more framework concepts than a minimal Fastify or Express app. That is acceptable here because learning those concepts is part of the project goal.

---

## ADR 002: Keep Health Checks As REST Endpoints

Status: accepted.

### Decision

Expose `/health` and `/ready` as plain HTTP endpoints.

### Reason

ECS target groups, Kubernetes probes, Docker Compose checks, and humans can all use simple HTTP paths easily.

### Tradeoff

This means the service has both REST and GraphQL. That is fine: health endpoints are operational boundaries, while GraphQL is a business API boundary.

---

## ADR 003: Use Code-First GraphQL Initially

Status: accepted.

### Decision

Use NestJS code-first GraphQL for booking operations.

### Reason

Code-first GraphQL is useful for learning how TypeScript classes, decorators, and runtime metadata interact. It keeps the initial schema close to the service code.

### Tradeoff

GraphQL schema-first can be better when the schema is the main contract shared across teams. Start code-first for learning. Revisit schema-first if multiple clients or teams depend on the schema later.

---

## ADR 004: Build Docker Compose, k3d, And ECS Paths

Status: proposed.

### Decision

Support three runtime targets over time:

- Docker Compose
- k3d Kubernetes
- ECS/Fargate

### Reason

Each target teaches a different platform concern:

- Docker Compose teaches local developer experience.
- k3d teaches Kubernetes primitives locally.
- ECS teaches AWS container operations and CDK automation.

### Tradeoff

Supporting three paths adds maintenance cost. Keep the app contract common across all three: container, port, health path, config, secrets, telemetry.

---

## ADR 005: Standardize On OpenTelemetry

Status: proposed.

### Decision

Use OpenTelemetry as the common observability contract.

### Reason

OpenTelemetry can work across Node, Python, Docker Compose, Kubernetes, and ECS. It gives a shared vocabulary for traces, metrics, logs, resource attributes, and propagation.

### Tradeoff

OpenTelemetry setup can feel complex early. Add it incrementally: first local traces, then logs and metrics, then collector pipelines for each runtime.

---

## ADR 006: Keep External Apps Independent

Status: accepted.

### Decision

Do not merge `yoga-studio-api` or `python-agent-with-idp` into this repository early.

### Reason

The platform should learn to consume independently owned apps. That is closer to real platform engineering than making one monorepo before the platform contract is clear.

### Tradeoff

Local orchestration will need paths to external repos. That is acceptable for a personal learning platform and can later be replaced by image references or app registry metadata.
