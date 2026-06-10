# Distributed Observability Demo Platform Follow-Ups

## 1. Purpose

This document captures the higher-level movement beyond the first React/Vite
frontend demonstrator.

The project should eventually demonstrate a distributed internal platform slice:
a browser workflow, multiple backend services, generated API clients,
service-to-service trace propagation, MCP tools, a simple agent workflow,
production-shaped authentication, service discovery, and controlled failure
scenarios that are easy to investigate in the observability stack.

The browser app should remain a movie product, not an observability product.
Trace, log, and metric investigation belongs in Grafana, Tempo, Loki,
Prometheus, browser network tools, and Playwright reports.

This document is intentionally separate from
`docs/plans/d8a-rebase-frontend-spike.md`. Issue #23 should stay a clean
frontend baseline transplant. The follow-ups below should become GitHub issues
or implementation plans only when they are the next meaningful slice.

## 2. Decisions Captured

- Keep #23 scoped to a browser frontend baseline on top of finalized D7
  observability.
- Keep the D8 UI focused on the reservation workflow:
  - movie catalog;
  - screening selection;
  - seat selection;
  - reservation request;
  - polling status;
  - result lookup;
- Keep the D8 frontend customer-facing. It should not show trace ids,
  correlation ids, request ids, raw trace headers, or GraphQL exchange logs in
  normal UI.
- Use `docs/plans/movie-reservation-frontend-product-requirements.md` as the D8
  product and UX bar.
- Do not build a generic scenario engine or demo console before the real
  scenarios exist.
- Add TypeScript GraphQL code generation for the React frontend soon after #23
  inside D8.
- Add CI validation so generated frontend GraphQL client artifacts cannot drift
  from `movie-reservation-service/schema.gql`.
- Add a frontend containerization follow-up after the browser workflow is
  stable. The container should support local/Compose demos without implying that
  ECS is the only production deployment option for a static React app.
- Add the Rust Axum movie recommendation service as the first multi-service
  expansion.
- Prefer the NestJS backend calling the Rust recommendation service first. That
  creates a clearer service-to-service trace:
  `browser -> movie-reservation-service -> recommendation-service`.
- Add MCP/FastMCP and a simple ReAct agent after the service graph has at least
  the reservation API and recommendation service.
- Treat Ariadne Codegen as a good candidate for the future Python MCP GraphQL
  client, not for the browser frontend.
- Treat OIDC/JWKS as a later production-shaped auth deliverable. JWKS fetching
  should normally be cached, so it is useful for auth realism and failure demos
  but should not be the primary per-workflow service-to-service trace.
- Keep local frontend bearer-token support explicitly development-only. Vite
  `VITE_*` values are browser-visible and can support local JWT-shaped demo
  values, but production-shaped frontend auth should come from a later OIDC
  Authorization Code + PKCE flow, not build-time env secrets.
- Treat fault injection as later, scenario-controlled, local-only behavior.

## 3. Design Principles

- Build real service interactions before artificial failure demos.
- Keep generated clients tied to CI so contract drift is caught early.
- Preserve W3C `traceparent`, optional `tracestate`, workflow
  `X-Correlation-Id`, and per-request `X-Request-Id` across every HTTP boundary.
- Keep observability externally verifiable without making the customer frontend
  a diagnostics surface.
- Do not expose secrets, raw bearer tokens, cookies, raw auth headers, trace
  headers, request ids, or GraphQL exchange logs in customer UI.
- Keep demo-only fault controls out of production-shaped default paths.
- Prefer boring explicit boundaries first: environment-configured service URLs,
  small client interfaces, typed config, and focused tests.
- Add service discovery, OIDC, and fault injection only with rollback and local
  disablement paths.

## Frontend Follow-Up Mapping

The first stabilization pass keeps the browser app simple and explicitly defers
larger runtime concerns:

- #27 owns final D8 frontend verification, docs, and Playwright smoke coverage.
- #29 owns moving catalog read-model assembly out of the resolver. It should
  also account for frontend catalog overfetch: initial load should not require
  every nested seat for every screening once the demo grows.
- #31 owns scalable monorepo CI, affected/path-filtered checks, Playwright CI
  strategy, frontend/backend e2e timing, and Docker/Postgres e2e strategy.
- #32 owns idempotency before retrying frontend clients become production-like.

Issue-ready follow-ups not yet represented by a dedicated issue:

