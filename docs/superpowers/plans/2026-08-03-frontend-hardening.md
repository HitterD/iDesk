# Frontend Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden verified P1/P2 frontend accessibility, motion, performance, and responsive issues without changing product behavior or visual direction.

**Architecture:** Use semantic HTML and existing shared token/utilities in place. Keep changes local to affected components and CSS. Avoid new dependencies and broad visual migration. Validate each task with targeted tests where available, then run frontend build and detector scans.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Vitest, Testing Library, Framer Motion.

## Global Constraints

- Preserve existing product behavior, navigation, copy, and visual direction.
- No palette redesign, broad side-tab/bounce migration, bundle architecture rewrite, or backend changes.
- No new dependency.
- Use existing token-based focus styles and semantic components.
- Do not hide errors; build/test/detector failures remain visible.
- Read each modified file after edit for verification.

---

### Task 1: Harden dashboard and profile actions

**Files:**
- Modify: `apps/frontend/src/features/dashboard/pages/BentoDashboardPage.tsx:617-628`
- Modify: `apps/frontend/src/features/client/pages/ClientProfilePage.tsx:150-165`
- Test: `apps/frontend/src/features/client/pages/__tests__/ClientProfilePage.accessibility.test.tsx` (create only if existing page test harness supports these imports; otherwise use existing page test file)

**Interfaces:**
- Consumes: Existing `navigate`, `handleAvatarClick`, `UserAvatar`, and existing CSS classes.
- Produces: Keyboard-operable dashboard overdue action and avatar upload trigger with visible focus semantics.

- [ ] **Step 1: Inspect surrounding component contracts and existing tests**

  Confirm the dashboard panel navigates to `/tickets/list?overdue=true` and profile avatar action calls the existing file input trigger. Reuse existing test setup and mocks; do not introduce a new provider abstraction.

- [ ] **Step 2: Replace dashboard clickable container with semantic link/button**

  Preserve layout classes and navigation. Use a `button type="button"` only if the panel is an action without a URL; otherwise use an anchor/link matching the existing router pattern. Add `aria-label` that includes the current overdue action and add `focus-visible:ring-2 focus-visible:ring-primary`.

- [ ] **Step 3: Make profile avatar upload keyboard-operable**

  Replace the clickable wrapper with a `button type="button"` or keep the wrapper only if the existing nested file input requires it; in that case add `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space, and a visible `focus-visible` ring. Keep hidden input and `handleAvatarClick` behavior unchanged.

- [ ] **Step 4: Run targeted tests**

  Run: `npm run test --prefix apps/frontend -- --runInBand <relevant-test-file>`

  Expected: Existing tests pass. If no compatible page test exists, record that no targeted test was available and continue to build verification.

- [ ] **Step 5: Review modified files**

  Read both files and verify no click propagation, route, or upload behavior changed.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/frontend/src/features/dashboard/pages/BentoDashboardPage.tsx apps/frontend/src/features/client/pages/ClientProfilePage.tsx
  git commit -m "fix(frontend): harden dashboard and profile actions"
  ```

