# Agent Management — Bug Fix + UI Polish

> **Date:** 2026-04-27  
> **Scope:** 5 bug fixes + UI harmonization on Agent Management page  
> **Aesthetic:** Soft/Pastel polish — harmonize existing, no total redesign

---

## Problem Statement

Agent Management page has 5 functional bugs and inconsistent styling in several components (AddUserDialog dark theme mismatch, PresetDrawer empty state, agent assignment cross-site leak). Goal: fix all bugs and polish UI to match iDesk's light-mode-first design language.

---

## Bug #1: Permission Presets Cannot Be Edited

**Symptom:** Selecting a preset in PresetDrawer shows "No permissions defined for this preset" — checkboxes never appear.

**Root Cause:** `PresetDrawer.tsx` line 231 derives `permissionResources` from `Object.keys(draft.permissions || {})`. When backend returns `permissions: {}` (empty object), no rows render. There is no fallback list of available resources.

**Fix:**
- Define `DEFAULT_PERMISSION_RESOURCES` constant: `['tickets', 'users', 'knowledge_base', 'reports', 'hardware_requests', 'eform', 'lost_items', 'departments', 'sites', 'automation']`
- When rendering permission editor, merge existing preset permissions with defaults (missing resources get all-false values)
- This ensures all resource rows always appear, even for new/empty presets

**Files:** `PresetDrawer.tsx`

---

## Bug #2: Drawer Visible When Closed

**Symptom:** Thin element/border visible on right edge of page when PresetDrawer should be hidden.

**Root Cause:** PresetDrawer uses CSS `translate-x-full` when closed but remains in DOM with `border-l` and `shadow-2xl` visible at screen edge.

**Fix:**
- Add `invisible` (visibility: hidden) class when `!isOpen`, applied after transition ends
- Use `transition-all` with proper timing so visibility toggles after slide-out completes
- Alternative: conditional render with `{isOpen && <PresetDrawer />}` — simpler but loses exit animation

**Chosen approach:** CSS visibility toggle with delay — preserves exit animation.

**Files:** `PresetDrawer.tsx`

---

## Bug #3: Agent Assignment Shows Cross-Site Agents

**Symptom:** Agent logged in at site SPJ can click/assign agents from other sites (SMG, KRW, etc.) in ticket assign dropdown.

**Root Cause:** `AssigneeSelect.tsx` fetches `/users/agents` without any site filter. All agents across all sites appear for all roles.

**Fix:**
- `AssigneeSelect`: pass auth user's `siteId` as query param for non-admin roles
- API call: `/users/agents?siteId=<id>` for non-admin, `/users/agents` for admin
- `AgentSelectList`: already has `!isAdmin` branch that shows flat list — no code change needed there
- Backend `/users/agents` endpoint: verify it supports `siteId` filter param (if not, add it)

**Files:** `AssigneeSelect.tsx`, potentially `users.controller.ts` / `users.service.ts`

---

## Bug #4: AddUserDialog Color Mismatch

**Symptom:** "Add New User" dialog uses dark navy background (`bg-navy-light`, `border-white/10`, `text-white`) that clashes with the app's light-mode theme.

**Root Cause:** Hardcoded dark-theme classes throughout `AddUserDialog.tsx`.

**Fix:**
- Replace all `bg-navy-*` / `bg-white/5` / `border-white/10` / `text-white` with theme-aware CSS custom properties:
  - Dialog: `bg-[hsl(var(--card))]` + `border-[hsl(var(--border))]`
  - Inputs: `bg-slate-50 dark:bg-slate-800/50` + `border-[hsl(var(--border))]` + `text-slate-800 dark:text-white`
  - SelectContent: same pattern
  - Labels: `text-slate-700 dark:text-slate-300`
- Result: dialog matches rest of app in light mode, still works in dark mode

**Files:** `AddUserDialog.tsx`

---

## Bug #5: Preset Not Auto-Filled on Add User

**Symptom:** When creating new user, selecting a role does not auto-select the matching permission preset.

**Root Cause:** `AddUserDialog.tsx` line 201 — `<Select onValueChange>` has no `value` prop bound to form state. No `useEffect` watches role changes to auto-match preset.

**Fix:**
- Add `useEffect` watching `role` field → find first preset where `targetRole === role` → call `setValue('presetId', matchedPreset.id)`
- Bind `value` prop on preset `<Select>` to `watch('presetId')`
- If no matching preset found, leave empty (user manually selects)

**Files:** `AddUserDialog.tsx`

---

## UI Polish

### AddUserDialog Redesign
- Consistent field spacing (`space-y-4`)
- Rounded-xl inputs matching PresetDrawer style
- Proper label hierarchy (uppercase tracking-wider for section labels)
- Focus ring: `focus:ring-2 focus:ring-primary/50`

### PresetDrawer Polish
- Entrance: `opacity-0 → opacity-100` on overlay, `translate-x-full → translate-x-0` on panel (already has this, verify timing)
- Empty state: better icon + descriptive text + CTA button
- Permission grid: alternating row bg for readability

### Agent Cards
- Stagger animation on load: `animation-delay` based on index
- Hover: subtle `scale(1.01)` + shadow lift
- Consistent border-radius (`rounded-2xl`)

### Table "No Preset" Badge
- Replace plain text with soft warning badge: `bg-amber-50 text-amber-600 border-amber-200`

---

## Out of Scope
- Backend API changes beyond adding `siteId` filter to `/users/agents`
- Redesigning other iDesk pages
- New features (only fixing + polishing existing)

---

## Verification Plan

### Automated
- TypeScript build: `npx tsc --noEmit` — zero errors
- Lint: `npx eslint` on changed files

### Manual Browser Testing
1. PresetDrawer: create preset → verify permission checkboxes appear → edit → save
2. PresetDrawer: close → verify no visual bleed on right edge
3. Login as Agent (site SPJ) → open ticket → assign dropdown → verify only SPJ agents visible
4. Add User dialog: verify colors match light theme
5. Add User dialog: select role "Agent" → verify preset auto-fills with Agent preset
6. Agent cards: verify stagger animation on page load
