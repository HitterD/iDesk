# iDesk PR 2 — Approved Redesign Spec

## Authority

User approved the interactive prototype on 2026-10-20. Visual authority: `docs/mockups/` at commit `5a276380`; `README.md` documents interactive controls and prototype limitations. This spec records the approved direction for production implementation, not permission to reproduce synthetic data or demo behaviour.

## Scope

1. Agent/admin sidebar, topbar and responsive shell.
2. IT Support, Oracle K2, Web Developer and Mobile Developer queue screens: shared visual grammar, statistics, table rows, filters and inline controls.
3. Agent ticket detail/chat and requester ticket detail/chat.
4. Requester portal topbar and My Tickets.
5. New-ticket catalogue and ticket forms (Service, Oracle, Web and Mobile), preserving the original mascot assets and existing fields/validation.
6. Light/dark and desktop/mobile consistency across the above. Other routes retain their features and consume shared shell/tokens without a bespoke redesign.

## Visual contract

- Primary sapphire: `#2D4A8C`. Dark mode uses a readable lighter sapphire, not purple.
- Sidebar/topbar inspired by supplied iPop reference: continuous dark sapphire chrome, rounded content sheet, active menu tab visually joining the sheet.
- Sidebar icons retain distinct coloured square tiles. No purple UI colours; Mobile Developer uses deep teal, In Progress uses navy. Existing mascot image colours are not recoloured.
- Agent profile remains bottom-left, including collapsed/mobile access. No duplicate agent profile in the top-right.
- Hierarchy: frequent navigation prominent; Resources/Management quieter but readable; existing permissions and module visibility unchanged.
- Content padding approximately 12–14px on agent list/detail desktop; avoid unnecessary centred max-width gutters there. Forms may remain width-limited for legibility.
- Shared soft bordered pill/bubble vocabulary for priority, site, status, PIC and SLA. Only editable values get dropdown affordances. Site/SLA badges are readonly; terminal/requester properties retain actual production locks.
- Statistics have softly tinted surfaces, not bold full-colour fills; waiting vendor/overdue/critical use stronger but restrained tints when nonzero.
- Amber primary entry action labelled **Buat Tiket Baru**; higher visibility than utility actions. Requester list has the approved help banner and original service mascot; no promises of response times not backed by existing policy.
- Mobile: amber labelled ticket-creation action in bottom navigation, avoid duplicate icon-only topbar CTA; responsive rows/cards, no page-width overflow.
- Keep original new-ticket mascots from `apps/frontend/public/characters/mascot-{service,oracle,webdev,mobiledev,hardware,access}.png`.
- Portal user topbar uses the same sapphire chrome, a compact navigational segment, utility icons and requester account menu; its navigation/role affordances differ from the agent sidebar.
- Chat: shared rounded surfaces and bubble palette, composer visible, readable chronological timeline and system events. Sender-relative alignment and visibility must match authenticated production data.

## Dropdown / interaction contract

- Reuse existing React/Radix primitives: Popover + portal; searchable picker using Command/cmdk; Dialog for reassignment. Do not port the prototype's imperative DOM engine into React.
- Consistent radii, spacing, selected checks, search input and empty results across filters, PIC picker, ticket properties, form selectors and account menu.
- Overlay escapes scroll/overflow ancestors; viewport collision handling/flip/clamp and scroll limits; does not disappear behind sticky chrome.
- Mouse, touch and keyboard: Arrow keys, Enter, Escape, outside-click, focus restoration, visible focus; correct accessible names and selected/expanded states.
- Apply real filter state/query invalidation, not local fixture edits. Keep status options, ownership confirmation/reason, backend permission checks and request error handling from PR #52.
- Preserve site-filter availability by role. Changing the appearance does not expose cross-site data.
- Form dropdowns retain backend-supported options, validation, draft behaviour, template behaviour, attachment/paste/upload flow and submission payloads.
- Requester cannot gain agent controls through shared components.

## Not part of this redesign

- No backend/API/schema changes, no new ticket statuses, no new SLA rules or role changes.
- Do not implement the prototype Online/Sibuk availability feature. Omit demo-only availability until separately requested; retain genuine existing connection/presence indicators where already supported.
- Do not change cancellation/resolution/dispute/confirmation rules to match simplified prototype demos.
- No dummy data, hard-coded fixture counts, demo banners, simulated confirmations or prototype links in production.
- Do not remove functionality absent from the visual sample: internal notes, participants, mentions, attachments, activity logs, reminders, SLA extension, forwarding, notifications and keyboard shortcuts stay functional.
- Kanban internals are outside the bespoke visual redesign; shared shell/filter/control improvements must not break its behaviour.

## Acceptance

- Approved surfaces share tokens and control components rather than independent CSS copies.
- Existing route/RBAC/site restrictions and PR #52 regression tests remain passing.
- Interaction tests cover keyboard/open/select/cancel, long agent names, no results, terminal/requester locks, multi-site filtering, template and form payload preservation.
- Test runs serial, one file at a time; Jest always `--runInBand`; frontend use one Vitest worker.
- Frontend typecheck/build pass or pre-existing failures are explicitly recorded.
- Browser checks light/dark at desktop and mobile, including open dropdown near screen edge, sticky headers, composer, modal focus and no horizontal page overflow. Tests use local fixtures or an authorised local test environment; no production mutations.
