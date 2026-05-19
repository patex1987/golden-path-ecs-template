# Platform API

This document describes the future API that a service should use to join the platform.

The API does not need to exist all at once. Start with hard-coded CDK values, then extract a construct once the repeated shape is obvious.

---

## Target CDK Construct

Working name:

```ts
PlatformHttpService
```

Example future usage:

```ts
new PlatformHttpService(this, 'MovieReservationsApi', {
  serviceName: 'movie-reservations-api',
  containerPort: 3000,
  healthCheckPath: '/health',
  desiredCount: 1,
  cpu: 256,
  memoryMiB: 512,
  environment: {
    NODE_ENV: 'production',
    OTEL_SERVICE_NAME: 'movie-reservations-api',
  },
});
```

This should be a small API. The consumer should not need to understand every ECS object for normal usage.

---

## Proposed Inputs

Required inputs:

- `serviceName`
- `containerPort`
- `healthCheckPath`
- container image or build context

Optional inputs:

- `desiredCount`
- `cpu`
- `memoryMiB`
- `environment`
- `secrets`
- `public`
- `database`
- `autoscaling`
- `alarms`
- `otel`

Defaults should be good enough for the first internal service.

---

## Proposed Outputs

Useful outputs:

- service URL
- ECS service
- task definition
- target group
- security group
- log group
- service name

Expose handles only when consumers have a real reason to extend behavior.

---

## App Registration Model

For Docker Compose and k3d, a lightweight app metadata file may be more useful than CDK code.

Example shape:

```yaml
name: movie-reservations-api
runtime: node
buildContext: ./movie-reservation-service
containerPort: 3000
healthPath: /health
readinessPath: /ready
telemetry:
  serviceName: movie-reservations-api
database:
  required: true
  migrationCommand: npm run migrate:latest
```

Future app entries:

- `golden-path-ecs-template/movie-reservation-service`
- `yoga-studio-api`
- `python-agent-with-idp`

Keep this format boring. The value is in consistency, not clever syntax.

---

## OpenTelemetry Inputs

Every app should be able to receive:

- `OTEL_SERVICE_NAME`
- `OTEL_RESOURCE_ATTRIBUTES`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_TRACES_EXPORTER`
- `OTEL_METRICS_EXPORTER`
- `OTEL_LOGS_EXPORTER`

The platform should set the defaults. The app should only override them intentionally.

---

## Database and Migration Contract

The movie reservation service should eventually use Postgres with Knex migrations.

The platform should make these concerns explicit:

- database connection injected through `DATABASE_URL` or separate secret-backed fields
- migrations run as a separate task or command
- normal app startup does not mutate the schema
- migration logs are visible in the same observability system

For ECS, the likely shape is a one-off migration task using the same container image as the API but a different command.

For Docker Compose, the likely shape is a local migration command against the local Postgres container.

For k3d, the likely shape is either a Kubernetes Job or an explicit local command that targets the cluster database.

---

## Worker Service Contract

The first worker should process movie reservation requests.

Future construct name:

```ts
PlatformWorkerService
```

Expected inputs:

- `serviceName`
- container image or build context
- command override
- queue binding
- environment
- secrets
- CPU and memory
- desired count or scaling rules
- OpenTelemetry settings

The API and worker should share the same domain concepts and database, but they should be deployed and scaled as separate workloads.
