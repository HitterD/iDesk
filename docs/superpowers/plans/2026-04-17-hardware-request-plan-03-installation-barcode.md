# Hardware Request — Plan 3: Installation Lifecycle & Barcode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Backend untuk lifecycle INSTALLATION → COMPLETED: `installation_schedule` (di-port dari ticketing), `hardware_asset`, mutual scheduling (propose/confirm/reschedule), start/complete install, barcode scan + uniqueness, calendar query, state machine guard final.

**Architecture:** 2 entity baru (`installation_schedule`, `hardware_asset`). 2 service baru (`installation-schedule.service`, `hardware-asset.service`). 2 controller baru (`installation.controller`, endpoint calendar). Command service Plan 2 ditambahi `completeInstallation()`. Migration port schedule table dari ticketing (rename FK `ticket_id` → `request_id`, hapus ownership lama).

**Tech Stack:** Sama dengan Plan 1/2.

**Spec reference:** §4 (`installation_schedule`, `hardware_asset`), §5 (Installation transitions), §6 (write matrix TECH), §7 (install endpoints, calendar).

**Prerequisites:** Plan 2 merged. `HardwareRoleGuard` + `@HardwareRoles` aktif. Event `procurement.completed` bisa masuk ke INSTALLATION.

---

## Files in this plan

**Create:**
- `apps/backend/src/modules/hardware-request/domain/entities/installation-schedule.entity.ts`
- `apps/backend/src/modules/hardware-request/domain/entities/hardware-asset.entity.ts`
- `apps/backend/src/modules/hardware-request/domain/enums/install-status.enum.ts`
- `apps/backend/src/migrations/1776000200000-PortInstallationSchedule.ts`
- `apps/backend/src/migrations/1776000200500-AddHardwareAssets.ts`
- `apps/backend/src/modules/hardware-request/dto/schedule-install.dto.ts`
- `apps/backend/src/modules/hardware-request/dto/reschedule-install.dto.ts`
- `apps/backend/src/modules/hardware-request/dto/barcode.dto.ts`
- `apps/backend/src/modules/hardware-request/dto/calendar-query.dto.ts`
- `apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts`
- `apps/backend/src/modules/hardware-request/services/installation-schedule.service.spec.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-asset.service.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-asset.service.spec.ts`
- `apps/backend/src/modules/hardware-request/presentation/installation.controller.ts`
- `apps/backend/src/modules/hardware-request/presentation/installation.controller.spec.ts`

**Modify:**
- `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts` (add `completeInstallation`, `startInstallation`, `cancelInstallationIfAllowed`)
- `apps/backend/src/modules/hardware-request/hardware-request.module.ts` (register entities + services + controllers)
- `apps/backend/src/modules/ticketing/ticketing.module.ts` (remove installation-schedule-specific providers)

**Delete (after migration verified):**
- `apps/backend/src/modules/ticketing/entities/installation-schedule.entity.ts`
- `apps/backend/src/modules/ticketing/services/hardware-scheduler.service.ts`
- `apps/backend/src/modules/ticketing/listeners/installation-notification.listener.ts`

---

## Task 3.1: `InstallStatus` enum

**Files:** Create `domain/enums/install-status.enum.ts`

- [ ] **Step 1: Write enum**

```typescript
export enum InstallStatus {
    PROPOSED = 'PROPOSED',
    CONFIRMED = 'CONFIRMED',
    IN_PROGRESS = 'IN_PROGRESS',
    DONE = 'DONE',
    RESCHEDULED = 'RESCHEDULED',
    CANCELLED = 'CANCELLED',
}

export const INSTALL_TERMINAL = new Set<InstallStatus>([
    InstallStatus.DONE,
    InstallStatus.RESCHEDULED,
    InstallStatus.CANCELLED,
]);
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/enums/install-status.enum.ts
git commit -m "feat(hardware-request): add InstallStatus enum"
```

---

## Task 3.2: `installation_schedule` entity

**Files:** Create `domain/entities/installation-schedule.entity.ts`

- [ ] **Step 1: Write entity**

```typescript
import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
    ManyToOne, JoinColumn, Index, OneToOne,
} from 'typeorm';
import { HardwareRequest } from './hardware-request.entity';
import { User } from '../../../users/entities/user.entity';
import { InstallStatus } from '../enums/install-status.enum';

@Entity('installation_schedules')
@Index(['technicianId', 'scheduledStart'])
@Index(['status', 'scheduledStart'])
export class InstallationSchedule {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Column({ type: 'uuid', unique: true }) requestId: string;
    @OneToOne(() => HardwareRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'requestId' }) request: HardwareRequest;

    @Column({ type: 'uuid' }) technicianId: string;
    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'technicianId' }) technician: User;

    @Column({ type: 'timestamptz' }) scheduledStart: Date;
    @Column({ type: 'timestamptz' }) scheduledEnd: Date;

    @Column({ type: 'enum', enum: InstallStatus, default: InstallStatus.PROPOSED })
    status: InstallStatus;

    @Column({ type: 'uuid' }) proposedBy: string;
    @Column({ type: 'uuid', nullable: true }) confirmedBy: string | null;

    @Column({ type: 'text', nullable: true }) locationDetail: string | null;
    @Column({ type: 'text', nullable: true }) rescheduleReason: string | null;

    @Column({ type: 'timestamptz', nullable: true }) startedAt: Date | null;
    @Column({ type: 'timestamptz', nullable: true }) completedAt: Date | null;

    @CreateDateColumn() createdAt: Date;
    @UpdateDateColumn() updatedAt: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/entities/installation-schedule.entity.ts
git commit -m "feat(hardware-request): port installation_schedule entity"
```

---

## Task 3.3: `hardware_asset` entity

**Files:** Create `domain/entities/hardware-asset.entity.ts`

- [ ] **Step 1: Write entity**

