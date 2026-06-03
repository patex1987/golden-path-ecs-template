---
name: react-typescript-frontend
description: Use when creating, refactoring, or explaining React + TypeScript frontend application code, including Vite apps, components, hooks, state, GraphQL clients, routing, and frontend workspace structure.
---

# React TypeScript Frontend

Use this skill for React application work in this repository. Pair it with:

- `frontend-ui-engineering` when the task affects visual UI, interaction, accessibility, or responsive behavior.
- `vercel-react-best-practices` when performance, bundle size, waterfalls, or render behavior matter.
- `frontend-observability` when the UI must exercise or propagate tracing, correlation ids, request ids, logs, or metrics.
- `typescript` when the task is mostly type design.

## Repository Fit

Prefer a small React + Vite + TypeScript workspace for the first UI unless the user explicitly chooses Next.js. The backend is already a NestJS GraphQL API, so the frontend should initially act as a local internal tool for clicking through reservation workflows and producing observability signals.

Do not assume Tailwind, shadcn/ui, Zustand, TanStack Query, or React Hook Form are already present. Add dependencies only when they remove real complexity for the current UI.

## Application Shape

For a new workspace, prefer this shape:

```text
movie-reservation-web/
  src/
    app/
    features/
      movie-reservations/
    shared/
      api/
      ui/
      observability/
```

Keep feature code close to the workflow it supports:

- `features/movie-reservations/` for movie catalog, screening, seat selection, reservation request, polling, and result UI.
- `shared/api/` for GraphQL request helpers and generated or hand-written DTO types.
- `shared/ui/` for reusable visual primitives only after duplication is real.
- `shared/observability/` for browser-side trace/correlation/request id helpers.

## Component Guidelines

- Use function components and named exports.
- Keep components focused: one component should have one primary rendering responsibility.
- Separate remote data orchestration from pure presentation when complexity grows.
- Extract custom hooks for reusable stateful logic, not for every small expression.
- Keep static constants, GraphQL operation strings, and expensive lookup tables outside component bodies.
- Do not define child components inside parent components.
- Prefer composition over large configuration prop objects.

## State Guidance

Choose the smallest state model that fits:

| Need | Preferred tool |
| --- | --- |
| One component's UI state | `useState` |
| Multi-step local flow | `useReducer` with a discriminated union |
| Shared read-heavy app context | React context |
| Server state with caching/polling/retry | TanStack Query, if dependency is justified |
| Complex global client state | Zustand, only when local/context state is strained |
| Shareable filters or selected ids | URL state via router/search params |

For the first reservation UI, local state plus a small GraphQL helper is acceptable. Add TanStack Query when polling, cache invalidation, retries, or refetch state starts becoming repetitive.

## TypeScript Guidance

- Define explicit interfaces for API payloads and component props when they document the boundary.
- Avoid `any`; use `unknown` plus parsing/guards for untrusted data.
- Use discriminated unions for request lifecycle UI states such as `idle`, `loading`, `success`, and `error`.
- Distinguish GraphQL API DTOs from UI state. Do not let every API shape leak into component props.
- Runtime validation is still needed at external boundaries; TypeScript only checks compile-time assumptions.

## Data Fetching

- Name GraphQL operations clearly because operation names appear in logs/traces.
- Keep the GraphQL client small at first: URL, headers, JSON body, typed response, and error normalization.
- Prefer variables over string interpolation for GraphQL inputs.
- Handle loading, error, empty, and success states explicitly.
- For polling reservation status, bound the polling interval and stop polling on terminal states.

## Forms And Inputs

- Use native form semantics first.
- Use `react-hook-form` only when validation, touched state, or larger form behavior justifies it.
- Validate user-editable external inputs with a runtime schema or explicit parser before sending requests.
- Keep submit handlers readable with early returns for invalid or incomplete state.

## Verification

For frontend code, use the narrowest useful checks while iterating, then run the relevant workspace check before handoff. If a dev server is needed, start it and provide the local URL.

At minimum verify:

- TypeScript compile passes.
- Main user flow can be clicked through.
- Browser console has no runtime errors.
- Loading, error, empty, and terminal states are visible.
