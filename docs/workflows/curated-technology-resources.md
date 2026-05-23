# Curated Technology Resources

This is the expanded reference list for AI and human contributors. Keep `AGENTS.md` compact; use this file when a task needs deeper technology-specific context.

The package manifests are the source of truth for versions used in this repository. Examples from newer or older docs should be adapted to the local code.

## TypeScript And Node.js

Purpose: application code in `movie-reservation-service/`, infrastructure code in `ecs-infra/`, and shared runtime behavior.

- TypeScript Handbook: https://www.typescriptlang.org/docs/
- TSConfig Reference: https://www.typescriptlang.org/tsconfig/
- Node.js Learn: https://nodejs.org/learn
- Node.js API docs: https://nodejs.org/api/

## NestJS

Purpose: current backend framework for modules, controllers, providers, dependency injection, and code-first GraphQL.

- NestJS docs: https://docs.nestjs.com/
- NestJS GraphQL docs: https://docs.nestjs.com/graphql/quick-start
- NestJS testing docs: https://docs.nestjs.com/fundamentals/testing

Guardrail: do not introduce Fastify or Express route patterns unless the task explicitly asks to revisit the HTTP adapter.

## GraphQL And Apollo Server

Purpose: product-facing API contract for the NestJS service.

- GraphQL Learn: https://graphql.org/learn/
- GraphQL schema docs: https://graphql.org/learn/schema/
- GraphQL best practices: https://graphql.org/learn/best-practices/
- Apollo Server docs: https://www.apollographql.com/docs/apollo-server
- Apollo Server auth/security docs: https://www.apollographql.com/docs/apollo-server/security/authentication

## Zod

Purpose: runtime validation at boundaries such as environment config, request inputs, and external data.

- Zod docs: https://zod.dev/
- Zod API/packages docs: https://zod.dev/packages/zod
- Zod JSON Schema docs: https://zod.dev/json-schema

## Testing

Purpose: service behavior tests, HTTP tests, and infrastructure assertions.

- Vitest guide: https://vitest.dev/guide/
- Vitest mocking guide: https://vitest.dev/guide/mocking
- Supertest README: https://github.com/forwardemail/supertest
- Jest docs: https://jestjs.io/docs/getting-started
- CDK testing docs: https://docs.aws.amazon.com/cdk/v2/guide/testing.html

## AWS CDK And Constructs

Purpose: infrastructure as code for AWS resources.

- AWS CDK v2 Developer Guide: https://docs.aws.amazon.com/cdk/v2/guide/home.html
- AWS CDK best practices: https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html
- AWS CDK API reference: https://docs.aws.amazon.com/cdk/api/v2/
- Construct Hub: https://constructs.dev/

## ECS, Fargate, And Load Balancing

Purpose: primary AWS deployment target for this service template.

- Amazon ECS Developer Guide: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html
- AWS Fargate guide: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html
- ECS task definitions: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html
- ECS load balancing: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-load-balancing.html
- CDK ECS construct library: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs-readme.html
- CDK ECS patterns: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs_patterns-readme.html

## Docker And Docker Compose

Purpose: container packaging and future local multi-service runtime.

- Docker build best practices: https://docs.docker.com/build/building/best-practices/
- Docker Compose docs: https://docs.docker.com/compose/
- Docker Node.js language guide: https://docs.docker.com/guides/nodejs/

## OpenTelemetry

Purpose: planned observability standard for traces, logs, metrics, resource attributes, and propagation.

- OpenTelemetry concepts: https://opentelemetry.io/docs/concepts/
- OpenTelemetry JavaScript docs: https://opentelemetry.io/docs/languages/js/
- OpenTelemetry Node.js getting started: https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
- OpenTelemetry Collector docs: https://opentelemetry.io/docs/collector/

## Static Checks

Purpose: formatting, linting, typed linting, and fast local checks.

- ESLint configuration docs: https://eslint.org/docs/latest/use/configure/
- typescript-eslint getting started: https://typescript-eslint.io/getting-started/
- Prettier docs: https://prettier.io/docs/
- Oxlint docs: https://oxc.rs/docs/guide/usage/linter.html

## GitHub Actions

Purpose: repository CI/CD automation, workflow design, monorepo checks, runners, and pipeline hardening.

- GitHub Actions tutorials: https://docs.github.com/en/actions/tutorials
- Understanding GitHub Actions: https://docs.github.com/en/actions/get-started/understand-github-actions
- GitHub Actions CI/CD best practices instruction file: https://github.com/github/awesome-copilot/blob/main/instructions/github-actions-ci-cd-best-practices.instructions.md
- GitHub Actions workflows, patterns, and best practices: https://dev.to/thesius_code_7a136ae718b7/github-actions-workflows-github-actions-patterns-best-practices-pge
- GitHub Actions in 2026: monorepo CI/CD and self-hosted runners: https://dev.to/pockit_tools/github-actions-in-2026-the-complete-guide-to-monorepo-cicd-and-self-hosted-runners-1jop

## Roadmap Technologies

Use these only when the relevant implementation phase starts.

PostgreSQL and Knex:

- PostgreSQL tutorial/current docs: https://www.postgresql.org/docs/current/tutorial.html
- Knex guide: https://knexjs.org/guide/
- Knex migrations: https://knexjs.org/guide/migrations.html

Amazon SQS:

- SQS best practices: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-best-practices.html
- SQS dead-letter queues: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html

Kubernetes and k3d:

- Kubernetes concepts: https://kubernetes.io/docs/concepts/
- Kubernetes workloads: https://kubernetes.io/docs/concepts/workloads/
- k3d docs: https://k3d.io/stable/
