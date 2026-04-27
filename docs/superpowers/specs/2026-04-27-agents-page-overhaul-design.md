# Agents Page Overhaul — Design Spec
**Date:** 2026-04-27  
**Branch:** feature/notification-command-center  
**Status:** Approved

---

## Overview

Three-area overhaul of the Admin Agents page:
1. **Preset Management** — replace double-modal pattern with slide-over drawer
2. **Site Isolation** — enforce per-site scoping for agents and ticket assignment
3. **Export/Import** — 6 improvements to user data and preset export/import flows

Roles in scope: `ADMIN`, `AGENT` (no `MANAGER` role — removed per project convention).

---

## Area 1: Preset Management — Drawer + Quick Apply

### Problem
Current flow: open `PresetManagementDialog` (modal) → click edit → open `PagePresetEditor` (second modal). Double-modal is disorienting and breaks context.

### Solution: Slide-over Drawer (A+C combination)

**`PresetDrawer` component** — new component, replaces `PresetManagementDialog`:
- Slides in from right, width ~780px (desktop), full-screen (mobile)
- **2-column layout:**
  - Left column (280px): preset list with search bar, "+ New Preset" button, each row shows name, target role badge, usage count badge, color dot
  - Right column (flex-1): inline editor — name input, description textarea, target role selector, page access toggles (same logic as `PagePresetEditor`)
- Selecting a preset in left column loads it in right column instantly (no navigation)
- Save/Cancel buttons in right column footer
- Delete button in left column row (with confirmation inline, not another modal)
- Clone button per row

**Quick actions from user card (PresetDropdown):**
- Existing `PresetDropdown` component retained as-is for quick-apply
- Add "Manage Presets →" link at bottom of dropdown that opens `PresetDrawer`
- Add hover tooltip on applied preset badge showing 3-5 key permissions

**Files to create/modify:**
- `CREATE` `apps/frontend/src/features/admin/components/PresetDrawer.tsx`
- `MODIFY` `apps/frontend/src/features/admin/components/agent-management/PresetDropdown.tsx` — add "Manage Presets" link + hover tooltip
- `MODIFY` `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx` — replace `PresetManagementDialog` open with `PresetDrawer` open
- `DELETE` `apps/frontend/src/features/admin/components/PresetManagementDialog.tsx` — replaced by drawer
- `KEEP` `apps/frontend/src/features/admin/components/PagePresetEditor.tsx` — reuse its permission toggle logic inside drawer right column

### UX Details
- Drawer opens over page content with backdrop (not full overlay — page still partially visible)
- Keyboard: `Escape` closes drawer, `Ctrl+S` saves current preset
- Empty state in right column: "← Select a preset to edit" with illustration
- Unsaved changes guard: confirm before switching preset or closing

---

## Area 2: Site Isolation

### Problem
- `GET /users/agents` has no site filtering — all agents see all agents cross-site
- Ticket "assigned to" dropdown shows agents from all sites to all roles
- Agents page shows all users regardless of logged-in agent's site

### Backend Fix

**`users.controller.ts` — `getAgents()` endpoint:**
```
GET /users/agents
```
- Add `@UseGuards(JwtAuthGuard, SiteGuard)` — `SiteGuard` already auto-injects `siteId` for AGENT role
- `UsersService.getAgents()` accepts optional `siteId?: string` param
- If `siteId` present → filter `WHERE user.siteId = :siteId`
- Include `site: { id, code, name }` in response

**`users.service.ts` — `getAgents()` signature:**
```typescript
async getAgents(siteId?: string): Promise<User[]>
```
- Existing query at line ~506 extended with `.andWhere('user.siteId = :siteId', { siteId })` when siteId provided

### Frontend — Assigned To Dropdown

4 frontend files call `GET /users/agents` for assignment (`BentoTicketDetailPage`, `BentoTicketKanban`, `BentoTicketListPage`, `RuleBuilder`):
- Response automatically scoped by backend (no frontend filter needed for AGENT role)
- **Display format (option B — labeled):**
  - Header: `"Site SPJ • 3 agents"` in muted uppercase above list
  - Each row: avatar + name + site badge colored by site (blue=SPJ, green=SMG, amber=KRW, purple=JTB)
- **ADMIN view:** agents grouped by site with `── SPJ ──` divider headers, can assign cross-site
- No manual frontend filtering — source of truth is backend response

### Frontend — Agents Page

- AGENT role: site tabs disabled (all tabs except own site grayed out), tooltip: `"Anda hanya dapat melihat site SPJ"`
- Stats cards auto-scoped to agent's site (already handled if API filters correctly)
- ADMIN: full tab navigation retained

---

## Area 3: Export/Import — 6 Improvements

### Export