- Frontend auth hardening: add OIDC/PKCE integration, define where access tokens
  live at runtime, remove build-time token assumptions from production paths,
  and keep local dev-token support clearly fake and browser-visible.
- Frontend request resilience and failure demonstrations: add AbortController
  support, request timeouts, cancellation of superseded catalog reloads/polls,
  user-facing timeout messages, and local-only failure scenarios that can be
  investigated through browser tools, Playwright artifacts, traces, logs, and
  metrics.

## 4. Frontend Runtime And Repository Learning Track

### Frontend Runtime Strategy

The React/Vite frontend can be used in two different runtime shapes:

- development runtime: Vite dev server, fast refresh, proxy `/graphql` to the
  local backend;
- demo/deployment runtime: built static assets served by a small HTTP container
  or static hosting platform.

Dockerizing the frontend is valuable for this repository because the project is
an ECS and observability learning project. A containerized frontend can join the
same local Compose network as the API, collector, and future services, which
makes end-to-end demo startup repeatable.

That does not mean containerized ECS is always the best production choice for a
static React app. Production options should remain explicit:

- Static hosting, such as S3 plus CloudFront, is often the simplest production
  path for a Vite single-page app. It has fewer runtime moving parts and fits
  immutable static assets well.
- A frontend container is useful when the team wants runtime config injection,
  the same ALB/ECS deployment model as the backend, private network behavior, or
  stronger local-to-production parity.
- Keeping both paths documented is useful for learning. The first Docker task
  should build the Vite assets and serve them from a small web server container;
  a later production design can compare ECS/ALB against static hosting.

Recommended first containerization slice:

- add `movie-reservation-web/Dockerfile`;
- build static assets with `npm -w movie-reservation-web run build`;
- serve `dist/` from a small HTTP image;
- route or configure `/graphql` to the backend;
- add Compose wiring only after the backend and observability stack startup path
  is clear;
- document which values are build-time config and which values are runtime
  config.

Acceptance signals:

- one local command can start the API and frontend container for the booking
  demo;
- the frontend can call the backend without hard-coded host-only URLs;
- request propagation still appears in browser network tools, Playwright
  reports, and backend traces/logs;
- docs clearly state that static hosting remains a valid production alternative.

### Repository Shape Learning Track

The current monorepo shape is intentional for the early project:

- one branch can evolve backend schema, frontend operations, generated clients,
  CI, Docker, and docs together;
- npm workspaces keep local commands and dependency installation in one repo;
- contract changes are easier while the GraphQL API and UI are still moving
  quickly.

The project should still preserve a future learning exercise that tries the
multi-repo model. That exercise should happen after the first D8 workflow and
codegen/CI checks exist, because generated contract artifacts are what make a
multi-repo split safe.

See
[`docs/learning/monorepo-vs-multirepo-frontend-backend.md`](../learning/monorepo-vs-multirepo-frontend-backend.md)
for the learning note and future comparison path.

## 5. Sequencing

### Phase 0: D8 Browser Baseline

Goal: establish a solid React/Vite workflow demonstrator before broadening the
system.

Expected work:

- Complete #23 by porting the useful additive frontend spike without carrying
  stale backend observability rewrites.
- Keep the UI as a focused customer reservation workflow, not a generic scenario
  engine or observability console.
- Preserve frontend observability headers and verify them externally.
- Keep backend GraphQL schema and resolver behavior unchanged for #23.
- Track final product requirements in
  `docs/plans/movie-reservation-frontend-product-requirements.md`.

Acceptance signals:

- The browser can request a reservation and poll status.
- Frontend-originated requests can be found in backend logs/traces by
  correlation id, request id, or trace id through external tools.
- Normal customer UI does not expose technical observability ids or request
  exchange logs.
- #23 diff is mostly `movie-reservation-web/**`, root workspace metadata,
  lockfile, and docs.

### Phase 1: Frontend GraphQL Codegen And Contract CI

Goal: make the React frontend more durable against GraphQL schema drift.

Expected work:

- Choose a TypeScript-native GraphQL code generation tool for the React
  workspace.
- Generate frontend query/mutation types from
  `movie-reservation-service/schema.gql` and the frontend's operation
  documents.
- Evaluate whether the selected tool can also generate runtime validation
  schemas or parsers, for example Zod or an equivalent TypeScript validation
  library.
- Decide whether generated runtime validation replaces the current hand-written
  response parsers, whether the parsers stay as the boundary mapper, or whether
  the frontend relies on generated TypeScript types plus schema-drift CI only.
