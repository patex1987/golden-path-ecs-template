# Service Instructions: fastapi_otel_prometheus_grafana_poc

Repo:

```text
/home/patex1987/development/fastapi_otel_prometheus_grafana_poc
```

Required branch:

```text
demo-multi-service-observability
```

Required AI context:

- Planner skill: `/home/patex1987/development/golden-path-ecs-template/.ai/skills/principal-engineer-planner`
- Review agents: `/home/patex1987/development/golden-path-ecs-template/.ai/agents`

## Why This Work Exists

This repo is the demo's observability control room. It does not need new application services for tomorrow. It needs a clear Grafana dashboard that shows the four golden signals across the demo workflow and lets the presenter move between metrics, traces, and logs.

The important part is that the dashboard must not be Prometheus-only. It must include panels derived from:

- Prometheus metrics.
- Tempo traces or trace queries.
- Loki logs and log-derived time series.

## Scope

Build or manually create one Grafana dashboard:

```text
Multi-Service Reservation Demo
```

The dashboard must have four collapsible sections, one per golden signal:

- Traffic
- Errors
- Latency
- Saturation

Grafana row panels are acceptable for collapsible sections. Start with the rows expanded for rehearsal if that helps the demo.

## Current State

The repo already has:

- `docker-compose.yml` for Grafana, Prometheus, Loki, Tempo, Alloy, and OTel Collector.
- Provisioned datasources in `grafana/provisioning/datasources/datasources.yml`.
- Dashboard provisioning directory at `grafana/dashboards`.
- Alloy Docker log scraping based on container labels.

## Dashboard Design

### Shared Dashboard Variables

Add variables where useful:

- `service`
  - Values: `movie-agent-worker`, `movie-reservation-mcp`, `movie-reservation-service`, `axum-tools-mcp`, `axum-tools-random-api`.
- `correlation_id`
  - Free text.
- `trace_id`
  - Free text.
- `fault`
  - Values: `none`, `slow-recommendation`, `recommendation-error`.

### Section 1: Traffic

Purpose:

Show request volume and workflow activity.

Panels:

- Prometheus metric graph:
  - request rate by service/route/operation.
  - Use existing movie-service metrics first.
  - Add agent/MCP/Rust metrics if exporters provide them.
- Loki-derived graph:
  - `count_over_time` over JSON logs where `event` matches request/tool/workflow completion.
  - Group by `service_name` if available.
- Tempo-derived panel:
  - Trace count by service or operation using Tempo TraceQL metrics if available.
  - If TraceQL metrics are not available in this local Tempo setup, use a trace search/table panel filtered by service name and time range.

### Section 2: Errors

Purpose:

Show dependency failures and reservation failures.

Panels:

- Prometheus metric graph:
  - error count/rate by service and operation.
  - Include GraphQL errors and reservation processor outcomes.
- Loki-derived graph:
  - `count_over_time` over logs where `level="error"` or `outcome="error"` or `event` ends in `.failed`.
  - Filterable by `correlation_id` and `fault`.
- Tempo-derived panel:
  - traces with error status or spans whose attributes include `fault="recommendation-error"`.
  - Include a table with trace id, service, operation, and duration.

### Section 3: Latency

Purpose:

Show slow dependency behavior from the poison pill.

Panels:

- Prometheus metric graph:
  - p95 latency by service/operation.
  - Existing movie-service histogram panels are acceptable.
- Loki-derived graph:
  - log-derived duration over time when logs include `duration_ms`.
  - Use unwrap-style LogQL if available, otherwise table recent slow logs.
- Tempo-derived graph:
  - trace/span duration by service or operation.
  - The `slow-recommendation` run must make the Rust API and MCP spans visibly longer.

### Section 4: Saturation

Purpose:

Show where saturation would live in a production dashboard, but do not overbuild it tonight.

Panels:

