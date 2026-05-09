# Project AI Guidance

This repository is a learning project for building a small internal-platform-style ECS service template with:
- TypeScript application code
- AWS CDK infrastructure code
- ECS/Fargate deployment concepts

When helping in this repository:

- keep explanations concrete and tied to the actual files
- prefer solutions that teach TypeScript and CDK concepts clearly
- explain tradeoffs when proposing abstractions or infrastructure choices
- avoid over-engineering early abstractions
- favor coherent, incremental implementation over broad scaffolding

The user is learning, so understanding is part of the deliverable.

## Planning expectations

- For non-trivial features, refactors, integrations, migrations, infrastructure changes, or architecture changes, plan before implementing.
- Use the `principal-engineer-planner` skill for ambiguous, cross-cutting, risky, or design-heavy work.
- Do not implement from vague requirements when a short planning pass would materially reduce risk.
- Inspect the repository before asking questions that the code or docs can answer.
- Prefer the smallest design that satisfies the requirements and fits existing project conventions.
- Save implementation plans under `docs/plans/`.