- Avoid maintaining GraphQL operation documents, generated TypeScript result
  types, and hand-written Zod schemas for the same response contract unless
  there is a clear reason.
- Decide whether generated files are committed or regenerated only in CI.
- Add a check that fails when generated artifacts drift from the schema or
  operation documents.
- Keep operation names stable because they appear in logs and traces.

Likely files/modules:

- `movie-reservation-web/package.json`
- `movie-reservation-web/src/shared/api/**`
- `movie-reservation-web/src/features/movie-reservations/**`
- root `package.json`
- GitHub Actions or local CI docs when the pipeline is updated

Acceptance signals:

- Frontend typecheck uses generated operation/result types.
- The runtime validation strategy is documented: generated schemas/parsers,
  retained hand-written boundary parsers, or no runtime response validation with
  an explicit trust/CI rationale.
- If Zod or an equivalent validator is adopted, it stays inside the frontend
  adapter/platform boundary and the domain continues to expose plain TypeScript
  models.
- CI or local `check` fails when generated frontend client artifacts are stale.
- The codegen step does not require a running API server unless that is
  explicitly chosen and documented.

### Phase 1.5: Frontend Container And Playwright Smoke

Goal: make the customer booking workflow repeatable from a browser test and
from a containerized local demo.

Recommended shape:

- Add one high-level Playwright smoke test for the movie booking workflow.
- Capture Playwright HTML report and trace artifacts when the smoke test fails,
  and optionally for local demo runs.
- Use Playwright request inspection to verify `traceparent`,
  `X-Correlation-Id`, and `X-Request-Id` without showing those ids in customer
  UI.
- Add a frontend Dockerfile after the workflow is stable enough that the
  container contract is clear.
- Decide whether the smoke test runs against:
  - a mocked GraphQL route for pure frontend CI speed;
  - the real local backend for integration confidence;
  - both, with the real-backend version reserved for a slower job.

Acceptance signals:

- `npm -w movie-reservation-web run test:e2e` or an equivalent script can run at
  least one browser smoke test.
- A failed smoke test produces artifacts that can be reviewed with Playwright's
  HTML report or trace viewer.
- The frontend can be served from a container in local demos without changing
  customer-facing app code.

### Phase 2: Rust Recommendation Service Integration

Goal: create the first true service-to-service business trace.

Recommended shape:

- Introduce or connect the existing Rust Axum movie recommendation service as a
  separate local service.
- Add a small outbound client interface in the NestJS service for recommendation
  calls.
- Have the NestJS backend call the recommendation service for a narrow
  reservation-adjacent use case, such as recommended movies or recommended
  screenings.
- Propagate `traceparent`, optional `tracestate`, `X-Correlation-Id`, and
  `X-Request-Id` across the NestJS-to-Rust HTTP boundary.
- Start with an explicit configured base URL before adding richer service
  discovery.

Likely files/modules:

- `movie-reservation-service/src/application/**` for an outbound port if the
  use case belongs to the reservation API
- `movie-reservation-service/src/infrastructure/**` for the HTTP adapter
- `movie-reservation-service/src/config.ts`
- `docker-compose.yml`
- recommendation service repository or workspace
- local observability docs

Acceptance signals:

- One browser action produces a distributed trace containing both the NestJS
  service and Rust recommendation service.
- Logs in both services include compatible correlation fields.
- Timeouts and downstream errors have explicit user-facing and log-facing
  behavior.

### Phase 3: MCP Tools And Simple Agent

Goal: add an agentic path after the service graph is interesting enough to
inspect.

Recommended shape:

- Build a Python FastMCP server around the movie reservation GraphQL API.
- Use Ariadne Codegen or an equivalent Python GraphQL codegen path for the MCP
  GraphQL client.
- Build an MCP wrapper around the Rust recommendation service.
- Expose a small allow-list of tools, for example:
  - list movies;
  - list screenings;
  - request reservation;
  - poll reservation status;
  - get recommendations.
- Add a simple ReAct loop that can use those MCP tools for a constrained demo.

Safety requirements:

- Do not expose secrets in tool descriptions, logs, traces, prompts, or browser
  customer UI.
- Keep tool inputs explicit and validated.
- Add clear stop conditions and iteration limits for the ReAct loop.
- Keep generated clients and tool schemas checked by CI once they are part of
  the repository.

Acceptance signals:

- The agent can complete a constrained reservation/recommendation workflow.
- Tool calls are visible in traces/logs with stable operation names.
- Failures are explainable without reading raw prompt transcripts.

