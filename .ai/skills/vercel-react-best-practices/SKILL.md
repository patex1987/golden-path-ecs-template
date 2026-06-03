---
name: vercel-react-best-practices
description: Use when writing, reviewing, or refactoring React or Next.js code for performance, including request waterfalls, bundle size, rendering cost, re-renders, client data fetching, and JavaScript hot paths.
license: MIT
metadata:
  source: "Composed from Vercel React/Next.js performance guidance supplied by the user."
---

# Vercel React Best Practices

Use this skill as a performance checklist for React work. Apply the Next.js-specific parts only if this repository actually adopts Next.js; for a Vite React app, translate the rule to the equivalent browser/client pattern.

## Priority Order

Optimize in this order:

1. Eliminate request waterfalls.
2. Keep the bundle small.
3. Avoid unnecessary server work, if SSR/Next.js exists.
4. Make client data fetching deduplicated and bounded.
5. Reduce avoidable re-renders.
6. Keep rendering smooth.
7. Improve JavaScript hot paths only after a real bottleneck appears.

Do not prematurely memoize simple expressions or add abstractions without evidence.

## 1. Eliminate Waterfalls

- Check cheap synchronous conditions before awaiting remote values.
- Start independent async work early and await it late.
- Use `Promise.all` for independent requests.
- Avoid nested `await` chains when the operations do not depend on each other.
- In UI flows, load catalog data in parallel when the backend API allows it.
- Use Suspense or route-level loading boundaries only when they improve perceived progress.

For this repo's reservation UI, avoid loading movies, then screenings, then user context sequentially when a single GraphQL operation or parallel requests can fetch them together.

## 2. Bundle Size

- Prefer direct imports over broad barrel imports for large libraries.
- Keep import paths statically analyzable.
- Dynamically import heavy, rarely used views or tools.
- Load analytics, logging dashboards, or optional visualizations only when the feature is opened.
- Avoid adding component libraries before the UI has enough repeated complexity to justify them.
- Review bundle output when adding charting, date, icon, table, or animation libraries.

## 3. Server-Side Performance

Use only if the frontend uses Next.js or SSR:

- Authenticate server actions and API routes like normal backend endpoints.
- Avoid mutable module-level request state.
- Minimize serialized props sent to client components.
- Parallelize server fetches.
- Cache per-request duplicated work with framework-supported request caching.
- Use cross-request caches only for safe, bounded, non-user-specific data.

For a Vite-only app, these rules mostly become "do not fake backend trust in the browser" and "keep request-specific state out of global mutable modules."

## 4. Client Data Fetching

- Use a server-state library such as TanStack Query or SWR when deduplication, polling, retry, stale data, or cache invalidation becomes repetitive.
- Give query keys a stable hierarchy.
- Bound polling intervals and stop polling on terminal states.
- Deduplicate global event listeners.
- Use passive listeners for scroll or touch observation.
- Version and minimize `localStorage` data.

## 5. Re-Render Optimization

- Keep state as close as possible to where it is used.
- Derive booleans and display values during render instead of syncing them through effects.
- Use functional `setState` when callbacks depend on previous state.
- Hoist default arrays/objects outside components when passed as props.
- Prefer primitive effect dependencies.
- Split hooks that have unrelated dependencies.
- Use refs for transient, high-frequency values that do not affect rendering.
- Do not define components inside components.
- Use `React.memo`, `useMemo`, and `useCallback` only where they remove meaningful render work or stabilize props for memoized children.

## 6. Rendering Performance

- Use `content-visibility` or virtualization for long lists when needed.
- Keep SVG precision reasonable.
- Animate wrappers instead of expensive SVG internals when possible.
- Prefer CSS transitions for small UI state changes.
- Use `startTransition` for non-urgent updates that would block input.
- Defer expensive filtering or search rendering with `useDeferredValue` when typing becomes sluggish.

## 7. JavaScript Hot Paths

Reach for these only after the code is repeated or measured:

- Use `Map` or `Set` for repeated lookups.
- Combine multiple array passes when processing large arrays.
- Hoist regex creation out of loops.
- Use early returns for guard conditions.
- Use immutable array helpers such as `toSorted` when runtime support allows it.
- Defer non-critical browser work with `requestIdleCallback` where supported.

## Review Questions

When reviewing React performance, ask:

- Are independent backend calls accidentally serialized?
- Did this dependency materially increase bundle size?
- Is polling bounded and stopped correctly?
- Are effects syncing derived state that could be rendered directly?
- Are memoization hooks paying for themselves?
- Is the slow path real, or are we optimizing noise?