```typescript
import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
    ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { HardwareRequestItem } from './hardware-request-item.entity';
import { User } from '../../../users/entities/user.entity';
import { Site } from '../../../sites/entities/site.entity';

@Entity('hardware_assets')
@Index(['assignedToUserId'])
export class HardwareAsset {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Column({ type: 'uuid' }) itemId: string;
    @ManyToOne(() => HardwareRequestItem, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'itemId' }) item: HardwareRequestItem;

    @Column({ type: 'varchar', length: 128, unique: true }) barcode: string;

    @Column({ type: 'uuid' }) assignedToUserId: string;
    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'assignedToUserId' }) assignedTo: User;

    @Column({ type: 'uuid' }) siteId: string;
    @ManyToOne(() => Site, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'siteId' }) site: Site;

    @Column({ type: 'timestamptz' }) installedAt: Date;
    @Column({ type: 'uuid' }) installedBy: string;

    @CreateDateColumn() createdAt: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/entities/hardware-asset.entity.ts
git commit -m "feat(hardware-request): add hardware_asset entity"
```

---

## Task 3.4: Migration — port `installation_schedule`

**Files:** Create `migrations/1776000200000-PortInstallationSchedule.ts`

> **Catatan:** Table lama di ticketing namanya `installation_schedules` dengan FK `ticket_id`. Strategi: rename FK column bila tabel sudah ada, else create fresh. Simpan backup jika perlu.

- [ ] **Step 1: Migration file**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortInstallationSchedule1776000200000 implements MigrationInterface {
    name = 'PortInstallationSchedule1776000200000';

    async up(q: QueryRunner): Promise<void> {
        const hasOldTable = await q.hasTable('installation_schedules');

        if (hasOldTable) {
            const cols = await q.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name='installation_schedules'
            `);
            const names = cols.map((r: any) => r.column_name);

            // rename ticket_id → request_id bila perlu
            if (names.includes('ticket_id') && !names.includes('request_id')) {
                await q.query(`ALTER TABLE installation_schedules RENAME COLUMN ticket_id TO request_id`);
            }

            // drop FK lama ke tickets, buat FK baru ke hardware_requests
            await q.query(`
                ALTER TABLE installation_schedules
                DROP CONSTRAINT IF EXISTS fk_installation_schedules_ticket;
            `);

            // pastikan kolom baru ada
            const addCol = async (c: string, type: string, def = '') => {
                if (!names.includes(c)) await q.query(
                    `ALTER TABLE installation_schedules ADD COLUMN ${c} ${type} ${def}`,
                );
            };
            await addCol('proposed_by', 'uuid');
            await addCol('confirmed_by', 'uuid', 'NULL');
            await addCol('location_detail', 'text', 'NULL');
            await addCol('reschedule_reason', 'text', 'NULL');
            await addCol('started_at', 'timestamptz', 'NULL');
            await addCol('completed_at', 'timestamptz', 'NULL');

            // ubah status enum bila masih string
            await q.query(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='install_status_enum') THEN
                        CREATE TYPE install_status_enum AS ENUM
                            ('PROPOSED','CONFIRMED','IN_PROGRESS','DONE','RESCHEDULED','CANCELLED');
                    END IF;
                END $$;
            `);
            await q.query(`
                ALTER TABLE installation_schedules
                ALTER COLUMN status TYPE install_status_enum USING status::install_status_enum;
            `);

            await q.query(`
                ALTER TABLE installation_schedules
                ADD CONSTRAINT fk_installation_schedules_request
                FOREIGN KEY (request_id) REFERENCES hardware_requests(id) ON DELETE CASCADE;
            `);
            await q.query(`
                ALTER TABLE installation_schedules
                ADD CONSTRAINT uq_installation_schedules_request UNIQUE (request_id);
            `);
        } else {
            await q.query(`
                CREATE TYPE IF NOT EXISTS install_status_enum AS ENUM
                    ('PROPOSED','CONFIRMED','IN_PROGRESS','DONE','RESCHEDULED','CANCELLED');
            `);
            await q.query(`
                CREATE TABLE installation_schedules (
                    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                    request_id      uuid NOT NULL UNIQUE REFERENCES hardware_requests(id) ON DELETE CASCADE,
                    technician_id   uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                    scheduled_start timestamptz NOT NULL,
                    scheduled_end   timestamptz NOT NULL,
                    status          install_status_enum NOT NULL DEFAULT 'PROPOSED',
                    proposed_by     uuid NOT NULL,
                    confirmed_by    uuid NULL,
                    location_detail text NULL,
                    reschedule_reason text NULL,
                    started_at      timestamptz NULL,
                    completed_at    timestamptz NULL,
                    created_at      timestamptz NOT NULL DEFAULT now(),
                    updated_at      timestamptz NOT NULL DEFAULT now()
                );
            `);
        }

        await q.query(`
            CREATE INDEX IF NOT EXISTS idx_install_sched_tech_start
                ON installation_schedules(technician_id, scheduled_start);
        `);
        await q.query(`
            CREATE INDEX IF NOT EXISTS idx_install_sched_status_start
                ON installation_schedules(status, scheduled_start);
        `);
    }

    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP INDEX IF EXISTS idx_install_sched_tech_start`);
        await q.query(`DROP INDEX IF EXISTS idx_install_sched_status_start`);
        await q.query(`
            ALTER TABLE installation_schedules
            DROP CONSTRAINT IF EXISTS fk_installation_schedules_request;
        `);
        await q.query(`
            ALTER TABLE installation_schedules
            DROP CONSTRAINT IF EXISTS uq_installation_schedules_request;
        `);
        // biarkan table utk rollback manual (data sensitif)
    }
}
```

- [ ] **Step 2: Run + verify**

```bash
pnpm --filter backend typeorm migration:run
psql $DB_URL -c "\d installation_schedules"
```

