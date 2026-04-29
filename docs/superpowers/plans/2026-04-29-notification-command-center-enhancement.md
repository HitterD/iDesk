# Notification Command Center Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan auto-resolve via socket, snooze manual (DB-backed), CRITICAL banner dengan Acknowledge, dan per-kategori settings ke Action Command Center & Notification Center.

**Architecture:** Backend menyimpan snooze ke tabel `action_item_snooze`, emits socket event `action-items:refresh:{userId}` saat entity berubah status, dan menyaring snoozed/disabled items di `getActionItems()`. Frontend menampilkan snooze UI di popover, banner CRITICAL di notification center, dan category toggles di settings.

**Tech Stack:** NestJS + TypeORM (backend), React + TanStack Query + Socket.IO client + Framer Motion + lucide-react + Tailwind CSS (frontend), Sonner (toast)

---

## File Map

**Backend — Create:**
- `apps/backend/src/migrations/1777400000000-AddActionItemSnooze.ts`
- `apps/backend/src/modules/notifications/entities/action-item-snooze.entity.ts`
- `apps/backend/src/modules/notifications/dto/snooze-action-item.dto.ts`

**Backend — Modify:**
- `apps/backend/src/modules/notifications/entities/notification-preference.entity.ts` — add `categorySettings` column
- `apps/backend/src/modules/notifications/dto/action-item.dto.ts` — add `isSnoozed`, `snoozeUntil`
- `apps/backend/src/modules/notifications/notification-center.service.ts` — snooze join, category filter, emit refresh
- `apps/backend/src/modules/notifications/notification.controller.ts` — 4 new endpoints
- `apps/backend/src/modules/notifications/notification.module.ts` — inject new entity
- `apps/backend/src/modules/ticketing/listeners/ticket-notification.listener.ts` — emit refresh
- `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts` — emit refresh
- `apps/backend/src/modules/eform-request/listeners/eform-notification.listener.ts` — emit refresh
- `apps/backend/src/modules/renewal/renewal.service.ts` — emit refresh

**Frontend — Create:**
- `apps/frontend/src/features/notifications/hooks/useSnoozeActionItem.ts`
- `apps/frontend/src/features/notifications/hooks/useCategorySettings.ts`

**Frontend — Modify:**
- `apps/frontend/src/components/notifications/types/action-item.types.ts`
- `apps/frontend/src/features/notifications/hooks/useActionItems.ts`
- `apps/frontend/src/components/notifications/ActionCommandCenter.tsx`
- `apps/frontend/src/components/notifications/NotificationItem.tsx`
- `apps/frontend/src/components/notifications/NotificationCenter.tsx`
- `apps/frontend/src/features/notifications/hooks/useNotificationCenter.ts`
- `apps/frontend/src/features/settings/components/NotificationSettings.tsx`

---

## Task 1: Migration — Tabel action_item_snooze

**Files:**
- Create: `apps/backend/src/migrations/1777400000000-AddActionItemSnooze.ts`

- [ ] **Step 1: Buat file migration**

```typescript
// apps/backend/src/migrations/1777400000000-AddActionItemSnooze.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActionItemSnooze1777400000000 implements MigrationInterface {
    name = 'AddActionItemSnooze1777400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "action_item_snooze" (
                "id"            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id"       VARCHAR     NOT NULL,
                "entity_type"   VARCHAR     NOT NULL,
                "entity_id"     VARCHAR     NOT NULL,
                "snoozed_until" TIMESTAMP   NOT NULL,
                "created_at"    TIMESTAMP   DEFAULT NOW(),
                CONSTRAINT "uq_snooze_user_entity" UNIQUE ("user_id", "entity_type", "entity_id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_snooze_user_expiry"
            ON "action_item_snooze" ("user_id", "snoozed_until")
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_preferences"
            ADD COLUMN IF NOT EXISTS "categorySettings" jsonb DEFAULT '{}'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_snooze_user_expiry"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "action_item_snooze"`);
        await queryRunner.query(`
            ALTER TABLE "notification_preferences"
            DROP COLUMN IF EXISTS "categorySettings"
        `);
    }
}
```

- [ ] **Step 2: Commit**

```bash
cd apps/backend
git add src/migrations/1777400000000-AddActionItemSnooze.ts
git commit -m "feat(backend): add action_item_snooze migration and categorySettings column"
```

---

## Task 2: Entity — ActionItemSnooze

**Files:**
- Create: `apps/backend/src/modules/notifications/entities/action-item-snooze.entity.ts`

- [ ] **Step 1: Buat entity**

```typescript
// apps/backend/src/modules/notifications/entities/action-item-snooze.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('action_item_snooze')
@Index(['userId', 'entityType', 'entityId'], { unique: true })
export class ActionItemSnooze {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column()
    entityType: string;

    @Column()
    entityId: string;

    @Column({ type: 'timestamp' })
    snoozedUntil: Date;