### Phase 4: Production-Shaped OIDC/JWKS

Goal: replace the placeholder `production-oidc` auth mode with a realistic
validator that can also support later failure demos.

Current repo context:

- `movie-reservation-service/src/config.ts` already has a `production-oidc`
  composition profile that maps to `AUTH_MODE=oidc`.
- `oidc` currently remains explicit but not implemented.
- Local auth modes are blocked in staging/production.
- `local-jwt` decodes unsigned local JWT claims for development; it does not
  verify issuer, audience, expiry, signatures, or JWKS key rotation.

Expected work:

- Add issuer, audience, JWKS URI, cache TTL, and timeout config.
- Implement a real token validation client for `AUTH_MODE=oidc`.
- Cache JWKS keys and refresh on key miss or rotation.
- Add a local mock IdP/JWKS path for development and failure demos.
- Keep JWT validation errors structured and safe to log.

Acceptance signals:

- Valid OIDC JWTs authenticate through the existing `JwtAuthenticationManager`
  flow.
- Invalid issuer, audience, expiry, signature, and key id cases fail with clear
  errors.
- JWKS fetch timeout or rotation scenarios are testable locally.
- No bearer token or raw authorization header is logged.

### Phase 5: Scenario-Controlled Fault Injection

Goal: make failures easy to trigger and investigate without polluting normal
development or production-shaped code paths.

Recommended shape:

- Add local-only scenario controls after the multi-service and auth paths exist.
- Prefer explicit named scenarios over hidden random failures.
- Examples:
  - recommendation service timeout;
  - recommendation service 500 response;
  - JWKS endpoint unavailable;
  - JWKS key rotation/cache miss;
  - invalid service discovery target;
  - reservation processor retryable failure.
- Make scenario state visible in local demo docs and external investigation
  tools, not in the normal customer booking UI unless a separate product plan
  explicitly scopes it.
- Keep scenario controls disabled by default.

Acceptance signals:

- A demo operator can trigger a named failure and then investigate it through
  traces, logs, and metrics.
- The same workflow passes when the scenario is disabled.
- Production/staging profiles cannot enable local-only fault controls by
  accident.

## 6. Candidate Follow-Up Issues

Create issues from this list only when the preceding phase is close enough that
the next work is concrete.

- D8f: Add frontend GraphQL codegen, runtime validation decision, and schema
  drift CI.
- D8f/D8g: Add Playwright booking smoke test, report artifacts, and trace review
  workflow.
- D8g: Dockerize the frontend for local/Compose demos and document production
  static-hosting versus ECS/container tradeoffs.
- Frontend UI: Split global CSS from feature/component styles once the
  reservation UI grows beyond the first workflow.
- Distributed demo: Add Rust Axum recommendation service to local Compose.
- Distributed demo: Add NestJS outbound recommendation client.
- Distributed demo: Propagate trace context across NestJS-to-Rust calls.
- MCP: Add FastMCP server for movie reservation GraphQL API.
- MCP: Add generated Python GraphQL client for the MCP server.
- MCP: Add recommendation-service MCP tools.
- Agent: Add simple bounded ReAct workflow using MCP tools.
- Auth: Implement production-shaped OIDC/JWKS validation.
- Auth demo: Add local mock IdP/JWKS service and failure cases.
- Fault demo: Add local-only scenario-controlled failure injection.
- Discovery demo: Add service discovery configuration and failure scenarios.

## 7. Non-Goals For #23

Do not implement these in #23:

- frontend GraphQL codegen;
- MCP servers;
- ReAct agent loop;
- Rust recommendation service integration;
- OIDC/JWKS validation;
- mock IdP/JWKS service;
- service discovery;
- fault injection controls.
- frontend Docker image;
- Playwright browser smoke tests.

#23 should only preserve the path for this work by keeping the frontend
workspace structure, API boundary, and observability propagation clean.

## 8. Review Prompts

Use these prompts before starting each future phase:

- Does this phase create a visible new trace/log story, or only add machinery?
- Is there a single narrow workflow that proves the new boundary?
- Which contract should be generated, and where does CI catch drift?
- Which ids cross this boundary: `traceparent`, `tracestate`,
  `X-Correlation-Id`, and `X-Request-Id`?
- What is the rollback path if the new service, auth mode, or scenario control
  fails?
- Which behavior is production-shaped, and which behavior is explicitly
  local/demo-only?