Expected: `request_id` FK → `hardware_requests(id)`, unique.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/migrations/1776000200000-PortInstallationSchedule.ts
git commit -m "feat(hardware-request): migrate installation_schedule from ticketing"
```

---

## Task 3.5: Migration — `hardware_assets`

**Files:** Create `migrations/1776000200500-AddHardwareAssets.ts`

- [ ] **Step 1: Migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHardwareAssets1776000200500 implements MigrationInterface {
    name = 'AddHardwareAssets1776000200500';

    async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE hardware_assets (
                id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                item_id              uuid NOT NULL REFERENCES hardware_request_items(id) ON DELETE RESTRICT,
                barcode              varchar(128) NOT NULL UNIQUE,
                assigned_to_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                site_id              uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
                installed_at         timestamptz NOT NULL,
                installed_by         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at           timestamptz NOT NULL DEFAULT now()
            );
        `);
        await q.query(`CREATE INDEX idx_hardware_assets_assignee ON hardware_assets(assigned_to_user_id);`);
        await q.query(`CREATE INDEX idx_hardware_assets_item ON hardware_assets(item_id);`);
    }

    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE IF EXISTS hardware_assets`);
    }
}
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter backend typeorm migration:run
git add apps/backend/src/migrations/1776000200500-AddHardwareAssets.ts
git commit -m "feat(hardware-request): add hardware_assets table"
```

---

## Task 3.6: DTOs

**Files:** Create 4 DTO files.

- [ ] **Step 1: `schedule-install.dto.ts`**

```typescript
import { IsUUID, IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';

export class ScheduleInstallDto {
    @IsOptional() @IsUUID() technicianId?: string; // wajib bila proposer bukan TECH
    @IsDateString() scheduledStart: string;
    @IsDateString() scheduledEnd: string;
    @IsOptional() @IsString() @MaxLength(500) locationDetail?: string;
}
```

- [ ] **Step 2: `reschedule-install.dto.ts`**

```typescript
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RescheduleInstallDto {
    @IsDateString() scheduledStart: string;
    @IsDateString() scheduledEnd: string;
    @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
```

- [ ] **Step 3: `barcode.dto.ts`**

```typescript
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class BarcodeDto {
    @IsString() @MinLength(4) @MaxLength(128)
    @Matches(/^[A-Za-z0-9\-_]+$/, { message: 'barcode alfanumerik/-/_ saja' })
    barcode: string;
}
```

- [ ] **Step 4: `calendar-query.dto.ts`**

```typescript
import { IsDateString, IsOptional, IsUUID, IsArray, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { InstallStatus } from '../domain/enums/install-status.enum';

export class CalendarQueryDto {
    @IsDateString() from: string;
    @IsDateString() to: string;
    @IsOptional() @IsArray() @IsUUID('4', { each: true })
    @Type(() => String) technicianId?: string[];
    @IsOptional() @IsArray() @IsEnum(InstallStatus, { each: true })
    status?: InstallStatus[];
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/dto/schedule-install.dto.ts \
        apps/backend/src/modules/hardware-request/dto/reschedule-install.dto.ts \
        apps/backend/src/modules/hardware-request/dto/barcode.dto.ts \
        apps/backend/src/modules/hardware-request/dto/calendar-query.dto.ts
git commit -m "feat(hardware-request): installation DTOs"
```

---

## Task 3.7: `InstallationScheduleService` — propose (RED→GREEN)

**Files:**
- Create: `services/installation-schedule.service.ts`
- Create: `services/installation-schedule.service.spec.ts`

- [ ] **Step 1: Spec skeleton (RED)**

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InstallationScheduleService } from './installation-schedule.service';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { InstallStatus } from '../domain/enums/install-status.enum';

