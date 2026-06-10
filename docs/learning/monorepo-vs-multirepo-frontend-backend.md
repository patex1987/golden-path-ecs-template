# Monorepo Vs Multi-Repo For Frontend And Backend

## Why This Note Exists

The current project uses an npm workspace monorepo. The backend service,
infrastructure code, documentation, and new React frontend live in one Git
repository.

That is a deliberate early-project choice, not a universal rule. Later, it is
worth trying the multi-repo model as a learning exercise, especially after the
GraphQL contract and generated frontend client are stable enough to cross a repo
boundary.

## Current Monorepo Shape

Current workspace direction:

- `movie-reservation-service/`: NestJS GraphQL backend;
- `movie-reservation-web/`: React/Vite frontend;
- `ecs-infra/`: AWS CDK infrastructure;
- `docs/`: plans, learning notes, workflows, and architecture docs.

This is similar in spirit to a Cargo workspace or a Python repository with
multiple packages: related code can move together, but each package still has
its own commands, tests, and deployment responsibilities.

## Why Monorepo Fits Now

The project is still evolving the product workflow, backend GraphQL schema,
generated clients, observability contract, CI, Docker, and docs together. A
monorepo keeps those changes reviewable in one branch.

Benefits:

- one pull request can update backend schema, frontend GraphQL operations,
  generated types, tests, Docker config, and docs together;
- local setup is simpler because `npm install` can resolve all npm workspaces;
- CI can run workspace-specific checks from one place;
- contract drift is easier to catch when schema and generated client changes
  are in the same diff;
- learning is easier because the complete request path is visible in one repo.

Costs:

- CI can become slow unless checks are scoped by workspace or path;
- frontend, backend, and infrastructure ownership boundaries can blur;
- unrelated changes can appear in the same pull request if discipline is weak;
- dependency churn in one workspace can update the root lockfile;
- deploy pipelines need care so frontend and backend can still deploy
  independently.

## Important Point: Monorepo Does Not Mean One Deployment

A monorepo is a source-control choice. It does not require one deployment unit.

From this monorepo, the project can still deploy:

- the backend as an ECS/Fargate service;
- the frontend as static assets on S3 plus CloudFront;
- the frontend as a small container behind an ALB;
- infrastructure through CDK;
- future recommendation or agent services as separate containers.

The CI/CD design should decide deploy units per workspace. In other words, one
repo can still produce multiple independently deployed artifacts.

## Multi-Repo Alternative

A future split could use separate repositories:

- `movie-reservation-service`;
- `movie-reservation-web`;
- `movie-recommendation-service`;
- `platform-infra` or `ecs-infra`.

That model is common when teams, ownership, release cadence, or access control
need stronger separation.

Benefits:

- each service or app can have a smaller, focused history;
- CI is naturally scoped to one deployable;
- teams can own repositories independently;
- access control can be stricter;
- release cadence is less coupled by default.

Costs:

- contract changes require more coordination;
- generated clients need to be published or shared as artifacts;
- local development requires more bootstrap steps;
- cross-repo pull requests are harder to review atomically;
- version skew becomes a real operational concern.

## What Makes Multi-Repo Safe

The split becomes safer once these pieces exist:

- GraphQL schema generated or exported as a versioned artifact;
- frontend GraphQL client generated from schema and operation documents;
- CI check that fails on generated client drift;
- documented local startup for backend plus frontend;
- clear compatibility policy for GraphQL field changes;
- release notes or automation that tells the frontend when the backend contract
  changes.

Without those pieces, a multi-repo split mostly adds coordination overhead.

## Future Learning Exercise

Recommended future exercise:

1. Keep the main project as a monorepo until D8 has a stable customer booking
   frontend, codegen, and CI checks.
2. Create a separate experimental frontend repository that consumes the backend
   GraphQL schema as an artifact.
3. Compare the developer workflow:
   - local setup;
   - schema change workflow;
   - generated client update workflow;
   - CI feedback speed;
   - deployment independence.
4. Keep the experiment reversible. Do not split the main repository unless the
   operational benefits outweigh the extra coordination.

## Practical Rule For This Project

Use the monorepo while the platform is still being shaped and learned.

Try multi-repo later as a controlled exercise after contracts and CI are strong
enough to make the boundary explicit.
