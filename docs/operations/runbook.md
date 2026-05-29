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

Once GraphQL is implemented, use `/graphql` for movie reservation operations.

Example query:

```graphql
query ListScreenings($movieId: ID) {
  screenings(movieId: $movieId) {
    id
    movieId
    startsAt
    auditoriumName
  }
}
```

Example mutation:

```graphql
mutation RequestReservation($input: RequestReservationInput!) {
  requestReservation(input: $input) {
    id
    screeningId
    status
  }
}
```

Example polling query:

```graphql
query ReservationRequest($id: ID!) {
  reservationRequestStatus(id: $id) {
    id
    screeningId
    seatIds
    requestedByUserId
    status
  }
}
```

GraphQL is for business operations. Do not use GraphQL as the load balancer health check.

---

## Local Docker Compose Checks

Target checks:

- service container is running
- Postgres container is running once persistence exists
- Knex migrations can run against local Postgres
- OpenTelemetry Collector is running
- observability backend is receiving traces
- `/health` returns success
- a GraphQL operation produces a trace
- logs include trace correlation fields after OpenTelemetry is added

Document the exact commands once `docker-compose.yml` exists.

---

## Reservation Workflow Checks

Target checks:

- movies can be listed
- screenings can be listed
- a reservation request can be submitted
- the request can be polled by id
- the request eventually reaches `CONFIRMED`, `REJECTED`, or `FAILED`
- conflicting seat requests do not both confirm

Keep these checks local first. They become more useful than infrastructure checks because they prove the app still behaves correctly after moving from in-memory state to Postgres, then from in-process async work to SQS.

---

## Frontend Observability Checks

Target checks:

- the frontend can call the GraphQL API
- a browser action produces a backend trace
- trace context is propagated from frontend to backend where feasible
- backend logs include the same trace id as the request trace
- failed reservation requests are visible in both UI state and backend logs

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
- app uses the same image contract as Docker Compose and ECS

Document exact `kubectl` commands once manifests exist.

---

## ECS Checks

Target checks:

- ECS service desired count equals running count
- tasks are healthy
- target group health checks pass
- ALB route responds
- CloudWatch logs are present
- database migration task can run successfully once RDS exists
- API and worker services can be checked separately once SQS exists
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
- database security group blocks app connections
- migrations were skipped before deploying code that expects a new schema
- migration task uses different environment variables than the API task
- SQS worker is not updating reservation request status
- dead-letter queue receives messages silently
- OpenTelemetry endpoint misconfigured
- collector running but backend unavailable
- GraphQL schema generation fails because decorator metadata is missing
