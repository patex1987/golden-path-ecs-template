# AI Review Workflow

This repository keeps AI assistant guidance in one canonical place:

- `.ai/project-guidance.md` for always-on project context
- `.ai/rules/` for focused rules
- `.ai/skills/` for reusable technical guidance
- `.ai/agents/` for reusable review subagents

Run this after editing files under `.ai/`:

```bash
bash .ai/sync.sh
```

The sync script publishes the same intent into tool-specific formats:

- Codex: `.codex/agents/*.toml`
- Claude Code: `.claude/agents/*.md`
- Gemini CLI: `.gemini/agents/*.md`
- Cursor: `.cursor/agents/*.md`

The important idea is that `.ai/` is the source of truth. Generated files should not be edited directly.

---

## Review Agents

The current review agents are:

- `system_design_scalability`: architecture, CDK/ECS design, service boundaries, and operational scalability
- `readability_maintainability`: naming, clarity, tests, documentation, and onboarding difficulty
- `performance_scalability`: runtime efficiency, load behavior, async/resource bottlenecks, and scaling signals
- `security_practices`: app security, IAM, secrets, dependency risk, and ECS security posture

Codex uses the underscore names from `.codex/agents/*.toml`. The canonical `.ai/agents/*.md` files use hyphenated names because Markdown-based tools commonly use filenames as identifiers.

---

## Parallel Review Prompt

Use this when you want the current branch reviewed from all four angles:

```text
Review this branch against main. Spawn one subagent per review angle and run them in parallel:

- system_design_scalability: architecture, CDK/ECS design, service boundaries, operational scalability
- readability_maintainability: clarity, tests, docs/JSDoc, onboarding difficulty
- performance_scalability: runtime efficiency, load behavior, async/resource bottlenecks
- security_practices: app security, IAM, secrets, dependency and ECS security posture

Each agent should inspect the diff plus any affected surrounding files. Wait for all results, deduplicate overlapping findings, and give me a consolidated review with severity, evidence, impact, and recommended fix.
```

For a narrower review, replace "this branch against main" with the target you want:

```text
Review only the staged changes using system_design_scalability and security_practices in parallel.
Wait for both agents, then summarize only concrete findings with file/line references.
```

```text
Review the service layer changes in this branch using readability_maintainability and performance_scalability.
Focus on changed files and affected execution paths. Wait for both agents and summarize the findings by severity.
```

---

## What To Expect

The agents are configured as review-only. They should inspect code, report findings, and avoid editing files.

A good review result should include:

- severity
- file and line evidence
- impact
- practical recommendation
- any important assumptions

If no material issue exists, the agent should say that clearly and list remaining risks or gaps.

---

## Tool Differences

Subagents are not standardized across tools.

- Codex uses TOML agent definitions.
- Claude Code and Gemini use Markdown files with YAML frontmatter.
- Cursor supports custom subagents, but its public format is less stable, so this repo generates a conservative Markdown/frontmatter shape.
- Roo currently receives rules and skills from `.ai/sync.sh`, but no Roo-specific subagent format is generated yet.

That is why this repo keeps a neutral Markdown definition under `.ai/agents/` and lets `.ai/sync.sh` translate it for each tool.
