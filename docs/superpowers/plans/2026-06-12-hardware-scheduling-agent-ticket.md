# Hardware Scheduling to Ticket Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki bug double-scheduling, mengubah skema technicianId menjadi agentId beserta filternya, dan membuat integrasi pembuatan tiket otomatis saat jadwal instalasi dikonfirmasi.

**Architecture:** Modifikasi komponen frontend (DeliveryBoard, ScheduleProposeModal), ganti schema DB & DTO untuk agentId, serta tambahkan listener di backend `ticketing` module yang memanggil TicketService untuk membuat tiket secara otomatis ketika `HardwareEvents.ScheduleConfirmed` ter-trigger.

**Tech Stack:** React, NestJS, TypeORM, Framer Motion

---

### Task 1: Fix Scheduling Bug in Frontend

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/utils/permission.util.ts`
- Modify: `apps/frontend/src/features/hardware-request/components/delivery/DeliveryBoard.tsx`

- [ ] **Step 1: Write the failing test / fix `permission.util.ts`**
Ubah `canProposeSchedule` agar return `false` jika sudah ada jadwal yang masih aktif (belum batal/selesai).

```typescript
export function canProposeSchedule(user: User, req: HardwareRequest): boolean {
  if (user.role !== 'ICT_STAFF') return false;
  if (req.status !== 'AWAITING_DELIVERY' && req.status !== 'INSTALLATION') return false;
  
  // Bug fix: do not propose if already proposed or confirmed (active schedule)
  const scheds = req.schedules || [];
  // Also check if req.installationSchedule is active
  const sched = req.installationSchedule;
  const activeStatuses = ['PROPOSED', 'PROPOSED_AWAITING_USER', 'CONFIRMED', 'IN_PROGRESS', 'RESCHEDULE_REQUESTED'];
  if (sched && activeStatuses.includes(sched.status)) {
    return false;
  }
  
  return req.items.some((i) => i.deliveryStatus === 'ARRIVED');
}
```

- [ ] **Step 2: Update `DeliveryBoard.tsx`**
Pastikan tombol tidak muncul jika `canProposeSchedule` bernilai false.

```typescript
  const canSchedule = canProposeSchedule(user, request);
// ...
      {editable && canSchedule && (
        <div className="mt-6 flex justify-end">
          <Button onClick={onSchedule}>
            Jadwalkan Instalasi {arrivedCount > 0 && `(${arrivedCount} item siap)`}
          </Button>
        </div>
      )}
```

- [ ] **Step 3: Commit**
```bash
git add apps/frontend/src/features/hardware-request/utils/permission.util.ts apps/frontend/src/features/hardware-request/components/delivery/DeliveryBoard.tsx
git commit -m "fix(hardware): prevent double scheduling of hardware installation"
```

---

### Task 2: Rename technicianId to agentId in Frontend

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/types/index.ts`
- Modify: `apps/frontend/src/features/hardware-request/components/scheduling/ScheduleProposeModal.tsx`
- Rename & Modify: `apps/frontend/src/features/hardware-request/components/calendar/TechnicianFilter.tsx` -> `AgentFilter.tsx`

- [ ] **Step 1: Rename file and update imports**
Ganti nama `TechnicianFilter.tsx` menjadi `AgentFilter.tsx`. Update export/import di mana saja ia digunakan.

- [ ] **Step 2: Update Types**
Di `apps/frontend/src/features/hardware-request/types/index.ts`:
Ganti `technicianId: string;` menjadi `agentId: string;` di `InstallationSchedule` dan `ScheduleProposeInput`. Ganti `technician?: UserLite;` menjadi `agent?: UserLite;`.

- [ ] **Step 3: Update `AgentFilter.tsx`**
Sesuaikan props `siteId` dan panggil endpoint `/users/agents?siteId=${siteId}`:
```tsx
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

type Props = { siteId?: string; selectedIds: string[]; onChange: (ids: string[]) => void };

export function AgentFilter({ siteId, selectedIds, onChange }: Props) {
  const { data: agents = [] } = useQuery({
    queryKey: ['users', 'agents', siteId],
    queryFn: async () => {
      const { data } = await api.get(`/users/agents${siteId ? `?siteId=${siteId}` : ''}`);
      return data.data;
    },
    staleTime: 5 * 60_000,
  });
  // ... rest of logic uses agents instead of technicians
```

