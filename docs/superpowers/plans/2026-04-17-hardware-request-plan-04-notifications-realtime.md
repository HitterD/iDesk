# Hardware Request — Plan 4: Notifications, Events & Realtime

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement semua channel notifikasi — EventEmitter2 payload terstandar, in-app records, email templates, WebSocket gateway `/ws/hardware-requests`, dan cron aging reminder. Setelah plan ini setiap transisi di Plan 1-3 terdeliver ke user.

**Architecture:** Satu listener module (`hardware-request/listeners/`) dengan 2 listener (email + in-app) dan 1 gateway (WebSocket). Event payload didefinisikan di `events/hardware-request.events.ts` sebagai type-safe DTO. Email pakai `nodemailer` + template engine existing. In-app pakai entity `notifications` existing. Cron pakai `@nestjs/schedule`.

**Tech Stack:** NestJS, `@nestjs/event-emitter`, `@nestjs/schedule`, `@nestjs/websockets` + `socket.io`, existing `notifications` module, existing mailer service.

**Spec reference:** §8 Events & Notifications.

**Prerequisites:** Plan 3 merged. Module `notifications` dan `mailer` existing operasional.

---

## Files in this plan

**Create:**
- `apps/backend/src/modules/hardware-request/domain/events/hardware-request.events.ts`
- `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts`
- `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.spec.ts`
- `apps/backend/src/modules/hardware-request/listeners/email-notifier.listener.ts`
- `apps/backend/src/modules/hardware-request/listeners/email-notifier.listener.spec.ts`
- `apps/backend/src/modules/hardware-request/listeners/aging-reminder.cron.ts`
- `apps/backend/src/modules/hardware-request/listeners/aging-reminder.cron.spec.ts`
- `apps/backend/src/modules/hardware-request/realtime/hardware-request.gateway.ts`
- `apps/backend/src/modules/hardware-request/realtime/hardware-request.gateway.spec.ts`
- `apps/backend/src/modules/notifications/templates/hardware-request/submitted.hbs`
- `apps/backend/src/modules/notifications/templates/hardware-request/approved.hbs`
- `apps/backend/src/modules/notifications/templates/hardware-request/rejected.hbs`
- `apps/backend/src/modules/notifications/templates/hardware-request/procurement-done.hbs`
- `apps/backend/src/modules/notifications/templates/hardware-request/schedule-proposed.hbs`
- `apps/backend/src/modules/notifications/templates/hardware-request/schedule-rescheduled.hbs`
- `apps/backend/src/modules/notifications/templates/hardware-request/install-completed.hbs`
- `apps/backend/src/modules/notifications/templates/hardware-request/aging-reminder.hbs`

**Modify:**
- `apps/backend/src/modules/hardware-request/hardware-request.module.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts` (emit list standardized)
- `apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts` (emit list standardized)
- `apps/backend/src/modules/hardware-request/services/hardware-comment.service.ts` (emit `commented`)
- `apps/backend/src/app.module.ts` (register `ScheduleModule`)

---

## Task 4.1: Typed event payload

**Files:** Create `domain/events/hardware-request.events.ts`

- [ ] **Step 1: Define event names + payloads**

```typescript
export const HR_EVT = {
    SUBMITTED:             'hardware-request.submitted',
    APPROVED:              'hardware-request.approved',
    REJECTED:              'hardware-request.rejected',
    CANCELLED:             'hardware-request.cancelled',
    PROCUREMENT_DONE:      'hardware-request.procurement.completed',
    SCHEDULE_PROPOSED:     'hardware-request.schedule.proposed',
    SCHEDULE_CONFIRMED:    'hardware-request.schedule.confirmed',
    SCHEDULE_RESCHEDULED:  'hardware-request.schedule.rescheduled',
    INSTALL_STARTED:       'hardware-request.install.started',
    INSTALL_COMPLETED:     'hardware-request.install.completed',
    COMMENTED:             'hardware-request.commented',
    AGING_FLAGGED:         'hardware-request.aging.flagged',
} as const;

export type HrEventName = typeof HR_EVT[keyof typeof HR_EVT];

export interface HrEventBase { requestId: string; actorId: string; occurredAt: Date; }
export interface HrSubmitted extends HrEventBase { requesterId: string; }
export interface HrApproved extends HrEventBase { requesterId: string; }
export interface HrRejected extends HrEventBase { requesterId: string; reason: string; }
export interface HrCancelled extends HrEventBase { requesterId: string; fromStatus: string; }
export interface HrProcurementDone extends HrEventBase { requesterId: string; }
export interface HrScheduleProposed extends HrEventBase { scheduleId: string; proposerId: string; technicianId: string; requesterId: string; }
export interface HrScheduleConfirmed extends HrEventBase { scheduleId: string; confirmedBy: string; technicianId: string; requesterId: string; }
export interface HrScheduleRescheduled extends HrEventBase { oldId: string; newId: string; reason?: string; technicianId: string; requesterId: string; }
export interface HrInstallStarted extends HrEventBase { scheduleId: string; requesterId: string; }
export interface HrInstallCompleted extends HrEventBase { requesterId: string; }
export interface HrCommented extends HrEventBase { commentId: string; body: string; subscribers: string[]; }
export interface HrAgingFlagged extends HrEventBase { requesterId: string; daysInStatus: number; status: string; }
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/events/hardware-request.events.ts
git commit -m "feat(hardware-request): typed event payloads"
```

