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

Use NestJS code-first GraphQL for movie reservation operations.

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

---

## ADR 007: Use Movie Reservations As The Learning Domain

Status: accepted.

### Decision

Evolve the generic booking-sync domain into a movie reservation workflow.

### Reason

Movie reservations make the platform use case easier to understand:

- movies and screenings give the frontend something concrete to display
- seat selection creates a natural conflict scenario
- reservation requests create a natural async command/status flow
- confirmed reservations give the query side a clear final resource

This keeps the product small while making GraphQL, CQRS-style APIs, persistence, async work, and observability feel connected.

### Tradeoff

Renaming the existing booking code creates short-term churn. That is acceptable because the current booking-sync shape is still early and in-memory.

---

## ADR 008: Start Async GraphQL With Polling Before Subscriptions

Status: accepted.

### Decision

Implement `requestReservation` plus `reservationRequest(id)` polling before adding GraphQL subscriptions.

### Reason

Polling teaches the important state model first:

- the mutation accepts a command
- the request gets a stable id
- the request status changes over time
- the client checks status until completion

Subscriptions can be added later after the states, persistence, and processing behavior are clear.

### Tradeoff

Polling is less realtime than subscriptions. That is acceptable for the first implementation because it avoids WebSocket transport, connection lifecycle, scaling, and load balancer concerns too early.

---

## ADR 009: Run Database Migrations Explicitly

Status: accepted.

### Decision

Use Knex migrations for Postgres and run them as an explicit operational step. Do not hide schema migration inside normal application startup.

### Reason

Explicit migrations teach a real deployment concern:

- local Docker Compose can run migrations against local Postgres
- ECS can run a one-off migration task before the API uses the new schema
- migration logs and failures are visible as operational events
- app startup remains focused on serving traffic

### Tradeoff

This adds a deployment step. That is acceptable because schema changes are operationally important and should be visible.

---

## ADR 010: Keep ECS As The Primary AWS Path Before EKS

Status: accepted.

### Decision

Build ECS/Fargate first, then add k3d/Kubernetes as a second runtime target. Do not jump directly to EKS.

### Reason

The purpose of the repository is to learn TypeScript, CDK, ECS/Fargate, and platform defaults. ECS is the primary AWS path. k3d is still valuable because it teaches Kubernetes concepts locally while reusing the same application contract.

### Tradeoff

The Kubernetes infrastructure will be different from ECS. That is the point: the app should stay portable while the platform layer adapts the runtime.
