# iDesk Redesign PR 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved interactive design to agent/requester shells, four ticket queues, both chat views and ticket creation without changing business behaviour.

**Architecture:** Translate approved prototype styles into existing HSL/class-dark tokens and reusable React controls backed by installed Radix/cmdk primitives. Keep page controllers, API hooks, access rules and mutation flows intact; extract presentation from oversized components instead of introducing a universal queue controller.

**Tech Stack:** Existing React, Vite, Tailwind v4, Radix Popover/Select/Dialog, cmdk, TanStack Query, Vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-10-20-idesk-redesign.md`; approved prototype `docs/mockups/` at `5a276380`.

## Global Constraints

- Primary sapphire: `#2D4A8C`. No purple UI colours; existing mascot image colours are not recoloured.
- Agent profile remains bottom-left. Sidebar/topbar form continuous sapphire chrome with rounded content sheet.
- Amber action label: **Buat Tiket Baru**. No mock availability/status feature in production.
- Keep original new-ticket mascots from `apps/frontend/public/characters/`.
- No backend/API/schema, RBAC, site-policy or ticket/SLA-rule changes. No prototype fixtures or imperative DOM engine in production.
- Requester/terminal edit locks, takeover confirmation, cache invalidation, drafts, uploads, message visibility and failure recovery remain intact.
- Tests serial, ONE file per invocation; frontend `npx vitest run <file> --maxWorkers=1 --no-file-parallelism`. Never package-wide tests in one invocation. Backend only if touched, always one file with `--runInBand`.
- Run commands from repository or appropriate package, never original checkout. No push/merge without user instruction. Commits end `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- Read actual files before editing. New focused files <800 lines; no unrelated restructuring of legacy oversized pages.

## Review Focus

1. Long PIC names, duplicate names, zero search results and picker inside a dialog: no clipped panel, loss of keyboard focus or ambiguous selected identity (Task 1).
2. Custom module/preset navigation and collapsed/detail/mobile modes: no hidden authorised routes or exposed forbidden routes (Tasks 2–3).
3. Actor receives stale ownership HTTP 409: dialog still opens; cancel leaves ticket/PIC unchanged (Task 4).
4. Requester viewing agent-like ticket data: no editable properties, internal notes or privileged actions leak (Tasks 3,5).
5. Failed reply/upload or form submit: composer/draft survives, no false success, existing API payload remains identical (Tasks 5–6).

## Execution / file map

Paths below relative to `apps/frontend/src/` unless explicitly stated. Every task reads spec + its prototype pages before editing. For tests lacking an existing harness, create the named focused test beside existing tests and copy their provider/mocking conventions. Tests assert behaviour/accessibility, not Tailwind snapshots.

---

### Task 1: Shared tokens and accessible bubble controls

**Files:** modify `styles/tokens.css`, `index.css`; create `components/ui/ticket-pill.tsx`, `components/ui/searchable-picker.tsx` and focused tests under `components/ui/__tests__/`; modify `features/ticket-board/components/TicketDropdowns.tsx`, `AgentSelectList.tsx`, `components/site/SiteSelector.tsx`. Read existing `ui/{popover,select,command,dialog}.tsx`; retain global layering conventions.

**Interfaces:**
- `TicketPill({tone, children, className, ...spanProps})`: readonly span; tone union `neutral | blue | navy | amber | green | red | teal`; no fake dropdown arrow.
- `SearchablePicker({value, options, onValueChange, label, placeholder, searchPlaceholder, disabled, triggerClassName})`; options `{value:string,label:string,description?:string,disabled?:boolean}`; controlled selection, Popover Portal + Command, selected identity by value. Trigger button with accessible label/expanded state. Optional search; collision handling and scroll height bounded by available viewport. Keep avatar/site grouping in AgentSelectList by composition, not converting identities to labels.
- Preserve exports/props of `CustomDropdown`, `PriorityDropdown`, `StatusDropdown`, `AgentSelectList` and `SiteSelector`. Multi-site selection remains multi-select, not prototype single-select.

- [ ] Write failing tests: selected check uses ID for duplicate names; keyboard search/select/Escape restores focus; disabled option/trigger cannot select; no-results text; picker in Dialog portal above dialog; SiteSelector preserves multiple selected IDs and reset.
- [ ] Run each new/affected test alone; record expected RED before implementation.
- [ ] Add scoped semantic tokens for sapphire chrome, soft bubbles, amber CTA, surfaces, focus and dark state; do not overwrite unrelated semantic priorities. Implement React wrappers using local primitives, then restyle existing dropdowns through them while retaining API contracts.
- [ ] Run tests GREEN, existing `overlay-layering.test.tsx` and `AgentSelectList.test.tsx` individually; frontend typecheck.
- [ ] Commit `feat(ui): add shared sapphire tokens and accessible ticket pickers`.

### Task 2: Agent shell and sidebar

**Files:** modify `components/layout/{BentoLayout,BentoSidebar,BentoTopbar,MobileBottomNav}.tsx`; create `components/layout/SidebarNavigation.tsx`; extend `components/layout/__tests__/BentoSidebar.test.tsx`; add `BentoTopbar.test.tsx`.

**Interfaces:** preserve `BentoSidebar({onNavigate?})`, `BentoTopbar()` and layout exports. Extract renderer/types currently in sidebar lines 47–359 to SidebarNavigation; parent retains permissions, module mapping, query/badge, collapse persistence and logout. Renderer receives derived authorised items, active state and navigation callbacks only.

- [ ] Failing tests: authorised custom module route still rendered; preset denial still hides menu; active tab has aria-current; collapsed item remains named; profile/logout stays accessible; topbar has labelled amber creation link and existing search keyboard shortcut; no demo availability menu.
- [ ] Run focused tests RED.
- [ ] Implement continuous sapphire sidebar/topbar, coloured tiles (no purple), active joining tab, bottom-left profile, narrow content gutters and amber CTA. Preserve route-specific detail/Zoom/Kanban height and scroll behaviour. Keep notification/action-center/global search implementations. Mobile uses labelled create action without duplicate topbar CTA.
- [ ] Run focused tests GREEN plus existing sidebar/roleHome/ProtectedRoute tests ONE FILE at a time; typecheck.
- [ ] Commit `feat(layout): apply approved sapphire agent shell`.

### Task 3: Requester shell and My Tickets

**Files:** modify `components/layout/ClientLayout.tsx`; extract `ClientTopbar.tsx` if needed; modify `features/client/pages/BentoMyTicketsPage.tsx`; extend its existing test; add layout `ClientTopbar.test.tsx`.

**Interfaces:** preserve ClientLayout route/preset logic and real logout/account actions. ClientTopbar consumes authorised navigation and real account/theme actions from layout; no fixture User SPJ or simulated logout. Reuse Task 1 token/pill vocabulary.

- [ ] Failing tests: preset-limited nav unchanged; selected route accessible; real user profile and logout wired; create link targets client create route; My Tickets still uses current search/status/page query and shows fetched counts; read-only status/PIC badges are not buttons. Help banner links to existing create route.
- [ ] Run tests RED.
- [ ] Implement sapphire user toolbar, navigation segment, account menu, responsive bottom navigation, tinted stats, pastel rows and approved mascot help banner. Banner copy must not promise immediate response. Preserve notifications, site/preset guards, socket invalidation and pagination.
- [ ] Run existing/new tests GREEN individually and role permission regressions; typecheck.
- [ ] Commit `feat(client): align requester shell and ticket list design`.

### Task 4: Four queue lists and inline editors

**Files:** modify `features/ticket-board/components/{StatsCard,TicketListRow,VirtualizedTicketList,TargetDateCell,TicketListActiveFilters}.tsx`; pages `{BentoTicketListPage,BentoOracleK2TicketsPage,BentoWebDevTicketsPage,BentoMobileDevTicketsPage}.tsx`; tests in components/__tests__ and pages/__tests__. Add developer-queue visual-contract smoke tests only if missing.

**Interfaces:** retain all existing exports and row/mutation callback signatures, notably `onUpdateStatus(id,status,resolutionNote?,files?,takeover?):Promise<void>` and `onAssign(id,assigneeId,reason?)`. StatsCard keeps existing props; add optional semantic tone only if necessary, with backward-compatible default.

- [ ] Failing tests: status/PIC/priority present as accessible bubble controls; readonly Site/SLA lack dropdown affordance; terminal lock follows existing production rules (do not invent a new lock); paused ticket never shows overdue; no flame on done/cancelled; composite Resolved/active Critical/Overdue filters still send same query; developer pages retain module-scoped agents and correct hooks.
- [ ] Run tests RED.
- [ ] Restyle queue headers, seven-card row where currently supported, table and responsive cards. Use same control grammar in all four queues, preserve actual columns/role visibility and data sources. Do not make developer counts falsely global; don't manufacture server aggregates. Keep real requester/agent photographs with initials fallback (prototype pastel initials are fallback only). Preserve sorting, row navigation, selection/bulk, ownership dialog and Kanban toggle.
- [ ] Run each affected test GREEN; include `TicketListRow.test.tsx`, memo suite, list filter suite, `useStatusTakeover.test.ts`, `ReassignConfirmDialog.test.tsx` separately.
- [ ] Commit `feat(tickets): unify queue presentation and bubble editors`.

### Task 5: Agent and requester ticket chat

**Files:** modify `features/ticket-board/pages/BentoTicketDetailPage.tsx`; `components/ticket-detail/{TicketHeader,TicketSidebar,TicketChat,ChatComposer,SlaProgress}.tsx`; `features/client/pages/ClientTicketDetailPage.tsx`. Extract inspector presentation blocks to `components/ticket-detail/TicketPropertyRows.tsx` to prevent TicketSidebar exceeding 800 lines. Tests: existing chat reply/client detail/header/attachment/SLA suites; add focused inspector tests.

**Interfaces:** retain TicketChat send signature `(content, files?, isInternal?, onUploadProgress?) => Promise<void>`, typing callbacks and uploader ownership. TicketPropertyRows receives value/disabled/saving and existing async callbacks; it must not own API or takeover state.

- [ ] Failing tests: requester cannot edit status/PIC/category and cannot see internal note controls; terminal inspector locked; status cancellation/resolve callback still invoked correctly; takeover cancellation restores local selection; failed send retains draft/files; original quote/attachment rendering persists.
- [ ] Run tests RED.
- [ ] Apply rounded shared panels, compact metadata bubble header, coloured-soft avatars, aligned incoming/outgoing messages and fixed-visible composer. Restyle inspector through shared dropdowns; readonly client uses plain badges. Keep timestamps/author identity, full audit/system events and permissions—do not replace them with simplified mock wording. Keep requester self-resolution/confirmation/rating and real SLA semantics; no new vendor date assumption.
- [ ] Run focused suites GREEN one by one: TicketChat.reply, ClientTicketDetailPage, TicketHeader, MessageAttachments, SlaProgress, TargetDateCell, useTicketSocket. Typecheck.
- [ ] Commit `feat(chat): align agent and requester ticket detail surfaces`.

### Task 6: Catalogue and new-ticket forms

**Files:** modify `features/client/pages/BentoCreateTicketPage.tsx`; create `features/client/components/create-ticket/{TicketTypeCard,TicketFormSection}.tsx` for presentation extraction; extend `features/client/pages/__tests__/BentoCreateTicketPage.test.tsx`.

**Interfaces:** preserve route type values `service`, `oracle-request`, `web-dev-request`, `mobile-dev-request`; reuse existing metadata and original mascotImg URLs. Presentational components accept children/metadata/callbacks; state, drafts and submit stay in owner page.

- [ ] Failing tests: all permitted cards show original mascots; preset-hidden card stays hidden; type route values unchanged; selecting real RequesterSelector and category/device/software preserves IDs; template fills existing fields; counters update; invalid form does not POST; valid submit sends current FormData including requester/files; rejection retains draft; success clears scoped draft and keeps existing redirect.
- [ ] Run focused test RED with mocked API/storage and fake timers for existing 2-second autosave.
- [ ] Apply compact mascot catalogue, shared grouped sections, soft form fields, consistent dropdowns and urgency segmentation, visible amber entry action and current submit CTA. Preserve paste/drop/file limits, draft clear/undo and requester selection; don't port prototype free-text requester or mock-submit dialog. Use each type's existing actual fields, not four identical fictional forms.
- [ ] Run focused tests GREEN, typecheck and frontend build.
- [ ] Commit `feat(forms): modernize ticket catalogue and creation forms`.

### Task 7: Whole-surface verification and design documentation

**Files:** update root `DESIGN.md` to approved implemented tokens/components (no change to product truth); add `docs/design/2026-10-20-pr2-verification.md` with commands/results/screenshots and any incomplete item. Use existing local test helpers; do not add an unsupported Playwright test configuration casually.

- [ ] Review each prior task against spec, inspect diff for accidental prototype data, purple styles on changed surfaces, broken permission gates and duplicated dropdown logic.
- [ ] Run affected test files ONE at a time, then from apps/frontend `npx tsc -p tsconfig.app.json --noEmit --incremental false` and `npm run build`. Record exact failures, not claims of baseline without evidence.
- [ ] Launch frontend locally with authorised test data / browser API fixtures when backend config unavailable. Browser-test real compiled components (not prototype): desktop light/dark and mobile; custom module navigation; four queues; requester nav/list; both chats; create catalogue+forms; overlay in dialog and near viewport edge; keyboard, long names, no-results, focus restoration; no horizontal page overflow or composer hiding.
- [ ] Fresh reviewer checks production diff and screenshot fidelity against approved mockup; resolve findings, rerun only covering tests serially, record unverified backend-dependent flows honestly.
- [ ] Commit design/verification docs. Report completion, remaining gaps and PR readiness; do not push/merge until authorised.

## Self-review

Coverage: spec shell → Tasks 2/3; tokens/dropdowns → Task 1; queue parity → Task 4; agent/client chat → Task 5; mascots/forms → Task 6; verification → Task 7. Interfaces are preserved rather than guessed rewrites. Shared-file dependencies are sequential: tokens/control first, layouts next, queue StatsCard changes recheck My Tickets, chat uses Task 1 controls, forms last. Prototype presence/demo-only rules are explicitly excluded. No backend test/build required unless backend files actually change (not planned).
