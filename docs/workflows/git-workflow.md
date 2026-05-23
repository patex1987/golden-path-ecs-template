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

## Commit Messages

Every commit should include the issue ID at the start of the subject line:

```text
{issue_id}: one-line commit message

Longer explanation of the change, when useful.
Explain the intent, tradeoffs, or verification notes that would help during review or later archaeology.
```

Example:

```text
#12: Add CI foundation workflow

Run service and infrastructure checks in separate GitHub Actions jobs so pull requests show the failing area without requiring reviewers to inspect the full log first.
```

Use the body when the reason for the change is not obvious from the diff. A good body explains why the change exists, not a line-by-line summary of what the patch already shows.

For external trackers, use the tracker key in the same position:

```text
PLAT-123: Add CI foundation workflow
```

GitHub issues should use `#12` rather than `issue-12` because GitHub automatically turns `#12` into a link to issue or pull request 12. External trackers such as Jira can use the same shape when the repository has GitHub autolinks configured for that tracker.

## Squash Merges

Prefer squash merges for completed pull requests.

The working branch can contain small checkpoint commits while the work is in progress. The final merge commit should read like the durable record of the unit of work:

```text
#12: Add CI foundation workflow

Closes #12

Summary:
- Add GitHub Actions jobs for service quality, infrastructure quality, build, and synth.
- Use npm workspace commands so CI matches local developer checks.

Verification:
- npm run check
```

This keeps `main` readable and makes rollback simpler: one pull request maps to one commit on the default branch. The tradeoff is that the detailed checkpoint history from the feature branch is not preserved on `main`, so keep important design context in the pull request description, commit body, or docs.

## Linking Commits, Issues, and Pull Requests

Use three layers of linking:

1. Branch: create the branch with `gh issue develop` when possible so GitHub knows the branch belongs to the issue.
2. Commit: include the issue reference in the commit subject, for example `#12: Add CI foundation workflow`.
3. Pull request: include `Closes #12`, `Fixes #12`, or `Refs #12` in the pull request body.

Use `Closes`, `Fixes`, or `Resolves` when merging the pull request should close the issue. Use `Refs` when the pull request is related but should not close the issue.

GitHub supports closing keywords in pull request descriptions and commit messages, but the pull request body is the best place to make the issue relationship explicit. If a closing keyword appears only in a commit message, GitHub can close the issue when that commit reaches the default branch, but the pull request may not be shown as the linked pull request. Keeping `Closes #12` in the pull request body avoids that ambiguity.
