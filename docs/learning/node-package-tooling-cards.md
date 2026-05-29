# Node Package Tooling Cards

These notes use a Trello-card shape: each tool has a short purpose, when it matters, common commands, and how it applies to this repository.

## Card: nvm

### Purpose

`nvm` is a local Node.js version manager. It helps developers install and switch between Node versions on one machine.

### Use It When

- A project expects a specific Node major version.
- You work on multiple Node projects with different runtime requirements.
- CI uses a pinned Node version and local development should match it.

### Common Commands

```bash
nvm install
nvm use
nvm current
```

### Project Notes

This repository already has `.nvmrc` with Node `24`. That means `nvm install` and `nvm use` can read the project version directly.

Think of `nvm` like using `pyenv` for Python or `rustup` for Rust toolchains: it controls the runtime/toolchain version before project dependencies are installed.

## Card: npm

### Purpose

`npm` is Node's default package manager. It installs dependencies, runs scripts, manages workspaces, and writes `package-lock.json`.

### Use It When

- You want the standard package manager bundled with Node.
- The repo already has `package-lock.json`.
- Simplicity and broad contributor familiarity matter more than advanced package-manager features.

### Common Commands

```bash
npm ci
npm install
npm run build
npm -w movie-reservation-service run check
```

### Project Notes

This repository currently uses npm workspaces. The root `package.json` defines the workspaces, `package-lock.json` pins dependency resolution, and GitHub Actions runs `npm ci`.

`npm ci` is the CI-friendly install command because it uses the lockfile exactly and fails if `package.json` and `package-lock.json` disagree.

## Card: Corepack

### Purpose

Corepack is a package-manager launcher included with modern Node. It makes package-manager versions reproducible by reading the `packageManager` field in `package.json`.

### Use It When

- A project uses pnpm or Yarn and wants contributors to use the same package-manager version.
- The repo has a field like `"packageManager": "pnpm@10.12.1"`.
- CI and local development should agree on the package-manager binary, not just dependency versions.

### Common Commands

```bash
corepack enable
corepack prepare pnpm@10.12.1 --activate
```

### Project Notes

This repository does not currently need Corepack because it uses npm and npm ships with Node. Corepack becomes important if the project migrates to pnpm or modern Yarn.

The key distinction:

- `.nvmrc` pins the Node runtime version.
- `packageManager` plus Corepack pins the package-manager version.
- A lockfile pins dependency versions and resolution.

## Card: pnpm

### Purpose

`pnpm` is an alternative package manager focused on fast installs, efficient disk usage, strict dependency boundaries, and strong workspace support.

### Use It When

- A team uses pnpm at work and you want local practice with the same workflow.
- A monorepo benefits from strict dependency isolation.
- Install speed and disk usage matter.
- You want to catch undeclared dependency imports earlier.

### Common Commands

```bash
pnpm install
pnpm run build
pnpm --filter movie-reservation-service check
pnpm --filter ecs-infra test
```

### Project Notes

A future migration would replace npm workspace usage with pnpm workspace usage. That would likely touch `package.json`, add `pnpm-workspace.yaml`, replace `package-lock.json` with `pnpm-lock.yaml`, update CI caching, add a `packageManager` field, and use Corepack.

The main learning value is understanding how package managers affect dependency layout, workspace commands, lockfiles, and CI reproducibility.

## Card: Yarn

### Purpose

Yarn is another alternative package manager. Modern Yarn is especially useful for teams that want its workspace features, constraints, plugins, or Plug'n'Play dependency model.

### Use It When

- A company or project already standardizes on Yarn.
- You need Yarn-specific workspace tooling or constraints.
- You intentionally want Plug'n'Play instead of a traditional `node_modules` layout.

### Common Commands

```bash
yarn install
yarn build
yarn workspace movie-reservation-service check
```

### Project Notes

Yarn is not the natural next step for this repository because your stated learning goal is pnpm and the repo already uses npm. If the goal is company alignment and practical learning, pnpm is the better follow-up target.

Yarn is still worth knowing conceptually because it shows the same broader idea: JavaScript projects can pin not only dependency versions, but also the package-manager behavior that installs them.

## Quick Decision Guide

| Tool | Main Job | Needed Here Now? | Likely Future Role |
| --- | --- | --- | --- |
| nvm | Pin/switch Node versions locally | Yes | Keep using `.nvmrc` |
| npm | Default dependency manager and script runner | Yes | Current project default |
| Corepack | Pin package-manager versions | Not yet | Use if migrating to pnpm |
| pnpm | Faster/stricter npm alternative | Not yet | Good planned learning migration |
| Yarn | Alternative package manager with advanced workspace modes | No | Learn only if a project requires it |
