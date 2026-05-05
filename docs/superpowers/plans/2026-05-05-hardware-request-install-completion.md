# Hardware Request Install Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework alur penyelesaian instalasi sehingga setelah ICT mark "Selesai", user harus konfirmasi (atau auto-confirm setelah 24 jam) sebelum request jadi COMPLETED — tanpa barcode wajib.

**Architecture:** Tambah state `AWAITING_USER_CONFIRMATION` di state machine. ICT klik selesai → request ke status baru → notif ke user → user konfirmasi atau cron 24 jam auto-confirm → COMPLETED. Single source of truth: status hanya diubah di `hardware-request-command.service`. Schedule service hanya urus schedule entity.

**Tech Stack:** NestJS (TypeORM, EventEmitter2, @nestjs/schedule), React (TanStack Query, sonner toast), PostgreSQL.

---

## File Map

**Backend — Create:**
- `apps/backend/src/migrations/1777500000000-AddInstallUserConfirmation.ts` — kolom baru + enum value
- `apps/backend/src/modules/hardware-request/listeners/install-auto-confirm.cron.ts` — cron 5 menit auto-confirm
- `apps/backend/src/modules/hardware-request/listeners/install-auto-confirm.cron.spec.ts` — unit test cron

**Backend — Modify:**
- `apps/backend/src/modules/hardware-request/domain/enums/request-status.enum.ts` — tambah AWAITING_USER_CONFIRMATION
- `apps/backend/src/modules/hardware-request/domain/state-machine/request-state.ts` — transisi baru
- `apps/backend/src/modules/hardware-request/domain/state-machine/__tests__/request-state.spec.ts` — test transisi baru
- `apps/backend/src/modules/hardware-request/domain/entities/hardware-request.entity.ts` — 3 kolom baru
- `apps/backend/src/modules/hardware-request/domain/enums/activity-action.enum.ts` — 3 action baru
- `apps/backend/src/modules/hardware-request/domain/events/hardware-request.events.ts` — 3 event baru + interfaces
- `apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts` — hapus dummy fallback + req.status mutation
- `apps/backend/src/modules/hardware-request/services/installation-schedule.service.spec.ts` — update test
- `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts` — rename completeInstallation, tambah markInstallDone + confirmInstallation
- `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.spec.ts` — test baru
- `apps/backend/src/modules/hardware-request/presentation/installation.controller.ts` — update complete, tambah confirm endpoint
- `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts` — handler event baru
- `apps/backend/src/modules/notifications/entities/notification.entity.ts` — 3 NotificationType baru
- `apps/backend/src/modules/hardware-request/hardware-request.module.ts` — register cron baru

**Frontend — Modify:**
- `apps/frontend/src/features/hardware-request/types/index.ts` — status baru, pipeline, HardwareRequest fields
- `apps/frontend/src/features/hardware-request/utils/status.util.ts` — meta AWAITING_USER_CONFIRMATION
- `apps/frontend/src/features/hardware-request/utils/permission.util.ts` — capsFor: canConfirmInstall, canCompleteInstall fix
- `apps/frontend/src/features/hardware-request/api/installation.api.ts` — update completeInstallation, tambah startInstallation + confirmInstallation
- `apps/frontend/src/features/hardware-request/hooks/useHardwareMutations.ts` — tambah startInstallMut, confirmInstallMut
- `apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx` — tombol baru, hapus barcode, banner konfirmasi

**Frontend — Delete:**
- `apps/frontend/src/features/hardware-request/components/barcode/CompleteInstallWizard.tsx`
- `apps/frontend/src/features/hardware-request/components/barcode/BarcodeScannerModal.tsx`
- `apps/frontend/src/features/hardware-request/components/barcode/BarcodeInputFallback.tsx`
- `apps/frontend/src/features/hardware-request/hooks/useBarcodeScanner.ts`
- `apps/frontend/src/features/hardware-request/__tests__/BarcodeScannerModal.test.tsx` (jika ada, hapus)

---

## Task 1: DB Migration

**Files:**
- Create: `apps/backend/src/migrations/1777500000000-AddInstallUserConfirmation.ts`

- [ ] **Step 1: Buat file migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstallUserConfirmation1777500000000 implements MigrationInterface {
    public async up(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TYPE "hardware_request_status_enum" ADD VALUE IF NOT EXISTS 'AWAITING_USER_CONFIRMATION'`,
        );
        await qr.query(
            `ALTER TABLE "hardware_request" ADD COLUMN IF NOT EXISTS "install_marked_done_at" TIMESTAMPTZ NULL`,
        );
        await qr.query(
            `ALTER TABLE "hardware_request" ADD COLUMN IF NOT EXISTS "user_confirmed_at" TIMESTAMPTZ NULL`,
        );
        await qr.query(
            `ALTER TABLE "hardware_request" ADD COLUMN IF NOT EXISTS "user_confirmation_kind" VARCHAR(16) NULL`,
        );
    }

    public async down(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TABLE "hardware_request" DROP COLUMN IF EXISTS "user_confirmation_kind"`,
        );
        await qr.query(
            `ALTER TABLE "hardware_request" DROP COLUMN IF EXISTS "user_confirmed_at"`,
        );
        await qr.query(
            `ALTER TABLE "hardware_request" DROP COLUMN IF EXISTS "install_marked_done_at"`,
        );
        // NOTE: PostgreSQL does not support removing enum values; down cannot fully revert.
    }
}
```

- [ ] **Step 2: Jalankan migration**

```bash
cd apps/backend && npx ts-node -r tsconfig-paths/register node_modules/.bin/typeorm migration:run -d src/database/data-source.ts
```

Expected: `Migration AddInstallUserConfirmation1777500000000 has been executed successfully`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/migrations/1777500000000-AddInstallUserConfirmation.ts
git commit -m "chore(migration): add AWAITING_USER_CONFIRMATION status + install confirmation columns"
```

---

## Task 2: Backend Enums & State Machine

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/domain/enums/request-status.enum.ts`
- Modify: `apps/backend/src/modules/hardware-request/domain/state-machine/request-state.ts`
- Modify: `apps/backend/src/modules/hardware-request/domain/enums/activity-action.enum.ts`

- [ ] **Step 1: Tulis test state machine yang failing**

Buka `apps/backend/src/modules/hardware-request/domain/state-machine/__tests__/request-state.spec.ts`, tambah di akhir describe block:

```typescript
describe('AWAITING_USER_CONFIRMATION transitions', () => {
    it('allows INSTALLATION → AWAITING_USER_CONFIRMATION', () => {
        expect(canTransition(RequestStatus.INSTALLATION, RequestStatus.AWAITING_USER_CONFIRMATION)).toBe(true);
    });
    it('allows AWAITING_USER_CONFIRMATION → COMPLETED', () => {
        expect(canTransition(RequestStatus.AWAITING_USER_CONFIRMATION, RequestStatus.COMPLETED)).toBe(true);
    });
    it('allows AWAITING_USER_CONFIRMATION → CANCELLED', () => {
        expect(canTransition(RequestStatus.AWAITING_USER_CONFIRMATION, RequestStatus.CANCELLED)).toBe(true);
    });
    it('forbids INSTALLATION → COMPLETED directly', () => {
        expect(canTransition(RequestStatus.INSTALLATION, RequestStatus.COMPLETED)).toBe(false);
    });
});
```

- [ ] **Step 2: Jalankan test untuk confirm failing**

```bash
cd apps/backend && npx jest request-state.spec.ts --no-coverage
```

Expected: `4 tests fail` karena `AWAITING_USER_CONFIRMATION` belum ada.

- [ ] **Step 3: Update RequestStatus enum**

Edit `apps/backend/src/modules/hardware-request/domain/enums/request-status.enum.ts`:

```typescript
export enum RequestStatus {
    DRAFT = 'DRAFT',
    SUBMITTED = 'SUBMITTED',
    UNDER_REVIEW = 'UNDER_REVIEW',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    CANCELLED = 'CANCELLED',
    PROCUREMENT = 'PROCUREMENT',
    AWAITING_DELIVERY = 'AWAITING_DELIVERY',
    INSTALLATION = 'INSTALLATION',
    AWAITING_USER_CONFIRMATION = 'AWAITING_USER_CONFIRMATION',
    COMPLETED = 'COMPLETED',
    CLOSED = 'CLOSED',
}
export const TERMINAL_STATUSES: ReadonlyArray<RequestStatus> = [
    RequestStatus.REJECTED,
    RequestStatus.CANCELLED,
    RequestStatus.COMPLETED,
];
```

- [ ] **Step 4: Update state machine**

Edit `apps/backend/src/modules/hardware-request/domain/state-machine/request-state.ts`:

```typescript
import { RequestStatus } from '../enums/request-status.enum';