describe('InstallationScheduleService', () => {
    let svc: InstallationScheduleService;
    const scheduleRepo = { findOne: jest.fn(), create: jest.fn(v => v), save: jest.fn(v => ({ ...v, id: 'sch-1' })) };
    const requestRepo = { findOne: jest.fn(), save: jest.fn(v => v) };
    const activity = { log: jest.fn() };
    const emitter = { emit: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                InstallationScheduleService,
                { provide: getRepositoryToken(InstallationSchedule), useValue: scheduleRepo },
                { provide: getRepositoryToken(HardwareRequest), useValue: requestRepo },
                { provide: 'HardwareActivityService', useValue: activity },
                { provide: EventEmitter2, useValue: emitter },
            ],
        }).compile();
        svc = mod.get(InstallationScheduleService);
        jest.clearAllMocks();
    });

    describe('propose', () => {
        it('creates PROPOSED when none exists, request in INSTALLATION', async () => {
            requestRepo.findOne.mockResolvedValue({
                id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1',
            });
            scheduleRepo.findOne.mockResolvedValue(null);

            const res = await svc.propose('r1', {
                technicianId: 't1',
                scheduledStart: '2026-05-01T09:00:00Z',
                scheduledEnd: '2026-05-01T11:00:00Z',
            }, { id: 'u1', role: 'USER' });

            expect(res.status).toBe(InstallStatus.PROPOSED);
            expect(res.proposedBy).toBe('u1');
            expect(emitter.emit).toHaveBeenCalledWith(
                'hardware-request.schedule.proposed', expect.objectContaining({ requestId: 'r1' }),
            );
        });

        it('rejects when end ≤ start', async () => {
            requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION });
            await expect(svc.propose('r1', {
                scheduledStart: '2026-05-01T11:00:00Z',
                scheduledEnd: '2026-05-01T10:00:00Z',
                technicianId: 't1',
            }, { id: 'u1', role: 'USER' })).rejects.toThrow(/end must be after start/i);
        });

        it('rejects when request status != INSTALLATION', async () => {
            requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.PROCUREMENT });
            await expect(svc.propose('r1', {
                scheduledStart: '2026-05-01T09:00:00Z',
                scheduledEnd: '2026-05-01T10:00:00Z',
                technicianId: 't1',
            }, { id: 'u1', role: 'USER' })).rejects.toThrow(/invalid state/i);
        });
    });
});
```

- [ ] **Step 2: Run** — expect fail: service tidak ada.

```bash
pnpm --filter backend test -- installation-schedule.service.spec
```

- [ ] **Step 3: Service minimal — propose**

```typescript
// installation-schedule.service.ts
import { Injectable, Inject, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { InstallStatus, INSTALL_TERMINAL } from '../domain/enums/install-status.enum';
import { ScheduleInstallDto } from '../dto/schedule-install.dto';
import { RescheduleInstallDto } from '../dto/reschedule-install.dto';
import { HardwareActivityService } from './hardware-activity.service';

export interface ActingUser { id: string; role: 'USER'|'ICT_LEAD'|'ICT_PROCUREMENT'|'ICT_TECHNICIAN' }

@Injectable()
export class InstallationScheduleService {
    constructor(
        @InjectRepository(InstallationSchedule) private readonly repo: Repository<InstallationSchedule>,
        @InjectRepository(HardwareRequest) private readonly reqRepo: Repository<HardwareRequest>,
        private readonly activity: HardwareActivityService,
        private readonly emitter: EventEmitter2,
    ) {}

    async propose(requestId: string, dto: ScheduleInstallDto, actor: ActingUser): Promise<InstallationSchedule> {
        const start = new Date(dto.scheduledStart);
        const end = new Date(dto.scheduledEnd);
        if (end <= start) throw new BadRequestException('end must be after start');

        const req = await this.reqRepo.findOne({ where: { id: requestId } });
        if (!req) throw new NotFoundException('request not found');
        if (req.status !== RequestStatus.INSTALLATION) throw new ConflictException('invalid state: must be INSTALLATION');

        const allowed = (actor.role === 'USER' && actor.id === req.requesterId)
            || actor.role === 'ICT_TECHNICIAN';
        if (!allowed) throw new ForbiddenException('HR_PERMISSION_DENIED');

        const technicianId = dto.technicianId
            ?? (actor.role === 'ICT_TECHNICIAN' ? actor.id : undefined);
        if (!technicianId) throw new BadRequestException('technicianId required when proposer is USER');

        const existing = await this.repo.findOne({ where: { requestId } });
        if (existing && !INSTALL_TERMINAL.has(existing.status)) {
            throw new ConflictException('active schedule exists; use reschedule');
        }

        const row = this.repo.create({
            requestId, technicianId,
            scheduledStart: start, scheduledEnd: end,
            locationDetail: dto.locationDetail ?? null,
            status: InstallStatus.PROPOSED,
            proposedBy: actor.id,
            confirmedBy: null,
        });
        const saved = await this.repo.save(row);

        await this.activity.log(requestId, actor.id, 'SCHEDULE_PROPOSED', {
            scheduleId: saved.id, scheduledStart: start, scheduledEnd: end, technicianId,
        });
        this.emitter.emit('hardware-request.schedule.proposed', {
            requestId, scheduleId: saved.id, proposerId: actor.id, technicianId,
        });
        return saved;
    }
}
```

- [ ] **Step 4: Re-run tests → PASS (3 cases).**

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts \
        apps/backend/src/modules/hardware-request/services/installation-schedule.service.spec.ts
git commit -m "feat(hardware-request): schedule propose with invariants"
```

---

## Task 3.8: `confirm` method + tests

- [ ] **Step 1: Tests (RED)**

```typescript
describe('confirm', () => {
    it('confirms by counterparty; sets CONFIRMED + confirmedBy ≠ proposedBy', async () => {
        scheduleRepo.findOne.mockResolvedValue({
            id: 'sch-1', requestId: 'r1', status: InstallStatus.PROPOSED,
            proposedBy: 'u1', technicianId: 't1',
        });
        requestRepo.findOne.mockResolvedValue({
            id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1',
        });
        scheduleRepo.save.mockImplementation(v => v);

        const res = await svc.confirm('r1', { id: 't1', role: 'ICT_TECHNICIAN' });
        expect(res.status).toBe(InstallStatus.CONFIRMED);
        expect(res.confirmedBy).toBe('t1');
        expect(emitter.emit).toHaveBeenCalledWith('hardware-request.schedule.confirmed', expect.any(Object));
    });

    it('rejects same-person confirm', async () => {
        scheduleRepo.findOne.mockResolvedValue({
            id: 'sch-1', requestId: 'r1', status: InstallStatus.PROPOSED, proposedBy: 'u1', technicianId: 't1',
        });
        requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1' });
        await expect(svc.confirm('r1', { id: 'u1', role: 'USER' }))
            .rejects.toThrow(/counterparty/i);
    });

    it('rejects confirm when not in PROPOSED', async () => {
        scheduleRepo.findOne.mockResolvedValue({
            id: 'sch-1', requestId: 'r1', status: InstallStatus.CONFIRMED, proposedBy: 'u1', technicianId: 't1',
        });
        requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1' });
        await expect(svc.confirm('r1', { id: 't1', role: 'ICT_TECHNICIAN' }))
            .rejects.toThrow(/invalid state/i);
    });
});
```

- [ ] **Step 2: Implement `confirm`**

```typescript
async confirm(requestId: string, actor: ActingUser): Promise<InstallationSchedule> {
    const sched = await this.repo.findOne({ where: { requestId } });
    if (!sched) throw new NotFoundException('schedule not found');
    if (sched.status !== InstallStatus.PROPOSED) throw new ConflictException('invalid state: must be PROPOSED');

    const req = await this.reqRepo.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('request');

    const isRequester = actor.role === 'USER' && actor.id === req.requesterId;
    const isTech = actor.role === 'ICT_TECHNICIAN';
    if (!isRequester && !isTech) throw new ForbiddenException('HR_PERMISSION_DENIED');
    if (actor.id === sched.proposedBy) throw new ForbiddenException('counterparty must confirm');

    sched.status = InstallStatus.CONFIRMED;
    sched.confirmedBy = actor.id;
    const saved = await this.repo.save(sched);

    await this.activity.log(requestId, actor.id, 'SCHEDULE_CONFIRMED', { scheduleId: saved.id });
    this.emitter.emit('hardware-request.schedule.confirmed', {
        requestId, scheduleId: saved.id, confirmedBy: actor.id,
    });
    return saved;
}
```

- [ ] **Step 3: Run tests → PASS. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): schedule confirm counterparty check"
```

---

## Task 3.9: `reschedule` method + tests

- [ ] **Step 1: Tests (RED)**

```typescript
describe('reschedule', () => {
    it('marks old as RESCHEDULED and creates new PROPOSED', async () => {
        const old = { id: 'old', requestId: 'r1', status: InstallStatus.CONFIRMED, proposedBy: 'u1', technicianId: 't1' };
        scheduleRepo.findOne.mockResolvedValueOnce(old);
        requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1' });
        scheduleRepo.save.mockImplementation(v => ({ ...v, id: v.id ?? 'new' }));

        const res = await svc.reschedule('r1', {
            scheduledStart: '2026-05-02T09:00:00Z',
            scheduledEnd: '2026-05-02T11:00:00Z',
            reason: 'sick',
        }, { id: 't1', role: 'ICT_TECHNICIAN' });

        expect(old.status).toBe(InstallStatus.RESCHEDULED);
        expect(res.status).toBe(InstallStatus.PROPOSED);
        expect(emitter.emit).toHaveBeenCalledWith('hardware-request.schedule.rescheduled', expect.any(Object));
    });

    it('forbids reschedule after IN_PROGRESS', async () => {
        scheduleRepo.findOne.mockResolvedValue({ id: 'old', requestId: 'r1', status: InstallStatus.IN_PROGRESS });
        requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, requesterId: 'u1' });
        await expect(svc.reschedule('r1', {
            scheduledStart: '2026-05-02T09:00:00Z', scheduledEnd: '2026-05-02T10:00:00Z',
        }, { id: 't1', role: 'ICT_TECHNICIAN' })).rejects.toThrow(/in progress/i);
    });
});
```

- [ ] **Step 2: Implement**

```typescript
async reschedule(requestId: string, dto: RescheduleInstallDto, actor: ActingUser): Promise<InstallationSchedule> {
    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);
    if (end <= start) throw new BadRequestException('end must be after start');

    const old = await this.repo.findOne({ where: { requestId } });
    if (!old) throw new NotFoundException('schedule');
    if (old.status === InstallStatus.IN_PROGRESS) throw new ConflictException('cannot reschedule while in progress');
    if (INSTALL_TERMINAL.has(old.status)) throw new ConflictException('schedule already terminal');

    const req = await this.reqRepo.findOne({ where: { id: requestId } });
    if (!req || req.status !== RequestStatus.INSTALLATION) throw new ConflictException('invalid state');

    const allowed = (actor.role === 'USER' && actor.id === req.requesterId) || actor.role === 'ICT_TECHNICIAN';
    if (!allowed) throw new ForbiddenException('HR_PERMISSION_DENIED');

    old.status = InstallStatus.RESCHEDULED;
    old.rescheduleReason = dto.reason ?? null;
    await this.repo.save(old);

    const technicianId = old.technicianId;
    const next = this.repo.create({
        requestId, technicianId,
        scheduledStart: start, scheduledEnd: end,
        status: InstallStatus.PROPOSED,
        proposedBy: actor.id, confirmedBy: null,
        locationDetail: old.locationDetail,
    });
    // NB: unique(request_id) constraint → remove old row, or soften constraint to partial index.
    // solusi: ganti unique menjadi partial index WHERE status NOT IN (RESCHEDULED,CANCELLED,DONE).
    // Lihat Task 3.4 follow-up migration.
    const saved = await this.repo.save(next);

    await this.activity.log(requestId, actor.id, 'SCHEDULE_RESCHEDULED', {
        oldId: old.id, newId: saved.id, reason: dto.reason ?? null,
    });
    this.emitter.emit('hardware-request.schedule.rescheduled', {
        requestId, oldId: old.id, newId: saved.id, actorId: actor.id,
    });
    return saved;
}
```

- [ ] **Step 3: Migration patch — partial unique index**

`migrations/1776000201000-InstallSchedulePartialUnique.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InstallSchedulePartialUnique1776000201000 implements MigrationInterface {
    async up(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE installation_schedules DROP CONSTRAINT IF EXISTS uq_installation_schedules_request`);
        await q.query(`
            CREATE UNIQUE INDEX uq_install_sched_active
            ON installation_schedules(request_id)
            WHERE status NOT IN ('RESCHEDULED','CANCELLED','DONE');
        `);
    }
    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP INDEX IF EXISTS uq_install_sched_active`);
        await q.query(`ALTER TABLE installation_schedules ADD CONSTRAINT uq_installation_schedules_request UNIQUE (request_id)`);
    }
}
```

- [ ] **Step 4: Run tests + migration → PASS. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): schedule reschedule + partial unique index"
```

