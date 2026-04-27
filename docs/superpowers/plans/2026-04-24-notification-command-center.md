# Notification Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a hybrid Action Command Center that pulls directly from entity states and adds configurable persistent reminders for urgent items.

**Architecture:** 
- New `getActionItems` API endpoint in backend pulling from ticket, hardware, eform, and renewal tables.
- New `ActionCommandCenter` dropdown in frontend topbar.
- New `reminderIntensity` in `notification_preferences`.
- Existing notification system remains unchanged.

**Tech Stack:** NestJS, TypeORM, React, Tailwind CSS, React Query

---

### Task 1: Add ActionItem Schema & Type Definitions

**Files:**
- Create: `apps/backend/src/modules/notifications/dto/action-item.dto.ts`
- Modify: `apps/frontend/src/components/notifications/types/action-item.types.ts` (Create if not exists)

- [ ] **Step 1: Create Backend DTO**

```typescript
// apps/backend/src/modules/notifications/dto/action-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export enum ActionItemUrgency {
    CRITICAL = 'CRITICAL',
    HIGH = 'HIGH',
    NORMAL = 'NORMAL',
}

export enum ActionItemEntityType {
    TICKET = 'TICKET',
    HARDWARE_REQUEST = 'HARDWARE_REQUEST',
    EFORM = 'EFORM',
    RENEWAL = 'RENEWAL',
}

export class ActionItemDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ enum: ActionItemEntityType })
    entityType: ActionItemEntityType;

    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;

    @ApiProperty({ enum: ActionItemUrgency })
    urgency: ActionItemUrgency;

    @ApiProperty()
    entityId: string;

    @ApiProperty()
    link: string;

    @ApiProperty()
    createdAt: Date;
}

export class ActionItemsResponseDto {
    @ApiProperty({ type: [ActionItemDto] })
    items: ActionItemDto[];

    @ApiProperty()
    counts: {
        critical: number;
        high: number;
        normal: number;
        total: number;
    };
}
```

- [ ] **Step 2: Create Frontend Types**

```typescript
// apps/frontend/src/components/notifications/types/action-item.types.ts
export type ActionItemUrgency = 'CRITICAL' | 'HIGH' | 'NORMAL';
export type ActionItemEntityType = 'TICKET' | 'HARDWARE_REQUEST' | 'EFORM' | 'RENEWAL';

export interface ActionItem {
    id: string;
    entityType: ActionItemEntityType;
    title: string;
    description: string;
    urgency: ActionItemUrgency;
    entityId: string;
    link: string;
    createdAt: string;
}

export interface ActionItemsResponse {
    items: ActionItem[];
    counts: {
        critical: number;
        high: number;
        normal: number;
        total: number;
    };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/notifications/dto/action-item.dto.ts apps/frontend/src/components/notifications/types/action-item.types.ts
git commit -m "feat(notifications): add action item DTO and types"
```

### Task 2: Implement `getActionItems` in Service

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts`

- [ ] **Step 1: Add EntityManager to NotificationCenterService**

Modify `apps/backend/src/modules/notifications/notification-center.service.ts` to add `EntityManager` injection.

```typescript
// Add these imports at the top
import { EntityManager } from 'typeorm';
import { ActionItemDto, ActionItemUrgency, ActionItemEntityType } from './dto/action-item.dto';

