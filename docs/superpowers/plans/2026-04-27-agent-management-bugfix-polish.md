# Agent Management Bug Fix + UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 bugs in Agent Management page and polish UI to match iDesk's design language.

**Architecture:** Direct component-level fixes — no new files, no architectural changes. All fixes are contained within existing components. Backend already supports `siteId` filter on `/users/agents`.

**Tech Stack:** React 18, TypeScript, TanStack Query, Radix UI, Tailwind-style utility classes, Sonner toast

**Spec:** [2026-04-27-agent-management-bugfix-polish-design.md](file:///d:/iDesk-main/docs/superpowers/specs/2026-04-27-agent-management-bugfix-polish-design.md)

---

## File Map

| File | Action | Task |
|------|--------|------|
| `apps/frontend/src/features/admin/components/PresetDrawer.tsx` | Modify | T1, T2, T6 |
| `apps/frontend/src/features/admin/components/AddUserDialog.tsx` | Modify | T4, T5 |
| `apps/frontend/src/features/ticket-board/components/sidebar/AssigneeSelect.tsx` | Modify | T3 |
| `apps/frontend/src/features/ticket-board/components/TicketListRow.tsx` | — | No change needed (uses `agents` prop from parent) |

---

### Task 1: Fix Permission Presets Empty State (Bug #1)

**Files:**
- Modify: `apps/frontend/src/features/admin/components/PresetDrawer.tsx`

**Root cause:** `permissionResources = Object.keys(draft.permissions || {})` — empty when backend returns `permissions: {}`.

- [ ] **Step 1: Add default permission resources constant**

In `PresetDrawer.tsx`, after `EMPTY_PRESET` constant (line ~63), add:

```typescript
const DEFAULT_PERMISSION_RESOURCES = [
    'tickets',
    'users', 
    'knowledge_base',
    'reports',
    'hardware_requests',
    'eform',
    'lost_items',
    'departments',
    'sites',
    'automation',
] as const;

const DEFAULT_PERMISSION_VALUES = {
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
};
```

- [ ] **Step 2: Replace permissionResources derivation**

Replace line 231:
```typescript
const permissionResources = Object.keys(draft.permissions || {});
```

With:
```typescript
// Merge existing permissions with defaults so all resources always show
const permissionResources = [...new Set([
    ...DEFAULT_PERMISSION_RESOURCES,
    ...Object.keys(draft.permissions || {}),
])];
```

- [ ] **Step 3: Update PermissionRow value fallback**

In the permission editor section (line ~467), update the `value` prop:

```tsx
<PermissionRow
    key={resource}
    resource={resource}
    value={draft.permissions?.[resource] || DEFAULT_PERMISSION_VALUES}
    onChange={updatePermission}
    disabled={isSystem}
/>
```

- [ ] **Step 4: Verify — open PresetDrawer, select any preset → checkboxes must appear for all resources**

---

### Task 2: Fix Drawer Visibility Bleed (Bug #2)

**Files:**
- Modify: `apps/frontend/src/features/admin/components/PresetDrawer.tsx`

**Root cause:** Drawer uses `translate-x-full` when closed but remains in DOM with visible border/shadow.

- [ ] **Step 1: Add visibility + pointer-events to drawer panel**

Replace the drawer container `className` (line ~246-249):

```tsx
// OLD:
'fixed top-0 right-0 h-full w-full max-w-5xl bg-[hsl(var(--card))] shadow-2xl z-50',
'flex flex-col border-l border-[hsl(var(--border))] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
isOpen ? 'translate-x-0' : 'translate-x-full'

// NEW:
'fixed top-0 right-0 h-full w-full max-w-5xl bg-[hsl(var(--card))] shadow-2xl z-50',
'flex flex-col border-l border-[hsl(var(--border))] transition-[transform,visibility] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
isOpen ? 'translate-x-0 visible' : 'translate-x-full invisible'
```

- [ ] **Step 2: Same for overlay — ensure pointer-events-none AND invisible**

Overlay div (line ~237-241) already has `pointer-events-none`. Add `invisible`:

```tsx
// OLD:
isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'

// NEW:  
isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none invisible'
```

- [ ] **Step 3: Verify — close PresetDrawer → no visual bleed on right edge**

---

### Task 3: Fix Cross-Site Agent Assignment (Bug #3)

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/components/sidebar/AssigneeSelect.tsx`

**Root cause:** Fetches `/users/agents` without `siteId` param. Backend already accepts `siteId` query param (verified: `users.controller.ts:109`).

- [ ] **Step 1: Pass siteId for non-admin users**

In `AssigneeSelect.tsx`, update the query (lines 34-40):

```tsx
const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents', isAdmin ? 'all' : user?.siteId],
    queryFn: async () => {
        const params = new URLSearchParams();
        // Non-admin: filter by own site
        if (!isAdmin && user?.siteId) {
            params.set('siteId', user.siteId);
        }
        const res = await api.get(`/users/agents?${params.toString()}`);
        return res.data;
    },
});
```

- [ ] **Step 2: Verify auth user type has siteId**

Check `useAuth` store — `user` object should have `siteId`. If not, check backend JWT payload.

```tsx
// Already in AssigneeSelect:
const { user } = useAuth();
// user.siteId should exist from auth store
```

- [ ] **Step 3: Verify — login as Agent SPJ → open ticket assign dropdown → only SPJ agents visible**

---

### Task 4: Fix AddUserDialog Color Mismatch (Bug #4)

**Files:**
- Modify: `apps/frontend/src/features/admin/components/AddUserDialog.tsx`

**Root cause:** Hardcoded `bg-navy-light`, `border-white/10`, `text-white` across dialog.

- [ ] **Step 1: Fix DialogContent wrapper**

Line 150:
```tsx
// OLD:
<DialogContent className="bg-navy-light border-white/10 text-white sm:max-w-[480px]">