---

## Task 4.2: Normalize emits di command service & schedule service

**Files:** Modify `hardware-request-command.service.ts`, `installation-schedule.service.ts`, `hardware-comment.service.ts`.

- [ ] **Step 1: Refactor — pakai `HR_EVT.*`**

Ubah setiap `this.emitter.emit('hardware-request.submitted', {...})` menjadi:

```typescript
import { HR_EVT } from '../domain/events/hardware-request.events';

this.emitter.emit(HR_EVT.SUBMITTED, {
    requestId: req.id,
    actorId: actor.id,
    occurredAt: new Date(),
    requesterId: req.requesterId,
});
```

Lakukan untuk setiap transisi:
- `submit()` → `SUBMITTED`
- `approve()` → `APPROVED`
- `reject()` → `REJECTED` (sertakan `reason`)
- `cancel()` → `CANCELLED`
- `completeProcurement()` → `PROCUREMENT_DONE`
- `completeInstallation()` → `INSTALL_COMPLETED`
- Schedule service: `SCHEDULE_PROPOSED/CONFIRMED/RESCHEDULED/INSTALL_STARTED`
- Comment service: `COMMENTED`

Payload harus sertakan `requesterId` (ambil dari `req.requesterId`) agar listener tidak perlu fetch ulang.

- [ ] **Step 2: Update existing tests — assert payload bentuk baru**

Ganti `expect(emitter.emit).toHaveBeenCalledWith('hardware-request.x', ...)` dengan konstanta `HR_EVT.X`.

- [ ] **Step 3: Run all backend tests → hijau. Commit.**

```bash
pnpm --filter backend test
git add -A && git commit -m "refactor(hardware-request): standardized HR_EVT emits"
```

---

## Task 4.3: In-app notifier listener

**Files:** Create `listeners/in-app-notifier.listener.ts` + spec.

Asumsi existing `NotificationsService.create({ userId, title, body, type, link })`.

- [ ] **Step 1: Spec (RED)**

```typescript
import { Test } from '@nestjs/testing';
import { InAppNotifierListener } from './in-app-notifier.listener';
import { NotificationsService } from '../../notifications/notifications.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import { PermissionsService } from '../../permissions/permissions.service';

describe('InAppNotifierListener', () => {
    let listener: InAppNotifierListener;
    const notif = { create: jest.fn() };
    const perm = { listUsersWithRole: jest.fn().mockResolvedValue([{ id: 'lead1' }]) };
    const q = { findById: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                InAppNotifierListener,
                { provide: NotificationsService, useValue: notif },
                { provide: PermissionsService, useValue: perm },
                { provide: HardwareRequestQueryService, useValue: q },
            ],
        }).compile();
        listener = mod.get(InAppNotifierListener);
        jest.clearAllMocks();
    });

    it('onSubmitted notifies all ICT_LEAD', async () => {
        q.findById.mockResolvedValue({ id: 'r1', requestNumber: 'HR-2026-0001' });
        await listener.onSubmitted({ requestId: 'r1', actorId: 'u1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(notif.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'lead1',
            type: 'HARDWARE_REQUEST_SUBMITTED',
            link: '/hardware-requests/r1',
        }));
    });

    it('onApproved notifies requester + ICT_PROCUREMENT', async () => {
        q.findById.mockResolvedValue({ id: 'r1', requesterId: 'u1', requestNumber: 'HR-2026-0001' });
        perm.listUsersWithRole.mockResolvedValue([{ id: 'proc1' }]);
        await listener.onApproved({ requestId: 'r1', actorId: 'lead1', requesterId: 'u1', occurredAt: new Date() } as any);
        const calls = notif.create.mock.calls.map(c => c[0].userId);
        expect(calls).toContain('u1');
        expect(calls).toContain('proc1');
    });

    it('onCommented notifies subscribers except author', async () => {
        await listener.onCommented({
            requestId: 'r1', actorId: 'u1', commentId: 'c1', body: 'halo',
            subscribers: ['u1', 'u2', 'lead1'], occurredAt: new Date(),
        } as any);
        const calls = notif.create.mock.calls.map(c => c[0].userId);
        expect(calls).toEqual(expect.arrayContaining(['u2', 'lead1']));
        expect(calls).not.toContain('u1');
    });
});
```