---

## Task 3.10: `start` + `complete` schedule methods

- [ ] **Step 1: Tests (RED)**

```typescript
describe('startInstallation', () => {
    it('CONFIRMED → IN_PROGRESS by TECH owning the schedule', async () => {
        scheduleRepo.findOne.mockResolvedValue({
            id: 'sch-1', requestId: 'r1', status: InstallStatus.CONFIRMED, technicianId: 't1',
        });
        const res = await svc.startInstallation('r1', { id: 't1', role: 'ICT_TECHNICIAN' });
        expect(res.status).toBe(InstallStatus.IN_PROGRESS);
        expect(res.startedAt).toBeDefined();
    });
    it('rejects non-owner TECH', async () => {
        scheduleRepo.findOne.mockResolvedValue({
            id: 'sch-1', requestId: 'r1', status: InstallStatus.CONFIRMED, technicianId: 't1',
        });
        await expect(svc.startInstallation('r1', { id: 'tX', role: 'ICT_TECHNICIAN' }))
            .rejects.toThrow(/HR_PERMISSION_DENIED/);
    });
});

describe('completeInstallation', () => {
    it('IN_PROGRESS → DONE', async () => {
        scheduleRepo.findOne.mockResolvedValue({
            id: 'sch-1', requestId: 'r1', status: InstallStatus.IN_PROGRESS, technicianId: 't1',
        });
        const res = await svc.completeInstallation('r1', { id: 't1', role: 'ICT_TECHNICIAN' });
        expect(res.status).toBe(InstallStatus.DONE);
        expect(res.completedAt).toBeDefined();
    });
});
```