// In constructor add:
constructor(
    // ... existing injects
    private readonly entityManager: EntityManager,
) { }
```

- [ ] **Step 2: Implement `getActionItems` method**

```typescript
// Add to NotificationCenterService class
    async getActionItems(userId: string, role: string): Promise<any> {
        const items: ActionItemDto[] = [];
        let critical = 0;
        let high = 0;
        let normal = 0;

        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const next1Day = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // 1. Tickets
        // SLA breach (Agent/Admin)
        if (role === 'AGENT' || role === 'ADMIN') {
            const slaBreachedTickets = await this.entityManager.query(
                `SELECT id, "ticketNumber", title, "createdAt", "updatedAt" FROM tickets WHERE "assigneeId" = $1 AND status != 'RESOLVED' AND "slaTarget" < $2`,
                [userId, now]
            );
            for (const t of slaBreachedTickets) {
                items.push({
                    id: `tkt-sla-${t.id}`, entityType: ActionItemEntityType.TICKET, title: `SLA Breached: ${t.ticketNumber}`,
                    description: t.title, urgency: ActionItemUrgency.CRITICAL, entityId: t.id, link: `/tickets/${t.id}`, createdAt: t.updatedAt
                });
                critical++;
            }

            // Unresponded
            const unrespondedTickets = await this.entityManager.query(
                `SELECT id, "ticketNumber", title, "createdAt" FROM tickets WHERE "assigneeId" = $1 AND status = 'TODO' AND "createdAt" < $2`,
                [userId, oneHourAgo]
            );
            for (const t of unrespondedTickets) {
                items.push({
                    id: `tkt-unresp-${t.id}`, entityType: ActionItemEntityType.TICKET, title: `Unresponded: ${t.ticketNumber}`,
                    description: t.title, urgency: ActionItemUrgency.HIGH, entityId: t.id, link: `/tickets/${t.id}`, createdAt: t.createdAt
                });
                high++;
            }
        }

        if (role === 'USER') {
            const waitingUserTickets = await this.entityManager.query(
                `SELECT id, "ticketNumber", title, "updatedAt" FROM tickets WHERE "userId" = $1 AND status = 'WAITING_USER'`,
                [userId]
            );
            for (const t of waitingUserTickets) {
                items.push({
                    id: `tkt-wait-${t.id}`, entityType: ActionItemEntityType.TICKET, title: `Action Required: ${t.ticketNumber}`,
                    description: t.title, urgency: ActionItemUrgency.HIGH, entityId: t.id, link: `/client/tickets/${t.id}`, createdAt: t.updatedAt
                });
                high++;
            }

            const resolvedTickets = await this.entityManager.query(
                `SELECT id, "ticketNumber", title, "updatedAt" FROM tickets WHERE "userId" = $1 AND status = 'RESOLVED'`,
                [userId]
            );
            for (const t of resolvedTickets) {
                items.push({
                    id: `tkt-res-${t.id}`, entityType: ActionItemEntityType.TICKET, title: `Ticket Resolved: ${t.ticketNumber}`,
                    description: 'Please confirm resolution', urgency: ActionItemUrgency.NORMAL, entityId: t.id, link: `/client/tickets/${t.id}`, createdAt: t.updatedAt
                });
                normal++;
            }
        }

        if (role === 'ADMIN' || role === 'MANAGER') {
            // Hardware
            const pendingHw = await this.entityManager.query(
                `SELECT id, "requestNumber", status, "createdAt" FROM hardware_requests WHERE status IN ('SUBMITTED', 'UNDER_REVIEW')`
            );
            for (const hw of pendingHw) {
                items.push({
                    id: `hw-${hw.id}`, entityType: ActionItemEntityType.HARDWARE_REQUEST, title: `Hardware Approval Pending`,
                    description: `Request ${hw.requestNumber}`, urgency: ActionItemUrgency.HIGH, entityId: hw.id, link: `/hardware-requests/${hw.id}`, createdAt: hw.createdAt
                });
                high++;
            }

            // Eform
            const pendingEform = await this.entityManager.query(
                `SELECT id, "requestNumber", "createdAt" FROM eform_requests WHERE "currentApproverId" = $1 AND status LIKE 'PENDING_%'`,
                [userId]
            );
            for (const ef of pendingEform) {
                items.push({
                    id: `ef-${ef.id}`, entityType: ActionItemEntityType.EFORM, title: `E-Form Approval Pending`,
                    description: `Request ${ef.requestNumber}`, urgency: ActionItemUrgency.HIGH, entityId: ef.id, link: `/eform/requests/${ef.id}`, createdAt: ef.createdAt
                });
                high++;
            }

            // Renewals
            try {
                const renewals = await this.entityManager.query(
                    `SELECT id, "title", "endDate", "status" FROM renewal_contracts WHERE "status" != 'EXPIRED' AND "endDate" < $1`,
                    [next7Days]
                );
                for (const r of renewals) {
                    const isCritical = new Date(r.endDate) < next1Day;
                    items.push({
                        id: `ren-${r.id}`, entityType: ActionItemEntityType.RENEWAL, title: isCritical ? `Renewal Critical` : `Renewal Expiring Soon`,
                        description: r.title, urgency: isCritical ? ActionItemUrgency.CRITICAL : ActionItemUrgency.HIGH, entityId: r.id, link: `/renewals/${r.id}`, createdAt: new Date()
                    });
                    if (isCritical) critical++; else high++;
                }
            } catch (e) {
                this.logger.warn('Renewal query failed', e);
            }
        }

        return {
            items: items.sort((a, b) => {
                const urgencyWeight = { 'CRITICAL': 3, 'HIGH': 2, 'NORMAL': 1 };
                if (urgencyWeight[b.urgency] !== urgencyWeight[a.urgency]) {
                    return urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
                }
                return b.createdAt.getTime() - a.createdAt.getTime();
            }),
            counts: { critical, high, normal, total: critical + high + normal }
        };
    }
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/notifications/notification-center.service.ts
git commit -m "feat(notifications): add getActionItems to service"
```

### Task 3: Setup Backend Endpoint & Preferences

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification.controller.ts`
- Modify: `apps/backend/src/modules/notifications/entities/notification-preference.entity.ts`