// NEW:
<DialogContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))] text-slate-800 dark:text-white sm:max-w-[480px]">
```

- [ ] **Step 2: Fix all Input fields**

Replace all instances of `className="bg-white/5 border-white/10 text-white"` on Input components:

```tsx
// OLD (line 161, 173, etc):
className="bg-white/5 border-white/10 text-white"

// NEW:
className="bg-slate-50 dark:bg-slate-800/50 border-[hsl(var(--border))] text-slate-800 dark:text-white placeholder:text-slate-400"
```

- [ ] **Step 3: Fix SelectTrigger components**

Replace all `className="bg-white/5 border-white/10 text-white"` on SelectTrigger:

```tsx
// OLD (line 182, 202, 255, 271):
className="bg-white/5 border-white/10 text-white"

// NEW:
className="bg-slate-50 dark:bg-slate-800/50 border-[hsl(var(--border))] text-slate-800 dark:text-white"
```

- [ ] **Step 4: Fix SelectContent dropdown menus**

Replace all `className="bg-navy-main border-white/10 text-white"` on SelectContent:

```tsx
// OLD (line 185, 205, 258, 274):
className="bg-navy-main border-white/10 text-white"

// NEW:
className="bg-[hsl(var(--card))] border-[hsl(var(--border))] text-slate-800 dark:text-white"
```

- [ ] **Step 5: Fix department add section**

Line 228 `bg-white/5`:
```tsx
// OLD:
className="space-y-2 p-3 bg-white/5 rounded-lg border border-white/10"

// NEW:
className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-[hsl(var(--border))]"
```

Line 233, 240 `bg-black/20 border-white/10`:
```tsx
// OLD:
className="bg-black/20 border-white/10"

// NEW:
className="bg-white dark:bg-slate-900 border-[hsl(var(--border))]"
```

- [ ] **Step 6: Fix Cancel button**

Line 309:
```tsx
// OLD:
className="text-slate-400 hover:text-white"

