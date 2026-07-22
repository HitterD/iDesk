# Realtime Unread Chat Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 2-way realtime unread chat indicator on ticket list pages (`/tickets/list` and `/tickets/oracle-k2`) that updates instantly via WebSocket without page refresh and automatically disappears when the ticket detail is opened.

**Architecture:** Database-backed timestamp tracking on `Ticket` entity (`lastMessageAt`, `lastMessageSenderRole`, `userLastReadAt`, `agentLastReadAt`) combined with WebSocket broadcast (`NEW_MESSAGE` / `ticket:newMessage`) and React state updates in list pages.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Socket.io, React (TypeScript), TailwindCSS, Lucide React icons.

---

### Task 1: Backend Ticket Entity & Migration Update

**Files:**
- Modify: `apps/backend/src/modules/ticketing/entities/ticket.entity.ts`
- Create: `apps/backend/src/migrations/1784678400000-AddUnreadChatFieldsToTicket.ts`

- [ ] **Step 1: Update `Ticket` Entity with unread chat tracking columns**

Add `lastMessageAt`, `lastMessageSenderRole`, `userLastReadAt`, and `agentLastReadAt` to `apps/backend/src/modules/ticketing/entities/ticket.entity.ts`:

```typescript
    // === Unread Chat Tracking Fields ===

    @Column({ type: 'timestamp', nullable: true })
    lastMessageAt: Date | null;

    @Column({ type: 'varchar', nullable: true })
    lastMessageSenderRole: string | null; // 'USER' | 'AGENT' | 'ADMIN'

    @Column({ type: 'timestamp', nullable: true })
    userLastReadAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    agentLastReadAt: Date | null;
```

- [ ] **Step 2: Create TypeORM migration file**