const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
    [RequestStatus.DRAFT]: [RequestStatus.SUBMITTED, RequestStatus.CANCELLED],
    [RequestStatus.SUBMITTED]: [RequestStatus.UNDER_REVIEW, RequestStatus.CANCELLED],
    [RequestStatus.UNDER_REVIEW]: [RequestStatus.APPROVED, RequestStatus.REJECTED],
    [RequestStatus.APPROVED]: [RequestStatus.PROCUREMENT],
    [RequestStatus.PROCUREMENT]: [RequestStatus.AWAITING_DELIVERY, RequestStatus.REJECTED],
    [RequestStatus.AWAITING_DELIVERY]: [RequestStatus.INSTALLATION, RequestStatus.CANCELLED],
    [RequestStatus.INSTALLATION]: [RequestStatus.AWAITING_USER_CONFIRMATION, RequestStatus.CANCELLED],
    [RequestStatus.AWAITING_USER_CONFIRMATION]: [RequestStatus.COMPLETED, RequestStatus.CANCELLED],
    [RequestStatus.COMPLETED]: [RequestStatus.CLOSED],
    [RequestStatus.REJECTED]: [],
    [RequestStatus.CANCELLED]: [],
    [RequestStatus.CLOSED]: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false;
}
```

- [ ] **Step 5: Update ActivityAction enum**

Edit `apps/backend/src/modules/hardware-request/domain/enums/activity-action.enum.ts`:

```typescript
export enum ActivityAction {
    CREATED = 'CREATED',
    UPDATED = 'UPDATED',
    SUBMITTED = 'SUBMITTED',
    REVIEWED = 'REVIEWED',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    CANCELLED = 'CANCELLED',
    PROCUREMENT_UPDATED = 'PROCUREMENT_UPDATED',
    PROCUREMENT_COMPLETED = 'PROCUREMENT_COMPLETED',
    INSTALL_SCHEDULED = 'INSTALL_SCHEDULED',
    INSTALL_CONFIRMED = 'INSTALL_CONFIRMED',
    INSTALL_RESCHEDULED = 'INSTALL_RESCHEDULED',
    INSTALL_STARTED = 'INSTALL_STARTED',
    INSTALL_COMPLETED = 'INSTALL_COMPLETED',
    INSTALL_MARKED_DONE = 'INSTALL_MARKED_DONE',
    INSTALL_USER_CONFIRMED = 'INSTALL_USER_CONFIRMED',
    INSTALL_AUTO_CONFIRMED = 'INSTALL_AUTO_CONFIRMED',
    COMMENTED = 'COMMENTED',
    BARCODE_SCANNED = 'BARCODE_SCANNED',
    CLOSED = 'CLOSED',
}
```

- [ ] **Step 6: Jalankan test untuk confirm passing**

```bash
cd apps/backend && npx jest request-state.spec.ts --no-coverage
```

Expected: semua test PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/
git commit -m "feat(hardware-request): add AWAITING_USER_CONFIRMATION state + transitions + activity actions"
```

---

## Task 3: Backend Entity & Events

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/domain/entities/hardware-request.entity.ts`
- Modify: `apps/backend/src/modules/hardware-request/domain/events/hardware-request.events.ts`

- [ ] **Step 1: Tambah 3 kolom ke HardwareRequest entity**

Buka `apps/backend/src/modules/hardware-request/domain/entities/hardware-request.entity.ts`. Setelah field `completedAt` (sekitar line 79), tambah:

```typescript
@Column({ type: 'timestamptz', nullable: true })
installMarkedDoneAt: Date | null;

@Column({ type: 'timestamptz', nullable: true })
userConfirmedAt: Date | null;

@Column({ type: 'varchar', length: 16, nullable: true })
userConfirmationKind: 'MANUAL' | 'AUTO' | null;
```

- [ ] **Step 2: Tambah events ke HR_EVT + interfaces**

Buka `apps/backend/src/modules/hardware-request/domain/events/hardware-request.events.ts`. Tambah ke object `HR_EVT`:

```typescript
export const HR_EVT = {
    // ... (semua yang sudah ada)
    INSTALL_MARKED_DONE:   'hardware-request.install.marked-done',
    INSTALL_USER_CONFIRMED: 'hardware-request.install.user-confirmed',
    INSTALL_AUTO_CONFIRMED: 'hardware-request.install.auto-confirmed',
    // ... sisa yang sudah ada
} as const;
```

Tambah interfaces setelah `HrInstallCompleted`:

```typescript
export interface HrInstallMarkedDone extends HrEventBase {
    scheduleId: string | null;
    requesterId: string;
    autoConfirmAt: Date;
}
export interface HrInstallUserConfirmed extends HrEventBase {
    requesterId: string;
    kind: 'MANUAL' | 'AUTO';
}
export interface HrInstallAutoConfirmed {
    requestId: string;
    requesterId: string;
    confirmedAt: Date;
}
```

- [ ] **Step 3: Build check**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/entities/hardware-request.entity.ts
git add apps/backend/src/modules/hardware-request/domain/events/hardware-request.events.ts
git commit -m "feat(hardware-request): add install confirmation fields to entity + new events"
```

---