// NEW:
className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
```

- [ ] **Step 7: Verify — open Add User dialog → colors match light theme, inputs readable**

---

### Task 5: Fix Preset Auto-Fill on Add User (Bug #5)

**Files:**
- Modify: `apps/frontend/src/features/admin/components/AddUserDialog.tsx`

**Root cause:** No `value` binding on preset Select, no role-watch logic.

- [ ] **Step 1: Add role watcher to auto-select matching preset**

After the existing `useEffect` for reset (line ~142-146), add:

```tsx
// Auto-select preset matching selected role
const watchedRole = watch('role');
const watchedPresetId = watch('presetId');

useEffect(() => {
    if (!watchedRole || !presets.length) return;
    const match = presets.find((p: any) => p.targetRole === watchedRole);
    if (match) {
        setValue('presetId', match.id);
    }
}, [watchedRole, presets, setValue]);
```

- [ ] **Step 2: Bind value prop on preset Select**

Line 201, update Select:
```tsx
// OLD:
<Select onValueChange={(val) => setValue('presetId', val)}>

// NEW:
<Select 
    value={watchedPresetId || ''} 
    onValueChange={(val) => setValue('presetId', val)}
>
```

- [ ] **Step 3: Verify — open Add User → select role "Agent" → preset auto-fills with Agent preset. Change to "User" → preset switches to User preset.**

---

### Task 6: UI Polish — PresetDrawer + Agent Cards + Table Badge

**Files:**
- Modify: `apps/frontend/src/features/admin/components/PresetDrawer.tsx`
- Modify: `apps/frontend/src/features/admin/pages/BentoAdminAgentsPage.tsx` (table badge only)

- [ ] **Step 1: Add alternating row colors to permission grid**

In `PermissionRow` component (line ~78), add index-based bg:

```tsx
// Update PermissionRow to accept index prop
const PermissionRow: React.FC<{
    resource: string;
    value: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
    onChange: (resource: string, field: string, val: boolean) => void;
    disabled?: boolean;
    index?: number;
}> = ({ resource, value, onChange, disabled, index = 0 }) => {
    return (
        <div className={cn(
            "flex items-center gap-3 py-2.5 px-1 border-b border-[hsl(var(--border))] last:border-0 rounded-sm",
            index % 2 === 1 && "bg-slate-50/50 dark:bg-slate-800/20"
        )}>
```

Pass `index` when rendering:
```tsx
{permissionResources.map((resource, idx) => (
    <PermissionRow
        key={resource}
        resource={resource}
        value={draft.permissions?.[resource] || DEFAULT_PERMISSION_VALUES}
        onChange={updatePermission}
        disabled={isSystem}
        index={idx}
    />
))}
```

- [ ] **Step 2: Fix "No Preset" badge in UnifiedUserTable**

Find the preset display in `UnifiedUserTable.tsx` or `BentoAdminAgentsPage.tsx` where "No Preset" appears. Replace plain text with styled badge:

```tsx
// Find and replace "No Preset" text with:
<span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 font-medium">
    No Preset
</span>
```

- [ ] **Step 3: Verify — PresetDrawer has alternating row colors. Table shows styled "No Preset" badge.**

---

### Task 7: Build Verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd d:/iDesk-main && npx tsc --noEmit --project apps/frontend/tsconfig.json
```
Expected: zero errors on changed files.

- [ ] **Step 2: Commit all changes**

```bash
git add -A
git commit -m "fix(agents): fix 5 bugs + UI polish in Agent Management

- Fix permission presets showing empty (add default resources)
- Fix PresetDrawer visibility bleed when closed
- Fix cross-site agent assignment for non-admin
- Fix AddUserDialog dark theme mismatch
- Fix preset auto-fill when adding new user
- Polish: alternating permission rows, No Preset badge"
```

---

## Verification Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | Open PresetDrawer → select any preset | Permission checkboxes appear for all resources |
| 2 | Close PresetDrawer | No visual bleed on right edge |
| 3 | Login Agent SPJ → ticket assign dropdown | Only SPJ agents visible |
| 4 | Open Add User dialog | Colors match light theme |
| 5 | Add User → select role "Agent" | Preset auto-fills with matching preset |
| 6 | PresetDrawer permission grid | Alternating row backgrounds |
| 7 | User table → user without preset | Styled amber "No Preset" badge |
