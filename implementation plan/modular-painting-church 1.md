# Hardware Requests Page — UX & Design Redesign

## Context

The Hardware Requests page (`HardwareRequestPage.tsx`) has several UX and visual polish issues visible in the current design:

1. **Fragmented filtering**: The status strip (ALL/PENDING/PURCHASING/ARRIVED/COMPLETED) is decorative — clicking it does nothing. Filtering is via a separate dropdown below it. This duplicates UI and is confusing.
2. **Tiny, hard-to-read text**: Font sizes of `text-[8px]`, `text-[9px]`, `text-[10px]` are used throughout — badges, metadata, column headers — making the page strain to read.
3. **Row spacing inconsistency**: Table header uses `py-3` + muted background; data rows use `py-4` + card border — the first row looks disconnected and the jump is visually jarring.
4. **Progress bar too thin**: `h-1` (4px) — barely visible; the `h-1.5` in card view is also minimal.
5. **Avatar too small in list view**: `w-6 h-6` (24px) — hard to distinguish.
6. **Status badges undersized**: `text-[8px] px-2 py-1` — text is nearly invisible on the badge.
7. **Expand chevron unclear**: Small, hidden right-side button is not obvious as a disclosure trigger.
8. **Redundant "ALL STATUS" dropdown**: Duplicates the tab strip functionality.

## Critical Files

- **Page**: `apps/frontend/src/features/request-center/pages/HardwareRequestPage.tsx`
- **Tokens**: `apps/frontend/src/styles/tokens.css`
- **Glassmorphism**: `apps/frontend/src/glassmorphism.css`

## Implementation Plan

### Step 1 — Convert Stats Strip to Interactive Tab Bar

**Current**: A flex row with dividers showing icon + label + count. No click handler. Filter is in a separate `<select>` below.

**New**: Replace the stats strip with a proper tab bar component that:
- Highlights the active tab with `bg-[hsl(var(--primary))]` pill on the label
- Shows count as a small rounded badge (e.g., `12` in a gray pill)
- On click, sets `statusFilter` state (reuse existing state — just wire the tabs to it)
- Remove the `<select>` dropdown entirely — tabs handle all filtering

```tsx
// Tab configuration
const TABS = [
  { label: 'All', value: 'ALL', icon: HardDrive, color: 'default' },
  { label: 'Pending', value: 'PENDING', icon: Clock, color: 'amber' },
  { label: 'Purchasing', value: 'PURCHASING', icon: ShoppingCart, color: 'indigo' },
  { label: 'Arrived', value: 'ARRIVED', icon: Package, color: 'blue' },
  { label: 'Completed', value: 'REALIZED', icon: CheckCircle2, color: 'success' },
]
```

Tab bar layout:
```
[bg-card border border-border rounded-2xl p-1.5]
  [flex gap-1]
    [Tab: active=bg-primary text-white, inactive=text-muted hover:bg-muted]
      Icon  Label  [Count badge: bg-muted/80 text-[10px] px-1.5 py-0.5 rounded-full]
```

### Step 2 — Redesign the Filter/Search Row

Remove the `<select>` entirely. Keep only:
- Search input (full width, taller: `py-3.5`)
- View mode toggle (list/card buttons)

The row becomes cleaner: `[Search flex-1] [ViewToggle]`

### Step 3 — Redesign Table Header

Current header: `grid-cols-12 px-6 py-3 bg-muted/30 rounded-xl text-[10px] uppercase`

Issues:
- `text-[10px]` too small
- `bg-muted/30` creates a distinct floating pill that separates from rows

New header:
- `text-xs` (12px) for readability
- `px-6 py-3` kept but `border-b border-border` instead of background pill
- Remove the rounded-xl box entirely — use a simple divider line
- Column labels: use `text-muted-foreground font-semibold tracking-wider` (not `extrabold uppercase tracking-widest`)
- Adjust column spans: `col-span-1` (ID) → smaller, `col-span-4` (Title/Items), `col-span-2` (Requester), `col-span-2` (Status), `col-span-2` (Progress), `col-span-1` (Date + chevron)

### Step 4 — Redesign Table Rows

Each row changes:

**Visual structure**:
- Add left accent bar: a `w-1 self-stretch rounded-r` colored strip at the left edge of each row (like card view already has) — shows status color at a glance
- Row container: keep `border border-border rounded-xl` but add `hover:border-primary/20 hover:shadow-md` for clear hover affordance
- Row padding: `px-6 py-5` (up from `py-4`) for breathing room

**ID column** (`col-span-1`):
- Font: `text-xs font-mono` (up from `text-[10px]`)

**Title/Items column** (`col-span-4`):
- Title: `text-sm font-bold` (up from `text-xs font-extrabold uppercase`)
- Items: `text-xs text-muted-foreground` (up from `text-[9px]`), with truncation

**Requester column** (`col-span-2`):
- Avatar: `w-8 h-8` (up from `w-6 h-6`), `rounded-xl`
- Name: `text-xs font-semibold` (up from `text-[10px] font-extrabold uppercase`)

**Status column** (`col-span-2`):
- Badge: `text-xs px-3 py-1 rounded-full` (up from `text-[8px] px-2 py-1 rounded-lg`)
- Status text: normal case or Title Case (drop all-caps — "Partially Arrived" not "PARTIALLY ARRIVED")

**Progress column** (`col-span-2`):
- Bar: `h-2` (up from `h-1`)
- Text: `text-xs` (up from `text-[8px]`)
- Show `X/Y` on left, `N%` on right

**Date + Expand column** (`col-span-1`):
- Date: `text-xs` (up from `text-[10px] opacity-60`)
- Expand button: larger click target `p-2 rounded-lg`, icon `w-4 h-4` (up from `w-3.5 h-3.5`)
- Make the entire right area a row of `[date | chevron]` aligned right

### Step 5 — Status Text Formatting Helper

Replace `.replace(/_/g, ' ')` with a proper formatter that returns Title Case:

```tsx
const formatStatus = (status: string) =>
  status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? 'Unknown';
```

Apply to both badge and expanded detail section.

### Step 6 — Card View Polish (minor)

The card view is already better but needs:
- Progress bar: `h-2` (up from `h-1.5`)
- Items subtitle: `text-xs` (up from `text-[9px]`)
- Date: `text-xs` (up from `text-[8px]`)

### Step 7 — Empty State & Loading State Polish

No structural changes needed — just ensure font sizes match new standard (`text-xs` minimum).

## Column Grid Adjustment

Current: `grid-cols-12` with `1 | 3 | 2 | 2 | 2 | 2`
New:     `grid-cols-12` with `1 | 4 | 2 | 2 | 2 | 1`

The Title column gets one more slot (content is the most important), and Date gets reduced since it only shows the date string + chevron icon.

## What Does NOT Change

- Logic: filtering, navigation, expand/collapse, data fetching — unchanged
- Card view structure (only minor sizing tweaks)
- Status badge color system (`getStatusStyles`) — keep as-is, just increase badge size
- API hooks, routing, auth

## Verification

1. Start frontend dev server and navigate to `/hardware-requests`
2. Verify tabs filter the list correctly (ALL / PENDING / PURCHASING / ARRIVED / COMPLETED)
3. Verify search still works
4. Verify row expand still works
5. Verify progress bar renders with visible height
6. Verify status badges are readable without squinting
7. Verify card view still renders correctly
8. Check light mode and dark mode both look correct
