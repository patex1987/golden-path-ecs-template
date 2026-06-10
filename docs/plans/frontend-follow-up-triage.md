# Frontend Follow-Up Triage

Date: 2026-06-08

## Summary

The next roadmap deliverable should remain the React + Vite frontend
demonstrator. The only task that should happen before frontend implementation is
adopting the existing `observability_demo_plus_frontend` spike safely, because
that branch was created before the finalized local observability work landed.

The frontend branch contains useful UI work, but it is not a clean base:

- `observability_demo_plus_frontend` is two commits ahead of the shared base.
- Current `main` now includes the finalized D7 observability work.
- The UI commit is mostly additive frontend code.
- The earlier branch commit carries broad backend observability rewrites that
  overlap with the finalized D7 work.

## Recommended Order

1. Do #23 before more frontend implementation.
2. Do #24 to establish the frontend workspace and GraphQL/observability client.
3. Do #25 and #26 together or back-to-back so the customer booking workflow and
   external observability verification are built as one demo experience.
4. Do #27 before closing the parent D8 issue.
5. Defer #28, #29, #30, #31, and #32 until the first frontend workflow proves
   which backend, observability, and CI gaps matter in practice.

## Created Issues

### Frontend D8 Split

- [#23 D8a: Rebase frontend spike onto finalized local observability](https://github.com/patex1987/golden-path-ecs-template/issues/23)
- [#24 D8b: Add frontend workspace foundation and GraphQL client](https://github.com/patex1987/golden-path-ecs-template/issues/24)
- [#25 D8c: Build reservation workflow UI with polling states](https://github.com/patex1987/golden-path-ecs-template/issues/25)
- [#26 D8d: Verify frontend observability propagation and demo workflow](https://github.com/patex1987/golden-path-ecs-template/issues/26)
- [#27 D8e: Add frontend verification, docs, and CI wiring](https://github.com/patex1987/golden-path-ecs-template/issues/27)

### Related Follow-Ups

- [#28 Service/API: Make reservation read outcomes explicit for frontend state](https://github.com/patex1987/golden-path-ecs-template/issues/28)
- [#29 Service/API: Move catalog read model assembly into application query layer](https://github.com/patex1987/golden-path-ecs-template/issues/29)
- [#30 Observability: Build production dashboard and saturation follow-up](https://github.com/patex1987/golden-path-ecs-template/issues/30)
- [#31 CI: Add post-D8 frontend and Docker/Postgres e2e check strategy](https://github.com/patex1987/golden-path-ecs-template/issues/31)
- [#32 Service/API: Add idempotency handling for reservation commands](https://github.com/patex1987/golden-path-ecs-template/issues/32)

## Priority Decisions

### Do Before Frontend

- #23 only. This keeps the existing spike from undoing finalized D7
  observability work.

### Do During Frontend

- #24, #25, #26, and #27. These are the real D8 implementation path.
- Use
  [movie-reservation-frontend-product-requirements.md](movie-reservation-frontend-product-requirements.md)
  as the product and UX bar: the final D8 app should be a customer-facing movie
  booking app, not an observability console.
- #27 should include at least one Playwright browser smoke test before the D8
  parent is closed. The first useful smoke test should exercise the booking
  workflow at a high level and preserve Playwright trace/report artifacts so the
  frontend request path can be reviewed outside the customer UI.

### Do Soon After Frontend

- #28 if the UI makes the current `null` read semantics confusing.
- #31 for the next CI strategy wave after the basic web workspace job exists:
  affected/path-filtered workspace checks, Playwright browser tests, Docker
  image/runtime choices, and Docker/Postgres e2e checks.
- #32 before public or production-like frontend use, because retrying clients
  need idempotent command behavior.
- Add a D8f frontend GraphQL codegen follow-up when #24 through #27 are close
  enough to close. That issue should evaluate generated operation/result types,
  schema-drift CI, and whether runtime response validation should be generated
  with Zod or an equivalent library. Prefer generated validators or the current
  hand-written boundary parsers over manually maintaining duplicate GraphQL
  types and hand-written Zod schemas for the same contract.
- Add a follow-up for frontend containerization once the D8 workflow is stable:
  Docker should support repeatable local/Compose demos, while production can
  still choose between static hosting and a containerized runtime.

### Defer Until Need Is Concrete

- Revisit frontend stylesheet organization after D8 or when a second page,
  feature, or repeated UI primitive appears. The current single
  `movie-reservation-web/src/styles.css` is acceptable for the first workflow,
  but the next maintainability step should split global concerns from
  feature-owned styles: for example `src/app/global.css` for tokens, reset,
  body, focus, and shell primitives, plus a reservation feature stylesheet under
  `src/features/movie-reservations/ui/`. Consider per-component CSS or CSS
  Modules only when class ownership becomes hard to reason about.
- #29 until the first frontend pass clarifies the catalog read shape. The
  current frontend already proved one important concern: loading all nested
  seats for all screenings on initial catalog load is not the right
  production-shaped read model. #29 or a child plan should decide whether the
  frontend gets metadata-first catalog queries, a selected-screening seat query,
  pagination/date windows, or a dedicated application-layer catalog read model.
- #30 until the frontend demo has proven local trace/log correlation and the
  project is preparing for more production-like ECS operations.