- [ ] **Step 2: Implement listener**

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../../notifications/notifications.service';
import { PermissionsService } from '../../permissions/permissions.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import {
    HR_EVT, HrSubmitted, HrApproved, HrRejected, HrCancelled,
    HrProcurementDone, HrScheduleProposed, HrScheduleConfirmed, HrScheduleRescheduled,
    HrInstallStarted, HrInstallCompleted, HrCommented,
} from '../domain/events/hardware-request.events';

const link = (id: string) => `/hardware-requests/${id}`;

@Injectable()
export class InAppNotifierListener {
    constructor(
        private readonly notif: NotificationsService,
        private readonly perm: PermissionsService,
        private readonly q: HardwareRequestQueryService,
    ) {}

    private async push(userId: string, payload: { title: string; body: string; type: string; link: string; meta?: unknown }) {
        await this.notif.create({ userId, ...payload });
    }

    @OnEvent(HR_EVT.SUBMITTED)
    async onSubmitted(e: HrSubmitted) {
        const r = await this.q.findById(e.requestId);
        const leads = await this.perm.listUsersWithRole('ICT_LEAD');
        await Promise.all(leads.map(l => this.push(l.id, {
            title: 'Permintaan hardware baru',
            body: `${r.requestNumber} menunggu review`,
            type: 'HARDWARE_REQUEST_SUBMITTED',
            link: link(r.id),
        })));
    }

    @OnEvent(HR_EVT.APPROVED)
    async onApproved(e: HrApproved) {
        const r = await this.q.findById(e.requestId);
        const procs = await this.perm.listUsersWithRole('ICT_PROCUREMENT');
        await this.push(e.requesterId, {
            title: 'Request disetujui',
            body: `${r.requestNumber} approved, menunggu procurement`,
            type: 'HARDWARE_REQUEST_APPROVED',
            link: link(r.id),
        });
        await Promise.all(procs.map(p => this.push(p.id, {
            title: 'Procurement baru',
            body: `${r.requestNumber} siap diproses`,
            type: 'HARDWARE_REQUEST_APPROVED_PROC',
            link: link(r.id),
        })));
    }

    @OnEvent(HR_EVT.REJECTED)
    async onRejected(e: HrRejected) {
        const r = await this.q.findById(e.requestId);
        await this.push(e.requesterId, {
            title: 'Request ditolak',
            body: `${r.requestNumber}: ${e.reason.slice(0, 200)}`,
            type: 'HARDWARE_REQUEST_REJECTED',
            link: link(r.id),
        });
    }

    @OnEvent(HR_EVT.CANCELLED)
    async onCancelled(e: HrCancelled) {
        if (e.fromStatus !== 'UNDER_REVIEW') return;
        const leads = await this.perm.listUsersWithRole('ICT_LEAD');
        await Promise.all(leads.map(l => this.push(l.id, {
            title: 'Request dibatalkan oleh user',
            body: `Request ${e.requestId.slice(0, 8)} dicancel`,
            type: 'HARDWARE_REQUEST_CANCELLED',
            link: link(e.requestId),
        })));
    }

    @OnEvent(HR_EVT.PROCUREMENT_DONE)
    async onProcurementDone(e: HrProcurementDone) {
        const r = await this.q.findById(e.requestId);
        const techs = await this.perm.listUsersWithRole('ICT_TECHNICIAN');
        await this.push(e.requesterId, {
            title: 'Procurement selesai',
            body: `${r.requestNumber} siap jadwal instalasi`,
            type: 'HARDWARE_REQUEST_PROC_DONE',
            link: link(r.id),
        });
        await Promise.all(techs.map(t => this.push(t.id, {
            title: 'Siap dijadwalkan',
            body: `${r.requestNumber} menunggu instalasi`,
            type: 'HARDWARE_REQUEST_PROC_DONE_TECH',
            link: link(r.id),
        })));
    }

    @OnEvent(HR_EVT.SCHEDULE_PROPOSED)
    async onScheduleProposed(e: HrScheduleProposed) {
        const target = e.proposerId === e.technicianId ? e.requesterId : e.technicianId;
        await this.push(target, {
            title: 'Jadwal instalasi diusulkan',
            body: 'Mohon konfirmasi waktu',
            type: 'HARDWARE_REQUEST_SCHEDULE_PROPOSED',
            link: link(e.requestId),
        });
    }

    @OnEvent(HR_EVT.SCHEDULE_CONFIRMED)
    async onScheduleConfirmed(e: HrScheduleConfirmed) {
        await Promise.all([e.requesterId, e.technicianId].map(u => this.push(u, {
            title: 'Jadwal instalasi terkonfirmasi',
            body: 'Siap dilaksanakan',
            type: 'HARDWARE_REQUEST_SCHEDULE_CONFIRMED',
            link: link(e.requestId),
        })));
    }