**1. Format lebih lengkap**
- Existing: CSV, XLSX
- Add: JSON export (full user objects including preset assignments) for backup purposes
- PDF export: fix layout to use proper print CSS, include site filter context in header
- Per-site filename: `users_SPJ_2026-04-27.xlsx` (already done, verify correctness)

**2. Field selector saat export**
- Extend `ExportPreviewDialog`:
  - Add "Select Fields" collapsible section before download
  - Checklist: Full Name, Email, Role, Site, Employee ID, Job Title, Phone, Status (Active/Inactive), Applied Preset, Department
  - Default: all checked
  - Preview table updates live as fields are checked/unchecked
  - Selected fields sent as query param `?fields=email,fullName,role,...`

**3. Export/Import Preset Permission**
- In `PresetDrawer` header actions: "Export Presets" button → downloads `presets-backup-2026-04-27.json`
  - JSON structure: `{ version: 1, exportedAt: string, presets: PermissionPreset[] }`
- "Import Presets" button → file picker for `.json` → validation → preview list of presets to import
  - Conflict resolution: if preset name exists → "Skip", "Replace", or "Rename (Copy)"
  - Backend: `POST /permissions/presets/import` accepts array of preset objects

**Files:**
- `MODIFY` `apps/frontend/src/features/admin/components/ExportPreviewDialog.tsx` — add field selector
- `MODIFY` `apps/frontend/src/features/admin/components/PresetDrawer.tsx` — add export/import preset buttons
- `MODIFY` `apps/backend/src/modules/users/users.controller.ts` — handle `?fields=` param in export
- `MODIFY` `apps/backend/src/modules/users/users.service.ts` — dynamic field selection in export
- `CREATE` `apps/backend/src/modules/permissions/dto/import-presets.dto.ts`

### Import

**4. Validation lebih jelas**
- `ImportUsersDialog` preview table row coloring:
  - 🔴 Red background: blocking error (invalid email format, unknown role, missing required field)
  - 🟡 Yellow background: warning (email already exists → will skip in Create-only mode)
  - 🟢 Green background: valid, ready to import
- Counter bar: `12 OK • 3 Warning • 1 Error`
- "Jump to errors" button scrolls table to first red row
- Error tooltip on hover per cell showing what's wrong

**5. Import mode toggle**
- Radio group in preview step (before confirm):
  - `Create only` (default) — skip rows where email already exists
  - `Create + Update` — if email matches existing user, update: fullName, role, siteCode, employeeId, jobTitle
- Mode sent to backend: `POST /users/import` body includes `mode: 'create' | 'upsert'`
- Backend `importUsers()` in `users.service.ts` handles upsert logic

**6. Progress & Result Summary**
- After import API call resolves, do NOT close dialog
- Show summary card:
  ```
  ✓ 12 berhasil dibuat
  ↺ 3 diupdate  
  ✗ 1 gagal — [Download Error Report]
  ```
- "Download Error Report" → CSV with only failed rows + error message column
- "Done" button closes dialog and invalidates user query cache

---

## Component Map

```
BentoAdminAgentsPage
├── PresetDrawer (NEW — replaces PresetManagementDialog)
│   ├── PresetList (left column)
│   └── PagePresetEditor logic (right column, inline)
├── PresetDropdown (MODIFIED — adds "Manage Presets" link + tooltip)
├── ExportPreviewDialog (MODIFIED — field selector)
├── ImportUsersDialog (MODIFIED — row coloring, mode toggle, summary)
├── BentoTicketDetailPage (MODIFIED — `/users/agents` call → site-scoped)
├── BentoTicketKanban (MODIFIED — `/users/agents` call → site-scoped)
├── BentoTicketListPage (MODIFIED — `/users/agents` call → site-scoped)
└── RuleBuilder (MODIFIED — `/users/agents` call → site-scoped, admin-only context)

Backend:
├── UsersController.getAgents() → add SiteGuard
├── UsersService.getAgents(siteId?) → add filter
├── UsersService.exportUsersXlsx() → dynamic fields
├── UsersService.importUsers() → upsert mode
└── PermissionsController → POST /presets/import (NEW)
```

---

## Non-Goals
- No new backend entity or migration needed
- No change to SiteGuard logic (already correct)
- No manager role (removed from project)
- No real-time sync between sites

---

## Success Criteria
- [ ] Preset CRUD works entirely in drawer without any second modal
- [ ] Agent logging in as SPJ only sees SPJ agents in ticket assignment dropdown
- [ ] ADMIN sees all agents grouped by site in assignment dropdown
- [ ] Export respects field selection
- [ ] Import shows per-row color validation before confirming
- [ ] Import result summary shown after completion
- [ ] Preset JSON export/import works round-trip
