# CI Workflow

This repository uses a small GitHub Actions CI foundation for pull requests, pushes to `main`, and manual runs.

The workflow is intentionally deployment-free. It proves the service and CDK workspaces are formatted, linted, typed, tested, buildable, and CDK-synthesizable without using AWS credentials or repository secrets.

## Local Commands

Run the full local CI contract from the repository root:

```sh
npm run ci
```

That delegates to the workspace-owned CI commands:

```sh
npm -w movie-reservation-service run ci
npm -w ecs-infra run ci
```

The service workspace also exposes category-specific test commands:

```sh
npm -w movie-reservation-service run test:unit
npm -w movie-reservation-service run test:integration
npm -w movie-reservation-service test
```

## Runtime Version

Node is pinned with `.nvmrc`:

```text
24
```

GitHub Actions reads the same file through `actions/setup-node`, so local development and CI use the same intended Node major version.

## Test Categories

- Unit tests live under `movie-reservation-service/test/unit/**`.
- Thin integration tests live under `movie-reservation-service/test/integration/**`.
- Future Docker/Testcontainers e2e tests should use a separate `test/e2e/**` category and CI job.
- Future deployed-environment smoke tests should use a separate system or smoke-test workflow.

Current in-process NestJS Supertest checks are integration/API contract tests because they start the app in-process with local/fake infrastructure. They are not Docker-network e2e tests.

## GitHub Actions Jobs

The workflow at `.github/workflows/ci.yml` exposes five required CI-1 jobs:

- `service-quality`: service format check, lint checks, and TypeScript typecheck.
- `service-unit-tests`: service unit tests.
- `service-integration-tests`: service thin integration/API contract tests.
- `service-build`: service TypeScript build.
- `infra`: CDK workspace build, Jest tests, and `cdk synth`.

`service-unit-tests`, `service-integration-tests`, `service-build`, and `infra` run after `service-quality` passes. This keeps fast static feedback first while still making failure categories visible in pull request checks.

## Required Checks

Branch protection or a GitHub repository ruleset should require these checks before merging to `main`:

- `service-quality`
- `service-unit-tests`
- `service-integration-tests`
- `service-build`
- `infra`

GitHub may require the workflow to run once before these status checks are available to select in repository settings.

## Deferred Work

CI-1 does not include deployment, Docker image publishing, dependency audit gates, action SHA pinning, custom caches, artifact uploads, test reports, special PR annotations, Node matrices, Docker/Testcontainers e2e checks, or deployed smoke tests.

The detailed design is in [github-actions-ci-foundation.md](../plans/github-actions-ci-foundation.md). Deferred hardening and delivery work is tracked in [platform-follow-up-tasks.md](../plans/platform-follow-up-tasks.md).