    @OnEvent(HR_EVT.SCHEDULE_RESCHEDULED)
    async onScheduleRescheduled(e: HrScheduleRescheduled) {
        await Promise.all([e.requesterId, e.technicianId].map(u => this.push(u, {
            title: 'Jadwal instalasi diubah',
            body: e.reason ?? 'Mohon cek ulang jadwal',
            type: 'HARDWARE_REQUEST_SCHEDULE_RESCHEDULED',
            link: link(e.requestId),
        })));
    }

    @OnEvent(HR_EVT.INSTALL_STARTED)
    async onInstallStarted(e: HrInstallStarted) {
        await this.push(e.requesterId, {
            title: 'Instalasi dimulai',
            body: 'Teknisi sedang memasang hardware Anda',
            type: 'HARDWARE_REQUEST_INSTALL_STARTED',
            link: link(e.requestId),
        });
    }

    @OnEvent(HR_EVT.INSTALL_COMPLETED)
    async onInstallCompleted(e: HrInstallCompleted) {
        const r = await this.q.findById(e.requestId);
        const leads = await this.perm.listUsersWithRole('ICT_LEAD');
        await this.push(e.requesterId, {
            title: 'Instalasi selesai',
            body: `${r.requestNumber} completed`,
            type: 'HARDWARE_REQUEST_COMPLETED',
            link: link(r.id),
        });
        await Promise.all(leads.map(l => this.push(l.id, {
            title: 'Request selesai',
            body: r.requestNumber,
            type: 'HARDWARE_REQUEST_COMPLETED_LEAD',
            link: link(r.id),
        })));
    }

    @OnEvent(HR_EVT.COMMENTED)
    async onCommented(e: HrCommented) {
        const targets = e.subscribers.filter(u => u !== e.actorId);
        await Promise.all(targets.map(u => this.push(u, {
            title: 'Komentar baru',
            body: e.body.slice(0, 140),
            type: 'HARDWARE_REQUEST_COMMENTED',
            link: link(e.requestId),
        })));
    }
}
```

- [ ] **Step 3: Tests PASS. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): in-app notifier listener"
```

---

## Task 4.4: Email templates (Handlebars)

**Files:** 8 `.hbs` di `notifications/templates/hardware-request/`.

- [ ] **Step 1: `submitted.hbs`**

```hbs
<p>Halo Tim ICT Lead,</p>
<p>Permintaan hardware baru <strong>{{requestNumber}}</strong> telah disubmit oleh {{requesterName}}.</p>
<ul>
    <li>Site: {{siteName}}</li>
    <li>Jumlah item: {{itemCount}}</li>
    <li>Justifikasi: {{justification}}</li>
</ul>
<p><a href="{{appUrl}}/hardware-requests/{{requestId}}">Buka request</a></p>
```

- [ ] **Step 2: `approved.hbs`**

```hbs
<p>Halo {{recipientName}},</p>
<p>Request <strong>{{requestNumber}}</strong> telah disetujui oleh {{approverName}} dan diteruskan ke procurement.</p>
<p><a href="{{appUrl}}/hardware-requests/{{requestId}}">Lihat detail</a></p>
```

- [ ] **Step 3: `rejected.hbs`**

```hbs
<p>Halo {{recipientName}},</p>
<p>Mohon maaf, request <strong>{{requestNumber}}</strong> ditolak.</p>
<blockquote>{{reason}}</blockquote>
<p><a href="{{appUrl}}/hardware-requests/{{requestId}}">Detail</a></p>
```

- [ ] **Step 4: `procurement-done.hbs`**

```hbs
<p>Procurement untuk {{requestNumber}} selesai. Request siap memasuki tahap instalasi.</p>
<p>Total biaya: Rp {{totalCost}}</p>
<p><a href="{{appUrl}}/hardware-requests/{{requestId}}">Buka request</a></p>
```

- [ ] **Step 5: `schedule-proposed.hbs`**

```hbs
<p>Halo {{recipientName}},</p>
<p>Jadwal instalasi diusulkan oleh {{proposerName}}:</p>
<p><strong>{{scheduledStart}}</strong> — {{scheduledEnd}}</p>
<p>Mohon konfirmasi atau reschedule melalui aplikasi.</p>
<p><a href="{{appUrl}}/hardware-requests/{{requestId}}">Buka</a></p>
```

- [ ] **Step 6: `schedule-rescheduled.hbs`**

```hbs
<p>Jadwal instalasi {{requestNumber}} telah diubah.</p>
<p>Jadwal baru: <strong>{{scheduledStart}} — {{scheduledEnd}}</strong></p>
<p>Alasan: {{reason}}</p>
<p><a href="{{appUrl}}/hardware-requests/{{requestId}}">Konfirmasi jadwal</a></p>
```

