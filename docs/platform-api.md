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
new PlatformHttpService(this, 'BookingsApi', {
  serviceName: 'bookings-api',
  containerPort: 3000,
  healthCheckPath: '/health',
  desiredCount: 1,
  cpu: 256,
  memoryMiB: 512,
  environment: {
    NODE_ENV: 'production',
    OTEL_SERVICE_NAME: 'bookings-api',
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
name: bookings-api
runtime: node
buildContext: ./service
containerPort: 3000
healthPath: /health
telemetry:
  serviceName: bookings-api
```

Future app entries:

- `golden-path-ecs-template/service`
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