- [ ] **Step 2: Implement**

```typescript
async startInstallation(requestId: string, actor: ActingUser): Promise<InstallationSchedule> {
    const sched = await this.repo.findOne({ where: { requestId, status: InstallStatus.CONFIRMED } });
    if (!sched) throw new ConflictException('no confirmed schedule');
    if (actor.role !== 'ICT_TECHNICIAN' || sched.technicianId !== actor.id) throw new ForbiddenException('HR_PERMISSION_DENIED');

    sched.status = InstallStatus.IN_PROGRESS;
    sched.startedAt = new Date();
    const saved = await this.repo.save(sched);
    await this.activity.log(requestId, actor.id, 'INSTALL_STARTED', { scheduleId: saved.id });
    this.emitter.emit('hardware-request.install.started', { requestId, scheduleId: saved.id });
    return saved;
}

async completeInstallation(requestId: string, actor: ActingUser): Promise<InstallationSchedule> {
    const sched = await this.repo.findOne({ where: { requestId, status: InstallStatus.IN_PROGRESS } });
    if (!sched) throw new ConflictException('no in-progress schedule');
    if (actor.role !== 'ICT_TECHNICIAN' || sched.technicianId !== actor.id) throw new ForbiddenException('HR_PERMISSION_DENIED');

    sched.status = InstallStatus.DONE;
    sched.completedAt = new Date();
    const saved = await this.repo.save(sched);
    await this.activity.log(requestId, actor.id, 'INSTALL_SCHEDULE_DONE', { scheduleId: saved.id });
    return saved;
}
```

- [ ] **Step 3: Run → PASS. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): schedule start/complete"
```

---

## Task 3.11: `HardwareAssetService` (barcode uniqueness)

**Files:** Create service + spec.

- [ ] **Step 1: Tests (RED)**

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareAssetService } from './hardware-asset.service';
import { HardwareAsset } from '../domain/entities/hardware-asset.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

describe('HardwareAssetService', () => {
    let svc: HardwareAssetService;
    const assetRepo = { findOne: jest.fn(), create: jest.fn(v => v), save: jest.fn(v => ({ ...v, id: 'a1' })), count: jest.fn() };
    const itemRepo = { findOne: jest.fn() };
    const reqRepo = { findOne: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                HardwareAssetService,
                { provide: getRepositoryToken(HardwareAsset), useValue: assetRepo },
                { provide: getRepositoryToken(HardwareRequestItem), useValue: itemRepo },
                { provide: getRepositoryToken(HardwareRequest), useValue: reqRepo },
            ],
        }).compile();
        svc = mod.get(HardwareAssetService);
        jest.clearAllMocks();
    });

    it('creates asset with unique barcode', async () => {
        itemRepo.findOne.mockResolvedValue({ id: 'i1', requestId: 'r1', quantity: 2 });
        reqRepo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'u1', siteId: 's1', recipientId: null });
        assetRepo.findOne.mockResolvedValue(null);
        assetRepo.count.mockResolvedValue(0);

        const res = await svc.createAsset('r1', 'i1', 'BC-001', 't1');
        expect(res.id).toBe('a1');
        expect(res.barcode).toBe('BC-001');
    });

    it('rejects duplicate barcode', async () => {
        itemRepo.findOne.mockResolvedValue({ id: 'i1', requestId: 'r1', quantity: 1 });
        reqRepo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'u1', siteId: 's1' });
        assetRepo.findOne.mockResolvedValue({ id: 'other', barcode: 'BC-001' });
        await expect(svc.createAsset('r1', 'i1', 'BC-001', 't1')).rejects.toThrow(/HR_BARCODE_DUPLICATE/);
    });

    it('rejects scan beyond quantity', async () => {
        itemRepo.findOne.mockResolvedValue({ id: 'i1', requestId: 'r1', quantity: 2 });
        reqRepo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'u1', siteId: 's1' });
        assetRepo.findOne.mockResolvedValue(null);
        assetRepo.count.mockResolvedValue(2);
        await expect(svc.createAsset('r1', 'i1', 'BC-003', 't1')).rejects.toThrow(/quantity reached/i);
    });

    it('allAssetsCollected returns true when all items fully barcoded', async () => {
        assetRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
        const items = [{ id: 'i1', quantity: 2 }, { id: 'i2', quantity: 1 }];
        const ok = await svc.allAssetsCollected(items as any);
        expect(ok).toBe(true);
    });
});
```

- [ ] **Step 2: Implement service**

```typescript
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HardwareAsset } from '../domain/entities/hardware-asset.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

@Injectable()
export class HardwareAssetService {
    constructor(
        @InjectRepository(HardwareAsset) private readonly repo: Repository<HardwareAsset>,
        @InjectRepository(HardwareRequestItem) private readonly items: Repository<HardwareRequestItem>,
        @InjectRepository(HardwareRequest) private readonly reqs: Repository<HardwareRequest>,
    ) {}

    async createAsset(requestId: string, itemId: string, barcode: string, installedBy: string): Promise<HardwareAsset> {
        const item = await this.items.findOne({ where: { id: itemId, requestId } });
        if (!item) throw new NotFoundException('item');
        const req = await this.reqs.findOne({ where: { id: requestId } });
        if (!req) throw new NotFoundException('request');

        const dupe = await this.repo.findOne({ where: { barcode } });
        if (dupe) {
            const err: any = new ConflictException('HR_BARCODE_DUPLICATE');
            err.existingAssetId = dupe.id;
            throw err;
        }
        const existing = await this.repo.count({ where: { itemId } });
        if (existing >= item.quantity) throw new ConflictException('quantity reached for this item');

        const row = this.repo.create({
            itemId, barcode,
            assignedToUserId: req.recipientId ?? req.requesterId,
            siteId: req.siteId,
            installedAt: new Date(),
            installedBy,
        });
        return this.repo.save(row);
    }

    async findByBarcode(barcode: string): Promise<HardwareAsset | null> {
        return this.repo.findOne({ where: { barcode } });
    }

    async allAssetsCollected(items: HardwareRequestItem[]): Promise<boolean> {
        for (const it of items) {
            const c = await this.repo.count({ where: { itemId: it.id } });
            if (c < it.quantity) return false;
        }
        return true;
    }

    async listByRequest(requestId: string): Promise<HardwareAsset[]> {
        return this.repo.createQueryBuilder('a')
            .innerJoin('hardware_request_items', 'i', 'i.id = a.itemId')
            .where('i.requestId = :requestId', { requestId })
            .orderBy('a.createdAt', 'ASC')
            .getMany();
    }
}
```

