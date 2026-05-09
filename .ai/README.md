# AI Setup

This directory is the source of truth for repository-specific AI guidance.

Edit the files under `.ai/`, then run:

```bash
bash .ai/sync.sh
```

The sync script publishes rules and skills to tool-specific locations for common coding assistants.

## Directory layout

```text
.ai/
├── project-guidance.md
├── agents/
│   └── security-practices.md
├── rules/
│   └── teaching-mode.md
├── skills/
│   ├── fastify/
│       └── SKILL.md
│   └── principal-engineer-planner/
│       └── SKILL.md
├── meta/
│   ├── teaching-mode.yaml
│   └── fastify.yaml
├── sync.sh
└── README.md
```

## Editing workflow

1. Update `.ai/project-guidance.md` for always-on repository guidance.
2. Update `.ai/agents/*.md` for reusable review subagents.
3. Update `.ai/rules/*.md` for focused rules.
4. Update `.ai/skills/*/SKILL.md` for reusable skill instructions.
5. Keep `.ai/meta/*.yaml` in sync so generated rule and skill files have names and descriptions.
6. Run `bash .ai/sync.sh`.

## Generated outputs

The sync script currently generates content for:

- Cursor
- Roo
- Codex
- Claude
- Gemini
- root `AGENTS.md`

Agent support is tool-specific:

- Codex agents are generated as `.codex/agents/*.toml`.
- Claude agents are generated as `.claude/agents/*.md` with YAML frontmatter.
- Gemini agents are generated as `.gemini/agents/*.md` with YAML frontmatter.
- Cursor agents are generated as `.cursor/agents/*.md` using the same conservative Markdown/frontmatter shape.
- Roo output is currently limited to rules and skills because this repo does not define a Roo-specific subagent format yet.

The goal is simple: maintain one canonical source in `.ai/` and copy or index it into the formats those tools expect.

## Notes

- Edit canonical files under `.ai/`, not the generated outputs.
- Generated files include a header noting they were produced by `sync.sh`.
- If you add a new rule or skill, add a matching metadata file in `.ai/meta/`.
- If you add a new agent, include YAML frontmatter with at least `name`, `codexName`, `description`, and `nicknames`.
- Use `principal-engineer-planner` before implementation when the work needs a written plan under `docs/plans/`.

Example planning prompt:

```text
Use the principal-engineer-planner skill.

I want to build <feature>. Do not implement yet.
Interview me like a principal engineer, inspect the repo, challenge the approach,
identify risks, compare alternatives, and produce docs/plans/<feature>.md.
```
