# Design: Hardware Request — Awaiting User Confirmation UX Fix

**Date:** 2026-05-07  
**Status:** Approved  
**Scope:** Frontend only — `hardware-request` feature

---

## Problem

When ICT staff marks installation complete, request moves to `AWAITING_USER_CONFIRMATION`. Three bugs exist:

1. **MiniPipeline misleads** — bar index 6 (AWAITING_USER_CONFIRMATION) is filled solid like a "done" step, making 7/8 bars appear filled → visually looks "almost completed" automatically
2. **No CTA in list/card view** — requester sees the status badge but has no prompt to take action; must know to navigate to detail page on their own
3. **Confirmation buttons exist only in detail page** — `ActionPanel.tsx:39-40` has correct buttons, but invisible from list

---

## Solution: Option A — Minimal Fix

### Change 1: Fix MiniPipeline visual (`RequestCard.tsx`)

**File:** `apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx`

Replace current logic:
```ts
const done = !terminalBad && i <= idx;
```

With three-state logic:
- `i < idx` → solid filled bar (step done)
- `i === idx && current === 'AWAITING_USER_CONFIRMATION'` → pulsing animated bar (pending user action)
- otherwise → grey (not yet reached)

Visual result:
```
[■][■][■][■][■][■][~~pending~~][  ]
 SUBMITTED ... INSTALLATION  AUC   COMPLETED
```

### Change 2: Action-Required Banner in `RequestCard`

**File:** `apps/frontend/src/features/hardware-request/components/list/RequestCard.tsx`

Condition: `r.status === 'AWAITING_USER_CONFIRMATION' && r.requesterId === userId`

Show a banner inside the card (above MiniPipeline):
- Attention color: cyan with left icon (e.g. `ClipboardCheck` or `AlertCircle`)
- Text: "Konfirmasi instalasi diperlukan"
- Full-width, clickable (the card's Link already wraps it)
- Only renders for the requester — check via `useHardwareRole().userId`

### Change 3: Action-Required Strip in `RequestRowDrawer`

**File:** `apps/frontend/src/features/hardware-request/components/list/RequestRowDrawer.tsx`

Same condition as Change 2. Add a highlighted strip at the top of the drawer content:
- Compact alert strip with link text "Buka detail untuk konfirmasi"
- Color: cyan/amber border

---

## Data Flow

No API or backend changes. Frontend-only reads:
- `r.status` — already in list query response
- `r.requesterId` — already in list query response  
- `userId` from `useHardwareRole()` (reads from auth store)

---

## Out of Scope

- Push notifications / email alerts
- Inline confirmation in list (no modal in list view)
- Dashboard "Aksi Diperlukan" section
- Backend changes

---

## Files to Modify

| File | Change |
|------|--------|
| `components/list/RequestCard.tsx` | MiniPipeline fix + banner |
| `components/list/RequestRowDrawer.tsx` | Alert strip |
