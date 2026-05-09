# Runbook

This runbook is intentionally early. It describes the operational questions the project should eventually answer.

---

## Local Health Checks

For the NestJS service:

```text
GET /health
GET /ready
```

Expected basic responses:

```json
{ "status": "ok" }
```

```json
{ "status": "ready" }
```

Use `/health` to check that the process is alive.
Use `/ready` to check that the service can receive real traffic.

---

## GraphQL Smoke Test

Once GraphQL is implemented, use `/graphql` for booking operations.

Example query:

```graphql
query GetBooking($id: String!) {
  booking(id: $id) {
    id
    guestName
    status
  }
}
```

Example mutation:

```graphql
mutation RequestBookingSync($input: RequestBookingSyncInput!) {
  requestBookingSync(input: $input) {
    id
    bookingId
    status
  }
}
```

GraphQL is for business operations. Do not use GraphQL as the load balancer health check.

---

## Local Docker Compose Checks

Target checks:

- service container is running
- OpenTelemetry Collector is running
- observability backend is receiving traces
- `/health` returns success
- a GraphQL operation produces a trace

Document the exact commands once `docker-compose.yml` exists.

---

## k3d Checks

Target checks:

- cluster exists
- namespace exists
- deployment is available
- service has endpoints
- ingress route works
- readiness probe passes
- traces reach the collector

Document exact `kubectl` commands once manifests exist.

---

## ECS Checks

Target checks:

- ECS service desired count equals running count
- tasks are healthy
- target group health checks pass
- ALB route responds
- CloudWatch logs are present
- OpenTelemetry export path is working

Document exact AWS CLI commands once the CDK stack creates the resources.

---

## Common Failure Modes To Document Later

- container fails to start
- wrong port configured
- `/health` path mismatch
- task cannot pull image
- task execution role missing permissions
- app task role too broad or too narrow
- OpenTelemetry endpoint misconfigured
- collector running but backend unavailable
- GraphQL schema generation fails because decorator metadata is missing