- [ ] **Step 3: Tests PASS. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): hardware asset + barcode uniqueness"
```

---

## Task 3.12: Command service — `completeInstallation` on request

**Files:** Modify `hardware-request-command.service.ts`

- [ ] **Step 1: Tests (RED)**

```typescript
describe('completeInstallation (request transition)', () => {
    it('INSTALLATION → COMPLETED when schedule DONE and all assets collected', async () => {
        requestRepo.findOne.mockResolvedValue({
            id: 'r1', status: RequestStatus.INSTALLATION, items: [{ id: 'i1', quantity: 1 }],
        });
        scheduleRepo.findOne.mockResolvedValue({ status: InstallStatus.DONE });
        assetSvc.allAssetsCollected.mockResolvedValue(true);

        const res = await svc.completeInstallation('r1', { id: 't1', role: 'ICT_TECHNICIAN' });
        expect(res.status).toBe(RequestStatus.COMPLETED);
    });

    it('blocks when schedule not DONE', async () => {
        requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, items: [] });
        scheduleRepo.findOne.mockResolvedValue({ status: InstallStatus.IN_PROGRESS });
        await expect(svc.completeInstallation('r1', { id: 't1', role: 'ICT_TECHNICIAN' }))
            .rejects.toThrow(/schedule not done/i);
    });

    it('blocks when not all items barcoded', async () => {
        requestRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, items: [{ id: 'i1', quantity: 2 }] });
        scheduleRepo.findOne.mockResolvedValue({ status: InstallStatus.DONE });
        assetSvc.allAssetsCollected.mockResolvedValue(false);
        await expect(svc.completeInstallation('r1', { id: 't1', role: 'ICT_TECHNICIAN' }))
            .rejects.toThrow(/barcode/i);
    });
});
```

- [ ] **Step 2: Implement method**

Di `hardware-request-command.service.ts`:

```typescript
async completeInstallation(requestId: string, actor: ActingUser): Promise<HardwareRequest> {
    const req = await this.repo.findOne({
        where: { id: requestId }, relations: ['items'],
    });
    if (!req) throw new NotFoundException('request');
    if (req.status !== RequestStatus.INSTALLATION) throw new ConflictException('HR_INVALID_TRANSITION');
    if (actor.role !== 'ICT_TECHNICIAN') throw new ForbiddenException('HR_PERMISSION_DENIED');

    const sched = await this.scheduleRepo.findOne({ where: { requestId, status: InstallStatus.DONE } });
    if (!sched) throw new ConflictException('schedule not done');

    const ok = await this.assetSvc.allAssetsCollected(req.items);
    if (!ok) throw new ConflictException('missing barcode for one or more items');

    req.status = RequestStatus.COMPLETED;
    req.completedAt = new Date();
    req.version += 1;
    const saved = await this.repo.save(req);

    await this.activity.log(requestId, actor.id, 'REQUEST_COMPLETED', { scheduleId: sched.id });
    this.emitter.emit('hardware-request.install.completed', { requestId, actorId: actor.id });
    return saved;
}
```

- [ ] **Step 3: Tests PASS. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): completeInstallation transition"
```

---

## Task 3.13: `installation.controller.ts`

**Files:** Create `presentation/installation.controller.ts` + spec.

- [ ] **Step 1: Controller**

```typescript
import { Body, Controller, Param, ParseUUIDPipe, Post, Get, Query, UseGuards, Req } from '@nestjs/common';
import { HardwareRoleGuard, HardwareRoles } from '../guards/hardware-role.guard';
import { InstallationScheduleService } from '../services/installation-schedule.service';
import { HardwareAssetService } from '../services/hardware-asset.service';
import { HardwareRequestCommandService } from '../services/hardware-request-command.service';
import { ScheduleInstallDto } from '../dto/schedule-install.dto';
import { RescheduleInstallDto } from '../dto/reschedule-install.dto';
import { BarcodeDto } from '../dto/barcode.dto';
import { CalendarQueryDto } from '../dto/calendar-query.dto';

@Controller('hardware-requests')
@UseGuards(HardwareRoleGuard)
export class InstallationController {
    constructor(
        private readonly scheduleSvc: InstallationScheduleService,
        private readonly assetSvc: HardwareAssetService,
        private readonly cmdSvc: HardwareRequestCommandService,
    ) {}

    @Post(':id/schedule')
    @HardwareRoles('USER', 'ICT_TECHNICIAN')
    async propose(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ScheduleInstallDto, @Req() r: any) {
        const data = await this.scheduleSvc.propose(id, dto, r.user);
        return { success: true, data };
    }

    @Post(':id/schedule/confirm')
    @HardwareRoles('USER', 'ICT_TECHNICIAN')
    async confirm(@Param('id', ParseUUIDPipe) id: string, @Req() r: any) {
        const data = await this.scheduleSvc.confirm(id, r.user);
        return { success: true, data };
    }

    @Post(':id/schedule/reschedule')
    @HardwareRoles('USER', 'ICT_TECHNICIAN')
    async reschedule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RescheduleInstallDto, @Req() r: any) {
        const data = await this.scheduleSvc.reschedule(id, dto, r.user);
        return { success: true, data };
    }

    @Post(':id/install/start')
    @HardwareRoles('ICT_TECHNICIAN')
    async start(@Param('id', ParseUUIDPipe) id: string, @Req() r: any) {
        const data = await this.scheduleSvc.startInstallation(id, r.user);
        return { success: true, data };
    }

    @Post(':id/items/:itemId/barcode')
    @HardwareRoles('ICT_TECHNICIAN')
    async scan(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('itemId', ParseUUIDPipe) itemId: string,
        @Body() dto: BarcodeDto,
        @Req() r: any,
    ) {
        const data = await this.assetSvc.createAsset(id, itemId, dto.barcode, r.user.id);
        return { success: true, data };
    }

    @Post(':id/install/complete')
    @HardwareRoles('ICT_TECHNICIAN')
    async complete(@Param('id', ParseUUIDPipe) id: string, @Req() r: any) {
        await this.scheduleSvc.completeInstallation(id, r.user);
        const data = await this.cmdSvc.completeInstallation(id, r.user);
        return { success: true, data };
    }

    @Get('calendar')
    @HardwareRoles('ICT_LEAD', 'ICT_PROCUREMENT', 'ICT_TECHNICIAN')
    async calendar(@Query() q: CalendarQueryDto) {
        const data = await this.scheduleSvc.calendar(q);
        return { success: true, data };
    }

    @Get('assets/by-barcode/:code')
    @HardwareRoles('ICT_LEAD', 'ICT_PROCUREMENT', 'ICT_TECHNICIAN')
    async byBarcode(@Param('code') code: string) {
        const data = await this.assetSvc.findByBarcode(code);
        return { success: true, data };
    }
}
```

