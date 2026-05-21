# Git Workflow

This repository tracks roadmap work with GitHub issues. Create one branch per issue so the branch, pull request, and review discussion stay tied to the same unit of work.

## Branch Naming

Use this pattern:

```text
issue-{issue_number}_{type}_{short-kebab-description}
```

Examples:

```text
issue-1_feature_graphql-polling-api
issue-2_feature_in-process-processor
issue-3_feature_postgres-knex-persistence
issue-6_infra_ecs-cdk-foundation
issue-10_spike_authorization-hardening
issue-12_spike_payments
```

Use underscores to separate the main fields, and use kebab-case inside the short description. This keeps the branch readable while making the issue number easy to spot in terminal output, GitHub branch lists, and pull requests.

## Type Values

Prefer one of these type values:

- `feature`: new user-facing, API, domain, or platform capability
- `fix`: bug fix or behavior correction
- `docs`: documentation-only change
- `test`: test-only change
- `refactor`: internal restructuring without intended behavior change
- `infra`: infrastructure, deployment, CI, or CDK change
- `chore`: maintenance that does not fit the other categories
- `spike`: research, prototype, or throwaway investigation

When a branch touches multiple categories, choose the type that best describes the primary purpose. For example, an ECS CDK deliverable should use `infra` even if it also updates docs and tests.

## Creating an Issue-Linked Branch

Prefer `gh issue develop` when starting work from a GitHub issue:

```bash
gh issue develop 1 --name issue-1_feature_graphql-polling-api --checkout
```

This creates the branch, checks it out, and links it to the GitHub issue. That link helps GitHub connect the future pull request back to the roadmap item.

If `gh issue develop` is not available, use plain Git:

```bash
git switch -c issue-1_feature_graphql-polling-api
```

Then reference the issue in the pull request body with `Closes #1` or `Refs #1`, depending on whether merging the pull request should close the issue.

## Pull Request Titles

Use a matching pull request title style:

```text
D4: Add Movie Reservation GraphQL Polling API
```

The branch name is optimized for tools. The pull request title should be optimized for humans reviewing the work.
