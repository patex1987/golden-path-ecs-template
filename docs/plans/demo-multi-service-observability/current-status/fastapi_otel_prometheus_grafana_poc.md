## fastapi_otel_prometheus_grafana_poc

Status: READY
Branch: demo-multi-service-observability
Latest commit: 2d32a3d
Owner/agent: Codex

### What Works
- Local observability stack definition exists for Grafana, Prometheus, Loki, Tempo, Alloy, and OpenTelemetry Collector.
- Grafana datasources are provisioned with stable UIDs: `prometheus`, `loki`, and `tempo`.
- Dashboard provisioning is configured to load JSON files from `grafana/dashboards`.
- Main demo dashboard is prepared at `grafana/dashboards/multi-service-reservation-demo.json`.
- Dashboard JSON validates with `jq empty`.
- Dashboard title is `Multi-Service Reservation Demo`.
- Dashboard has four collapsible golden-signal rows: Traffic, Errors, Latency, Saturation.
- Dashboard includes variables for `service`, `correlation_id`, `trace_id`, `fault`, and `log_keyword`.
- Dashboard includes Prometheus panels using known movie-reservation-service metrics where available.
- Dashboard includes Loki JSON-log panels scoped by `service_environment` and `service_name`.
- Dashboard includes Tempo TraceQL table panels as trace-derived visibility scaffolding.
- Planning document exists at `docs/plans/main-grafana-dashboard-golden-signals.md`.

### How To Run
```sh
cd /home/patex1987/development/fastapi_otel_prometheus_grafana_poc
docker compose up -d

# Optional old FastAPI demo app, not required for the multi-service dashboard:
docker compose --profile demo-api up -d fastapi
```

### Health / Smoke Checks
```sh
cd /home/patex1987/development/fastapi_otel_prometheus_grafana_poc

# Expected: no output, exit 0.
jq empty grafana/dashboards/multi-service-reservation-demo.json

# Expected: title, uid, 25 panels, four row titles.
jq '.title, .uid, (.panels | length), [.panels[] | select(.type == "row") | .title]' \
  grafana/dashboards/multi-service-reservation-demo.json

# Expected after stack startup: Grafana reports ok/database ok.
curl http://localhost:3000/api/health

# Expected after stack startup: Prometheus is reachable.
curl http://localhost:9090/-/ready

# Expected after stack startup and observable containers running:
# service_name values include demo services that have observability.logs=true.
curl -G 'http://localhost:3100/loki/api/v1/label/service_name/values'

# Expected after demo traffic:
# Prometheus contains reservation-service metrics and/or Tempo span metrics.
curl -G 'http://localhost:9090/api/v1/label/__name__/values'
```

### Observability
- OTel service name: stack service; receives external service telemetry through collector on `localhost:4317` and `http://localhost:4318`. Dashboard expects upstream service names `movie-agent-worker`, `movie-reservation-mcp`, `movie-reservation-service`, `axum-tools-mcp`, and `axum-tools-random-api`.
- Important spans/log fields: `service.name`, `service_name`, `service_environment`, `trace_id`, `span_id`, `correlation_id`, `request_id`, `event`, `fault`, `duration_ms`, `business_operation`, `outcome`.
- Grafana/Loki/Tempo expectations:
  - Grafana URL: `http://localhost:3000`, login `admin` / `admin`.
  - Dashboard should appear from `grafana/dashboards/multi-service-reservation-demo.json` under the provisioned dashboard folder.
  - Prometheus datasource UID is `prometheus`.
  - Loki datasource UID is `loki`.
  - Tempo datasource UID is `tempo`.
  - Tempo is configured with traces-to-logs through Loki by `trace_id`.
  - Loki derived field links back to Tempo when JSON logs contain a 32-character hex `trace_id`.
  - Alloy only scrapes Docker stdout logs from containers labelled `observability.logs=true`.

### Known Gaps
- Live Grafana provisioning was not verified in this session because Docker daemon access was blocked.
- Tempo TraceQL table panel shapes may need tuning after opening the dashboard in Grafana.
- Cross-service Prometheus metric names for the Python agent, MCP servers, and Rust API still need discovery after those services run.
- Saturation is intentionally a v1 placeholder/proxy section, not production-grade CPU/memory/queue/pool/backlog coverage.
- `grafana/dashboards` had been container-owned; it was recreated as user-owned so the dashboard JSON could be versioned. The old empty backup path is ignored as `/grafana/.dashboards-container-owned-backup/`.

### Demo Risk
Medium

### Needs From Other Repos
- Demo service containers must emit OTLP traces/metrics to this stack's collector.
- Demo service containers must have Docker labels `observability.logs=true`, `service.name=<service-name>`, and `service.environment=local` for Loki scraping.
- Services should emit structured JSON logs with `trace_id`, `correlation_id`, `request_id`, `event`, and fault fields where applicable.
- `movie-reservation-service` should continue emitting known metrics such as `graphql_operation_total`, `graphql_operation_duration_ms`, `reservation_processor_outcome_total`, and related histograms/counters.
- Agent, MCP, and Rust services should either emit useful Prometheus/OTLP metrics or rely on logs/traces for demo v1.
