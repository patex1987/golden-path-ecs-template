# Documentation Index

This folder is organized by purpose. Start here when you need to decide where a new note belongs.

## `architecture/`

Durable design documents for the platform and service shape.

Use this folder for:

- current system architecture
- accepted or proposed architecture decisions
- platform/golden-path design
- future platform APIs and service contracts

Current documents:

- [architecture.md](architecture/architecture.md) - current system architecture and target direction.
- [architecture-decisions.md](architecture/architecture-decisions.md) - ADR-style decision log and tradeoffs.
- [graphql-request-flow.md](architecture/graphql-request-flow.md) - GraphQL request path through NestJS, Apollo, middleware, context, resolvers, and clean architecture layers.
- [golden-path.md](architecture/golden-path.md) - the opinionated service path this template should provide.
- [platform-api.md](architecture/platform-api.md) - future platform-facing API and CDK construct ideas.

## `plans/`

Implementation plans, migration plans, roadmaps, and follow-up task lists.

Use this folder when a document describes planned work, sequencing, risks, or acceptance criteria.

Current documents:

- [implementation-plan.md](plans/implementation-plan.md) - overall learning and build plan.
- [movie-reservation-platform-roadmap.md](plans/movie-reservation-platform-roadmap.md) - roadmap for the movie reservation platform slice.
- [nestjs-service-migration.md](plans/nestjs-service-migration.md) - completed/active migration plan for moving the service to NestJS.
- [service-follow-up-tasks.md](plans/service-follow-up-tasks.md) - intentional leftovers from the service migration.

## `learning/`

Personal learning notes, cheat sheets, and concept explanations.

Use this folder for material whose primary job is teaching or memory support, not project governance.

Current documents:

- [my-learning-notes.md](learning/my-learning-notes.md) - chronological personal learning notes.
- [graphql-context-factory-notes.md](learning/graphql-context-factory-notes.md) - notes on Apollo GraphQL context creation and request enrichment.
- [ts-cdk-learning-path.md](learning/ts-cdk-learning-path.md) - TypeScript and CDK study path.
- [typescript-docstrings-and-generated-docs.md](learning/typescript-docstrings-and-generated-docs.md) - notes on TypeScript documentation comments and generated docs.
- [vitest-cheat-sheet.md](learning/vitest-cheat-sheet.md) - Vitest notes from a pytest mental model.

## `operations/`

Operational procedures and runtime checks.

Use this folder for runbooks, health-check procedures, deployment checks, smoke tests, and incident/debugging notes.

Current documents:

- [runbook.md](operations/runbook.md) - local and future operational checks for the service/platform.

## `workflows/`

Development workflows that support the project but are not product architecture.

Use this folder for repeatable collaboration, review, release, or AI-assistant workflows.

Current documents:

- [ai-review-workflow.md](workflows/ai-review-workflow.md) - how the repository's AI review agents are organized and used.
- [curated-technology-resources.md](workflows/curated-technology-resources.md) - expanded trusted technology references for AI and human contributors.

## `scratch/`

Temporary notes and rough captures that may later become plans, learning notes, or architecture docs.

Use this folder for unfinished thinking. When a scratch note becomes useful and durable, move it into the appropriate category above.

Current documents:

- [temp-notes.md](scratch/temp-notes.md) - temporary working notes.
