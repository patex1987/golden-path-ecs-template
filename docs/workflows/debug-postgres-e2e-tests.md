# Debug Postgres E2E Tests

This workflow is for `movie-reservation-service/test/e2e/postgres-movie-reservations.test.ts`.

## Mental Model

The Postgres e2e suite has two database modes:

- Testcontainers mode starts a temporary Postgres container for the test run.
- External mode points the test harness at a developer-managed Postgres
  database, usually the Docker Compose `postgres` service.

Use Testcontainers for CI-style confidence. Use external mode when debugging
locally, especially from WebStorm, because the debugger does not also need to
wait for Testcontainers teardown.

The e2e harness resets the target database by dropping and recreating the
`public` schema. External mode must only point at a throwaway local database.

> **Callout: external Docker Postgres is your responsibility.** In external
> mode, the e2e harness resets the target `public` schema for its own test
> setup, but it does not own your Compose container or Docker volume. Use only a
> disposable local database, and clean up the Compose database yourself between
> manual/debug sessions when you need a known-clean volume, for example with
> `docker compose down -v`.

The e2e Nest app explicitly disables `RESERVATION_WORKER_MODE`. Tests that need
worker behavior call the `ReservationRequestProcessor` manually. That keeps
debug runs deterministic: a paused breakpoint cannot let the fake background
poller claim the same row first.

## Render The Local E2E Env Files

Render the ignored host-runner env file from the committed template:

```bash
cp movie-reservation-service/env_files/templates/local/test-e2e-postgres.env.template movie-reservation-service/env_files/local/test-e2e-postgres.env
```

The template uses `localhost` because npm and WebStorm run the Vitest process
on the host machine:

```text
TEST_DATABASE_URL=postgres://movie_reservation_service:movie_reservation_service@localhost:5432/movie_reservation_service
```

Render the Compose-network template only when the test runner itself runs
inside the Compose network:

```bash
cp movie-reservation-service/env_files/templates/in-docker/test-e2e-postgres.env.template movie-reservation-service/env_files/in-docker/test-e2e-postgres.env
```

That template uses the Compose service name:

```text
TEST_DATABASE_URL=postgres://movie_reservation_service:movie_reservation_service@postgres:5432/movie_reservation_service
```

## Debug From The Terminal

Start the Compose database:

```bash
docker compose up -d postgres
```

Run one focused test with Vitest timeouts disabled:

```bash
npm -w movie-reservation-service run test:e2e:local-postgres -- \
  -t "creates, processes, and reads a confirmed reservation" \
  --testTimeout 0 \
  --hookTimeout 0 \
  --no-file-parallelism
```

`testTimeout 0` disables the timeout for the test body. `hookTimeout 0`
disables the timeout for `beforeAll`, `beforeEach`, and `afterAll`. The hook
timeout is usually the one that fails when the debugger pauses while Nest,
Knex, or Docker cleanup is still running.

`no-file-parallelism` keeps e2e files from running concurrently against the
same external database. That matters because external mode resets the `public`
schema.

To attach a Node debugger from the terminal, run Vitest through Node directly:

```bash
cd movie-reservation-service

node --env-file=env_files/local/test-e2e-postgres.env \
  --inspect-brk \
  ../node_modules/vitest/vitest.mjs run test/e2e \
  -t "creates, processes, and reads a confirmed reservation" \
  --testTimeout 0 \
  --hookTimeout 0 \
  --no-file-parallelism
```

Then attach WebStorm, Chrome DevTools, or another Node inspector client to the
printed debugger URL.

## Debug From WebStorm

This repository commits two shared WebStorm run configurations for this
workflow under `.idea/runConfigurations/`.

- `service_e2e_debug_testcontainers_postgres` runs the focused Postgres e2e
  test with Testcontainers. It does not load an env file because Testcontainers
  creates a temporary Postgres container and passes its connection URL to the
  test harness.
- `service_e2e_debug_local_compose_postgres` runs the same focused e2e test
  against the Compose Postgres database. It loads
  `env_files/local/test-e2e-postgres.env`, so start Compose Postgres first with
  `docker compose up -d postgres`.

Both configs run the same focused scenario and disable Vitest test/hook
timeouts for debugger sessions:

```text
-t "creates, processes, and reads a confirmed reservation" --testTimeout 0 --hookTimeout 0 --no-file-parallelism
```

Use an npm run configuration when you want WebStorm to execute the same script
as the terminal.

Settings:

- Package file: `movie-reservation-service/package.json`
- Command: `run`
- Script: `test:e2e:local-postgres`
- Arguments:

```text
-- -t "creates, processes, and reads a confirmed reservation" --testTimeout 0 --hookTimeout 0 --no-file-parallelism
```

The npm script loads `env_files/local/test-e2e-postgres.env`, so the WebStorm
configuration does not need to duplicate `TEST_DATABASE_URL`.

The sibling `test:e2e:compose-postgres` script is for a future/containerized
test runner that executes on the Compose network. Do not use it from a normal
host-based WebStorm run because the hostname `postgres` will not resolve there.

Use a dedicated Vitest run configuration when you prefer WebStorm's Vitest UI.
In that case the npm script is not involved, so the run configuration must
provide the external-mode environment variables itself.

Settings:

- Working directory:
  `movie-reservation-service`
- Vitest package:
  `node_modules/vitest`
- Config:
  `movie-reservation-service/vitest.config.ts`
- Test name pattern:
  `creates, processes, and reads a confirmed reservation`
- Additional arguments:

```text
--testTimeout 0 --hookTimeout 0 --no-file-parallelism
```

Environment variables:

```text
MOVIE_RESERVATION_E2E_DATABASE=external
TEST_DATABASE_URL=postgres://movie_reservation_service:movie_reservation_service@localhost:5432/movie_reservation_service
```

Again, use `localhost` when WebStorm runs the test process on the host.

## CI/CD Placement

The required GitHub Actions workflow intentionally does not run the Postgres
e2e suite yet. The current required checks stay Docker-free: formatting, lint,
typecheck, unit tests, integration tests, service build, and CDK checks.

When the project promotes Postgres e2e tests into CI, use a separate job rather
than hiding them inside the fast integration-test job. There are two reasonable
CI shapes:

- Run Testcontainers against the CI runner's Docker daemon. GitHub-hosted
  Ubuntu runners normally provide Docker on the VM, so this does not require
  GitLab-style Docker-in-Docker when the job itself is not running inside a
  container.
- Start a CI-managed Postgres service or Docker Compose Postgres and run the
  e2e harness in external mode. This is simpler to reason about when
  Testcontainers has CI/runtime compatibility issues.

GitLab CI often needs `docker:dind` when the job is itself running inside a
Docker executor container and must create sibling containers. That is an
execution-environment detail, not a Testcontainers requirement in every CI
system.

Until that CI runtime is deliberately designed, keep the Postgres e2e suite as
a local/manual check and track the CI job as platform follow-up work.