- [ ] **Step 7: `install-completed.hbs`**

```hbs
<p>Instalasi request <strong>{{requestNumber}}</strong> telah diselesaikan oleh {{technicianName}} pada {{completedAt}}.</p>
<p>Barcode aset: {{#each barcodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</p>
<p><a href="{{appUrl}}/hardware-requests/{{requestId}}">Detail</a></p>
```

- [ ] **Step 8: `aging-reminder.hbs`**

```hbs
<p>Request <strong>{{requestNumber}}</strong> sudah berada di status {{status}} selama {{days}} hari.</p>
<p>Mohon dilanjutkan. <a href="{{appUrl}}/hardware-requests/{{requestId}}">Buka</a></p>
```

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/modules/notifications/templates/hardware-request/
git commit -m "feat(hardware-request): email templates"
```

---

## Task 4.5: Email notifier listener

**Files:** Create `listeners/email-notifier.listener.ts` + spec.

Asumsi existing `MailerService.sendTemplate({ to, subject, template, data })`.

- [ ] **Step 1: Spec (RED)**

```typescript
describe('EmailNotifierListener', () => {
    let listener: EmailNotifierListener;
    const mailer = { sendTemplate: jest.fn().mockResolvedValue(undefined) };
    const users = { findById: jest.fn().mockImplementation(async id => ({ id, email: `${id}@x.com`, fullName: `User ${id}` })) };
    const perm = { listUsersWithRole: jest.fn().mockResolvedValue([{ id: 'lead1', email: 'lead1@x.com', fullName: 'Lead 1' }]) };
    const q = { findById: jest.fn().mockResolvedValue({ id: 'r1', requestNumber: 'HR-2026-0001', siteName: 'HQ', justification: '...', items: [], requester: { fullName: 'User 1' } }) };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                EmailNotifierListener,
                { provide: MailerService, useValue: mailer },
                { provide: UsersService, useValue: users },
                { provide: PermissionsService, useValue: perm },
                { provide: HardwareRequestQueryService, useValue: q },
            ],
        }).compile();
        listener = mod.get(EmailNotifierListener);
        jest.clearAllMocks();
    });

    it('onSubmitted sends to ICT_LEAD', async () => {
        await listener.onSubmitted({ requestId: 'r1', actorId: 'u1', requesterId: 'u1', occurredAt: new Date() } as any);
        expect(mailer.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({
            to: 'lead1@x.com', template: 'hardware-request/submitted',
        }));
    });

    it('onRejected includes reason', async () => {
        await listener.onRejected({
            requestId: 'r1', actorId: 'lead1', requesterId: 'u1', reason: 'Tidak sesuai',
            occurredAt: new Date(),
        } as any);
        expect(mailer.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({
            template: 'hardware-request/rejected',
            data: expect.objectContaining({ reason: 'Tidak sesuai' }),
        }));
    });
});
```

- [ ] **Step 2: Implement**

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../mailer/mailer.service';
import { UsersService } from '../../users/users.service';
import { PermissionsService } from '../../permissions/permissions.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import {
    HR_EVT, HrSubmitted, HrApproved, HrRejected, HrProcurementDone,
    HrScheduleProposed, HrScheduleRescheduled, HrInstallCompleted, HrAgingFlagged,
} from '../domain/events/hardware-request.events';

@Injectable()
export class EmailNotifierListener {
    constructor(
        private readonly mailer: MailerService,
        private readonly users: UsersService,
        private readonly perm: PermissionsService,
        private readonly q: HardwareRequestQueryService,
        private readonly cfg: ConfigService,
    ) {}

    private appUrl() { return this.cfg.get('APP_URL') ?? ''; }

    private async send(to: string, subject: string, template: string, data: Record<string, unknown>) {
        await this.mailer.sendTemplate({ to, subject, template, data: { ...data, appUrl: this.appUrl() } });
    }

    @OnEvent(HR_EVT.SUBMITTED)
    async onSubmitted(e: HrSubmitted) {
        const r = await this.q.findById(e.requestId);
        const leads = await this.perm.listUsersWithRole('ICT_LEAD');
        await Promise.all(leads.map(l => this.send(
            l.email, `[ICT] Request baru ${r.requestNumber}`,
            'hardware-request/submitted',
            { requestNumber: r.requestNumber, requesterName: r.requester?.fullName, siteName: r.site?.name,
              itemCount: r.items?.length, justification: r.justification, requestId: r.id },
        )));
    }

    @OnEvent(HR_EVT.APPROVED)
    async onApproved(e: HrApproved) {
        const r = await this.q.findById(e.requestId);
        const requester = await this.users.findById(e.requesterId);
        const approver = await this.users.findById(e.actorId);
        await this.send(requester.email, `Request ${r.requestNumber} disetujui`, 'hardware-request/approved', {
            recipientName: requester.fullName, requestNumber: r.requestNumber,
            approverName: approver.fullName, requestId: r.id,
        });
        const procs = await this.perm.listUsersWithRole('ICT_PROCUREMENT');
        await Promise.all(procs.map(p => this.send(p.email, `[Procurement] ${r.requestNumber}`, 'hardware-request/approved', {
            recipientName: p.fullName, requestNumber: r.requestNumber, approverName: approver.fullName, requestId: r.id,
        })));
    }

    @OnEvent(HR_EVT.REJECTED)
    async onRejected(e: HrRejected) {
        const r = await this.q.findById(e.requestId);
        const requester = await this.users.findById(e.requesterId);
        await this.send(requester.email, `Request ${r.requestNumber} ditolak`, 'hardware-request/rejected', {
            recipientName: requester.fullName, requestNumber: r.requestNumber,
            reason: e.reason, requestId: r.id,
        });
    }

    @OnEvent(HR_EVT.PROCUREMENT_DONE)
    async onProcurementDone(e: HrProcurementDone) {
        const r = await this.q.findById(e.requestId);
        const total = (r.items || []).reduce((s, it: any) => s + Number(it.actualCost ?? 0) * it.quantity, 0);
        const requester = await this.users.findById(e.requesterId);
        const techs = await this.perm.listUsersWithRole('ICT_TECHNICIAN');
        await this.send(requester.email, `Procurement ${r.requestNumber} selesai`, 'hardware-request/procurement-done', {
            requestNumber: r.requestNumber, totalCost: total.toLocaleString('id-ID'), requestId: r.id,
        });
        await Promise.all(techs.map(t => this.send(t.email, `[Install] ${r.requestNumber}`, 'hardware-request/procurement-done', {
            requestNumber: r.requestNumber, totalCost: total.toLocaleString('id-ID'), requestId: r.id,
        })));
    }

    @OnEvent(HR_EVT.SCHEDULE_PROPOSED)
    async onScheduleProposed(e: HrScheduleProposed) {
        const toUserId = e.proposerId === e.technicianId ? e.requesterId : e.technicianId;
        const to = await this.users.findById(toUserId);
        const proposer = await this.users.findById(e.proposerId);
        const r = await this.q.findById(e.requestId);
        const sched = r.installationSchedule;
        await this.send(to.email, `Jadwal instalasi ${r.requestNumber}`, 'hardware-request/schedule-proposed', {
            recipientName: to.fullName, proposerName: proposer.fullName,
            scheduledStart: sched?.scheduledStart, scheduledEnd: sched?.scheduledEnd,
            requestId: r.id, requestNumber: r.requestNumber,
        });
    }

    @OnEvent(HR_EVT.SCHEDULE_RESCHEDULED)
    async onScheduleRescheduled(e: HrScheduleRescheduled) {
        const r = await this.q.findById(e.requestId);
        const sched = r.installationSchedule;
        await Promise.all([e.requesterId, e.technicianId].map(async uid => {
            const u = await this.users.findById(uid);
            await this.send(u.email, `Reschedule: ${r.requestNumber}`, 'hardware-request/schedule-rescheduled', {
                requestNumber: r.requestNumber, scheduledStart: sched?.scheduledStart, scheduledEnd: sched?.scheduledEnd,
                reason: e.reason ?? '-', requestId: r.id,
            });
        }));
    }

    @OnEvent(HR_EVT.INSTALL_COMPLETED)
    async onInstallCompleted(e: HrInstallCompleted) {
        const r = await this.q.findById(e.requestId);
        const requester = await this.users.findById(e.requesterId);
        const leads = await this.perm.listUsersWithRole('ICT_LEAD');
        const barcodes = (r.assets || []).map((a: any) => a.barcode);
        const data = {
            requestNumber: r.requestNumber,
            technicianName: (await this.users.findById(e.actorId)).fullName,
            completedAt: r.completedAt, barcodes, requestId: r.id,
        };
        await this.send(requester.email, `${r.requestNumber} selesai`, 'hardware-request/install-completed', data);
        await Promise.all(leads.map(l => this.send(l.email, `Completed: ${r.requestNumber}`, 'hardware-request/install-completed', data)));
    }

    @OnEvent(HR_EVT.AGING_FLAGGED)
    async onAgingFlagged(e: HrAgingFlagged) {
        const r = await this.q.findById(e.requestId);
        const leads = await this.perm.listUsersWithRole('ICT_LEAD');
        await Promise.all(leads.map(l => this.send(l.email, `Aging: ${r.requestNumber}`, 'hardware-request/aging-reminder', {
            requestNumber: r.requestNumber, status: e.status, days: e.daysInStatus, requestId: r.id,
        })));
    }
}
```

