# User Ticket Portal — Design Spec
**Date:** 2026-04-24  
**Status:** Approved for implementation  
**Approach:** Option A — Refactor to reuse shared components

---

## Context

Sisi user (CLIENT role) menggunakan `ClientTicketDetailPage.tsx` (660 baris) yang merupakan implementasi **terpisah** dari admin/agent. Akibatnya:
- Fitur baru di `TicketChat` (paste screenshot, reply bubble, sticker picker) tidak tersedia untuk user
- Status/priority config diduplikasi inline
- `ImageLightbox` tidak dipakai (ada implementasi inline sendiri)
- Tidak ada SLA countdown display
- Tidak ada typing indicator
- Tidak ada status pipeline visual
- Tidak ada typing auto-resize textarea

Tujuan: Refactor `ClientTicketDetailPage` agar reuse komponen shared (khususnya `TicketChat`), dengan role-based feature gating yang sudah ada, plus improve `BentoMyTicketsPage` dengan real-time notification dan UI yang lebih polished.

---

## Architecture

### Approach: Component Reuse with Permission Props

`TicketChat` sudah memiliki role-check internal:
```typescript
const canAddInternalNote = user?.role === 'ADMIN' || user?.role === 'AGENT';
```
USER role otomatis tidak melihat internal note toggle — tidak perlu perubahan besar.

**Komponen yang akan dipakai ulang di client page:**
- `TicketChat` — full chat dengan paste/reply/sticker, internal notes otomatis tersembunyi untuk USER
- `ImageLightbox` — replace implementasi inline di client page
- `constants.ts` (STATUS_CONFIG, PRIORITY_CONFIG) — replace duplikasi inline

---

## Files to Modify

| File | Action |
|------|--------|
| `apps/frontend/src/features/client/pages/ClientTicketDetailPage.tsx` | **Major refactor** — strip inline chat, use TicketChat + ImageLightbox + shared constants |
| `apps/frontend/src/features/client/pages/BentoMyTicketsPage.tsx` | **Improve** — socket notification, UI polish, stats cards improvement |
| `apps/frontend/src/features/ticket-board/components/ticket-detail/TicketChat.tsx` | **Minor** — add optional `showCannedResponses` prop (default: true) |

---

## ClientTicketDetailPage Refactor Plan

### Layout Structure (new)
```
┌─────────────────────────────────────────────────────┐
│ HEADER: Back + Ticket# + Status badge + Cancel btn  │
│         SLA countdown pill (right side)             │
├──────────────────────────────────┬──────────────────┤
│ STATUS PIPELINE (full width)     │                  │
├──────────────────────────────────┤                  │
│ TICKET INFO CARD                 │ RIGHT PANEL:     │
│ (title, description, timestamps) │ Agent assigned   │
│                                  │ Priority badge   │
│ TICKET CHAT (flex-1)             │ Category         │
│ ← reuse TicketChat component     │ Hardware info    │
│ ← paste/reply/sticker included   │ (read-only)      │
│ ← internal notes hidden for USER │                  │
└──────────────────────────────────┴──────────────────┘
```

### Status Pipeline Component (new)
Visual flow: `TODO → IN_PROGRESS → WAITING_VENDOR → RESOLVED`
- Horizontal step indicator
- Current step highlighted
- Completed steps with checkmark
- CANCELLED shown as terminal red state
- Uses STATUS_CONFIG from constants.ts

### What USER Can Do
- ✅ Reply (text, file, paste screenshot, sticker)
- ✅ Reply to specific message (reply bubble)
- ✅ View all public messages
- ✅ View ticket info (read-only)
- ✅ Cancel ticket (with confirmation dialog)
- ✅ View SLA countdown
- ✅ See assigned agent name
- ✅ See typing indicator ("Agent is typing...")

### What USER Cannot Do (removed/hidden)
- ❌ Internal note toggle (hidden via role check in TicketChat)
- ❌ Canned responses (hidden via `showCannedResponses={false}` prop)
- ❌ Change status / priority / category / device
- ❌ Assign to different agent

### Data Flow
```
ClientTicketDetailPage
├── GET /tickets/${id}         → typed as TicketDetail (from ticket-detail/types.ts)
├── POST /tickets/${id}/reply  → handleSendMessage (same signature as admin)
├── PATCH /tickets/${id}/cancel → cancelMutation
└── useTicketSocket(ticketId)  → isConnected, typingUsers, sendTypingStart/Stop
```

### Key Removals (from current 660-line file)
- Inline STATUS_CONFIG/PRIORITY_CONFIG definitions (replace with import from constants.ts)
- Inline textarea + send button + file upload (~200 lines)
- Inline message rendering loop (~120 lines)
- Inline lightbox implementation (~30 lines)
- Duplicate `Ticket` interface (replace with `TicketDetail` from types.ts)

### SLA Display Logic
Reuse logic from `TicketHeader.tsx`:
- `ticket.slaTarget` → countdown format (Xd Xh Xm remaining)
- Overdue → red pill + AlertTriangle
- <4h → yellow warning
- Resolved/Cancelled → green "Done"
- No SLA → neutral "No SLA"

---

## TicketChat Minor Change

```typescript
// Add optional prop (default true to not break admin)
interface TicketChatProps {
    // ... existing props
    showCannedResponses?: boolean;
}

// In toolbar row:
{showCannedResponses !== false && (
    <CannedResponsePicker ... />
)}
```

---

## BentoMyTicketsPage Improvements

1. **Real-time new ticket notification** — `useTicketListSocket` hook (already used in admin list page) → toast when own ticket gets a reply
2. **Status chips** — add icon + color from STATUS_CONFIG instead of plain text  
3. **Stats cards** — add animation on count change
4. **Empty state** — better illustration + CTA to create ticket
5. **Assigned agent pill** — show agent avatar initial + name in card

---

## UI/UX Design Direction

**Aesthetic:** Clean user portal — warmer than admin, more spacious, friendlier

- **Status pipeline:** Horizontal stepper with connecting lines, smooth `transition-all`
- **SLA pill:** Animated pulse when < 1h remaining
- **Chat bubbles:** Consistent with admin (already styled)
- **Right panel:** Compact info card, read-only badges (not selects)
- **Header:** Softer, no "Save" button complexity — just back + ticket info + SLA + cancel
- **Animations:** `animate-in fade-in slide-in-from-top-4` on page load; stagger info card sections

---

## Verification

1. USER can send message with paste screenshot → see preview → send → optimistic update
2. USER can reply to a message → reply bubble shows → send → quote visible in chat
3. USER can send sticker → sticker appears without bubble
4. Internal note toggle is NOT visible for USER role
5. Canned responses NOT visible for USER  
6. Status pipeline shows correct current step
7. SLA countdown displays and updates
8. Cancel ticket flow works with confirmation
9. `BentoMyTicketsPage` shows toast on new reply to own ticket
10. TypeScript: `npx tsc --noEmit` → zero errors

---

## Implementation Order

1. Add `showCannedResponses` prop to `TicketChat`
2. Refactor `ClientTicketDetailPage`:
   a. New types (use shared TicketDetail)
   b. New layout structure + header
   c. Status pipeline component (inline, ~60 lines)
   d. Right info panel (read-only)
   e. Wire TicketChat + ImageLightbox
3. Improve `BentoMyTicketsPage`
4. TypeScript check
