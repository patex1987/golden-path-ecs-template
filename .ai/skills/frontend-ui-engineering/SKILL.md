---
name: frontend-ui-engineering
description: Use when building or modifying user-facing interfaces, including layouts, components, visual polish, accessibility, responsive behavior, loading states, error states, and interaction design.
---

# Frontend UI Engineering

Use this skill when the output must feel like a production UI, not a code-only prototype. In this repository, most frontend work is expected to be an internal operational tool for testing backend behavior and observability.

## Product Direction

Before editing UI, identify:

- Purpose: what workflow the user must complete.
- Audience: learner, developer, operator, reviewer, or demo audience.
- Density: how much information the user must scan repeatedly.
- Tone: internal tools should usually be calm, precise, and utilitarian.
- Differentiator: the one interaction or visual detail that makes the workflow easier to understand.

Do not build a marketing landing page unless the user asks for one. Make the actual usable workflow the first screen.

## Avoid Generic AI UI

Avoid:

- purple/indigo gradients as the default visual identity;
- oversized hero sections for tools;
- uniform card grids that ignore information priority;
- excessive rounded corners, shadows, glass effects, and decorative blobs;
- placeholder copy that hides real layout problems;
- color as the only status indicator;
- text that overflows buttons, cards, or compact panels.

Prefer:

- domain-specific labels and realistic seed data;
- dense but readable layouts for repeated operational use;
- semantic status text plus icons or shape changes;
- restrained motion that clarifies state transitions;
- stable dimensions for boards, lists, controls, and status tiles.

## Component Architecture

- Prefer composition over over-configured components.
- Split components that exceed one clear responsibility.
- Keep repeated UI primitives in `shared/ui/` only after they are reused.
- Do not nest decorative cards inside cards.
- Keep page sections unframed; reserve cards for repeated items, modals, and genuinely framed tools.

## Accessibility Baseline

Every UI change should preserve:

- semantic HTML for buttons, forms, lists, tables, headings, and navigation;
- keyboard access for every interactive control;
- visible focus states;
- labels for inputs and icon-only buttons;
- logical heading order;
- contrast suitable for WCAG 2.1 AA;
- status text that does not rely only on color.

Prefer real elements like `<button>`, `<label>`, `<input>`, `<select>`, and `<dialog>` over divs with roles. Add ARIA only when native semantics are insufficient.

## Layout And Responsiveness

- Design mobile first, then expand to desktop.
- Check at 320px, 768px, 1024px, and 1440px when feasible.
- Use a consistent spacing scale and avoid arbitrary pixel tweaks.
- Use stable layout constraints such as grid tracks, `minmax`, `aspect-ratio`, and max widths.
- Match type size to context: compact panels need compact headings, not hero-scale text.
- Ensure long ids, operation names, and error text wrap predictably.

## Loading, Error, Empty, And Success States

Do not ship blank states. For every remote-data area, handle:

- initial loading;
- refresh/polling state;
- empty state;
- user-facing error with retry where useful;
- terminal success or failure state.

Use skeletons for content-shaped loading when the wait is visible. Use small progress indicators for quick commands or button-local work.

## Interaction Design

- Use icons in compact command buttons when the symbol is familiar.
- Add tooltips for unfamiliar icon-only controls.
- Use checkboxes/toggles for binary settings, segmented controls for modes, sliders/inputs for numeric values, and menus for option sets.
- Keep animations subtle and purposeful; motion should explain cause and effect.
- Avoid animation that hides latency or distracts from debugging backend behavior.

## Verification

After UI work:

- Tab through the page.
- Check responsive behavior at small and desktop widths.
- Confirm loading, error, empty, and terminal states.
- Check browser console output.
- If Playwright or another browser tool is available, capture screenshots for desktop and mobile.
