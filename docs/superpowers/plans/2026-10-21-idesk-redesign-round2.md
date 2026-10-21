# iDesk Redesign Round 2 — Production Implementation Plan

> Agentic workers: use superpowers:subagent-driven-development. One task per subagent, sequential (shared `index.css`/`tokens.css`).

**Goal:** Production frontend matches the approved round-2 mockup (`docs/mockups/` at `e608fc26`) exactly — visuals, copy, micro-interactions — without changing business behaviour.

**Authority:** user approval 2026-10-21: "sudah ok bisa diimplementasikan sama persis semuanya, untuk status open dan in progress pastikan warna tulisannya berbeda". `docs/mockups/README.md` "Keputusan round 2" is binding. PR2 spec `docs/superpowers/specs/2026-10-20-idesk-redesign.md` constraints still apply (no backend/RBAC/SLA changes, no demo data, keep all existing features).

## Global constraints
- All PR2 global constraints (plan `2026-10-20-idesk-redesign-pr2.md`) apply: sapphire #2D4A8C, no purple, tests serial ONE file per invocation (`npx vitest run <file> --maxWorkers=1 --no-file-parallelism`), typecheck `npx tsc -p tsconfig.app.json --noEmit --incremental false`, no push/merge.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- New component CSS goes in `@layer components` so utilities win. Never `:active` scale stretched hit targets, rows, cells, or buttons inside rows.
- Motion via tokens `--ease-out`, `--ease-spring`, `--dur-1/2/3`; respect `prefers-reduced-motion`.
- Mockup copy is the label source (Indonesian where the mockup is Indonesian). Real data, real permissions; actions with no backend stay as they are in production (do not invent endpoints).
- Status ink: Open = sky (`#1a8fe0` hue, ink `#0b6bb8`; dark ink `#7cc6ff`), In Progress = navy (ink `#2d4a8c`; dark `#a9bdf0`). Must be visibly different everywhere status is shown.

## Tasks
1. **Foundation** — font stack (SF on Apple, Inter elsewhere via Google Fonts preconnect), motion tokens + reduced-motion block, status sky/navy tokens and STATUS_TONES (`TODO: 'sky'`), shared action-button system (primary/secondary/ghost/icon/destructive, sizes, focus ring, loading), single "Buat Tiket Baru" CTA (remove create buttons from queue headers, ticket menus, sidebar, command palette), sidebar active-tab slide, page fade-rise, stat-card hover, dialog/popover scale-in.
2. **Queues + Kanban + My Tickets** — Kanban|Tabel segmented toggle (thumb slide, keeps queue), row hover quick actions (Tandai selesai, ⋯ menu; always-visible ⋯ on touch), floating bulk bar (Status/Prioritas/PIC/Gabungkan/Hapus/close), Kanban board per `kanban.html` (columns, lock on terminal, existing DnD behaviour), requester rows openable (`Lihat detail` / `Lihat & balas`, hint, left accent, mobile full-width button).
3. **Ticket detail + chat** — header actions (Batalkan / Teruskan / Resolve primary / panel toggle, copy number), message hover toolbar (reaction, Balas, ⋯ Salin/Edit/Hapus), reaction chips, composer (Public Reply / Internal Note segmented with amber+lock tint and "Terlihat oleh pemohon"), attach/sticker/canned ghost icons in input, circular send disabled until content, reply quote chip; requester variant.
4. **Dashboards** — `dashboard-me.html` → AgentDashboardPage, `dashboard-team.html` → BentoDashboardPage.
5. **Resources** — hardware (4 tabs), eform, zoom calendar, KB + article.
6. **Management/Admin** — workloads, reports, notifications, renewal, agents, automation, audit logs, system health, settings.
7. **Verification + docs** — DESIGN.md to implemented tokens/components; `docs/design/2026-10-21-round2-verification.md`; browser check every route light/dark 1440/390 vs mockup screenshots; fresh whole-branch review.

Each task: read mockup page(s) + README + target production files first; failing behaviour tests where logic/a11y changes; browser comparison against mockup screenshot at 1440 and 390; commit.