- [ ] **Step 4: Update `ScheduleProposeModal.tsx`**
Ubah state `technicianId` menjadi `agentId`, dan tampilkan `<AgentFilter siteId={request.siteId} ... />`. Ubah teks "Teknisi" menjadi "Agent".

- [ ] **Step 5: Commit**
```bash
git add apps/frontend/src/features/hardware-request/
git commit -m "refactor(hardware-ui): rename technician to agent and filter by site"
```

---

### Task 3: Rename technicianId to agentId in Backend

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/domain/entities/installation-schedule.entity.ts`
- Modify: `apps/backend/src/modules/hardware-request/dto/schedule-propose.dto.ts`
- Modify: `apps/backend/src/modules/hardware-request/services/mutual-scheduling.service.ts`
- Modify: `apps/backend/src/modules/hardware-request/domain/events/hardware-request.events.ts`

- [ ] **Step 1: Update Entity & DTO**
Di `installation-schedule.entity.ts`, ganti column `technicianId` menjadi `agentId` dan relation-nya:
```typescript
  @Column({ name: 'agent_id' })
  agentId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'agent_id' })
  agent: User;
```

Di `schedule-propose.dto.ts`:
```typescript
  @IsString()
  @IsNotEmpty()
  agentId: string;
```

- [ ] **Step 2: Update Events**
Di `hardware-request.events.ts`:
Ganti field `technicianId` menjadi `agentId` pada semua interface event (`ScheduleProposedPayload`, `ScheduleConfirmedPayload`, dll).

- [ ] **Step 3: Update `mutual-scheduling.service.ts`**
Ubah logic yang menggunakan `technicianId` menjadi `agentId` (misal di pembuatan schedule, dan saat event payload).

- [ ] **Step 4: Commit**
```bash
git add apps/backend/src/modules/hardware-request/
git commit -m "refactor(hardware-api): update db schema and logic from technicianId to agentId"
```

---

### Task 4: Ticket Creation Event Listener

**Files:**
- Create: `apps/backend/src/modules/ticketing/listeners/hardware-schedule.listener.ts`
- Modify: `apps/backend/src/modules/ticketing/ticketing.module.ts` (Register listener)

- [ ] **Step 1: Create Listener**
Buat file listener yang bereaksi terhadap `HardwareEvents.ScheduleConfirmed`.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HardwareEvents, ScheduleConfirmedPayload } from '../../hardware-request/domain/events/hardware-request.events';
import { TicketingService } from '../ticketing.service';
import { TicketSource, TicketPriority } from '../enums/ticket.enum';

@Injectable()
export class HardwareScheduleListener {
  private readonly logger = new Logger(HardwareScheduleListener.name);

  constructor(private readonly ticketingService: TicketingService) {}

  @OnEvent(HardwareEvents.ScheduleConfirmed)
  async handleScheduleConfirmed(payload: ScheduleConfirmedPayload) {
    this.logger.log(`Creating ticket for confirmed hardware schedule: ${payload.scheduleId}`);
    try {
      // Create ticket for the agent
      await this.ticketingService.createTicket(
        {
          title: `Hardware Installation: HR-${payload.requestId.slice(-6)}`,
          description: `Jadwal instalasi hardware telah dikonfirmasi oleh user. Silakan proses instalasi pada ${payload.scheduledStart.toISOString()}`,
          categoryId: 'your_hardware_installation_category_id', // Note: Needs proper lookup or standard category id
          priority: TicketPriority.HARDWARE_INSTALLATION,
          source: TicketSource.WEB,
          assignedToId: payload.agentId,
        },
        'SYSTEM', // actor
      );
    } catch (err) {
      this.logger.error(`Failed to create ticket for schedule ${payload.scheduleId}`, err);
    }
  }
}
```

- [ ] **Step 2: Register Listener**
Masukkan `HardwareScheduleListener` ke array `providers` di dalam `TicketingModule`.

- [ ] **Step 3: Commit**
```bash
git add apps/backend/src/modules/ticketing/
git commit -m "feat(ticketing): auto create ticket on hardware schedule confirmed"
```