### Task 2: Harden ticket list row keyboard actions

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/components/TicketListRow.tsx:126-337`
- Test: `apps/frontend/src/features/ticket-board/components/__tests__/TicketListRow.accessibility.test.tsx` (create only if existing ticket row test setup is absent)

**Interfaces:**
- Consumes: `handleRowClick`, `TicketQuickPreview`, dropdown stop-propagation wrappers, and current grid layout.
- Produces: Keyboard-accessible row navigation without breaking dropdown, checkbox, or quick-action event isolation.

- [ ] **Step 1: Identify row navigation boundary**

  Keep dropdowns, checkbox, assigned-agent popover, hardware request link, resolve button, and other controls inside existing `StopPropagationWrapper` boundaries. Do not make the entire outer grid a button because it contains interactive descendants.

- [ ] **Step 2: Add one semantic row-navigation control**

  Wrap only the ticket information content currently handled by `onClick={handleRowClick}` in a focusable button/link that preserves its grid cell and styling. Use `type="button"`, `aria-label` containing ticket number/title, and `focus-visible:ring-2 focus-visible:ring-primary`. Route must remain `/tickets/${ticket.id}`.

- [ ] **Step 3: Convert remaining row click-only cells**

  For site, requester, target date, created date, and chevron cells, either remove redundant click handlers when ticket info control is the only intended navigation target, or add equivalent keyboard-operable controls without nesting controls. Do not add `role="button"` to the outer row if it creates nested interactive descendants.

- [ ] **Step 4: Preserve event isolation**

  Confirm hardware request button still calls `stopPropagation`, dropdowns still work, checkbox selection still works, and resolve action does not navigate.

- [ ] **Step 5: Run targeted tests**

  Run: `npm run test --prefix apps/frontend -- --runInBand apps/frontend/src/features/ticket-board/components/__tests__/TicketListRow.accessibility.test.tsx`

  Expected: PASS if test exists; otherwise run the nearest ticket-board smoke test and record missing dedicated coverage.

- [ ] **Step 6: Review and commit**

  Read modified file, then run:

  ```bash
  git add apps/frontend/src/features/ticket-board/components/TicketListRow.tsx
  git commit -m "fix(frontend): make ticket row navigation keyboard accessible"
  ```

### Task 3: Harden form labels and loading semantics

**Files:**
- Modify: `apps/frontend/src/features/client/pages/BentoCreateTicketPage.tsx:753-762` and related error-rendering block
- Modify: `apps/frontend/src/components/ui/LoadingScreen.tsx:7-67`
- Modify: `apps/frontend/src/features/google-sync/components/SheetMappingModal.tsx:265-373`
- Test: `apps/frontend/src/features/client/pages/__tests__/BentoCreateTicketPage.test.tsx`
- Test: `apps/frontend/src/components/ui/__tests__/LoadingScreen.accessibility.test.tsx` (create if no existing UI test setup)

**Interfaces:**
- Consumes: Existing `hardwareData`, `errors.hardwareDescription`, `handleAvatarChange`-style form patterns, and shared token CSS.
- Produces: Stable accessible names, error relationships, visible keyboard focus, and screen-reader loading status.

- [ ] **Step 1: Add explicit custom hardware label and field metadata**

  Add a stable `id`, matching `<label htmlFor>`, `aria-invalid={Boolean(...)}`, and `aria-describedby` only when error/help text exists. Keep placeholder as supplementary hint, not the label.

- [ ] **Step 2: Link hardware description error**

  Give the error paragraph a stable id and set the textarea `aria-describedby` to that id when validation fails. Keep current validation and focus behavior unchanged.

- [ ] **Step 3: Add loading status semantics**

  Add `role="status"`, `aria-live="polite"`, and an accessible loading label to the LoadingScreen root or loading indicator. Preserve optional visible `message`; use a fallback label when message is absent. Add `aria-hidden="true"` to purely decorative dots/spinner.

- [ ] **Step 4: Replace unsafe focus suppression**

  In `SheetMappingModal.tsx`, replace each `focus:outline-none` with `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` and a dark-compatible offset class if needed. Preserve select appearance and existing layout.

- [ ] **Step 5: Run targeted tests**

  Run: `npm run test --prefix apps/frontend -- --runInBand apps/frontend/src/features/client/pages/__tests__/BentoCreateTicketPage.test.tsx`

  Expected: PASS. Add or run LoadingScreen test if test environment supports it.

- [ ] **Step 6: Review and commit**

  Read all modified files, then:

  ```bash
  git add apps/frontend/src/features/client/pages/BentoCreateTicketPage.tsx apps/frontend/src/components/ui/LoadingScreen.tsx apps/frontend/src/features/google-sync/components/SheetMappingModal.tsx
  git commit -m "fix(frontend): harden form and loading accessibility"
  ```

### Task 4: Throttle onboarding geometry reads

**Files:**
- Modify: `apps/frontend/src/components/onboarding/OnboardingTour.tsx:79-106`
- Test: `apps/frontend/src/components/onboarding/__tests__/OnboardingTour.test.tsx` (create only if no existing test)

**Interfaces:**
- Consumes: Existing `updateTargetPosition`, `currentStepData`, `isOpen`, and DOM event lifecycle.
- Produces: At most one `getBoundingClientRect()` read per animation frame while retaining step repositioning.

- [ ] **Step 1: Add rAF scheduling state**

  Keep the current geometry function as the actual measurement operation. Add a ref storing the pending animation frame id and a scheduler callback that exits when a frame is already pending, then calls `requestAnimationFrame` to run the measurement and clears the ref.

- [ ] **Step 2: Use passive scroll listener and cleanup**

  Register `scroll` with `{ capture: true, passive: true }` and remove using the same options object or matching capture semantics. Register resize through the scheduler too. Cancel pending rAF in effect cleanup.

- [ ] **Step 3: Preserve initial measurement**

  Call the scheduler once when the tour opens/current step changes so tooltip appears immediately on next frame. Do not change target lookup, placement, or visibility rules.

- [ ] **Step 4: Run tests/build smoke**

  Run: `npm run test --prefix apps/frontend -- --runInBand` for any onboarding test available, then later full build.

- [ ] **Step 5: Review and commit**

  Read modified file and commit:

  ```bash
  git add apps/frontend/src/components/onboarding/OnboardingTour.tsx
  git commit -m "perf(frontend): throttle onboarding geometry updates"
  ```

### Task 5: Make motion and responsive CSS safer

**Files:**
- Modify: `apps/frontend/src/index.css:40-46,107-115`
- Modify: `apps/frontend/src/micro-animations.css:58-75`
- Modify: `apps/frontend/src/styles/components.css:75-82,450-450,539-539`
- Modify: `apps/frontend/src/styles/utilities.css:514-514`
- Modify: `apps/frontend/src/styles/utilities.utilities.css:163-163`
- Modify: `apps/frontend/src/components/notifications/ActionCommandCenter.tsx:327`
- Test: `apps/frontend/src/styles/__tests__/motion-and-responsive.css.test.ts` (create only if CSS test setup supports parsing)

**Interfaces:**
- Consumes: Existing CSS custom properties, Tailwind utility classes, calendar and notification components.
- Produces: Reduced-motion-safe state changes, compositor-friendly transitions where equivalent, and viewport-safe widths.

- [ ] **Step 1: Narrow reduced-motion override**

  Replace global `animation-duration: 0.01ms`/`transition-duration: 0.01ms` blanket behavior with a reduced-motion rule that disables decorative infinite motion and sets `animation: none` only for decorative classes. Preserve visible focus, opacity, and state transitions. Do not remove semantic state changes.

- [ ] **Step 2: Replace layout transitions one rule at a time**

  Inspect each detected transition. Keep behavior where width/height is tied to a genuine progress indicator; otherwise use transform/opacity. For height disclosure, use existing grid row or Radix height animation pattern. Do not alter unrelated transitions.

- [ ] **Step 3: Make calendar width viewport-safe**

  Replace `min-width: 320px` with `width: min(100%, 320px)` or equivalent `min-width: min(320px, 100%)` while retaining desktop width. Ensure padding and border remain unchanged.

- [ ] **Step 4: Make notification panel width viewport-safe**

  Preserve 360px/400px desktop intent but add `max-w-[calc(100vw-2rem)]` and prevent right-edge overflow on narrow viewports.

- [ ] **Step 5: Verify CSS and focused detector scan**

  Run detector on changed CSS/TSX paths. Expected: no new responsive or layout-transition finding from modified rules; existing unrelated findings may remain.

- [ ] **Step 6: Review and commit**

  Read every modified CSS/TSX file, then:

  ```bash
  git add apps/frontend/src/index.css apps/frontend/src/micro-animations.css apps/frontend/src/styles/components.css apps/frontend/src/styles/utilities.css apps/frontend/src/styles/utilities.utilities.css apps/frontend/src/components/notifications/ActionCommandCenter.tsx
  git commit -m "fix(frontend): harden motion and narrow viewport layout"
  ```

### Task 6: Full verification and report

**Files:**
- Modify: None unless verification exposes a regression.
- Verify: all files changed by Tasks 1-5.

**Interfaces:**
- Consumes: Commits from Tasks 1-5.
- Produces: Verified build/test/detector status and remaining known limitations.

- [ ] **Step 1: Run frontend build**

  Run: `npm run build --prefix apps/frontend`

  Expected: TypeScript and Vite build pass. Record any chunk-size warning without changing bundle architecture.

- [ ] **Step 2: Run targeted and full tests**

  Run: `npm run test --prefix apps/frontend -- --runInBand`

  Expected: Existing test suite passes. Report exact failing test output if not.

- [ ] **Step 3: Run detector on changed paths**

  Run:

  ```bash
  node "C:\Users\IT18\.claude\plugins\cache\impeccable\impeccable\4.0.4\skills\impeccable\scripts\detect.mjs" --json <changed-paths>
  ```

  Expected: Review every finding; separate pre-existing detector findings from regressions.

- [ ] **Step 4: Run lint if available**

  Run: `npm run lint --prefix apps/frontend`

  Expected: If `eslint` remains unavailable, report exact error and do not claim lint passed.

- [ ] **Step 5: Read final diff and status**

  Run `git diff --check` and `git status --short`. Verify no generated `dist` files or unrelated modifications entered commits.

- [ ] **Step 6: Commit any verification-only fix separately**

  If a regression is found and fixed, run its smallest relevant test, then commit with a specific `fix(frontend): ...` message. Do not amend prior commits.