- [ ] **Step 3: Run tests → PASS. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): email notifier listener"
```

---

## Task 4.6: WebSocket gateway

**Files:** Create `realtime/hardware-request.gateway.ts` + spec.

- [ ] **Step 1: Spec (RED)**

```typescript
describe('HardwareRequestGateway', () => {
    let gw: HardwareRequestGateway;
    const server = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({ providers: [HardwareRequestGateway] }).compile();
        gw = mod.get(HardwareRequestGateway);
        (gw as any).server = server;
        jest.clearAllMocks();
    });

    it('emits status-changed to request room + global', () => {
        gw.onStatusChanged({ requestId: 'r1', actorId: 'u1', occurredAt: new Date() } as any);
        expect(server.to).toHaveBeenCalledWith('request:r1');
        expect(server.to).toHaveBeenCalledWith('global');
        expect(server.emit).toHaveBeenCalledWith('status-changed', expect.objectContaining({ requestId: 'r1' }));
    });

    it('emits comment-added only to request room', () => {
        gw.onCommented({ requestId: 'r1', actorId: 'u1', commentId: 'c1', body: 'hi', subscribers: [], occurredAt: new Date() } as any);
        expect(server.to).toHaveBeenCalledWith('request:r1');
        expect(server.emit).toHaveBeenCalledWith('comment-added', expect.any(Object));
    });

    it('handleJoinRequest subscribes socket to room', () => {
        const socket = { join: jest.fn() } as any;
        gw.handleJoinRequest(socket, { requestId: 'r1' });
        expect(socket.join).toHaveBeenCalledWith('request:r1');
    });
});
```

- [ ] **Step 2: Implement**

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
    WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody,
    OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
    HR_EVT, HrEventBase, HrCommented, HrScheduleProposed, HrScheduleConfirmed,
    HrScheduleRescheduled, HrInstallStarted, HrInstallCompleted,
} from '../domain/events/hardware-request.events';

@Injectable()
@WebSocketGateway({ namespace: '/ws/hardware-requests', cors: true })
export class HardwareRequestGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;

    handleConnection(_socket: Socket) {/* authn via existing jwt middleware */}
    handleDisconnect(_socket: Socket) {/* noop */}

    @SubscribeMessage('join-request')
    handleJoinRequest(@ConnectedSocket() socket: Socket, @MessageBody() body: { requestId: string }) {
        socket.join(`request:${body.requestId}`);
        return { ok: true };
    }

    @SubscribeMessage('leave-request')
    handleLeaveRequest(@ConnectedSocket() socket: Socket, @MessageBody() body: { requestId: string }) {
        socket.leave(`request:${body.requestId}`);
        return { ok: true };
    }

    private emitBoth(event: string, payload: unknown, requestId: string) {
        this.server.to(`request:${requestId}`).emit(event, payload);
        this.server.to('global').emit(event, payload);
    }

    private emitRoom(event: string, payload: unknown, requestId: string) {
        this.server.to(`request:${requestId}`).emit(event, payload);
    }

    @OnEvent(HR_EVT.SUBMITTED)
    @OnEvent(HR_EVT.APPROVED)
    @OnEvent(HR_EVT.REJECTED)
    @OnEvent(HR_EVT.CANCELLED)
    @OnEvent(HR_EVT.PROCUREMENT_DONE)
    @OnEvent(HR_EVT.INSTALL_COMPLETED)
    onStatusChanged(e: HrEventBase) {
        this.emitBoth('status-changed', e, e.requestId);
    }

    @OnEvent(HR_EVT.COMMENTED)
    onCommented(e: HrCommented) {
        this.emitRoom('comment-added', e, e.requestId);
    }

    @OnEvent(HR_EVT.SCHEDULE_PROPOSED)
    @OnEvent(HR_EVT.SCHEDULE_CONFIRMED)
    @OnEvent(HR_EVT.SCHEDULE_RESCHEDULED)
    onScheduleUpdated(e: HrScheduleProposed | HrScheduleConfirmed | HrScheduleRescheduled) {
        this.emitBoth('schedule-updated', e, e.requestId);
    }

    @OnEvent(HR_EVT.INSTALL_STARTED)
    onInstallProgress(e: HrInstallStarted) {
        this.emitBoth('install-progress', e, e.requestId);
    }
}
```