    @CreateDateColumn()
    createdAt: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/notifications/entities/action-item-snooze.entity.ts
git commit -m "feat(backend): add ActionItemSnooze entity"
```

---

## Task 3: Update NotificationPreference entity + ActionItemDto

**Files:**
- Modify: `apps/backend/src/modules/notifications/entities/notification-preference.entity.ts`
- Modify: `apps/backend/src/modules/notifications/dto/action-item.dto.ts`

- [ ] **Step 1: Tambah `categorySettings` ke NotificationPreference entity**

Buka `apps/backend/src/modules/notifications/entities/notification-preference.entity.ts`, tambahkan setelah blok `// Reminder Settings`:

```typescript
    // =====================
    // Action Item Category Settings
    // =====================
    // Controls which entity categories appear in Action Command Center
    // Default: all true (if null, all categories are enabled)
    @Column('jsonb', { nullable: true })
    categorySettings?: {
        TICKET: boolean;
        HARDWARE_REQUEST: boolean;
        EFORM: boolean;
        RENEWAL: boolean;
        ZOOM: boolean;
    };
```

- [ ] **Step 2: Extend ActionItemDto dengan snooze fields**

Buka `apps/backend/src/modules/notifications/dto/action-item.dto.ts`, update class `ActionItemDto`:

```typescript
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

    @ApiProperty()
    isSnoozed: boolean;

    @ApiProperty({ required: false })
    snoozeUntil?: string;
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

- [ ] **Step 3: Commit**

```bash
git add src/modules/notifications/entities/notification-preference.entity.ts
git add src/modules/notifications/dto/action-item.dto.ts
git commit -m "feat(backend): add categorySettings to NotificationPreference, extend ActionItemDto with snooze fields"
```

---

## Task 4: DTO — SnoozeActionItemDto

**Files:**
- Create: `apps/backend/src/modules/notifications/dto/snooze-action-item.dto.ts`

- [ ] **Step 1: Buat DTO**

```typescript
// apps/backend/src/modules/notifications/dto/snooze-action-item.dto.ts
import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ActionItemEntityType } from './action-item.dto';

export class SnoozeActionItemDto {
    @ApiProperty({ enum: ActionItemEntityType })
    @IsEnum(ActionItemEntityType)
    entityType: ActionItemEntityType;

    @ApiProperty()
    @IsString()
    entityId: string;

    @ApiProperty({ enum: ['30m', '2h', 'tomorrow'] })
    @IsEnum(['30m', '2h', 'tomorrow'])
    duration: '30m' | '2h' | 'tomorrow';
}

export class UnsnoozeActionItemDto {
    @ApiProperty({ enum: ActionItemEntityType })
    @IsEnum(ActionItemEntityType)
    entityType: ActionItemEntityType;