- Placeholder text panel:
  - Explain that saturation would normally include CPU, memory, queue depth, DB pool usage, and concurrency.
- Optional Docker/container metric panel if already available.
- Log/trace-derived proxy panel:
  - Count active or overlapping slow workflows if easy.

Do not spend time wiring deep saturation metrics unless all core demo flows already work.

## Trace To Logs Workflow

Keep existing datasource integration:

- Tempo should link to Loki logs by `trace_id`.
- Loki should expose derived field links back to Tempo when logs contain `trace_id`.

Dashboard should include a small text panel with the live workflow:

```text
1. Run demo traffic.
2. Copy printed trace_id or correlation_id.
3. Open Tempo trace panel or Explore.
4. Jump from trace to Loki logs.
5. Filter logs by correlation_id for the whole workflow.
```

## Manual Dashboard Path

Manual UI creation is acceptable.

After manual creation:

1. Export dashboard JSON.
2. Save it under:

```text
grafana/dashboards/multi-service-reservation-demo.json
```

3. Restart Grafana or reload provisioning.
4. Verify the dashboard appears after `docker compose up -d`.

## Implementation Steps

1. Start observability stack
   - `docker compose up -d`.
   - Confirm Grafana, Prometheus, Loki, Tempo, and collector are healthy.

2. Confirm datasource behavior
   - Prometheus query works.
   - Loki query over one service log works.
   - Tempo can find a recent trace id.
   - Tempo-to-Loki link works, or document exact manual fallback.

3. Create dashboard rows
   - Add collapsible row: Traffic.
   - Add collapsible row: Errors.
   - Add collapsible row: Latency.
   - Add collapsible row: Saturation.

4. Add panels
   - Use Prometheus metrics where they already exist.
   - Use Loki `count_over_time` or tables for log-derived graphs.
   - Use Tempo TraceQL metrics or trace search panels for trace-derived graphs.

5. Add presenter filters
   - Add `service`, `correlation_id`, `trace_id`, and `fault` variables.
   - Make panels respect variables where practical.

6. Export dashboard
   - Save JSON to `grafana/dashboards/multi-service-reservation-demo.json`.
   - Keep datasource UIDs aligned with existing provisioning.

7. Rehearse
   - Run happy path.
   - Run `slow-recommendation`.
   - Run `recommendation-error`.
   - Confirm all three are visible.

## Suggested Queries

Treat these as starting points. Adjust names to match actual emitted fields.

Loki traffic:

```logql
sum by (service_name) (
  count_over_time({service_environment="local"} | json | event=~".*(completed|finish|success).*" [5m])
)
```

Loki errors:

```logql
sum by (service_name) (
  count_over_time({service_environment="local"} | json | level="error" [5m])
)
```

Loki fault filter:

```logql
{service_environment="local"} | json | fault=~"$fault"
```

Movie-service GraphQL traffic:

```promql
sum by (business_operation, outcome) (increase(graphql_operation_total[5m]))
```

Movie-service p95 latency:

```promql
histogram_quantile(
  0.95,
  sum by (le, business_operation) (rate(graphql_operation_duration_ms_bucket[5m]))
)
```

Reservation processor outcomes:

```promql
sum by (outcome, reason) (increase(reservation_processor_outcome_total[15m]))
```

Tempo:

- Use TraceQL/TraceQL metrics if available in the Grafana Tempo datasource.
- Minimum manual filter targets:
  - `service.name = movie-agent-worker`
  - `service.name = axum-tools-random-api`
  - error traces
  - traces containing the printed `trace_id`

## Done Criteria

- Dashboard exists and is saved under `grafana/dashboards`.
- Four collapsible rows exist: Traffic, Errors, Latency, Saturation.
- Traffic, Errors, and Latency each contain Prometheus, Loki, and Tempo-derived visibility.
- Saturation has at least a clear placeholder section.
- Presenter can start from a slow/error graph and find the related trace/logs.