- [ ] **Step 3: Tests PASS. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): websocket gateway"
```

---

## Task 4.7: Aging reminder cron

**Files:** Create `listeners/aging-reminder.cron.ts` + spec.

Ambang: SUBMITTED/UNDER_REVIEW > 3 hari → flag kuning (info), > 7 hari → flag merah + emit `AGING_FLAGGED` ke EmailNotifier. Jalankan tiap pagi 07:00 Asia/Jakarta.

- [ ] **Step 1: Spec (RED)**

```typescript
describe('AgingReminderCron', () => {
    let cron: AgingReminderCron;
    const repo = { find: jest.fn() };
    const emitter = { emit: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                AgingReminderCron,
                { provide: getRepositoryToken(HardwareRequest), useValue: repo },
                { provide: EventEmitter2, useValue: emitter },
            ],
        }).compile();
        cron = mod.get(AgingReminderCron);
        jest.clearAllMocks();
    });

    it('emits AGING_FLAGGED for requests stuck > 7 days in non-terminal', async () => {
        const oldDate = new Date(Date.now() - 8 * 24 * 3600 * 1000);
        repo.find.mockResolvedValue([{ id: 'r1', status: 'UNDER_REVIEW', updatedAt: oldDate, requesterId: 'u1' }]);
        await cron.runDaily();
        expect(emitter.emit).toHaveBeenCalledWith('hardware-request.aging.flagged', expect.objectContaining({
            requestId: 'r1', daysInStatus: 8, status: 'UNDER_REVIEW',
        }));
    });

    it('ignores terminal statuses', async () => {
        repo.find.mockResolvedValue([]);
        await cron.runDaily();
        expect(emitter.emit).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Implement**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { HR_EVT } from '../domain/events/hardware-request.events';

const DAYS = 24 * 60 * 60 * 1000;

@Injectable()
export class AgingReminderCron {
    private readonly log = new Logger(AgingReminderCron.name);
    private readonly thresholdDays = 7;

    constructor(
        @InjectRepository(HardwareRequest) private readonly repo: Repository<HardwareRequest>,
        private readonly emitter: EventEmitter2,
    ) {}

    @Cron('0 7 * * *', { timeZone: 'Asia/Jakarta', name: 'hr-aging-reminder' })
    async runDaily() {
        const nonTerminal = [
            RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW,
            RequestStatus.APPROVED, RequestStatus.PROCUREMENT, RequestStatus.INSTALLATION,
        ];
        const rows = await this.repo.find({ where: { status: In(nonTerminal) } });
        const now = Date.now();
        for (const r of rows) {
            const days = Math.floor((now - new Date(r.updatedAt).getTime()) / DAYS);
            if (days < this.thresholdDays) continue;
            this.emitter.emit(HR_EVT.AGING_FLAGGED, {
                requestId: r.id, actorId: 'system', requesterId: r.requesterId,
                occurredAt: new Date(), daysInStatus: days, status: r.status,
            });
        }
        this.log.log(`aging reminder scanned ${rows.length} requests`);
    }
}
```

- [ ] **Step 3: Register `ScheduleModule.forRoot()` di `app.module.ts` (jika belum).**

- [ ] **Step 4: Tests PASS. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): aging reminder cron"
```

---

## Task 4.8: Module wiring

**Files:** Modify `hardware-request.module.ts`.

- [ ] **Step 1: Tambahkan**

```typescript
imports: [
    TypeOrmModule.forFeature([...]),
    EventEmitterModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => MailerModule),
    forwardRef(() => UsersModule),
    forwardRef(() => PermissionsModule),
],
providers: [
    ...,
    InAppNotifierListener,
    EmailNotifierListener,
    AgingReminderCron,
    HardwareRequestGateway,
],
```

- [ ] **Step 2: Boot smoke — cek WS listen di `/ws/hardware-requests`.**

```bash
pnpm --filter backend start:dev
# browser console:  const s = io('/ws/hardware-requests'); s.emit('join-request', { requestId: 'x' });
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(hardware-request): wire listeners + gateway into module"
```

---

## Task 4.9: Integration test — end-to-end notification

**Files:** Create `test/integration/hr-notifications.e2e-spec.ts`.

- [ ] **Step 1: Test skeleton**

```typescript
describe('HR notifications end-to-end', () => {
    // spy MailerService.sendTemplate + NotificationsService.create
    // run submit → assert 1 mail + N in-app to lead users
    // run approve → assert requester + procs
    // run commentedEvent → assert subscribers except author
    // connect socket client, subscribe request:r1, trigger approve, assert `status-changed` received
});
```

Implementasi pakai `Test.createTestingModule` dengan mock MailerService (resolve) & real NotificationsService hitting test DB.

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter backend test:integration -- hr-notifications
git add -A && git commit -m "test(hardware-request): notifications e2e"
```

---

## Verification Checklist (Plan 4)

- [ ] Tiap transisi backend memicu in-app record (cek `notifications` table)
- [ ] Tiap transisi wajib email terpanggil sesuai matrix §8
- [ ] WebSocket client menerima `status-changed`, `comment-added`, `schedule-updated`, `install-progress` pada room `request:${id}`
- [ ] Aging cron berjalan; untuk request dummy >7 hari → email reminder ke lead
- [ ] Tidak ada double-email (idempoten per event)
- [ ] Unit + integration ≥80% coverage untuk `listeners/` dan `realtime/`

**Next:** Plan 5 — Dashboard, Catalog Admin, Data Migration.