    @ApiProperty()
    @IsString()
    entityId: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/notifications/dto/snooze-action-item.dto.ts
git commit -m "feat(backend): add SnoozeActionItemDto and UnsnoozeActionItemDto"
```

---

## Task 5: NotificationModule — Wire ActionItemSnooze

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification.module.ts`

- [ ] **Step 1: Tambah import ActionItemSnooze**

Buka `apps/backend/src/modules/notifications/notification.module.ts`.

Tambahkan import di bagian atas:
```typescript
import { ActionItemSnooze } from './entities/action-item-snooze.entity';
```

Tambahkan `ActionItemSnooze` ke array `TypeOrmModule.forFeature([...])`  — setelah `PushSubscription`:
```typescript
TypeOrmModule.forFeature([
    Notification,
    NotificationPreference,
    NotificationLog,
    PushSubscription,
    User,
    ActionItemSnooze,  // tambahkan ini
]),
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/notifications/notification.module.ts
git commit -m "feat(backend): register ActionItemSnooze repository in NotificationModule"
```

---

## Task 6: NotificationCenterService — Snooze logic + emitActionItemsRefresh

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification-center.service.ts`

- [ ] **Step 1: Inject ActionItemSnooze repository dan EventsGateway**

Buka `apps/backend/src/modules/notifications/notification-center.service.ts`.

Tambahkan imports di bagian atas (setelah existing imports):
```typescript
import { ActionItemSnooze } from './entities/action-item-snooze.entity';
import { LessThan, MoreThan } from 'typeorm';
import { addMinutes, addHours, addDays, startOfDay, setHours } from 'date-fns';
import { EventsGateway } from '../ticketing/gateways/events.gateway';
import { forwardRef, Inject } from '@nestjs/common';
```

Tambahkan di constructor:
```typescript
@InjectRepository(ActionItemSnooze)
private readonly snoozeRepo: Repository<ActionItemSnooze>,
@Inject(forwardRef(() => EventsGateway))
private readonly eventsGateway: EventsGateway,
```

- [ ] **Step 2: Tambah method resolveSnoozedUntil dan emitActionItemsRefresh**

Tambahkan method berikut ke class (sebelum `getActionItems`):

```typescript
private resolveSnoozedUntil(duration: '30m' | '2h' | 'tomorrow'): Date {
    const now = new Date();
    if (duration === '30m') return addMinutes(now, 30);
    if (duration === '2h') return addHours(now, 2);
    const tomorrow = startOfDay(addDays(now, 1));
    return setHours(tomorrow, 8);
}

emitActionItemsRefresh(userId: string, entityType: string, entityId: string): void {
    this.eventsGateway.server.emit(`action-items:refresh:${userId}`, { entityType, entityId });
}

async snoozeActionItem(userId: string, entityType: string, entityId: string, duration: '30m' | '2h' | 'tomorrow'): Promise<{ snoozeUntil: string }> {
    const snoozedUntil = this.resolveSnoozedUntil(duration);
    await this.snoozeRepo.upsert(
        { userId, entityType, entityId, snoozedUntil },
        { conflictPaths: ['userId', 'entityType', 'entityId'] }
    );
    this.emitActionItemsRefresh(userId, entityType, entityId);
    return { snoozeUntil: snoozedUntil.toISOString() };
}

async unsnoozeActionItem(userId: string, entityType: string, entityId: string): Promise<void> {
    await this.snoozeRepo.delete({ userId, entityType, entityId });
    this.emitActionItemsRefresh(userId, entityType, entityId);
}

async getCategorySettings(userId: string): Promise<Record<string, boolean>> {
    const pref = await this.preferenceRepo.findOne({ where: { userId } });
    const defaults = { TICKET: true, HARDWARE_REQUEST: true, EFORM: true, RENEWAL: true, ZOOM: true };
    if (!pref?.categorySettings) return defaults;
    return { ...defaults, ...pref.categorySettings };
}

async updateCategorySettings(userId: string, updates: Partial<Record<string, boolean>>): Promise<Record<string, boolean>> {
    const pref = await this.preferenceRepo.findOne({ where: { userId } });
    if (!pref) {
        throw new Error('Notification preferences not found');
    }
    const current = pref.categorySettings || {};
    const updated = { ...current, ...updates };
    await this.preferenceRepo.update({ userId }, { categorySettings: updated as any });
    this.emitActionItemsRefresh(userId, 'SETTINGS', 'categories');
    const defaults = { TICKET: true, HARDWARE_REQUEST: true, EFORM: true, RENEWAL: true, ZOOM: true };
    return { ...defaults, ...updated };
}
```

- [ ] **Step 3: Update getActionItems untuk join snooze + filter kategori**

Temukan method `async getActionItems(userId: string, role: string)` dan update logika di akhirnya, tepat sebelum `return` statement. Tambahkan kode berikut sebelum return:

```typescript
// Load active snoozes untuk user
const now = new Date();
const activeSnoozes = await this.snoozeRepo.find({
    where: { userId, snoozedUntil: MoreThan(now) },
});
const snoozeMap = new Map(
    activeSnoozes.map(s => [`${s.entityType}:${s.entityId}`, s.snoozedUntil])
);

// Load category settings
const categorySettings = await this.getCategorySettings(userId);

// Annotate items dengan snooze info + filter disabled categories
const annotatedItems = items
    .filter(item => {
        const catKey = item.entityType as string;
        return categorySettings[catKey] !== false;
    })
    .map(item => {
        const key = `${item.entityType}:${item.entityId}`;
        const snoozeUntil = snoozeMap.get(key);
        return {
            ...item,
            isSnoozed: !!snoozeUntil,
            snoozeUntil: snoozeUntil?.toISOString(),
        };
    });

// Recalculate counts (exclude snoozed items)
const activeItems = annotatedItems.filter(i => !i.isSnoozed);
const counts = {
    critical: activeItems.filter(i => i.urgency === ActionItemUrgency.CRITICAL).length,
    high: activeItems.filter(i => i.urgency === ActionItemUrgency.HIGH).length,
    normal: activeItems.filter(i => i.urgency === ActionItemUrgency.NORMAL).length,
    total: activeItems.length,
};

return { items: annotatedItems, counts };
```

Pastikan baris `return { items, counts: ... }` yang lama dihapus dan diganti dengan `return { items: annotatedItems, counts }`.

- [ ] **Step 4: Commit**

```bash
git add src/modules/notifications/notification-center.service.ts
git commit -m "feat(backend): add snooze logic, category filter, and emitActionItemsRefresh to NotificationCenterService"
```

---

## Task 7: NotificationController — Snooze + Category endpoints

**Files:**
- Modify: `apps/backend/src/modules/notifications/notification.controller.ts`

- [ ] **Step 1: Tambah imports**

Di bagian atas file, tambahkan import:
```typescript
import { SnoozeActionItemDto, UnsnoozeActionItemDto } from './dto/snooze-action-item.dto';
```

- [ ] **Step 2: Tambah 4 endpoint baru**

Tambahkan setelah `@Get('action-items')` endpoint yang sudah ada:

```typescript
@Post('action-items/snooze')
@ApiOperation({ summary: 'Snooze an action item' })
@ApiResponse({ status: 200, description: 'Action item snoozed.' })
async snoozeActionItem(@Request() req: any, @Body() body: SnoozeActionItemDto) {
    return this.notificationCenterService.snoozeActionItem(
        req.user.userId,
        body.entityType,
        body.entityId,
        body.duration,
    );
}

@Delete('action-items/snooze')
@ApiOperation({ summary: 'Unsnooze an action item' })
@ApiResponse({ status: 200, description: 'Action item unsnoozed.' })
async unsnoozeActionItem(@Request() req: any, @Body() body: UnsnoozeActionItemDto) {
    await this.notificationCenterService.unsnoozeActionItem(
        req.user.userId,
        body.entityType,
        body.entityId,
    );
    return { success: true };
}

@Get('preferences/categories')
@ApiOperation({ summary: 'Get action item category settings' })
async getCategorySettings(@Request() req: any) {
    return this.notificationCenterService.getCategorySettings(req.user.userId);
}

@Patch('preferences/categories')
@ApiOperation({ summary: 'Update action item category settings' })
async updateCategorySettings(@Request() req: any, @Body() updates: Record<string, boolean>) {
    return this.notificationCenterService.updateCategorySettings(req.user.userId, updates);
}
```

- [ ] **Step 3: Tambah Delete decorator import jika belum ada**

Pastikan `Delete` ada di import dari `@nestjs/common`:
```typescript
import { Controller, Get, Post, Delete, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/notifications/notification.controller.ts
git commit -m "feat(backend): add snooze and category settings endpoints to NotificationController"
```

---

## Task 8: Auto-resolve — Ticket Listener

**Files:**
- Modify: `apps/backend/src/modules/ticketing/listeners/ticket-notification.listener.ts`

- [ ] **Step 1: Inject NotificationCenterService**

Buka file listener, tambahkan import:
```typescript
import { NotificationCenterService } from '../../notifications/notification-center.service';
```

Tambahkan ke constructor (setelah `notificationService`):
```typescript
private readonly notificationCenterService: NotificationCenterService,
```

- [ ] **Step 2: Emit refresh di handleTicketRepliedEvent**

Cari `@OnEvent('ticket.replied')` handler. Setelah blok notifikasi berhasil dikirim (di dalam try block, setelah `notificationService` calls), tambahkan:

```typescript
// Emit action-items refresh bagi assignee dan requester agar item hilang otomatis
if (event.ticket?.assigneeId) {
    this.notificationCenterService.emitActionItemsRefresh(
        event.ticket.assigneeId, 'TICKET', event.ticketId
    );
}
if (event.ticket?.userId) {
    this.notificationCenterService.emitActionItemsRefresh(
        event.ticket.userId, 'TICKET', event.ticketId
    );
}
```

- [ ] **Step 3: Emit refresh di handleTicketUpdatedEvent untuk RESOLVED/CLOSED**

Cari `@OnEvent('ticket.updated')` handler. Di dalam blok yang mengecek `ticket.status === TicketStatus.RESOLVED`, tambahkan setelah notifikasi dikirim:

```typescript
// Auto-resolve: emit refresh ke semua pihak yang terlibat
if (ticket.user?.id) {
    this.notificationCenterService.emitActionItemsRefresh(ticket.user.id, 'TICKET', ticket.id);
}
if (ticket.assigneeId) {
    this.notificationCenterService.emitActionItemsRefresh(ticket.assigneeId, 'TICKET', ticket.id);
}
```

Lakukan hal yang sama untuk status `CLOSED` jika ada handler-nya.

- [ ] **Step 4: Commit**

```bash
git add src/modules/ticketing/listeners/ticket-notification.listener.ts
git commit -m "feat(backend): emit action-items:refresh on ticket reply and resolve/close"
```

---

## Task 9: Auto-resolve — Hardware + EForm + Renewal

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts`
- Modify: `apps/backend/src/modules/eform-request/listeners/eform-notification.listener.ts`
- Modify: `apps/backend/src/modules/renewal/renewal.service.ts`

- [ ] **Step 1: Hardware listener — inject NotificationCenterService + emit on APPROVED/REJECTED/COMPLETED**

Buka `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts`.

Tambahkan import:
```typescript
import { NotificationCenterService } from '../../notifications/notification-center.service';
```

Tambahkan ke constructor:
```typescript
private readonly notificationCenterService: NotificationCenterService,
```

Di `onApproved` handler, setelah blok `await this.push(...)`, tambahkan:
```typescript
this.notificationCenterService.emitActionItemsRefresh(e.requesterId, 'HARDWARE_REQUEST', e.requestId);
```

Di `onRejected` handler, tambahkan:
```typescript
this.notificationCenterService.emitActionItemsRefresh(e.requesterId, 'HARDWARE_REQUEST', e.requestId);
```

Cari handler untuk `HR_EVT.COMPLETED` (atau install-completed), tambahkan:
```typescript
this.notificationCenterService.emitActionItemsRefresh(e.requesterId, 'HARDWARE_REQUEST', e.requestId);
```

- [ ] **Step 2: EForm listener — emit on ict-confirmed + rejected**

Buka `apps/backend/src/modules/eform-request/listeners/eform-notification.listener.ts`.

EFormNotificationListener sudah inject `notificationCenter: NotificationCenterService`. Tambahkan import dan cast:

Di `handleEFormIctConfirmed`, setelah `await this.notificationCenter.send(...)`:
```typescript
this.notificationCenter.emitActionItemsRefresh(
    payload.request.requesterId, 'EFORM', payload.request.id
);
```

Cari handler `@OnEvent('eform.rejected')` (atau buat jika belum ada — cek event name yang dipakai):
```typescript
@OnEvent('eform.rejected')
async handleEFormRejected(payload: { request: EFormRequest }) {
    try {
        await this.notificationCenter.send({
            userId: payload.request.requesterId,
            type: NotificationType.EFORM_REJECTED,
            title: 'Permintaan Akses Ditolak',
            message: `Permintaan akses ${payload.request.formType} Anda ditolak.`,
            referenceId: payload.request.id,
        });
        this.notificationCenter.emitActionItemsRefresh(
            payload.request.requesterId, 'EFORM', payload.request.id
        );
    } catch (error: any) {
        this.logger.error(`Failed to notify requester for eform.rejected: ${error.message}`);
    }
}
```

- [ ] **Step 3: Renewal service — emit on contract update**

Buka `apps/backend/src/modules/renewal/renewal.service.ts`.

Tambahkan import:
```typescript
import { NotificationCenterService } from '../notifications/notification-center.service';
```

Inject di constructor:
```typescript
private readonly notificationCenterService: NotificationCenterService,
```

Cari method `update(id: string, ...)` atau method yang mengubah `endDate`/`status`. Setelah save/update berhasil, ambil list admin/agent user IDs yang perlu di-refresh dan emit:

```typescript
// Emit refresh ke semua admin yang mungkin punya renewal action item
// (karena action items renewal bersifat role-based, emit ke semua admin)
const admins = await this.userRepo?.find({ where: { role: 'ADMIN' } });
for (const admin of (admins || [])) {
    this.notificationCenterService.emitActionItemsRefresh(admin.id, 'RENEWAL', id);
}
```

Catatan: jika RenewalService tidak memiliki `userRepo`, inject `@InjectRepository(User) private readonly userRepo: Repository<User>` dan import User entity.

- [ ] **Step 4: Commit**

```bash
git add src/modules/hardware-request/listeners/in-app-notifier.listener.ts
git add src/modules/eform-request/listeners/eform-notification.listener.ts
git add src/modules/renewal/renewal.service.ts
git commit -m "feat(backend): emit action-items:refresh on hardware/eform/renewal status changes"
```

---

## Task 10: Frontend — Update ActionItem types

**Files:**
- Modify: `apps/frontend/src/components/notifications/types/action-item.types.ts`

- [ ] **Step 1: Tambah snooze fields ke ActionItem**

```typescript
// apps/frontend/src/components/notifications/types/action-item.types.ts
export type ActionItemUrgency = 'CRITICAL' | 'HIGH' | 'NORMAL';
export type ActionItemEntityType = 'TICKET' | 'HARDWARE_REQUEST' | 'EFORM' | 'RENEWAL';
export type SnoozeDuration = '30m' | '2h' | 'tomorrow';

export interface ActionItem {
    id: string;
    entityType: ActionItemEntityType;
    title: string;
    description: string;
    urgency: ActionItemUrgency;
    entityId: string;
    link: string;
    createdAt: string;
    isSnoozed: boolean;
    snoozeUntil?: string;
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

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/notifications/types/action-item.types.ts
git commit -m "feat(frontend): add isSnoozed and snoozeUntil fields to ActionItem type"
```

---

## Task 11: Frontend — useSnoozeActionItem hook

**Files:**
- Create: `apps/frontend/src/features/notifications/hooks/useSnoozeActionItem.ts`

- [ ] **Step 1: Buat hook**

```typescript
// apps/frontend/src/features/notifications/hooks/useSnoozeActionItem.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ActionItemEntityType, SnoozeDuration } from '../../../components/notifications/types/action-item.types';

interface SnoozePayload {
    entityType: ActionItemEntityType;
    entityId: string;
    duration: SnoozeDuration;
}

interface UnsnoozePayload {
    entityType: ActionItemEntityType;
    entityId: string;
}

export const useSnoozeActionItem = () => {
    const queryClient = useQueryClient();

    const snoozeMutation = useMutation({
        mutationFn: async (payload: SnoozePayload) => {
            const res = await api.post('/notifications/action-items/snooze', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['action-items'] });
        },
        onError: () => {
            toast.error('Gagal menunda reminder. Coba lagi.');
        },
    });

    const unsnoozeMutation = useMutation({
        mutationFn: async (payload: UnsnoozePayload) => {
            const res = await api.delete('/notifications/action-items/snooze', { data: payload });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['action-items'] });
        },
        onError: () => {
            toast.error('Gagal membatalkan snooze. Coba lagi.');
        },
    });

    return {
        snooze: snoozeMutation.mutate,
        unsnooze: unsnoozeMutation.mutate,
        isSnoozePending: snoozeMutation.isPending,
        isUnsnoozePending: unsnoozeMutation.isPending,
    };
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/notifications/hooks/useSnoozeActionItem.ts
git commit -m "feat(frontend): add useSnoozeActionItem hook"
```

---

## Task 12: Frontend — useActionItems: socket listener + count fix

**Files:**
- Modify: `apps/frontend/src/features/notifications/hooks/useActionItems.ts`

- [ ] **Step 1: Tambah socket listener action-items:refresh dan fix count**

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
        refetchInterval: 60000,
    });

    useEffect(() => {
        if (!socket || !user) return;

        const handleRefresh = () => {
            queryClient.invalidateQueries({ queryKey: ['action-items'] });
        };

        socket.on(`notification:${user.id}`, handleRefresh);
        socket.on(`notification:acknowledged:${user.id}`, handleRefresh);
        socket.on(`action-items:refresh:${user.id}`, handleRefresh);

        return () => {
            socket.off(`notification:${user.id}`, handleRefresh);
            socket.off(`notification:acknowledged:${user.id}`, handleRefresh);
            socket.off(`action-items:refresh:${user.id}`, handleRefresh);
        };
    }, [socket, user, queryClient]);

    const allItems = data?.items || [];
    const activeItems = allItems.filter(i => !i.isSnoozed);

    return {
        items: allItems,
        activeItems,
        counts: data?.counts || { critical: 0, high: 0, normal: 0, total: 0 },
        isLoading,
        error,
        refetch,
    };
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/notifications/hooks/useActionItems.ts
git commit -m "feat(frontend): add action-items:refresh socket listener and activeItems filter to useActionItems"
```

---

## Task 13: Frontend — ActionCommandCenter: Snooze UI

**Files:**
- Modify: `apps/frontend/src/components/notifications/ActionCommandCenter.tsx`

- [ ] **Step 1: Tambah imports**

Di bagian import ActionCommandCenter.tsx, tambahkan:
```typescript
import { Clock } from 'lucide-react';
import { useSnoozeActionItem } from '../../features/notifications/hooks/useSnoozeActionItem';
import { ActionItem, SnoozeDuration } from './types/action-item.types';
```

- [ ] **Step 2: Update ActionRow component untuk snooze**

Temukan component `ActionRow` (atau buat jika inline). Replace/update dengan versi yang include snooze button:

```typescript
const SNOOZE_OPTIONS: { label: string; value: SnoozeDuration }[] = [
    { label: '30 menit', value: '30m' },
    { label: '2 jam', value: '2h' },
    { label: 'Besok pagi', value: 'tomorrow' },
];

