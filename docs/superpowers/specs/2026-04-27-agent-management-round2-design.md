# Agent Management Round 2 — Spec

**Date:** 2026-04-27  
**Status:** Approved  
**Scope:** 4 fixes across PresetDrawer, BentoAdminAgentsPage, and 3 ticket-board pages

---

## 1. Permission Toggle Simplification

### Problem
Permission presets show a 4-checkbox CRUD grid (View/Create/Edit/Delete) per resource — 40 checkboxes total. Too complex for the actual use case.

### Solution
Replace the 4-checkbox `PermissionRow` with a single toggle switch per resource.

**Toggle behavior:**
- ON → `{ canView: true, canCreate: true, canEdit: true, canDelete: true }`
- OFF → `{ canView: false, canCreate: false, canEdit: false, canDelete: false }`

**Backward compatibility:** Backend schema unchanged. UI maps toggle state to/from the CRUD object. A resource is considered "enabled" if `canView === true`.

### Files
- `apps/frontend/src/features/admin/components/PresetDrawer.tsx`
  - Refactor `PermissionRow` component: remove 4 checkboxes, add 1 toggle switch
  - Update `updatePermission` helper to set all 4 fields at once
  - Remove `DEFAULT_PERMISSION_VALUES` constant (replaced by toggle logic)

---

## 2. Clone from System Presets

### Problem
Clone button only appears for non-system presets (`!isNew && selectedPreset && !isSystem`). Users cannot clone system presets like "Agent" or "User" as a starting template.

### Solution
Show Clone button for ALL presets (system and custom). Keep Delete hidden for system presets.

### Files
- `apps/frontend/src/features/admin/components/PresetDrawer.tsx`
  - Line ~402: Change condition from `!isNew && selectedPreset && !isSystem` to separate Clone and Delete conditions
  - Clone: `!isNew && selectedPreset` (always visible)
  - Delete: `!isNew && selectedPreset && !isSystem` (system presets cannot be deleted)

---

## 3. Horizontal Scroll Fix

### Problem
Agents page allows horizontal scrolling (visible scrollbar at bottom in screenshot). Caused by card grid or table content overflowing the page container.

### Solution
Add `overflow-x: hidden` to the outer page container.

### Files
- `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx`
  - Line ~561: Add `overflow-x-hidden` to outer `<div>`

---

## 4. Agent Site Filter — 3 Remaining Fetch Points

### Problem
Previous fix only applied siteId filtering to `AssigneeSelect.tsx`. Three other components still fetch `/users/agents` without site filtering:
1. `BentoTicketListPage.tsx:222` — feeds `TicketListRow` agent dropdown
2. `BentoTicketDetailPage.tsx:75` — feeds ticket detail sidebar
3. `BentoTicketKanban.tsx:654` — feeds kanban card agent assignment

### Solution
Apply the same pattern from `AssigneeSelect.tsx` to all 3 locations:
```typescript
const { user } = useAuth();
const isAdmin = user?.role === 'ADMIN';

const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents', isAdmin ? 'all' : user?.siteId],
    queryFn: async () => {
        const params = new URLSearchParams();
        if (!isAdmin && user?.siteId) {
            params.set('siteId', user.siteId);
        }
        const res = await api.get(`/users/agents?${params.toString()}`);
        return res.data;
    },
});
```

### Files
- `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx`
- `apps/frontend/src/features/ticket-board/pages/BentoTicketDetailPage.tsx`
- `apps/frontend/src/features/ticket-board/components/BentoTicketKanban.tsx`

### Prerequisites
- `useAuth` must already be imported in each file (verify before editing)
- Backend `/users/agents?siteId=xxx` already works (verified in `users.controller.ts:109`)

---

## Verification Plan

### Automated
```bash
npx tsc --noEmit --project apps/frontend/tsconfig.json
```

### Manual
| # | Test | Expected |
|---|------|----------|
| 1 | Open PresetDrawer → select preset | Single toggle per resource (not 4 checkboxes) |
| 2 | Toggle resource ON → save → reopen | Toggle reflects saved state correctly |
| 3 | Select system preset ("Agent") | Clone button visible |
| 4 | Click Clone on system preset | New editable copy created |
| 5 | Agents page → resize browser | No horizontal scroll |
| 6 | Login as non-admin → ticket list → assign dropdown | Only same-site agents shown |
| 7 | Login as non-admin → ticket detail → assign | Only same-site agents shown |
| 8 | Login as non-admin → kanban → assign | Only same-site agents shown |