## Task 4: Refactor InstallationScheduleService.completeInstallation

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts`
- Modify: `apps/backend/src/modules/hardware-request/services/installation-schedule.service.spec.ts`

- [ ] **Step 1: Tulis test failing**

Buka `apps/backend/src/modules/hardware-request/services/installation-schedule.service.spec.ts` (atau `__tests__/installation-schedule.service.edge.spec.ts`). Tambah:

```typescript
describe('completeInstallation', () => {
    it('throws ConflictException when no schedule exists', async () => {
        jest.spyOn(repo, 'findOne').mockResolvedValue(null);
        await expect(svc.completeInstallation('req1', { id: 'ict1', role: 'ICT_STAFF' }))
            .rejects.toThrow(ConflictException);
    });

    it('promotes CONFIRMED → IN_PROGRESS → DONE and does not touch req.status', async () => {
        const fakeSched = { requestId: 'req1', status: InstallStatus.CONFIRMED, startedAt: null } as any;
        jest.spyOn(repo, 'findOne').mockResolvedValue(fakeSched);
        jest.spyOn(repo, 'save').mockImplementation(async (s: any) => s);
        const result = await svc.completeInstallation('req1', { id: 'ict1', role: 'ICT_STAFF' });
        expect(result.status).toBe(InstallStatus.DONE);
        expect(reqRepo.save).not.toHaveBeenCalled(); // req.status NOT touched
    });

    it('completes IN_PROGRESS → DONE without touching req.status', async () => {
        const fakeSched = { requestId: 'req1', status: InstallStatus.IN_PROGRESS } as any;
        jest.spyOn(repo, 'findOne').mockResolvedValue(fakeSched);
        jest.spyOn(repo, 'save').mockImplementation(async (s: any) => s);
        const result = await svc.completeInstallation('req1', { id: 'ict1', role: 'ICT_STAFF' });
        expect(result.status).toBe(InstallStatus.DONE);
        expect(reqRepo.save).not.toHaveBeenCalled();
    });

    it('returns idempotently when already DONE', async () => {
        const fakeSched = { requestId: 'req1', status: InstallStatus.DONE } as any;
        jest.spyOn(repo, 'findOne').mockResolvedValue(fakeSched);
        const result = await svc.completeInstallation('req1', { id: 'ict1', role: 'ICT_STAFF' });
        expect(result.status).toBe(InstallStatus.DONE);
        expect(repo.save).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Jalankan test untuk confirm failing**

```bash
cd apps/backend && npx jest installation-schedule.service --no-coverage 2>&1 | tail -20
```

Expected: test baru FAIL.

- [ ] **Step 3: Refactor completeInstallation di service**

Ganti method `completeInstallation` (line 158–192) di `installation-schedule.service.ts` dengan:

```typescript
async completeInstallation(requestId: string, actor: ActingUser): Promise<InstallationSchedule> {
    const sched = await this.repo.findOne({
        where: { requestId },
        order: { createdAt: 'DESC' },
    });

    if (!sched) throw new ConflictException('no schedule found for request');
    if (sched.status === InstallStatus.DONE) return sched; // idempotent

    if (INSTALL_TERMINAL.has(sched.status)) {
        throw new ConflictException(`schedule already terminal: ${sched.status}`);
    }

    if (sched.status === InstallStatus.CONFIRMED) {
        sched.status = InstallStatus.IN_PROGRESS;
        sched.startedAt = new Date();
    } else if (sched.status !== InstallStatus.IN_PROGRESS) {
        throw new ConflictException(`cannot complete schedule in status ${sched.status}`);
    }

    sched.status = InstallStatus.DONE;
    sched.completedAt = new Date();
    sched.technicianId = actor.id;
    const saved = await this.repo.save(sched);
    await this.activity.log(requestId, actor.id, 'INSTALL_SCHEDULE_DONE', { scheduleId: saved.id });
    return saved;
}
```

- [ ] **Step 4: Jalankan test untuk confirm passing**

```bash
cd apps/backend && npx jest installation-schedule.service --no-coverage
```

Expected: semua test PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts
git add apps/backend/src/modules/hardware-request/services/installation-schedule.service.spec.ts
git commit -m "refactor(install-schedule): remove dummy fallback + decouple req status mutation from schedule completion"
```

---

## Task 5: Add markInstallDone + confirmInstallation to CommandService

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts`
- Modify: `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.spec.ts`

- [ ] **Step 1: Tulis test failing untuk markInstallDone**

Buka `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.spec.ts`. Tambah describe block baru:

```typescript
describe('markInstallDone', () => {
    const ict = { id: 'ict1', role: 'ICT_STAFF' as const };
    const items = [
        { procurementDecision: 'APPROVED', deliveryStatus: 'ARRIVED' },
        { procurementDecision: 'REJECTED', deliveryStatus: 'PENDING' },
    ];

    it('transitions INSTALLATION → AWAITING_USER_CONFIRMATION', async () => {
        const req = { id: 'r1', requesterId: 'u1', status: RequestStatus.INSTALLATION, items } as any;
        // mock dataSource.transaction to call fn inline
        jest.spyOn(dataSource, 'transaction').mockImplementation(async (fn: any) => fn(mgr));
        jest.spyOn(mgr.getRepository(HardwareRequest), 'findOne').mockResolvedValue(req);
        jest.spyOn(mgr.getRepository(HardwareRequest), 'save').mockImplementation(async (r: any) => r);
        // ... (setup activityRepo, scheduleRepo mocks)
        await svc.markInstallDone('r1', ict);
        expect(req.status).toBe(RequestStatus.AWAITING_USER_CONFIRMATION);
        expect(req.installMarkedDoneAt).toBeInstanceOf(Date);
    });

    it('throws ConflictException if status !== INSTALLATION', async () => {
        const req = { id: 'r1', status: RequestStatus.COMPLETED, items: [] } as any;
        jest.spyOn(dataSource, 'transaction').mockImplementation(async (fn: any) => fn(mgr));
        jest.spyOn(mgr.getRepository(HardwareRequest), 'findOne').mockResolvedValue(req);
        await expect(svc.markInstallDone('r1', ict)).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException if any APPROVED item not ARRIVED', async () => {
        const badItems = [
            { procurementDecision: 'APPROVED', deliveryStatus: 'PENDING' },
        ];
        const req = { id: 'r1', status: RequestStatus.INSTALLATION, items: badItems } as any;
        jest.spyOn(dataSource, 'transaction').mockImplementation(async (fn: any) => fn(mgr));
        jest.spyOn(mgr.getRepository(HardwareRequest), 'findOne').mockResolvedValue(req);
        await expect(svc.markInstallDone('r1', ict)).rejects.toThrow(BadRequestException);
    });
});

describe('confirmInstallation', () => {
    it('transitions AWAITING_USER_CONFIRMATION → COMPLETED (MANUAL)', async () => {
        const req = { id: 'r1', requesterId: 'u1', status: RequestStatus.AWAITING_USER_CONFIRMATION } as any;
        jest.spyOn(dataSource, 'transaction').mockImplementation(async (fn: any) => fn(mgr));
        jest.spyOn(mgr.getRepository(HardwareRequest), 'findOne').mockResolvedValue(req);
        jest.spyOn(mgr.getRepository(HardwareRequest), 'save').mockImplementation(async (r: any) => r);
        await svc.confirmInstallation('r1', { id: 'u1' });
        expect(req.status).toBe(RequestStatus.COMPLETED);
        expect(req.userConfirmationKind).toBe('MANUAL');
    });

    it('transitions AWAITING_USER_CONFIRMATION → COMPLETED (AUTO/system)', async () => {
        const req = { id: 'r1', requesterId: 'u1', status: RequestStatus.AWAITING_USER_CONFIRMATION } as any;
        jest.spyOn(dataSource, 'transaction').mockImplementation(async (fn: any) => fn(mgr));
        jest.spyOn(mgr.getRepository(HardwareRequest), 'findOne').mockResolvedValue(req);
        jest.spyOn(mgr.getRepository(HardwareRequest), 'save').mockImplementation(async (r: any) => r);
        await svc.confirmInstallation('r1', { id: 'system-cron', system: true });
        expect(req.userConfirmationKind).toBe('AUTO');
    });

    it('throws ForbiddenException if non-requester tries manual confirm', async () => {
        const req = { id: 'r1', requesterId: 'u1', status: RequestStatus.AWAITING_USER_CONFIRMATION } as any;
        jest.spyOn(dataSource, 'transaction').mockImplementation(async (fn: any) => fn(mgr));
        jest.spyOn(mgr.getRepository(HardwareRequest), 'findOne').mockResolvedValue(req);
        await expect(svc.confirmInstallation('r1', { id: 'other-user' })).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if status !== AWAITING_USER_CONFIRMATION', async () => {
        const req = { id: 'r1', requesterId: 'u1', status: RequestStatus.COMPLETED } as any;
        jest.spyOn(dataSource, 'transaction').mockImplementation(async (fn: any) => fn(mgr));
        jest.spyOn(mgr.getRepository(HardwareRequest), 'findOne').mockResolvedValue(req);
        await expect(svc.confirmInstallation('r1', { id: 'u1' })).rejects.toThrow(ConflictException);
    });
});
```

- [ ] **Step 2: Jalankan test untuk confirm failing**

```bash
cd apps/backend && npx jest hardware-request-command.service.spec --no-coverage 2>&1 | tail -20
```

Expected: test baru FAIL.

- [ ] **Step 3: Tambah ForbiddenException import ke command service**

Buka `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts`. Pastikan import mencakup:

```typescript
import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
```

- [ ] **Step 4: Rename completeInstallation → markInstallDone, tulis method baru**

Ganti method `completeInstallation` (line 443–465) di `hardware-request-command.service.ts` dengan dua method baru:

```typescript
async markInstallDone(requestId: string, actor: ActingUser): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
        const reqRepo = mgr.getRepository(HardwareRequest);
        const activityRepo = mgr.getRepository(HardwareRequestActivity);

        const req = await reqRepo.findOne({
            where: { id: requestId },
            relations: { items: true },
        });
        if (!req) throw new NotFoundException('request');
        if (req.status !== RequestStatus.INSTALLATION) {
            throw new ConflictException(`invalid status: ${req.status}, expected INSTALLATION`);
        }

        const approvedItems = req.items.filter((i) => i.procurementDecision === 'APPROVED');
        const allArrived = approvedItems.every((i) => i.deliveryStatus === 'ARRIVED');
        if (!allArrived) {
            throw new BadRequestException('all approved items must be ARRIVED before completing installation');
        }

        const autoConfirmAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        req.status = RequestStatus.AWAITING_USER_CONFIRMATION;
        req.installMarkedDoneAt = new Date();
        const saved = await reqRepo.save(req);

        const sched = await this.scheduleRepo.findOne({
            where: { requestId, status: InstallStatus.DONE },
            order: { createdAt: 'DESC' },
        });

        await activityRepo.save(activityRepo.create({
            requestId: req.id,
            actorId: actor.id,
            action: ActivityAction.INSTALL_MARKED_DONE,
            fromStatus: RequestStatus.INSTALLATION,
            toStatus: RequestStatus.AWAITING_USER_CONFIRMATION,
            metadata: { scheduleId: sched?.id ?? null, autoConfirmAt },
        }));

        this.emitter.emit(HR_EVT.INSTALL_MARKED_DONE, {
            requestId,
            actorId: actor.id,
            occurredAt: new Date(),
            scheduleId: sched?.id ?? null,
            requesterId: req.requesterId,
            autoConfirmAt,
        } satisfies HrInstallMarkedDone);

        return saved;
    });
}

async confirmInstallation(
    requestId: string,
    actor: { id: string; system?: boolean },
): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
        const reqRepo = mgr.getRepository(HardwareRequest);
        const activityRepo = mgr.getRepository(HardwareRequestActivity);

        const req = await reqRepo.findOne({ where: { id: requestId } });
        if (!req) throw new NotFoundException('request');
        if (req.status !== RequestStatus.AWAITING_USER_CONFIRMATION) {
            throw new ConflictException(`invalid status: ${req.status}`);
        }

        if (!actor.system && actor.id !== req.requesterId) {
            throw new ForbiddenException('only the requester can confirm installation');
        }

        const kind: 'MANUAL' | 'AUTO' = actor.system ? 'AUTO' : 'MANUAL';
        req.status = RequestStatus.COMPLETED;
        req.completedAt = new Date();
        req.userConfirmedAt = new Date();
        req.userConfirmationKind = kind;
        const saved = await reqRepo.save(req);

        const action = kind === 'AUTO'
            ? ActivityAction.INSTALL_AUTO_CONFIRMED
            : ActivityAction.INSTALL_USER_CONFIRMED;

        await activityRepo.save(activityRepo.create({
            requestId: req.id,
            actorId: actor.id,
            action,
            fromStatus: RequestStatus.AWAITING_USER_CONFIRMATION,
            toStatus: RequestStatus.COMPLETED,
            metadata: { kind },
        }));

        const evtName = kind === 'AUTO' ? HR_EVT.INSTALL_AUTO_CONFIRMED : HR_EVT.INSTALL_USER_CONFIRMED;
        this.emitter.emit(evtName, {
            requestId,
            actorId: actor.id,
            occurredAt: new Date(),
            requesterId: req.requesterId,
            kind,
        } satisfies HrInstallUserConfirmed);

        // Backward compat: existing listeners on INSTALL_COMPLETED still fire
        this.emitter.emit(HR_EVT.INSTALL_COMPLETED, {
            requestId,
            actorId: actor.id,
            occurredAt: new Date(),
            requesterId: req.requesterId,
        });

        return saved;
    });
}
```

Pastikan import `HrInstallMarkedDone`, `HrInstallUserConfirmed` ditambah ke import events.

- [ ] **Step 5: Tambah import InstallStatus ke command service**

Di top import, tambahkan:
```typescript
import { InstallStatus } from '../domain/enums/install-status.enum';
import { HrInstallMarkedDone, HrInstallUserConfirmed } from '../domain/events/hardware-request.events';
```

- [ ] **Step 6: Jalankan test**

```bash
cd apps/backend && npx jest hardware-request-command.service --no-coverage
```

Expected: semua test PASS.

- [ ] **Step 7: Build check**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts
git add apps/backend/src/modules/hardware-request/services/hardware-request-command.service.spec.ts
git commit -m "feat(hardware-request): add markInstallDone + confirmInstallation to command service"
```

---

## Task 6: Update InstallationController

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/presentation/installation.controller.ts`

- [ ] **Step 1: Tulis test endpoint baru (failing)**

Buka `apps/backend/src/modules/hardware-request/presentation/__tests__/installation.controller.routes.spec.ts`. Tambah:

```typescript
describe('POST /:id/install/confirm', () => {
    it('returns 201 when requester confirms', async () => {
        mockCmdSvc.confirmInstallation = jest.fn().mockResolvedValue({});
        const response = await request(app.getHttpServer())
            .post('/hardware-requests/some-uuid/install/confirm')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(201);
        expect(response.body.success).toBe(true);
    });

    it('returns 403 when non-requester tries to confirm', async () => {
        mockCmdSvc.confirmInstallation = jest.fn().mockRejectedValue(new ForbiddenException());
        await request(app.getHttpServer())
            .post('/hardware-requests/some-uuid/install/confirm')
            .set('Authorization', `Bearer ${otherUserToken}`)
            .expect(403);
    });
});
```

- [ ] **Step 2: Jalankan test untuk confirm failing**

```bash
cd apps/backend && npx jest installation.controller.routes.spec --no-coverage 2>&1 | tail -10
```

Expected: test baru FAIL (endpoint 404).

- [ ] **Step 3: Update controller**

Ganti method `complete` dan tambah method `confirm` di `installation.controller.ts`:

```typescript
@Post(':id/install/complete')
@HardwareRoles(HardwareRole.ICT_STAFF)
async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
) {
    const user = this.getActingUser(req);
    await this.scheduleSvc.completeInstallation(id, user as any);
    const data = await this.cmdSvc.markInstallDone(id, user as any);
    return { success: true, data };
}

@Post(':id/install/confirm')
async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
) {
    const user = req.user;
    await this.guardOwnerOrIct(id, user);
    const data = await this.cmdSvc.confirmInstallation(id, { id: user.userId });
    return { success: true, data };
}
```

- [ ] **Step 4: Jalankan test**

```bash
cd apps/backend && npx jest installation.controller --no-coverage
```

Expected: semua test PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/presentation/installation.controller.ts
git add apps/backend/src/modules/hardware-request/presentation/__tests__/
git commit -m "feat(install-controller): update complete endpoint (no barcode), add confirm endpoint"
```

---

## Task 7: Notification Types + In-App Listener

**Files:**
- Modify: `apps/backend/src/modules/notifications/entities/notification.entity.ts`
- Modify: `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts`

- [ ] **Step 1: Tambah NotificationType values**

Buka `apps/backend/src/modules/notifications/entities/notification.entity.ts`. Di dalam `NotificationType` enum, setelah `HARDWARE_REQUEST_COMPLETED_LEAD`, tambah:

```typescript
HARDWARE_REQUEST_INSTALL_MARKED_DONE = 'HARDWARE_REQUEST_INSTALL_MARKED_DONE',
HARDWARE_REQUEST_INSTALL_CONFIRMED = 'HARDWARE_REQUEST_INSTALL_CONFIRMED',
HARDWARE_REQUEST_INSTALL_AUTO_CONFIRMED = 'HARDWARE_REQUEST_INSTALL_AUTO_CONFIRMED',
```

- [ ] **Step 2: Update in-app-notifier listener**

Buka `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts`.

Tambah import:
```typescript
import { HrInstallMarkedDone, HrInstallUserConfirmed, HrInstallAutoConfirmed } from '../domain/events/hardware-request.events';
```

Update `onInstallCompleted` — ubah menjadi notif ke ICT staff saja (karena requester sudah di-notif via `onInstallMarkedDone`):

```typescript
@OnEvent(HR_EVT.INSTALL_COMPLETED)
async onInstallCompleted(e: HrInstallCompleted) {
    const r = await this.q.findById(e.requestId);
    if (!r) return;
    const leads = await this.perm.listUsersWithRole('ICT_STAFF');
    await Promise.all(leads.map((l) =>
        this.push(l.id, {
            title: 'Request selesai',
            message: r.requestNumber,
            type: NotificationType.HARDWARE_REQUEST_COMPLETED_LEAD,
            link: link(r.id),
        }),
    ));
    this.notificationCenterService.emitActionItemsRefresh(e.requesterId, 'HARDWARE_REQUEST', e.requestId);
}
```

Tambah handler baru setelah `onInstallStarted`:

```typescript
@OnEvent(HR_EVT.INSTALL_MARKED_DONE)
async onInstallMarkedDone(e: HrInstallMarkedDone) {
    const r = await this.q.findById(e.requestId);
    if (!r) return;
    await this.push(e.requesterId, {
        title: 'Konfirmasi Instalasi Selesai',
        message: `${r.requestNumber}: ICT telah menyelesaikan instalasi. Konfirmasi dalam 24 jam atau akan otomatis dikonfirmasi.`,
        type: NotificationType.HARDWARE_REQUEST_INSTALL_MARKED_DONE,
        link: link(r.id),
        requiresAcknowledge: true,
    });
    this.notificationCenterService.emitActionItemsRefresh(e.requesterId, 'HARDWARE_REQUEST', e.requestId);
}

@OnEvent(HR_EVT.INSTALL_USER_CONFIRMED)
async onInstallUserConfirmed(e: HrInstallUserConfirmed) {
    const r = await this.q.findById(e.requestId);
    if (!r) return;
    await this.push(e.requesterId, {
        title: 'Instalasi dikonfirmasi',
        message: `${r.requestNumber} telah selesai dan dikonfirmasi.`,
        type: NotificationType.HARDWARE_REQUEST_COMPLETED,
        link: link(r.id),
    });
}

@OnEvent(HR_EVT.INSTALL_AUTO_CONFIRMED)
async onInstallAutoConfirmed(e: HrInstallAutoConfirmed) {
    const r = await this.q.findById(e.requestId);
    if (!r) return;
    await this.push(e.requesterId, {
        title: 'Instalasi Auto-Dikonfirmasi',
        message: `${r.requestNumber} telah otomatis dikonfirmasi setelah 24 jam.`,
        type: NotificationType.HARDWARE_REQUEST_INSTALL_AUTO_CONFIRMED,
        link: link(r.id),
    });
}
```

- [ ] **Step 3: Jalankan test listener**

```bash
cd apps/backend && npx jest in-app-notifier --no-coverage
```

Expected: semua test PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/notifications/entities/notification.entity.ts
git add apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts
git commit -m "feat(notifications): add install-marked-done + auto-confirm notification handlers"
```

---

## Task 8: Auto-Confirm Cron

**Files:**
- Create: `apps/backend/src/modules/hardware-request/listeners/install-auto-confirm.cron.ts`
- Create: `apps/backend/src/modules/hardware-request/listeners/install-auto-confirm.cron.spec.ts`

- [ ] **Step 1: Tulis spec file dulu**

Buat `apps/backend/src/modules/hardware-request/listeners/install-auto-confirm.cron.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InstallAutoConfirmCron, TTL_MS, SYSTEM_ACTOR_ID } from './install-auto-confirm.cron';
import { HardwareRequestCommandService } from '../services/hardware-request-command.service';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';

describe('InstallAutoConfirmCron', () => {
    let cron: InstallAutoConfirmCron;
    let reqRepo: jest.Mocked<{ find: jest.Mock }>;
    let cmdSvc: jest.Mocked<{ confirmInstallation: jest.Mock }>;

    beforeEach(async () => {
        reqRepo = { find: jest.fn() };
        cmdSvc = { confirmInstallation: jest.fn().mockResolvedValue({}) };

        const module = await Test.createTestingModule({
            providers: [
                InstallAutoConfirmCron,
                { provide: getRepositoryToken(HardwareRequest), useValue: reqRepo },
                { provide: HardwareRequestCommandService, useValue: cmdSvc },
            ],
        }).compile();

        cron = module.get(InstallAutoConfirmCron);
    });

    it('auto-confirms each expired request', async () => {
        reqRepo.find.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }] as any);
        await cron.run();
        expect(cmdSvc.confirmInstallation).toHaveBeenCalledTimes(2);
        expect(cmdSvc.confirmInstallation).toHaveBeenCalledWith('r1', { id: SYSTEM_ACTOR_ID, system: true });
        expect(cmdSvc.confirmInstallation).toHaveBeenCalledWith('r2', { id: SYSTEM_ACTOR_ID, system: true });
    });

    it('does nothing when no expired requests', async () => {
        reqRepo.find.mockResolvedValue([]);
        await cron.run();
        expect(cmdSvc.confirmInstallation).not.toHaveBeenCalled();
    });

    it('continues processing if one request fails', async () => {
        reqRepo.find.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }] as any);
        cmdSvc.confirmInstallation
            .mockRejectedValueOnce(new Error('already done'))
            .mockResolvedValueOnce({} as any);
        await expect(cron.run()).resolves.not.toThrow();
        expect(cmdSvc.confirmInstallation).toHaveBeenCalledTimes(2);
    });
});
```

- [ ] **Step 2: Jalankan test untuk confirm failing**

```bash
cd apps/backend && npx jest install-auto-confirm.cron --no-coverage 2>&1 | tail -10
```

Expected: FAIL (file belum ada).

- [ ] **Step 3: Buat cron file**

Buat `apps/backend/src/modules/hardware-request/listeners/install-auto-confirm.cron.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { HardwareRequestCommandService } from '../services/hardware-request-command.service';

export const SYSTEM_ACTOR_ID = 'system-cron';
export const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InstallAutoConfirmCron {
    private readonly logger = new Logger(InstallAutoConfirmCron.name);

    constructor(
        @InjectRepository(HardwareRequest)
        private readonly reqRepo: Repository<HardwareRequest>,
        private readonly cmdSvc: HardwareRequestCommandService,
    ) {}

    @Cron('*/5 * * * *')
    async run(): Promise<void> {
        const cutoff = new Date(Date.now() - TTL_MS);
        const expired = await this.reqRepo.find({
            where: {
                status: RequestStatus.AWAITING_USER_CONFIRMATION,
                installMarkedDoneAt: LessThan(cutoff),
            },
            select: ['id'],
        });

        for (const req of expired) {
            try {
                await this.cmdSvc.confirmInstallation(req.id, { id: SYSTEM_ACTOR_ID, system: true });
                this.logger.log(`auto-confirmed requestId=${req.id}`);
            } catch (err) {
                this.logger.error(`auto-confirm failed requestId=${req.id}`, err);
            }
        }
    }
}
```

- [ ] **Step 4: Jalankan test**

```bash
cd apps/backend && npx jest install-auto-confirm.cron --no-coverage
```

Expected: semua test PASS.

- [ ] **Step 5: Register di module**

Buka `apps/backend/src/modules/hardware-request/hardware-request.module.ts`. Tambah import dan provider:

```typescript
import { InstallAutoConfirmCron } from './listeners/install-auto-confirm.cron';

// Di providers array, tambah:
InstallAutoConfirmCron,
```

- [ ] **Step 6: Build check**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/hardware-request/listeners/install-auto-confirm.cron.ts
git add apps/backend/src/modules/hardware-request/listeners/install-auto-confirm.cron.spec.ts
git add apps/backend/src/modules/hardware-request/hardware-request.module.ts
git commit -m "feat(hardware-request): add auto-confirm cron (24h TTL for AWAITING_USER_CONFIRMATION)"
```

---

## Task 9: Frontend Types & Status Util

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/types/index.ts`
- Modify: `apps/frontend/src/features/hardware-request/utils/status.util.ts`

- [ ] **Step 1: Update types/index.ts**

Ganti `RequestStatus` type:

```typescript
export type RequestStatus =
    | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED'
    | 'PROCUREMENT' | 'AWAITING_DELIVERY' | 'INSTALLATION'
    | 'AWAITING_USER_CONFIRMATION'
    | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'CLOSED';
```

Ganti `REQUEST_PIPELINE`:

```typescript
export const REQUEST_PIPELINE: RequestStatus[] = [
    'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROCUREMENT',
    'AWAITING_DELIVERY', 'INSTALLATION', 'AWAITING_USER_CONFIRMATION', 'COMPLETED',
];
```

Tambah fields ke `HardwareRequest` interface (setelah `completedAt`):

```typescript
installMarkedDoneAt?: string | null;
userConfirmedAt?: string | null;
userConfirmationKind?: 'MANUAL' | 'AUTO' | null;
```

- [ ] **Step 2: Update status.util.ts**

Tambah ke `STATUS_META`:

```typescript
AWAITING_USER_CONFIRMATION: {
    label: 'Menunggu Konfirmasi',
    tone: 'bg-amber-100 text-amber-900 ring-amber-200',
    hex: '#b45309',
},
CLOSED: {
    label: 'Closed',
    tone: 'bg-zinc-200 text-zinc-700 ring-zinc-300',
    hex: '#52525b',
},
```

Update `isTerminal`:

```typescript
export const isTerminal = (s: RequestStatus) =>
    s === 'COMPLETED' || s === 'REJECTED' || s === 'CANCELLED' || s === 'CLOSED';
```

- [ ] **Step 3: Build check**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors (atau hanya errors yang tidak terkait perubahan ini).

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/hardware-request/types/index.ts
git add apps/frontend/src/features/hardware-request/utils/status.util.ts
git commit -m "feat(frontend): add AWAITING_USER_CONFIRMATION to request types + status meta"
```

---

## Task 10: Frontend Permission Util

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/utils/permission.util.ts`

- [ ] **Step 1: Tulis test failing**

Buka `apps/frontend/src/features/hardware-request/utils/__tests__/permission.util.test.ts`. Tambah:

```typescript
describe('canConfirmInstall', () => {
    it('is true for requester when status is AWAITING_USER_CONFIRMATION', () => {
        const user = { id: 'u1', role: 'USER' as HardwareRole };
        const req = { requesterId: 'u1', status: 'AWAITING_USER_CONFIRMATION', items: [], installationSchedule: null } as any;
        expect(capsFor(user, req).canConfirmInstall).toBe(true);
    });

    it('is false for non-requester', () => {
        const user = { id: 'u2', role: 'USER' as HardwareRole };
        const req = { requesterId: 'u1', status: 'AWAITING_USER_CONFIRMATION', items: [], installationSchedule: null } as any;
        expect(capsFor(user, req).canConfirmInstall).toBe(false);
    });

    it('is false for ICT_STAFF', () => {
        const user = { id: 'ict1', role: 'ICT_STAFF' as HardwareRole };
        const req = { requesterId: 'u1', status: 'AWAITING_USER_CONFIRMATION', items: [], installationSchedule: null } as any;
        expect(capsFor(user, req).canConfirmInstall).toBe(false);
    });
});

describe('canCompleteInstall', () => {
    it('is true for ICT when INSTALLATION + schedule IN_PROGRESS + all arrived', () => {
        const user = { id: 'ict1', role: 'ICT_STAFF' as HardwareRole };
        const req = {
            requesterId: 'u1', status: 'INSTALLATION',
            installationSchedule: { status: 'IN_PROGRESS', proposedBy: 'ict1' },
            items: [{ procurementDecision: 'APPROVED', deliveryStatus: 'ARRIVED' }],
        } as any;
        expect(capsFor(user, req).canCompleteInstall).toBe(true);
    });

    it('is false when not all APPROVED items arrived', () => {
        const user = { id: 'ict1', role: 'ICT_STAFF' as HardwareRole };
        const req = {
            requesterId: 'u1', status: 'INSTALLATION',
            installationSchedule: { status: 'IN_PROGRESS', proposedBy: 'ict1' },
            items: [{ procurementDecision: 'APPROVED', deliveryStatus: 'PENDING' }],
        } as any;
        expect(capsFor(user, req).canCompleteInstall).toBe(false);
    });
});
```

- [ ] **Step 2: Jalankan test untuk confirm failing**

```bash
cd apps/frontend && npx vitest run src/features/hardware-request/utils/__tests__/permission.util.test.ts 2>&1 | tail -15
```

Expected: test baru FAIL.

- [ ] **Step 3: Update Caps interface + capsFor**

Buka `apps/frontend/src/features/hardware-request/utils/permission.util.ts`.

Tambah `canConfirmInstall: boolean` ke interface `Caps`.

Ganti function body capsFor return object (bagian install):

```typescript
canStartInstall:    isStaff && inCal && scheduleStatus === 'CONFIRMED',
canScanBarcode:     false, // barcode removed from install flow
canCompleteInstall: isStaff && inCal &&
                    (scheduleStatus === 'IN_PROGRESS' || scheduleStatus === 'CONFIRMED') &&
                    (req?.items ?? [])
                        .filter((i) => i.procurementDecision === 'APPROVED')
                        .every((i) => i.deliveryStatus === 'ARRIVED'),
canConfirmInstall:  mine && r === 'AWAITING_USER_CONFIRMATION',
```

- [ ] **Step 4: Jalankan test**

```bash
cd apps/frontend && npx vitest run src/features/hardware-request/utils/__tests__/permission.util.test.ts
```

Expected: semua test PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/hardware-request/utils/permission.util.ts
git commit -m "feat(frontend): update capsFor with canConfirmInstall + canCompleteInstall fix"
```

---

## Task 11: Frontend API + Mutations Hook

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/api/installation.api.ts`
- Modify: `apps/frontend/src/features/hardware-request/hooks/useHardwareMutations.ts`

- [ ] **Step 1: Update installation.api.ts**

Ganti `completeInstallation` (hapus payload) dan tambah dua fungsi baru:

```typescript
export async function startInstallation(requestId: string): Promise<void> {
    await api.post(`/hardware-requests/${requestId}/install/start`);
}

export async function completeInstallation(requestId: string): Promise<void> {
    await api.post(`/hardware-requests/${requestId}/install/complete`);
}

export async function confirmInstallation(requestId: string): Promise<void> {
    await api.post(`/hardware-requests/${requestId}/install/confirm`);
}
```

- [ ] **Step 2: Update useHardwareMutations.ts**

Tambah import fungsi baru dan mutations:

```typescript
import { HardwareRequestApi, completeProcurement } from '../api/hardware-request.api';
import { startInstallation, completeInstallation, confirmInstallation } from '../api/installation.api';
```

Tambah mutations baru ke return object:

```typescript
startInstallMut:   useMutation({ mutationFn: (id: string) => handle(startInstallation(id), 'Instalasi dimulai') }),
completeInstallMut: useMutation({ mutationFn: (id: string) => handle(completeInstallation(id), 'Menunggu konfirmasi user') }),
confirmInstallMut: useMutation({ mutationFn: (id: string) => handle(confirmInstallation(id), 'Instalasi dikonfirmasi') }),
```

- [ ] **Step 3: Build check**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/hardware-request/api/installation.api.ts
git add apps/frontend/src/features/hardware-request/hooks/useHardwareMutations.ts
git commit -m "feat(frontend): update install API (no barcode) + add start/confirm mutations"
```

---

## Task 12: Frontend ActionPanel Overhaul

**Files:**
- Modify: `apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx`

- [ ] **Step 1: Baca file ActionPanel saat ini**

```bash
cat apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx
```

Kenali posisi import, actions array, dan return JSX.

- [ ] **Step 2: Update ActionPanel**

Ganti seluruh isi file dengan versi baru di bawah. Perhatikan perubahan utama:
- Import hapus: tidak ada barcode wizard
- Import tambah: `startInstallation`, `confirmInstallation` (via mutations)
- Tombol "Mulai Instalasi" (caps.canStartInstall)
- Tombol "Selesaikan Instalasi" (caps.canCompleteInstall, confirm dialog, no barcode)
- Tombol "Konfirmasi Instalasi" (caps.canConfirmInstall)
- Banner countdown jika status AWAITING_USER_CONFIRMATION

```typescript
import React, { useState } from 'react';
import { CheckCircle2, XCircle, Eye, ClipboardCheck, Ban, CalendarClock, PlayCircle, ShieldCheck } from 'lucide-react';
import { SectionCard } from '../common/SectionCard';
import { useHardwareMutations } from '../../hooks/useHardwareMutations';
import { capsFor, canDecideProcurement, canSelectSlot } from '../../utils/permission.util';
import { useHardwareRole } from '../../hooks/usePermissions';
import { RejectDialog } from './RejectDialog';
import { ProcurementPanel } from '../procurement/ProcurementPanel';
import { DeliveryBoard } from '../delivery/DeliveryBoard';
import { ScheduleProposeModal } from '../scheduling/ScheduleProposeModal';
import { SlotPickerModal } from '../scheduling/SlotPickerModal';
import type { HardwareRequest, InstallationSchedule } from '../../types';

function formatCountdown(markedAt: string): string {
    const confirmBy = new Date(new Date(markedAt).getTime() + 24 * 60 * 60 * 1000);
    const diff = confirmBy.getTime() - Date.now();
    if (diff <= 0) return 'segera';
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return `${h}j ${m}m lagi`;
}

export function ActionPanel({ r }: { r: HardwareRequest }) {
    const { userId, role } = useHardwareRole();
    const user = { id: userId, role: role as 'USER' | 'ICT_STAFF' };
    const caps = capsFor(user, r);
    const m = useHardwareMutations(r.id);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [proposeOpen, setProposeOpen] = useState(false);
    const [pickerSched, setPickerSched] = useState<InstallationSchedule | null>(null);

    const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 w-full shadow-sm hover:shadow-md active:scale-[0.98]';
    const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2.5 text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 w-full';
    const danger = 'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 text-white px-4 py-3 text-sm font-bold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 w-full shadow-sm hover:shadow-md active:scale-[0.98]';
    const success = 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 w-full shadow-sm hover:shadow-md active:scale-[0.98]';

    const actions: Array<[boolean, React.ReactNode]> = [
        [caps.canSubmit,
            <button key="sub" className={primary} onClick={() => m.submitMut.mutate(r.id)}>
                <CheckCircle2 className="size-4" />Submit Request
            </button>],
        [caps.canCancel,
            <button key="cancel" className={secondary} onClick={() => m.cancelMut.mutate(r.id)}>
                <Ban className="size-4" />Batalkan Request
            </button>],
        [caps.canReview,
            <button key="rev" className={primary} onClick={() => m.reviewMut.mutate(r.id)}>
                <Eye className="size-4" />Mulai Review
            </button>],
        [caps.canApprove,
            <button key="appr" className={primary} onClick={() => m.approveMut.mutate(r.id)}>
                <CheckCircle2 className="size-4" />Setujui Request
            </button>],
        [caps.canReject,
            <button key="rej" className={danger} onClick={() => setRejectOpen(true)}>
                <XCircle className="size-4" />Tolak Request
            </button>],
        [caps.canStartInstall,
            <button key="start-install" className={primary}
                onClick={() => m.startInstallMut.mutate(r.id)}
                disabled={m.startInstallMut.isPending}>
                <PlayCircle className="size-4" />Mulai Instalasi
            </button>],
        [caps.canCompleteInstall,
            <button key="complete-install" className={primary}
                disabled={m.completeInstallMut.isPending}
                onClick={() => {
                    if (window.confirm('Konfirmasi bahwa instalasi sudah selesai dilakukan?')) {
                        m.completeInstallMut.mutate(r.id);
                    }
                }}>
                <ClipboardCheck className="size-4" />Selesaikan Instalasi
            </button>],
        [caps.canConfirmInstall,
            <button key="confirm-install" className={success}
                disabled={m.confirmInstallMut.isPending}
                onClick={() => {
                    if (window.confirm('Konfirmasi bahwa hardware sudah terpasang dengan benar?')) {
                        m.confirmInstallMut.mutate(r.id);
                    }
                }}>
                <ShieldCheck className="size-4" />Konfirmasi Instalasi Selesai
            </button>],
    ];

    const visible = actions.filter(([ok]) => ok);
    const arrivedItems = r.items.filter((i) => i.deliveryStatus === 'ARRIVED');
    const awaitingUserSchedule = r.schedules?.find((s) => s.status === 'PROPOSED_AWAITING_USER');

    return (
        <div className="space-y-6">
            <SectionCard title="Aksi Tersedia">
                {visible.length === 0 ? (
                    <div className="flex flex-col items-center gap-1 py-4">
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic text-center">
                            Tidak ada aksi tersedia untuk role Anda saat ini.
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">{visible.map(([, el]) => el)}</div>
                )}
                <RejectDialog
                    open={rejectOpen}
                    onClose={() => setRejectOpen(false)}
                    onConfirm={(reason) => m.rejectMut.mutate({ id: r.id, reason })}
                />
            </SectionCard>

            {r.status === 'AWAITING_USER_CONFIRMATION' && r.installMarkedDoneAt && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1">
                        Konfirmasi Diperlukan
                    </p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                        ICT telah menyelesaikan instalasi
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Konfirmasi dalam{' '}
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                            {formatCountdown(r.installMarkedDoneAt)}
                        </span>{' '}
                        atau sistem akan otomatis mengkonfirmasi.
                    </p>
                </div>
            )}

            {canDecideProcurement(user, r) && <ProcurementPanel request={r} />}

            {(r.status === 'AWAITING_DELIVERY' || r.status === 'INSTALLATION') && (
                <DeliveryBoard
                    request={r}
                    user={user}
                    onSchedule={() => setProposeOpen(true)}
                />
            )}

            {awaitingUserSchedule && canSelectSlot(user, r, awaitingUserSchedule.status) && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 dark:bg-primary/10 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Pemberitahuan</p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">ICT mengusulkan jadwal</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Silakan pilih slot waktu untuk instalasi:{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {r.items.map((i) => i.catalogName || i.categorySnapshot?.name || i.category).join(', ')}
                        </span>
                    </p>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-3 text-sm font-bold hover:bg-primary/90 transition-all duration-200 shadow-sm"
                        onClick={() => setPickerSched(awaitingUserSchedule)}
                    >
                        <CalendarClock className="size-4" />
                        Pilih Slot Jadwal
                    </button>
                </div>
            )}

            <ScheduleProposeModal
                open={proposeOpen}
                onOpenChange={setProposeOpen}
                requestId={r.id}
                arrivedItems={arrivedItems}
                defaultTechnicianId={userId}
            />

            {pickerSched && (
                <SlotPickerModal
                    open={!!pickerSched}
                    onOpenChange={(o) => !o && setPickerSched(null)}
                    requestId={r.id}
                    schedule={pickerSched}
                />
            )}
        </div>
    );
}
```

- [ ] **Step 3: Build check**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/hardware-request/components/detail/ActionPanel.tsx
git commit -m "feat(frontend): overhaul ActionPanel — add start/complete/confirm install buttons, remove barcode wizard"
```

---

## Task 13: Delete Barcode Files

**Files:**
- Delete: `apps/frontend/src/features/hardware-request/components/barcode/CompleteInstallWizard.tsx`
- Delete: `apps/frontend/src/features/hardware-request/components/barcode/BarcodeScannerModal.tsx`
- Delete: `apps/frontend/src/features/hardware-request/components/barcode/BarcodeInputFallback.tsx`
- Delete: `apps/frontend/src/features/hardware-request/hooks/useBarcodeScanner.ts`

- [ ] **Step 1: Cek apakah ada import ke file-file ini di luar barcode folder**

```bash
cd apps/frontend && grep -r "CompleteInstallWizard\|BarcodeScannerModal\|BarcodeInputFallback\|useBarcodeScanner" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: hanya file dalam folder `barcode/` + `hooks/useBarcodeScanner.ts`. Jika ada file lain yang import, update dulu sebelum delete.

- [ ] **Step 2: Delete files**

```bash
rm apps/frontend/src/features/hardware-request/components/barcode/CompleteInstallWizard.tsx
rm apps/frontend/src/features/hardware-request/components/barcode/BarcodeScannerModal.tsx
rm apps/frontend/src/features/hardware-request/components/barcode/BarcodeInputFallback.tsx
rm apps/frontend/src/features/hardware-request/hooks/useBarcodeScanner.ts
```

- [ ] **Step 3: Hapus test files terkait**

```bash
rm -f apps/frontend/src/features/hardware-request/__tests__/BarcodeScannerModal.test.tsx
rm -f apps/frontend/src/features/hardware-request/components/__tests__/BarcodeScannerModal.test.tsx
```

- [ ] **Step 4: Build check**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Run all frontend tests**

```bash
cd apps/frontend && npx vitest run src/features/hardware-request/ 2>&1 | tail -20
```

Expected: semua test PASS, tidak ada reference ke deleted files.

- [ ] **Step 6: Commit**

```bash
git add -A apps/frontend/src/features/hardware-request/components/barcode/
git add -A apps/frontend/src/features/hardware-request/hooks/useBarcodeScanner.ts
git add -A apps/frontend/src/features/hardware-request/__tests__/
git commit -m "chore(frontend): remove barcode install flow (CompleteInstallWizard, BarcodeScannerModal)"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Run semua backend tests**

```bash
cd apps/backend && npx jest --testPathPattern="hardware-request" --no-coverage 2>&1 | tail -30
```

Expected: semua PASS.

- [ ] **Step 2: Run semua frontend tests**

```bash
cd apps/frontend && npx vitest run src/features/hardware-request/ 2>&1 | tail -20
```

Expected: semua PASS.

- [ ] **Step 3: Full TypeScript check**

```bash
cd apps/backend && npx tsc --noEmit && echo "BACKEND OK"
cd apps/frontend && npx tsc --noEmit && echo "FRONTEND OK"
```

Expected: `BACKEND OK` dan `FRONTEND OK`.

- [ ] **Step 4: Verifikasi alur manual (checklist)**

Gunakan browser/Postman untuk verify end-to-end:

1. Login sebagai ICT_STAFF. Buka request yang sudah di status INSTALLATION.
2. Tombol "Mulai Instalasi" muncul jika schedule CONFIRMED → klik → schedule jadi IN_PROGRESS.
3. Tombol "Selesaikan Instalasi" muncul jika schedule IN_PROGRESS + semua item ARRIVED → klik confirm dialog → request jadi AWAITING_USER_CONFIRMATION.
4. Login sebagai USER requester. Tombol "Konfirmasi Instalasi Selesai" muncul + banner countdown.
5. Klik konfirmasi → request jadi COMPLETED.
6. Alternatif: tunggu cron (atau panggil endpoint langsung) → auto-confirm setelah TTL.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat(hardware-request): complete install confirmation workflow — AWAITING_USER_CONFIRMATION + 24h auto-confirm"
```

---

## Checklist: Spec Coverage

| Spec Section | Task |
|---|---|
| State machine AWAITING_USER_CONFIRMATION | Task 2 |
| Entity fields installMarkedDoneAt / userConfirmedAt / userConfirmationKind | Task 3 |
| scheduleSvc remove dummy fallback + req.status mutation | Task 4 |
| cmdSvc.markInstallDone | Task 5 |
| cmdSvc.confirmInstallation (manual + auto) | Task 5 |
| Controller: complete endpoint (no barcode) | Task 6 |
| Controller: confirm endpoint | Task 6 |
| Cron auto-confirm 24h | Task 8 |
| Notif INSTALL_MARKED_DONE → requester | Task 7 |
| Notif INSTALL_AUTO_CONFIRMED | Task 7 |
| DB migration | Task 1 |
| Frontend types + REQUEST_PIPELINE | Task 9 |
| Frontend status.util AWAITING_USER_CONFIRMATION | Task 9 |
| Frontend capsFor canConfirmInstall | Task 10 |
| Frontend ActionPanel buttons + countdown banner | Task 12 |
| Delete barcode wizard | Task 13 |
| Validation all-items-arrived | Task 5 (markInstallDone) |
| Activity log akurat per transisi | Task 5, 6 |
