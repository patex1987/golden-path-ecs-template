# Service Development

This service uses `package.json` scripts as the local automation entry point.
The goal is that a human developer and CI can run the same commands.

## Mental Model

The service toolchain is split by responsibility:

- `tsx` runs TypeScript directly during local development.
- `tsc` compiles and typechecks TypeScript.
- `vitest` runs tests.
- `prettier` formats code.
- `eslint` runs the established TypeScript lint rules.
- `oxlint` runs a fast Rust-based lint pass that is useful during migration away
  from slower ESLint-only workflows.
- `npm audit` checks installed dependencies against known vulnerability data.
- `npm outdated` shows dependency updates that are available.

This is similar to Python projects that combine `black` or `ruff format`,
`ruff check`, `pyright` or `mypy`, `pytest`, and `pip-audit`. It is also
similar to Rust's `cargo fmt`, `cargo clippy`, `cargo check`, `cargo test`, and
`cargo audit`, except Node does not give you one built-in tool like Cargo. The
project chooses and wires the commands explicitly.

## Daily Commands

Run the service locally with automatic restart:

```bash
npm -w service run dev
```

Build production JavaScript into `dist/`:

```bash
npm -w service run build
```

Run the compiled service:

```bash
npm -w service start
```

Run tests once:

```bash
npm -w service test
```

Run tests in watch mode while editing:

```bash
npm -w service run test:watch
```

## Quality Gate

Run the same checks CI should run before a service build:

```bash
npm -w service run check
```

`check` runs:

- `prettier . --check` for formatting.
- `oxlint . --deny-warnings` for the fast Rust-based lint pass.
- `eslint .` for the established TypeScript lint pass.
- `tsc -p tsconfig.json --noEmit` for TypeScript type safety without writing build output.
- `vitest run` for behavior tests.

Run the full CI-style command, including the production build:

```bash
npm -w service run ci
```

## Formatting And Linting

Format files:

```bash
npm -w service run format
```

Check formatting without writing files:

```bash
npm -w service run format:check
```

Run lint rules:

```bash
npm -w service run lint
```

Run only the fast Oxlint pass:

```bash
npm -w service run lint:oxlint
```

Run only the ESLint pass:

```bash
npm -w service run lint:eslint
```

Apply safe automatic lint fixes:

```bash
npm -w service run lint:fix
```

Apply formatting, import organization, and safe fixes together:

```bash
npm -w service run fix
```

Prettier, ESLint, and Oxlint have intentionally separate jobs:

- Prettier is the formatter. It avoids style debates.
- ESLint is the compatibility/reference linter. It has the broadest ecosystem.
- Oxlint is the fast linter. It is useful when a team is migrating from an
  ESLint-heavy setup toward faster Rust-based tooling.

TypeScript still needs `tsc --noEmit` because linting is not a replacement for
the compiler's type checker. This is similar to how `ruff` does not fully
replace `pyright` or `mypy`, and `clippy` does not replace `cargo check`.

## Dependency Risk And Updates

Check production dependency vulnerabilities:

```bash
npm -w service run audit
```

Check all dependency vulnerabilities, including development tools:

```bash
npm -w service run audit:all
```

Show available dependency updates:

```bash
npm -w service run deps:outdated
```

Do not run `npm audit fix --force` blindly. It can make breaking dependency
changes. Treat it like a dependency upgrade PR: inspect the proposed changes,
run the quality gate, and keep the lockfile change reviewable.

## Package Manager Note

This repository currently uses `npm` workspaces. That keeps the learning path
boring and compatible with most Node tooling.

`pnpm` is a reasonable future upgrade when install speed, stricter dependency
isolation, or disk usage matters. For now, prefer consistency over switching
package managers early.