- [ ] **Step 1: Add Controller Endpoint**

```typescript
// In apps/backend/src/modules/notifications/notification.controller.ts
// Add import for NotificationCenterService if not present, and ActionItemsResponseDto
import { NotificationCenterService } from './notification-center.service';

// Inside NotificationController:
    @Get('action-items')
    @ApiOperation({ summary: 'Get current action items for the user based on their role' })
    @ApiResponse({ status: 200, description: 'Return action items.' })
    async getActionItems(@Request() req: any) {
        return this.notificationCenterService.getActionItems(req.user.userId, req.user.role);
    }
```
*(Note: You will also need to inject `NotificationCenterService` in the constructor of `NotificationController` if it's not already there).*

- [ ] **Step 2: Update Preferences Entity**

```typescript
// In apps/backend/src/modules/notifications/entities/notification-preference.entity.ts
export enum ReminderIntensity {
    OFF = 'OFF',
    GENTLE = 'GENTLE',
    MODERATE = 'MODERATE',
    ASSERTIVE = 'ASSERTIVE',
}

// Add these columns inside NotificationPreference class:
    @Column({
        type: 'enum',
        enum: ReminderIntensity,
        default: ReminderIntensity.MODERATE,
    })
    reminderIntensity: ReminderIntensity;
```

- [ ] **Step 3: Generate and Run Migration**

```bash
npm run typeorm:generate -- -n AddReminderIntensity
npm run typeorm:run
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/notifications/notification.controller.ts apps/backend/src/modules/notifications/entities/notification-preference.entity.ts apps/backend/src/migrations/
git commit -m "feat(notifications): add action-items endpoint and reminder preferences"
```

### Task 4: Frontend Hook `useActionItems`

**Files:**
- Create: `apps/frontend/src/features/notifications/hooks/useActionItems.ts`

- [ ] **Step 1: Create Hook**

```typescript
// apps/frontend/src/features/notifications/hooks/useActionItems.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import api from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/stores/useAuth';
import { ActionItemsResponse } from '../../../components/notifications/types/action-item.types';

export const useActionItems = () => {
    const { user } = useAuth();
    const { socket } = useSocket();
    const queryClient = useQueryClient();

    const { data, isLoading, error, refetch } = useQuery<ActionItemsResponse>({
        queryKey: ['action-items'],
        queryFn: async () => {
            const res = await api.get('/notifications/action-items');
            return res.data;
        },
        enabled: !!user,
        refetchInterval: 60000, // Poll every 60s as per spec
    });

    // Invalidate on socket events
    useEffect(() => {
        if (!socket || !user) return;

        const handleSocketEvent = () => {
            queryClient.invalidateQueries({ queryKey: ['action-items'] });
        };

        socket.on(`notification:${user.id}`, handleSocketEvent);
        socket.on(`notification:acknowledged:${user.id}`, handleSocketEvent);
        // Assuming other entity updates might trigger these or similar events

        return () => {
            socket.off(`notification:${user.id}`, handleSocketEvent);
            socket.off(`notification:acknowledged:${user.id}`, handleSocketEvent);
        };
    }, [socket, user, queryClient]);

    return {
        items: data?.items || [],
        counts: data?.counts || { critical: 0, high: 0, normal: 0, total: 0 },
        isLoading,
        error,
        refetch
    };
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/notifications/hooks/useActionItems.ts
git commit -m "feat(notifications): add useActionItems hook"
```

### Task 5: Frontend Component `ActionCommandCenter`

**Files:**
- Create: `apps/frontend/src/components/notifications/ActionCommandCenter.tsx`

- [ ] **Step 1: Create UI Component**

```tsx
// apps/frontend/src/components/notifications/ActionCommandCenter.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, ChevronRight, Loader2, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActionItems } from '../../features/notifications/hooks/useActionItems';
import { ActionItemUrgency } from './types/action-item.types';

export const ActionCommandCenter = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { items, counts, isLoading } = useActionItems();
    const navigate = useNavigate();

    const getUrgencyColor = (urgency: ActionItemUrgency) => {
        switch (urgency) {
            case 'CRITICAL': return 'bg-red-500';
            case 'HIGH': return 'bg-amber-500';
            case 'NORMAL': return 'bg-blue-500';
            default: return 'bg-slate-500';
        }
    };

    const handleItemClick = (link: string) => {
        setIsOpen(false);
        navigate(link);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
                <CheckSquare className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:block">Actions</span>
                {counts.total > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        {counts.critical > 0 && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-4 w-4 items-center justify-center text-[10px] font-bold text-white ${counts.critical > 0 ? 'bg-red-500' : 'bg-amber-500'}`}>
                            {counts.total > 9 ? '9+' : counts.total}
                        </span>
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#060c14] border border-[#1e3a5f] rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col"
                        >
                            <div className="p-4 border-b border-[#1e3a5f] bg-[#0d1a2b] flex justify-between items-center">
                                <h3 className="font-bold text-white tracking-tight">Action Items</h3>
                                <div className="flex gap-2">
                                    {counts.critical > 0 && <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">{counts.critical} CRIT</span>}
                                    {counts.high > 0 && <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">{counts.high} HIGH</span>}
                                </div>
                            </div>

                            <div className="max-h-[60vh] overflow-y-auto scrollbar-custom p-2">
                                {isLoading ? (
                                    <div className="flex items-center justify-center p-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                    </div>
                                ) : items.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">
                                        <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-sm">All caught up!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {items.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => handleItemClick(item.link)}
                                                className="w-full text-left p-3 rounded-xl hover:bg-[#1e3a5f]/30 transition-colors group flex gap-3 items-start"
                                            >
                                                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${getUrgencyColor(item.urgency)}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">{item.title}</p>
                                                    <p className="text-xs text-slate-400 truncate mt-0.5">{item.description}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-2 border-t border-[#1e3a5f] bg-[#0d1a2b] flex justify-between">
                                <button 
                                    onClick={() => { setIsOpen(false); navigate('/settings/notifications'); }}
                                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                                    title="Reminder Settings"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                                {/* Future: Mark all done logic if applicable, though items resolve automatically */}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/notifications/ActionCommandCenter.tsx
git commit -m "feat(notifications): add ActionCommandCenter UI component"
```

### Task 6: Frontend Integration & Reminder Engine

**Files:**
- Create: `apps/frontend/src/features/notifications/hooks/useReminderEngine.ts`
- Modify: `apps/frontend/src/components/layout/BentoTopbar.tsx`
- Modify: `apps/frontend/src/components/layout/Topbar.tsx`
- Modify: `apps/frontend/src/components/layout/ClientLayout.tsx`

- [ ] **Step 1: Create Reminder Engine Hook**

```typescript
// apps/frontend/src/features/notifications/hooks/useReminderEngine.ts
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useActionItems } from './useActionItems';
import api from '@/lib/api';

export const useReminderEngine = () => {
    const { items, counts } = useActionItems();
    const lastReminderTime = useRef<number>(Date.now());

    useEffect(() => {
        if (counts.critical === 0 && counts.high === 0) return;

        const checkReminders = async () => {
            try {
                // Fetch user preferences for reminder intensity
                const prefRes = await api.get('/notifications/preferences');
                const intensity = prefRes.data?.reminderIntensity || 'MODERATE';
                
                let intervalMs = 0;
                if (intensity === 'GENTLE') intervalMs = 60 * 60 * 1000;
                else if (intensity === 'MODERATE') intervalMs = 30 * 60 * 1000;
                else if (intensity === 'ASSERTIVE') intervalMs = 15 * 60 * 1000;

                if (intervalMs === 0) return; // OFF

                const now = Date.now();
                if (now - lastReminderTime.current >= intervalMs) {
                    // Trigger reminder
                    toast.error(`You have ${counts.critical + counts.high} pending action items!`, {
                        description: 'Please check your Action Command Center.',
                        duration: 10000,
                    });
                    lastReminderTime.current = now;
                }
            } catch (e) {
                console.error("Failed to check reminder preferences", e);
            }
        };

        const intervalId = setInterval(checkReminders, 60000); // Check every minute
        return () => clearInterval(intervalId);
    }, [counts.critical, counts.high]);
};
```

- [ ] **Step 2: Add ActionCommandCenter to Topbars**

In `BentoTopbar.tsx`, `Topbar.tsx`, and `ClientLayout.tsx`, find `<NotificationPopover />` and add `<ActionCommandCenter />` right beside it. Don't forget to import it.

```tsx
// Example modification for Topbar.tsx (and similarly for BentoTopbar/ClientLayout)
import { ActionCommandCenter } from '../notifications/ActionCommandCenter';

// Then in the render:
<div className="flex items-center gap-4">
    <ActionCommandCenter />
    <NotificationPopover />
    {/* ... */}
</div>
```

- [ ] **Step 3: Call Reminder Engine**

In `apps/frontend/src/App.tsx` or a global layout wrapper, import and call `useReminderEngine()`.

```tsx
import { useReminderEngine } from '@/features/notifications/hooks/useReminderEngine';

// Inside a global component like App or Layout that sits inside providers:
useReminderEngine();
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/notifications/hooks/useReminderEngine.ts apps/frontend/src/components/layout/
git commit -m "feat(notifications): integrate ActionCommandCenter and ReminderEngine"
```

### Task 7: Notification Settings Update

**Files:**
- Modify: `apps/frontend/src/features/settings/components/NotificationSettings.tsx`

- [ ] **Step 1: Add Reminder Intensity Settings UI**

Modify `NotificationSettings.tsx` to include the reminder settings UI.

```tsx
// Find where preferences are handled, ensure reminderIntensity is in the type/state.
// Add this new section in the JSX layout:

<div className="p-6 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))]">
    <div className="flex items-center justify-between mb-4">
        <div>
            <h3 className="text-lg font-medium text-[hsl(var(--foreground))] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                Action Reminders
            </h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                How often should we remind you about pending Critical and High action items?
            </p>
        </div>
    </div>

    <div className="flex flex-wrap gap-3 mt-4">
        {['OFF', 'GENTLE', 'MODERATE', 'ASSERTIVE'].map((intensity) => (
            <button
                key={intensity}
                onClick={() => updatePreferenceMutation.mutate({ reminderIntensity: intensity })}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    preferences?.reminderIntensity === intensity 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/80'
                }`}
            >
                {intensity === 'OFF' && 'Off'}
                {intensity === 'GENTLE' && 'Gentle (1h)'}
                {intensity === 'MODERATE' && 'Moderate (30m)'}
                {intensity === 'ASSERTIVE' && 'Assertive (15m)'}
            </button>
        ))}
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/settings/components/NotificationSettings.tsx
git commit -m "feat(notifications): add reminder intensity to settings UI"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-04-24-notification-command-center.md`. 

Two execution options:
1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