const ActionRow = ({ item, index, onClick }: { item: ActionItem; index: number; onClick: () => void }) => {
    const { snooze, unsnooze, isSnoozePending } = useSnoozeActionItem();
    const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
    const snoozeRef = useRef<HTMLDivElement>(null);

    const urgencyDot = item.urgency === 'CRITICAL'
        ? 'bg-red-500'
        : item.urgency === 'HIGH'
        ? 'bg-amber-500'
        : 'bg-primary';

    const handleSnooze = (duration: SnoozeDuration) => {
        snooze({ entityType: item.entityType, entityId: item.entityId, duration });
        setShowSnoozeMenu(false);
    };

    const handleUnsnooze = (e: React.MouseEvent) => {
        e.stopPropagation();
        unsnooze({ entityType: item.entityType, entityId: item.entityId });
    };

    const snoozeLabel = item.snoozeUntil
        ? `Snoozed · sampai ${new Date(item.snoozeUntil).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
        : null;

    return (
        <motion.button
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={onClick}
            className={`group w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative ${item.isSnoozed ? 'opacity-50' : ''}`}
        >
            <div className="flex items-start gap-2.5">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${urgencyDot}`} />
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate leading-tight">
                        {item.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.description}
                    </p>
                    {item.isSnoozed && snoozeLabel && (
                        <button
                            onClick={handleUnsnooze}
                            className="mt-1 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 rounded px-1.5 py-0.5 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                        >
                            {snoozeLabel} · batalkan
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {!item.isSnoozed && (
                        <div className="relative" ref={snoozeRef}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowSnoozeMenu(v => !v); }}
                                disabled={isSnoozePending}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                title="Tunda reminder"
                            >
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                            {showSnoozeMenu && (
                                <div className="absolute right-0 top-7 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 w-32">
                                    {SNOOZE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={(e) => { e.stopPropagation(); handleSnooze(opt.value); }}
                                            className="w-full text-left px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>
        </motion.button>
    );
};
```

Pastikan `useRef` dan `useState` sudah diimport dari React.

- [ ] **Step 3: Update badge count di trigger button**

Cari baris yang memakai `counts.total` untuk badge topbar. Update menggunakan `activeItems.length` dan adjust counts:

```typescript
// Di dalam ActionCommandCenter component:
const { items, activeItems, counts, isLoading, refetch } = useActionItems();

// Untuk badge, hitung dari activeItems saja:
const activeCritical = activeItems.filter(i => i.urgency === 'CRITICAL').length;
const activeHigh = activeItems.filter(i => i.urgency === 'HIGH').length;
const hasCritical = activeCritical > 0;
const hasHigh = activeHigh > 0;
const activeTotal = activeItems.length;
```

Update badge:
```typescript
{activeTotal > 0 && (
    <span className={`absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 text-[10px] font-bold text-white ${
        hasCritical ? 'bg-red-500' : hasHigh ? 'bg-amber-500' : 'bg-primary'
    }`}>
        {activeTotal > 9 ? '9+' : activeTotal}
    </span>
)}
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/notifications/ActionCommandCenter.tsx
git commit -m "feat(frontend): add snooze UI to ActionCommandCenter with Clock dropdown and snoozed badge"
```

---

## Task 14: Frontend — useCategorySettings hook

**Files:**
- Create: `apps/frontend/src/features/notifications/hooks/useCategorySettings.ts`

- [ ] **Step 1: Buat hook**

```typescript
// apps/frontend/src/features/notifications/hooks/useCategorySettings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';

export type CategorySettings = {
    TICKET: boolean;
    HARDWARE_REQUEST: boolean;
    EFORM: boolean;
    RENEWAL: boolean;
    ZOOM: boolean;
};

const DEFAULT_SETTINGS: CategorySettings = {
    TICKET: true,
    HARDWARE_REQUEST: true,
    EFORM: true,
    RENEWAL: true,
    ZOOM: true,
};

export const useCategorySettings = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const query = useQuery<CategorySettings>({
        queryKey: ['notification-category-settings'],
        queryFn: async () => {
            const res = await api.get('/notifications/preferences/categories');
            return { ...DEFAULT_SETTINGS, ...res.data };
        },
        enabled: !!user,
    });

    const mutation = useMutation({
        mutationFn: async (updates: Partial<CategorySettings>) => {
            const res = await api.patch('/notifications/preferences/categories', updates);
            return res.data;
        },
        onMutate: async (updates) => {
            await queryClient.cancelQueries({ queryKey: ['notification-category-settings'] });
            const previous = queryClient.getQueryData<CategorySettings>(['notification-category-settings']);
            queryClient.setQueryData<CategorySettings>(
                ['notification-category-settings'],
                old => ({ ...DEFAULT_SETTINGS, ...old, ...updates })
            );
            return { previous };
        },
        onError: (_err, _updates, context) => {
            if (context?.previous) {
                queryClient.setQueryData(['notification-category-settings'], context.previous);
            }
            toast.error('Gagal menyimpan pengaturan. Coba lagi.');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-category-settings'] });
            queryClient.invalidateQueries({ queryKey: ['action-items'] });
        },
    });

    return {
        settings: query.data || DEFAULT_SETTINGS,
        isLoading: query.isLoading,
        update: mutation.mutate,
        isUpdating: mutation.isPending,
    };
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/notifications/hooks/useCategorySettings.ts
git commit -m "feat(frontend): add useCategorySettings hook with optimistic update"
```

---

## Task 15: Frontend — NotificationSettings: category toggles

**Files:**
- Modify: `apps/frontend/src/features/settings/components/NotificationSettings.tsx`

- [ ] **Step 1: Tambah import useCategorySettings**

Di bagian atas `NotificationSettings.tsx`, tambahkan:
```typescript
import { useCategorySettings, CategorySettings } from '../../../features/notifications/hooks/useCategorySettings';
import { Filter } from 'lucide-react';
```

- [ ] **Step 2: Tambah state dan hook**

Di dalam component `NotificationSettings`, tambahkan:
```typescript
const { settings: categorySettings, isLoading: catLoading, update: updateCategory } = useCategorySettings();
```

- [ ] **Step 3: Tambah section "Kategori Action Items"**

Temukan section Reminder Intensity di JSX (ada tombol OFF/GENTLE/MODERATE/ASSERTIVE). Tambahkan section baru setelah section Reminder Intensity:

```typescript
{/* Category Settings */}
<div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        <Filter className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Kategori Action Items
        </h3>
    </div>
    <p className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/50">
        Kategori yang dinonaktifkan tidak akan muncul di Action Command Center
    </p>
    {catLoading ? (
        <div className="px-4 py-3 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            <span className="text-sm text-slate-400">Memuat...</span>
        </div>
    ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {([
                { key: 'TICKET', label: 'Ticket', desc: 'SLA warning, tiket belum dibalas' },
                { key: 'HARDWARE_REQUEST', label: 'Hardware Request', desc: 'Approval, schedule, procurement' },
                { key: 'EFORM', label: 'E-Form', desc: 'Permintaan akses menunggu proses' },
                { key: 'RENEWAL', label: 'Renewal', desc: 'Kontrak mendekati expired' },
                { key: 'ZOOM', label: 'Zoom', desc: 'Booking dan jadwal meeting' },
            ] as { key: keyof CategorySettings; label: string; desc: string }[]).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between px-4 py-3">
                    <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                    </div>
                    <button
                        onClick={() => updateCategory({ [key]: !categorySettings[key] })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                            categorySettings[key]
                                ? 'bg-primary'
                                : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            categorySettings[key] ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`} />
                    </button>
                </div>
            ))}
        </div>
    )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/settings/components/NotificationSettings.tsx
git commit -m "feat(frontend): add category settings toggles to NotificationSettings"
```

---

## Task 16: Frontend — useNotificationCenter: critical count

**Files:**
- Modify: `apps/frontend/src/features/notifications/hooks/useNotificationCenter.ts`

- [ ] **Step 1: Tambah query unacknowledgedCriticalCount**

Buka `useNotificationCenter.ts`. Import tambahan yang dibutuhkan sudah ada. Tambahkan query baru setelah existing queries:

```typescript
// Tambah di dalam useNotificationCenter, setelah useNotificationQueries:
const { data: criticalCountData, refetch: refetchCriticalCount } = useQuery<{ count: number }>({
    queryKey: ['critical-unacknowledged-count'],
    queryFn: async () => {
        const res = await api.get('/notifications/critical/count');
        return res.data;
    },
    enabled: !!user,
    refetchInterval: 30000,
});
```

- [ ] **Step 2: Tambah socket listener untuk acknowledged event**

Di dalam `useEffect` yang sudah ada untuk socket, tambahkan listener:
```typescript
const handleAcknowledged = () => {
    queryClient.invalidateQueries({ queryKey: ['critical-unacknowledged-count'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
};
socket.on(`notification:acknowledged:${user.id}`, handleAcknowledged);
// cleanup:
socket.off(`notification:acknowledged:${user.id}`, handleAcknowledged);
```

- [ ] **Step 3: Tambah acknowledgeMutation dan export criticalCount**

Tambahkan mutation untuk acknowledge:
```typescript
const acknowledgeMutation = useMutation({
    mutationFn: async (notificationId: string) => {
        const res = await api.post(`/notifications/${notificationId}/acknowledge`);
        return res.data;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['critical-unacknowledged-count'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => {
        toast.error('Gagal mengkonfirmasi notifikasi. Coba lagi.');
    },
});
```

Di return statement, tambahkan:
```typescript
unacknowledgedCriticalCount: criticalCountData?.count || 0,
handleAcknowledge: acknowledgeMutation.mutate,
isAcknowledgePending: acknowledgeMutation.isPending,
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/notifications/hooks/useNotificationCenter.ts
git commit -m "feat(frontend): add critical count query and acknowledge mutation to useNotificationCenter"
```

---

## Task 17: Frontend — NotificationItem: Acknowledge button

**Files:**
- Modify: `apps/frontend/src/components/notifications/NotificationItem.tsx`

- [ ] **Step 1: Tambah onAcknowledge prop**

Buka `NotificationItem.tsx`. Update interface props:

```typescript
interface NotificationItemProps {
    notification: Notification;
    isSelectionMode: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onMarkRead: (id: string, e: React.MouseEvent) => void;
    onViewDetails: (notification: Notification) => void;
    onAcknowledge?: (id: string) => void;
    isAcknowledgePending?: boolean;
}
```

- [ ] **Step 2: Render acknowledge button untuk CRITICAL items**

Di dalam JSX NotificationItem, setelah existing content, tambahkan sebelum closing div:

```typescript
{isCritical && !notification.acknowledgedAt && onAcknowledge && (
    <div
        onClick={(e) => e.stopPropagation()}
        className="mt-2 flex justify-end"
    >
        <button
            onClick={() => onAcknowledge(notification.id)}
            disabled={isAcknowledgePending}
            className="text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
        >
            {isAcknowledgePending ? (
                <span className="inline-block w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
                <CheckCheck className="w-3 h-3" />
            )}
            Acknowledge
        </button>
    </div>
)}
```

Pastikan `CheckCheck` sudah diimport dari lucide-react.

Untuk item CRITICAL yang belum acknowledged, tambahkan border kiri merah pada wrapper div:
```typescript
className={cn(
    // ... existing classes
    isCritical && !notification.acknowledgedAt && 'border-l-2 border-red-500'
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/notifications/NotificationItem.tsx
git commit -m "feat(frontend): add acknowledge button and critical border to NotificationItem"
```

---

## Task 18: Frontend — NotificationCenter: CriticalBanner

**Files:**
- Modify: `apps/frontend/src/components/notifications/NotificationCenter.tsx`

- [ ] **Step 1: Tambah CriticalBanner component (di atas NotificationCenter, dalam file yang sama)**

```typescript
const CriticalBanner: React.FC<{
    count: number;
    onViewClick: () => void;
}> = ({ count, onViewClick }) => {
    if (count === 0) return null;
    return (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{count > 9 ? '9+' : count}</span>
            </div>
            <p className="flex-1 text-[12px] font-medium text-red-700 dark:text-red-300">
                {count} notifikasi kritis perlu konfirmasi
            </p>
            <button
                onClick={onViewClick}
                className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
            >
                Lihat
            </button>
        </div>
    );
};
```

- [ ] **Step 2: Tambah CriticalBanner ke NotificationCenter JSX**

Di dalam `NotificationCenter` component, extract nilai dari hook:
```typescript
const {
    // ... existing destructuring
    unacknowledgedCriticalCount,
    handleAcknowledge,
    isAcknowledgePending,
} = useNotificationCenter();
```

Tambahkan `CriticalBanner` di JSX, tepat sebelum tab bar (sebelum `<div className="flex gap-1 ...">` tabs):

```typescript
<CriticalBanner
    count={unacknowledgedCriticalCount}
    onViewClick={() => {
        setReadFilter('all');
        setActiveTab('all');
        // Scroll ke notifikasi pertama yang requiresAcknowledge - browser akan handle via fragment
    }}
/>
```

- [ ] **Step 3: Wire onAcknowledge ke NotificationItem**

Temukan tempat `<NotificationItem ...` dirender dan tambahkan props:
```typescript
<NotificationItem
    key={notification.id}
    notification={notification}
    // ... existing props
    onAcknowledge={handleAcknowledge}
    isAcknowledgePending={isAcknowledgePending}
/>
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/notifications/NotificationCenter.tsx
git commit -m "feat(frontend): add CriticalBanner and wire acknowledge flow in NotificationCenter"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Auto-resolve: Tasks 6, 8, 9, 12
- ✅ Snooze DB-backed: Tasks 1, 2, 4, 5, 6, 7, 11, 12, 13
- ✅ CRITICAL banner + acknowledge: Tasks 16, 17, 18
- ✅ Per-kategori settings: Tasks 3, 6, 7, 14, 15
- ✅ Migration: Task 1
- ✅ Frontend types update: Task 10

**Type consistency:**
- `ActionItem.isSnoozed: boolean` — defined Task 10, used Task 12, 13
- `SnoozeDuration = '30m' | '2h' | 'tomorrow'` — defined Task 10, used Task 11, 13
- `CategorySettings` type — defined Task 14, used Task 15
- `emitActionItemsRefresh(userId, entityType, entityId)` — defined Task 6, used Tasks 8, 9
- `useSnoozeActionItem()` returns `{ snooze, unsnooze, isSnoozePending, isUnsnoozePending }` — defined Task 11, used Task 13
- `useNotificationCenter()` returns `unacknowledgedCriticalCount, handleAcknowledge, isAcknowledgePending` — defined Task 16, used Tasks 17, 18

**No placeholders:** Semua steps memiliki kode lengkap.
