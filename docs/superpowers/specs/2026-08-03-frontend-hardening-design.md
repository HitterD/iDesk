# Frontend Hardening Design

## Goal

Harden verified P1/P2 frontend findings from the Impeccable audit without redesigning visual direction, changing product behavior, or migrating all 142 detector findings.

## Scope

### Accessibility

- Replace clickable content containers with semantic controls where action is primary:
  - `apps/frontend/src/features/dashboard/pages/BentoDashboardPage.tsx`
  - `apps/frontend/src/features/client/pages/ClientProfilePage.tsx`
  - `apps/frontend/src/features/ticket-board/components/TicketListRow.tsx`
- Preserve existing navigation and click behavior.
- Add visible keyboard focus treatment where controls are introduced.
- Add explicit `label`/`id` linkage and error metadata to custom hardware input in `BentoCreateTicketPage.tsx`.
- Add `role="status"` and live loading text to `LoadingScreen.tsx`.
- Replace `focus:outline-none` in `SheetMappingModal.tsx` with a visible token-based focus ring.

### Motion and performance

- Keep reduced-motion feedback meaningful. Disable decorative movement, but preserve state/focus visibility.
- Throttle `OnboardingTour` scroll geometry reads through one `requestAnimationFrame` callback and use passive scroll listener.
- Replace verified `width`/`height` transitions with transform/opacity or grid-row transitions where behavior remains equivalent.

### Responsive behavior

- Make calendar and notification panel widths viewport-safe using `min()`/`max-width`.
- Keep desktop dimensions unchanged where viewport has enough space.

## Explicit exclusions

- No palette redesign.
- No broad side-tab or bounce-easing migration.
- No full bundle architecture rewrite.
- No backend changes.
- No factual copy changes.

## Validation

1. Read modified files after each edit.
2. Run `npm run build --prefix apps/frontend`.
3. Run targeted frontend tests covering changed components when available.
4. Run Impeccable detector on changed frontend paths.
5. Report remaining lint limitation if `eslint` remains unavailable.

## Failure handling

- Preserve click/navigation behavior if semantic conversion cannot safely retain layout.
- Do not hide errors; retain existing error messages and propagate build/test failures.
- If CSS replacement changes measured layout, revert that individual replacement and use a narrower rule.