- [ ] **Step 2: Tambahkan `calendar()` di service**

```typescript
async calendar(q: CalendarQueryDto): Promise<InstallationSchedule[]> {
    const qb = this.repo.createQueryBuilder('s')
        .leftJoinAndSelect('s.request', 'r')
        .where('s.scheduledStart >= :from AND s.scheduledStart < :to', { from: q.from, to: q.to });

    if (q.technicianId?.length) qb.andWhere('s.technicianId IN (:...t)', { t: q.technicianId });
    if (q.status?.length) qb.andWhere('s.status IN (:...st)', { st: q.status });
    return qb.orderBy('s.scheduledStart', 'ASC').getMany();
}
```

- [ ] **Step 3: Controller spec — supertest happy path**

`installation.controller.spec.ts` — test propose (201), confirm (200), reschedule (200), barcode (201), complete (200), calendar (200) dengan mocked services, guard pass.

- [ ] **Step 4: Run e2e test + commit**

```bash
pnpm --filter backend test -- installation.controller.spec
git add -A && git commit -m "feat(hardware-request): installation controller + calendar endpoint"
```

---

## Task 3.14: Module registration + cleanup ticketing

**Files:** Modify `hardware-request.module.ts` + `ticketing/ticketing.module.ts`.

- [ ] **Step 1: Register**

```typescript
// hardware-request.module.ts (tambahan)
TypeOrmModule.forFeature([
    HardwareRequest, HardwareRequestItem, HardwareCatalog,
    HardwareRequestComment, HardwareRequestActivity,
    InstallationSchedule, HardwareAsset,
])

providers: [..., InstallationScheduleService, HardwareAssetService]
controllers: [..., InstallationController]
exports: [..., InstallationScheduleService, HardwareAssetService]
```

- [ ] **Step 2: Remove dari ticketing**

Di `ticketing.module.ts`: hapus import `InstallationSchedule` dari `TypeOrmModule.forFeature`, hapus provider `HardwareSchedulerService` + `InstallationNotificationListener`. Delete 3 file (entity, service, listener) — file fisik dibiarkan dulu sampai Plan 5 selesai.

- [ ] **Step 3: Run backend build + boot smoke**

```bash
pnpm --filter backend build
pnpm --filter backend start:dev # verify tidak crash
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(hardware-request): register install module + decouple ticketing"
```

---

## Task 3.15: Integration test — mutual scheduling happy path

**Files:** Create `test/integration/mutual-scheduling.e2e-spec.ts`

- [ ] **Step 1: Write integration**

```typescript
describe('Mutual Scheduling Flow (integration)', () => {
    // TestingModule bootstrap real DB (docker), seed users (requester u1, lead l1, proc p1, tech t1).
    // Flow:
    // 1. Create request u1, submit, l1 review+approve, p1 fill item + complete → status INSTALLATION.
    // 2. t1 POST /schedule → PROPOSED.
    // 3. u1 POST /schedule/confirm → CONFIRMED.
    // 4. t1 POST /install/start → IN_PROGRESS.
    // 5. t1 POST /items/:itemId/barcode {barcode:'BC-1'} → 201.
    // 6. t1 POST /install/complete → request COMPLETED.
    // assert: activity feed count, status chain, asset persisted.
});
```

Implementasi detail: reuse bootstrap dari Plan 1/2 integration test. Gunakan `SUPERTEST` + `Test.createTestingModule`.

- [ ] **Step 2: Run**

```bash
pnpm --filter backend test:integration -- mutual-scheduling
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test(hardware-request): mutual scheduling e2e"
```

---

## Task 3.16: Module exports + OpenAPI tags

- [ ] **Step 1: Decorate controllers**

```typescript
@ApiTags('hardware-requests/installation')
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "docs(hardware-request): openapi tags installation"
```

---

## Verification Checklist (before closing Plan 3)

- [ ] `pnpm --filter backend build` pass
- [ ] All new unit specs pass; coverage ≥80% untuk service install/asset
- [ ] Integration mutual-scheduling hijau
- [ ] Migration idempotent: `migration:run` 2× tidak error
- [ ] POST `/hardware-requests/:id/schedule` returns 201; `confirm` returns 200
- [ ] Duplicate barcode → 409 `HR_BARCODE_DUPLICATE`
- [ ] Complete request tanpa barcode lengkap → 409
- [ ] Reschedule saat IN_PROGRESS → 409
- [ ] Calendar endpoint filter date+technician+status → correct rows

**Next:** Plan 4 — Notifications, Events & Realtime.