Create `apps/backend/src/migrations/1784678400000-AddUnreadChatFieldsToTicket.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnreadChatFieldsToTicket1784678400000 implements MigrationInterface {
    name = 'AddUnreadChatFieldsToTicket1784678400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "tickets"
            ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS "lastMessageSenderRole" VARCHAR NULL,
            ADD COLUMN IF NOT EXISTS "userLastReadAt" TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS "agentLastReadAt" TIMESTAMP NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "tickets"
            DROP COLUMN IF EXISTS "lastMessageAt",
            DROP COLUMN IF EXISTS "lastMessageSenderRole",
            DROP COLUMN IF EXISTS "userLastReadAt",
            DROP COLUMN IF EXISTS "agentLastReadAt"
        `);
    }
}
```

- [ ] **Step 3: Run backend build to verify migration and entity compilation**

Run: `npm --prefix apps/backend run build`  
Expected: Build succeeds without TypeScript errors.

- [ ] **Step 4: Commit Task 1**

```bash
git add apps/backend/src/modules/ticketing/entities/ticket.entity.ts apps/backend/src/migrations/1784678400000-AddUnreadChatFieldsToTicket.ts
git commit -m "feat(ticketing): add unread chat tracking fields to Ticket entity and migration"
```

---

### Task 2: Backend Messaging & Query Service Updates

**Files:**
- Modify: `apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts`
- Modify: `apps/backend/src/modules/ticketing/services/ticket-query.service.ts`
- Modify: `apps/backend/src/modules/ticketing/presentation/controllers/ticket.controller.ts`
- Test: `apps/backend/src/modules/ticketing/services/ticket-messaging.service.spec.ts`

- [ ] **Step 1: Write failing test in `ticket-messaging.service.spec.ts`**

Add tests for updating `lastMessageAt`, `lastMessageSenderRole`, and `markAsRead`:

```typescript
describe('markAsRead & replyToTicket unread tracking', () => {
    it('should update lastMessageAt and lastMessageSenderRole on replyToTicket', async () => {
        // Test assertion that ticket's lastMessageAt and lastMessageSenderRole are set
    });

    it('should update agentLastReadAt when agent calls markAsRead', async () => {
        // Test assertion that agentLastReadAt is updated to now
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/backend test -- ticket-messaging.service.spec.ts`  
Expected: FAIL due to `markAsRead` not existing yet.

- [ ] **Step 3: Implement `markAsRead` & update `replyToTicket` in `TicketMessagingService`**

In `TicketMessagingService`:
1. In `replyToTicket`: update `ticket.lastMessageAt = new Date()`, `ticket.lastMessageSenderRole = user.role`. If `isAgentOrAdmin`, update `ticket.agentLastReadAt = new Date()`. If `USER`, update `ticket.userLastReadAt = new Date()`. Save `ticket`.
2. Add `markAsRead`:
```typescript
async markAsRead(ticketId: string, userId: string, role: string): Promise<void> {
    const isAgentOrAdmin = role === 'AGENT' || role === 'ADMIN';
    const updateData = isAgentOrAdmin
        ? { agentLastReadAt: new Date() }
        : { userLastReadAt: new Date() };

    await this.ticketRepo.update(ticketId, updateData);
}
```

In `TicketQueryService` (or mapping function):
Calculate `hasUnreadChat`:
```typescript
const isAgentOrAdmin = currentUserRole === 'AGENT' || currentUserRole === 'ADMIN';
const hasUnreadChat = isAgentOrAdmin
    ? ticket.lastMessageSenderRole === 'USER' && (!ticket.agentLastReadAt || (ticket.lastMessageAt && new Date(ticket.lastMessageAt) > new Date(ticket.agentLastReadAt)))
    : (ticket.lastMessageSenderRole === 'AGENT' || ticket.lastMessageSenderRole === 'ADMIN') && (!ticket.userLastReadAt || (ticket.lastMessageAt && new Date(ticket.lastMessageAt) > new Date(ticket.userLastReadAt)));
```

In `TicketController`:
In `getTicketById` / `GET /tickets/:id`, invoke `this.ticketMessagingService.markAsRead(id, req.user.id, req.user.role)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/backend test -- ticket-messaging.service.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/backend/src/modules/ticketing/services/ticket-messaging.service.ts apps/backend/src/modules/ticketing/services/ticket-query.service.ts apps/backend/src/modules/ticketing/presentation/controllers/ticket.controller.ts apps/backend/src/modules/ticketing/services/ticket-messaging.service.spec.ts
git commit -m "feat(ticketing): implement markAsRead and unread chat calculation in ticket services"
```

---

### Task 3: Frontend `TicketListRow` Unread Badge Rendering

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/components/TicketListRow.tsx`

- [ ] **Step 1: Update `TicketRowData` interface in `TicketListRow.tsx`**

```typescript
export interface TicketRowData {
    // ... existing properties
    hasUnreadChat?: boolean;
    unreadMessageCount?: number;
}
```

- [ ] **Step 2: Add Warm Amber Pill Badge render logic next to ticket title**

Inside `TicketListRow.tsx` right after title `<h3 className="...">...</h3>` or in title row:

```tsx
{ticket.hasUnreadChat && (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 shadow-sm animate-pulse shrink-0">
        <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>Pesan Baru{ticket.unreadMessageCount ? ` (${ticket.unreadMessageCount})` : ''}</span>
    </span>
)}
```

- [ ] **Step 3: Run frontend build check**

Run: `npm --prefix apps/frontend run build`  
Expected: Build succeeds without TypeScript errors.

- [ ] **Step 4: Commit Task 3**

```bash
git add apps/frontend/src/features/ticket-board/components/TicketListRow.tsx
git commit -m "feat(frontend): render warm amber unread chat badge on TicketListRow"
```

---

### Task 4: Realtime Socket Listener in Ticket List Pages

**Files:**
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx`
- Modify: `apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx`

- [ ] **Step 1: Add socket listener in `BentoTicketListPage.tsx`**

Subscribe to `NEW_MESSAGE` and `ticket:newMessage` events. When a message from another user arrives for a ticket in the list:
- Update ticket object: `hasUnreadChat = true`, `unreadMessageCount = (t.unreadMessageCount || 0) + 1`.
- Update state directly without refetching or refreshing page.

- [ ] **Step 2: Add socket listener in `BentoOracleK2TicketsPage.tsx`**

Subscribe to `NEW_MESSAGE` and `ticket:newMessage` events for Oracle tickets in list state.

- [ ] **Step 3: Run frontend build check**

Run: `npm --prefix apps/frontend run build`  
Expected: PASS

- [ ] **Step 4: Commit Task 4**

```bash
git add apps/frontend/src/features/ticket-board/pages/BentoTicketListPage.tsx apps/frontend/src/features/ticket-board/pages/BentoOracleK2TicketsPage.tsx
git commit -m "feat(frontend): add socket listener for realtime unread chat indicator on ticket lists"
```

---

## Plan Self-Review

1. **Spec coverage:** All requirements from design spec covered (DB schema, mark as read, Warm Amber Pill UI, Socket listeners).
2. **Placeholder scan:** No placeholders or TODOs.
3. **Type consistency:** `hasUnreadChat` boolean and `unreadMessageCount` number match across backend & frontend interfaces.
