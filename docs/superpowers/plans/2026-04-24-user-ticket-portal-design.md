# Plan: User Ticket Portal Upgrade

## Context
`ClientTicketDetailPage.tsx` (660 baris) adalah implementasi terpisah dari admin — tidak reuse `TicketChat`, sehingga fitur paste screenshot / reply bubble / sticker picker tidak tersedia untuk user. Juga terdapat duplikasi STATUS_CONFIG, inline lightbox, dan tipe `Ticket` sendiri. Tujuan: refactor reuse komponen shared dengan user-appropriate feature gates.

Spec lengkap: `D:\iDesk-main\docs\superpowers\specs\2026-04-24-user-ticket-portal-design.md`

---

## Step 1 — Minor: Add `showCannedResponses` prop to TicketChat

**File:** `apps/frontend/src/features/ticket-board/components/ticket-detail/TicketChat.tsx`

- Add optional `showCannedResponses?: boolean` to `TicketChatProps` interface
- Wrap `<CannedResponsePicker>` in `{showCannedResponses !== false && (...)}`
- Default true → no breaking change for admin

---

## Step 2 — Major: Refactor `ClientTicketDetailPage.tsx`

**File:** `apps/frontend/src/features/client/pages/ClientTicketDetailPage.tsx`

### 2a. Imports & Types
- Remove duplicate `Ticket` interface → import `TicketDetail` from `../../ticket-board/components/ticket-detail/types`
- Remove inline STATUS_CONFIG/PRIORITY_CONFIG → import from `../../ticket-board/components/ticket-detail/constants`
- Add imports: `TicketChat`, `ImageLightbox`, `ConfirmationDialog`, `Loader2`
- Keep: `useTicketSocket`, `useAuth`, react-query hooks

### 2b. New Header Component (inline ~50 lines)
Replaces current header. Shows:
- Back button → navigate to `/client/tickets`
- `#{ticketNumber}` pill
- Status badge (from STATUS_CONFIG)
- SLA countdown pill (logic from `TicketHeader.tsx:55-91` — copy the `formatTimeRemaining` + effect)
- "Cancel Ticket" button (only if not RESOLVED/CANCELLED, triggers ConfirmationDialog)

### 2c. Status Pipeline Component (inline ~60 lines)
New `UserStatusPipeline` component:
```
Steps: TODO → IN_PROGRESS → WAITING_VENDOR → RESOLVED
```
- Horizontal stepper, current step highlighted with primary color ring
- Completed steps: checkmark icon + muted color
- CANCELLED: show red terminal badge instead of pipeline
- Uses STATUS_CONFIG icons/labels

### 2d. Right Info Panel (inline ~80 lines)
Read-only panel replacing admin TicketSidebar:
- Assigned agent: avatar initial + fullName (or "Unassigned")
- Priority badge (color from PRIORITY_CONFIG)
- Category chip
- Hardware installation info (scheduledDate/Time/hardwareType) — keep existing logic

### 2e. Wire TicketChat
Replace entire inline chat (textarea + messages render + file upload, ~320 lines) with:
```tsx
<TicketChat
    ticket={ticket}               // typed as TicketDetail
    isConnected={isConnected}
    onSendMessage={handleSendMessage}
    onImageClick={setLightboxImage}
    typingUsers={typingUsers}
    onTypingStart={() => sendTypingStart({ fullName: currentUser.fullName })}
    onTypingStop={sendTypingStop}
    showCannedResponses={false}
/>
```
- `handleSendMessage` signature must match `(content: string, files?: FileList | null, isInternal?: boolean) => Promise<void>`
- Keep existing optimistic update logic

### 2f. Wire ImageLightbox
```tsx
{lightboxImage && (
    <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
)}
```
Remove inline lightbox JSX (~30 lines at bottom of file)

### 2g. Layout Structure
```tsx
<div className="flex flex-col h-full">
    <UserTicketHeader ... />              {/* new */}
    <UserStatusPipeline ... />            {/* new, full width */}
    <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
            <TicketInfoCard ticket={ticket} />  {/* reuse existing */}
            <TicketChat ... />                  {/* reuse */}
        </div>
        <div className="w-56 border-l ...">
            <UserInfoPanel ticket={ticket} />   {/* new read-only panel */}
        </div>
    </div>
    <ImageLightbox ... />
</div>
```

### cancelMutation
Keep existing `PATCH /tickets/${id}/cancel` logic — wire to ConfirmationDialog (import from `@/components/ui/ConfirmationDialog`).

---

## Step 3 — Improve `BentoMyTicketsPage.tsx`

**File:** `apps/frontend/src/features/client/pages/BentoMyTicketsPage.tsx`

- Import `useTicketListSocket` from `@/hooks/useTicketSocket`
- Add `handleNewReply` callback: when socket fires `ticket:newMessage` on a ticket the user owns → `toast.info('New reply on ticket #X', { action: { label: 'View', onClick: () => navigate(...) } })`
- Status chips: add icon from STATUS_CONFIG + color class instead of plain text badge
- Empty state: replace plain text with centered illustration + "Create your first ticket" button
- Live indicator: green dot + "Live" when socket connected

---

## Step 4 — Verification

```bash
cd apps/frontend && tsc --noEmit   # zero errors
```

Manual tests:
1. User can paste screenshot → preview → send
2. User can reply to message → reply bubble → quote in chat
3. User can send sticker
4. Internal note toggle NOT visible (USER role)
5. Canned responses NOT visible (showCannedResponses=false)
6. Status pipeline shows correct step
7. SLA countdown renders
8. Cancel ticket → ConfirmationDialog → PATCH → success toast
9. BentoMyTicketsPage shows toast on new reply

---

## Critical File Paths

| File | Role |
|------|------|
| `apps/frontend/src/features/client/pages/ClientTicketDetailPage.tsx` | Main target — full refactor |
| `apps/frontend/src/features/client/pages/BentoMyTicketsPage.tsx` | Minor improvements |
| `apps/frontend/src/features/ticket-board/components/ticket-detail/TicketChat.tsx` | Add `showCannedResponses` prop |
| `apps/frontend/src/features/ticket-board/components/ticket-detail/types.ts` | TicketDetail type (reuse) |
| `apps/frontend/src/features/ticket-board/components/ticket-detail/constants.ts` | STATUS_CONFIG, PRIORITY_CONFIG (reuse) |
| `apps/frontend/src/features/ticket-board/components/ticket-detail/ImageLightbox.tsx` | Reuse in client page |
| `apps/frontend/src/features/ticket-board/components/ticket-detail/TicketInfoCard.tsx` | Reuse in client page |
| `apps/frontend/src/features/ticket-board/components/ticket-detail/TicketHeader.tsx` | Reference for SLA logic |
| `apps/frontend/src/components/ui/ConfirmationDialog.tsx` | Reuse for cancel confirmation |
| `apps/frontend/src/hooks/useTicketSocket.ts` | useTicketListSocket for BentoMyTickets |
