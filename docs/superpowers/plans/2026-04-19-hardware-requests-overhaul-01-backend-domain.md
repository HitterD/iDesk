# Hardware Requests Overhaul — Plan 1: Backend Domain Extension

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend hardware-request backend dengan state `AWAITING_DELIVERY`, per-item delivery tracking, mutual scheduling endpoints, procurement simplification, comments un-block. Schema additive only (back-compat).

**Architecture:** NestJS + TypeORM. Layered (controller → service → repository). State machine in domain layer. Event-driven notifications via existing listeners. Atomic transactions for state transitions touching multiple tables.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Jest (max 2 worker), class-validator, EventEmitter2.

**Spec:** `docs/superpowers/specs/2026-04-19-hardware-requests-workflow-overhaul-design.md`

**Test command:**
```bash
pnpm --filter backend test -- --maxWorkers=2
# atau serial:
pnpm --filter backend test -- --runInBand
```

---

## Task 1: Migration — Schema Extension

**Files:**
- Create: `apps/backend/src/migrations/<timestamp>-hardware-request-workflow-v2.ts`

- [ ] **Step 1: Generate migration filename**

```bash
date -u +"%Y%m%d%H%M%S"
# example output: 20260419120000
```

Filename: `20260419120000-hardware-request-workflow-v2.ts`

- [ ] **Step 2: Write migration up/down**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardwareRequestWorkflowV21712345678901 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // hardware_request_item — delivery tracking + per-item procurement decision
    await queryRunner.query(`
      ALTER TABLE hardware_request_item
        ADD COLUMN IF NOT EXISTS delivery_status varchar(20) NOT NULL DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS arrived_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS procurement_decision varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS procurement_decided_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS procurement_decided_by uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request_item
        ADD CONSTRAINT chk_hri_delivery_status
          CHECK (delivery_status IN ('PENDING','ARRIVED','NOT_PROCURED'))
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request_item
        ADD CONSTRAINT chk_hri_procurement_decision
          CHECK (procurement_decision IS NULL OR procurement_decision IN ('APPROVED','REJECTED'))
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request_item
        ADD CONSTRAINT fk_hri_decided_by
          FOREIGN KEY (procurement_decided_by) REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_hri_delivery_status
        ON hardware_request_item(delivery_status)
    `);

    // installation_schedule — proposed_slots + reschedule loop
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        ADD COLUMN IF NOT EXISTS proposed_slots jsonb NULL,
        ADD COLUMN IF NOT EXISTS selected_slot_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS reschedule_count int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS reschedule_reason text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        DROP CONSTRAINT IF EXISTS installation_schedule_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        ADD CONSTRAINT installation_schedule_status_check
          CHECK (status IN (
            'PROPOSED','PROPOSED_AWAITING_USER','CONFIRMED',
            'IN_PROGRESS','DONE','RESCHEDULED','RESCHEDULE_REQUESTED','CANCELLED'
          ))
    `);

    // installation_schedule_items — M-to-N join
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS installation_schedule_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        schedule_id uuid NOT NULL REFERENCES installation_schedule(id) ON DELETE CASCADE,
        item_id uuid NOT NULL REFERENCES hardware_request_item(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(schedule_id, item_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_isi_schedule
        ON installation_schedule_items(schedule_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_isi_item
        ON installation_schedule_items(item_id)
    `);

    // hardware_request status — extend untuk AWAITING_DELIVERY
    await queryRunner.query(`
      ALTER TABLE hardware_request
        DROP CONSTRAINT IF EXISTS hardware_request_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request
        ADD CONSTRAINT hardware_request_status_check
          CHECK (status IN (
            'DRAFT','SUBMITTED','REVIEW','APPROVED','PROCUREMENT',
            'AWAITING_DELIVERY','INSTALLATION','DONE','REJECTED','CANCELLED'
          ))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS installation_schedule_items`);
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        DROP COLUMN IF EXISTS proposed_slots,
        DROP COLUMN IF EXISTS selected_slot_at,
        DROP COLUMN IF EXISTS reschedule_count,
        DROP COLUMN IF EXISTS reschedule_reason
    `);
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        DROP CONSTRAINT IF EXISTS installation_schedule_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE installation_schedule
        ADD CONSTRAINT installation_schedule_status_check
          CHECK (status IN ('PROPOSED','CONFIRMED','IN_PROGRESS','DONE','RESCHEDULED','CANCELLED'))
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request_item
        DROP CONSTRAINT IF EXISTS fk_hri_decided_by,
        DROP CONSTRAINT IF EXISTS chk_hri_procurement_decision,
        DROP CONSTRAINT IF EXISTS chk_hri_delivery_status,
        DROP COLUMN IF EXISTS procurement_decided_by,
        DROP COLUMN IF EXISTS procurement_decided_at,
        DROP COLUMN IF EXISTS procurement_decision,
        DROP COLUMN IF EXISTS arrived_at,
        DROP COLUMN IF EXISTS delivery_status
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_hri_delivery_status`);
    await queryRunner.query(`
      ALTER TABLE hardware_request
        DROP CONSTRAINT IF EXISTS hardware_request_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE hardware_request
        ADD CONSTRAINT hardware_request_status_check
          CHECK (status IN ('DRAFT','SUBMITTED','REVIEW','APPROVED','PROCUREMENT',
                            'INSTALLATION','DONE','REJECTED','CANCELLED'))
    `);
  }
}
```

- [ ] **Step 3: Run migration**

```bash
pnpm --filter backend run typeorm migration:run
```

Expected: "Migration HardwareRequestWorkflowV21712345678901... has been executed successfully"

- [ ] **Step 4: Verify schema**

```bash
psql "$DATABASE_URL" -c "\d hardware_request_item" | grep -E 'delivery_status|arrived_at|procurement_decision'
psql "$DATABASE_URL" -c "\d installation_schedule_items"
```

Expected: kolom & tabel terlihat.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/migrations/20260419120000-hardware-request-workflow-v2.ts
git commit -m "feat(hr-be): migration for delivery tracking + mutual scheduling schema"
```

---

## Task 2: Entity — `HardwareRequestItem` Extension

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/domain/entities/hardware-request-item.entity.ts`

- [ ] **Step 1: Read existing entity**

```bash
cat apps/backend/src/modules/hardware-request/domain/entities/hardware-request-item.entity.ts
```

- [ ] **Step 2: Add columns**

```typescript
// add inside @Entity class:
@Column({
  type: 'varchar',
  length: 20,
  default: 'PENDING',
})
deliveryStatus!: 'PENDING' | 'ARRIVED' | 'NOT_PROCURED';

@Column({ type: 'timestamptz', nullable: true })
arrivedAt?: Date | null;

@Column({
  type: 'varchar',
  length: 20,
  nullable: true,
})
procurementDecision?: 'APPROVED' | 'REJECTED' | null;

@Column({ type: 'timestamptz', nullable: true })
procurementDecidedAt?: Date | null;

@Column({ type: 'uuid', nullable: true })
procurementDecidedBy?: string | null;
```

- [ ] **Step 3: Write entity unit test**

Create `apps/backend/src/modules/hardware-request/domain/entities/__tests__/hardware-request-item.entity.spec.ts`:

```typescript
import { HardwareRequestItem } from '../hardware-request-item.entity';

describe('HardwareRequestItem entity', () => {
  it('defaults deliveryStatus to PENDING when constructed minimally', () => {
    const item = new HardwareRequestItem();
    item.deliveryStatus = 'PENDING';
    expect(item.deliveryStatus).toBe('PENDING');
  });

  it('allows ARRIVED with arrivedAt timestamp', () => {
    const item = new HardwareRequestItem();
    item.deliveryStatus = 'ARRIVED';
    item.arrivedAt = new Date('2026-04-19T08:00:00Z');
    expect(item.arrivedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter backend test -- --runInBand hardware-request-item.entity.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/entities/hardware-request-item.entity.ts \
        apps/backend/src/modules/hardware-request/domain/entities/__tests__/hardware-request-item.entity.spec.ts
git commit -m "feat(hr-be): add delivery & procurement-decision columns to item entity"
```

---

## Task 3: Entity — `InstallationSchedule` Extension + `InstallationScheduleItem`

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/domain/entities/installation-schedule.entity.ts`
- Create: `apps/backend/src/modules/hardware-request/domain/entities/installation-schedule-item.entity.ts`

- [ ] **Step 1: Add columns to InstallationSchedule**

```typescript
// add inside @Entity class:
@Column({ type: 'jsonb', nullable: true })
proposedSlots?: Array<{ start: string; end: string }> | null;

@Column({ type: 'timestamptz', nullable: true })
selectedSlotAt?: Date | null;

@Column({ type: 'int', default: 0 })
rescheduleCount!: number;

@Column({ type: 'text', nullable: true })
rescheduleReason?: string | null;

// extend status union type:
status!:
  | 'PROPOSED'
  | 'PROPOSED_AWAITING_USER'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'RESCHEDULED'
  | 'RESCHEDULE_REQUESTED'
  | 'CANCELLED';

@OneToMany(() => InstallationScheduleItem, (item) => item.schedule, { cascade: true })
items!: InstallationScheduleItem[];
```

- [ ] **Step 2: Create InstallationScheduleItem entity**

```typescript
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { HardwareRequestItem } from './hardware-request-item.entity';
import { InstallationSchedule } from './installation-schedule.entity';

@Entity({ name: 'installation_schedule_items' })
@Unique(['scheduleId', 'itemId'])
@Index(['scheduleId'])
@Index(['itemId'])
export class InstallationScheduleItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'schedule_id', type: 'uuid' })
  scheduleId!: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId!: string;

  @ManyToOne(() => InstallationSchedule, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id' })
  schedule!: InstallationSchedule;

  @ManyToOne(() => HardwareRequestItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: HardwareRequestItem;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

- [ ] **Step 3: Register entity in module**

Modify `apps/backend/src/modules/hardware-request/hardware-request.module.ts`:

```typescript
TypeOrmModule.forFeature([
  HardwareRequest,
  HardwareRequestItem,
  HardwareRequestActivity,
  HardwareRequestComment,
  InstallationSchedule,
  InstallationScheduleItem, // ← add
  // ... rest
]),
```

- [ ] **Step 4: Write entity test**

Create `apps/backend/src/modules/hardware-request/domain/entities/__tests__/installation-schedule-item.entity.spec.ts`:

```typescript
import { InstallationScheduleItem } from '../installation-schedule-item.entity';

describe('InstallationScheduleItem entity', () => {
  it('exposes scheduleId + itemId for join', () => {
    const link = new InstallationScheduleItem();
    link.scheduleId = '11111111-1111-1111-1111-111111111111';
    link.itemId = '22222222-2222-2222-2222-222222222222';
    expect(link.scheduleId).toBeDefined();
    expect(link.itemId).toBeDefined();
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter backend test -- --runInBand installation-schedule
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/entities/installation-schedule.entity.ts \
        apps/backend/src/modules/hardware-request/domain/entities/installation-schedule-item.entity.ts \
        apps/backend/src/modules/hardware-request/hardware-request.module.ts \
        apps/backend/src/modules/hardware-request/domain/entities/__tests__/installation-schedule-item.entity.spec.ts
git commit -m "feat(hr-be): add installation_schedule_items join + proposed_slots column"
```

---

## Task 4: Domain Events

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/domain/events/hardware-request.events.ts`

- [ ] **Step 1: Add event constants & payload types**

```typescript
export const HardwareEvents = {
  // ... existing
  ItemArrived: 'hardware-item.arrived',
  ItemNotProcured: 'hardware-item.not-procured',
  ProcurementCompleted: 'procurement.completed',
  ScheduleProposed: 'schedule.proposed',
  ScheduleConfirmed: 'schedule.confirmed',
  ScheduleRescheduleRequested: 'schedule.reschedule-requested',
  ScheduleCancelled: 'schedule.cancelled',
} as const;

export interface ItemArrivedPayload {
  requestId: string;
  itemId: string;
  itemName: string;
  ownerId: string;
  arrivedAt: Date;
}

export interface ProcurementCompletedPayload {
  requestId: string;
  ownerId: string;
  approvedItems: number;
  rejectedItems: number;
}

export interface ScheduleProposedPayload {
  requestId: string;
  scheduleId: string;
  ownerId: string;
  technicianId: string;
  slots: Array<{ start: string; end: string }>;
}

export interface ScheduleConfirmedPayload {
  requestId: string;
  scheduleId: string;
  technicianId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
}

export interface ScheduleRescheduleRequestedPayload {
  requestId: string;
  scheduleId: string;
  technicianId: string;
  reason: string;
  rescheduleCount: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/events/hardware-request.events.ts
git commit -m "feat(hr-be): add events for item arrival + mutual scheduling"
```

---

## Task 5: State Machine — Add `AWAITING_DELIVERY` Transition

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/domain/state-machine/request-state.ts` (path may differ — locate via `grep -r "PROCUREMENT.*INSTALLATION"`)

- [ ] **Step 1: Locate state machine**

```bash
grep -rln "PROCUREMENT" apps/backend/src/modules/hardware-request/domain/
```

- [ ] **Step 2: Write failing test for new transition**

Create or extend `apps/backend/src/modules/hardware-request/domain/state-machine/__tests__/request-state.spec.ts`:

```typescript
import { canTransition } from '../request-state';

describe('Request state machine — AWAITING_DELIVERY', () => {
  it('allows PROCUREMENT → AWAITING_DELIVERY', () => {
    expect(canTransition('PROCUREMENT', 'AWAITING_DELIVERY')).toBe(true);
  });

  it('allows AWAITING_DELIVERY → INSTALLATION', () => {
    expect(canTransition('AWAITING_DELIVERY', 'INSTALLATION')).toBe(true);
  });

  it('forbids AWAITING_DELIVERY → DONE directly', () => {
    expect(canTransition('AWAITING_DELIVERY', 'DONE')).toBe(false);
  });

  it('allows INSTALLATION → DONE', () => {
    expect(canTransition('INSTALLATION', 'DONE')).toBe(true);
  });

  it('still allows PROCUREMENT → REJECTED', () => {
    expect(canTransition('PROCUREMENT', 'REJECTED')).toBe(true);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

```bash
pnpm --filter backend test -- --runInBand request-state.spec
```

Expected: FAIL (transition not defined).

- [ ] **Step 4: Update state machine table**

```typescript
const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['REVIEW', 'CANCELLED'],
  REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PROCUREMENT'],
  PROCUREMENT: ['AWAITING_DELIVERY', 'REJECTED'],
  AWAITING_DELIVERY: ['INSTALLATION', 'CANCELLED'],
  INSTALLATION: ['DONE', 'CANCELLED'],
  DONE: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type RequestStatus =
  | 'DRAFT' | 'SUBMITTED' | 'REVIEW' | 'APPROVED'
  | 'PROCUREMENT' | 'AWAITING_DELIVERY' | 'INSTALLATION'
  | 'DONE' | 'REJECTED' | 'CANCELLED';
```

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm --filter backend test -- --runInBand request-state.spec
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/state-machine/
git commit -m "feat(hr-be): add AWAITING_DELIVERY state transitions"
```

---

## Task 6: DTO — Procurement Decision

**Files:**
- Create: `apps/backend/src/modules/hardware-request/dto/procurement-decision.dto.ts`
- Create: `apps/backend/src/modules/hardware-request/dto/procurement-complete.dto.ts`

- [ ] **Step 1: Write DTOs**

```typescript
// procurement-decision.dto.ts
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemDecisionInput {
  @IsUUID()
  itemId!: string;

  @IsEnum(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';
}

export class ProcurementDecisionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDecisionInput)
  decisions!: ItemDecisionInput[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
```

```typescript
// procurement-complete.dto.ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ProcurementCompleteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectReason?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/dto/procurement-decision.dto.ts \
        apps/backend/src/modules/hardware-request/dto/procurement-complete.dto.ts
git commit -m "feat(hr-be): procurement decision + complete DTOs"
```

---

## Task 7: Service — `ProcurementDecisionService`

**Files:**
- Create: `apps/backend/src/modules/hardware-request/services/procurement-decision.service.ts`
- Create: `apps/backend/src/modules/hardware-request/services/__tests__/procurement-decision.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { Test } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProcurementDecisionService } from '../procurement-decision.service';
import { HardwareRequest } from '../../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../../domain/entities/hardware-request-item.entity';

describe('ProcurementDecisionService', () => {
  let service: ProcurementDecisionService;
  let mockItemRepo: jest.Mocked<Repository<HardwareRequestItem>>;
  let mockReqRepo: jest.Mocked<Repository<HardwareRequest>>;
  let mockEmitter: jest.Mocked<EventEmitter2>;
  let mockDataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    mockItemRepo = { findBy: jest.fn(), save: jest.fn() } as any;
    mockReqRepo = { findOne: jest.fn(), save: jest.fn() } as any;
    mockEmitter = { emit: jest.fn() } as any;
    mockDataSource = {
      transaction: jest.fn((cb: any) => cb({
        getRepository: (e: any) => e.name.includes('Item') ? mockItemRepo : mockReqRepo,
      })),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProcurementDecisionService,
        { provide: getRepositoryToken(HardwareRequestItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(HardwareRequest), useValue: mockReqRepo },
        { provide: EventEmitter2, useValue: mockEmitter },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = moduleRef.get(ProcurementDecisionService);
  });

  describe('decideItems', () => {
    it('persists decisions for valid items', async () => {
      mockItemRepo.findBy.mockResolvedValue([
        { id: 'i1', requestId: 'r1' } as any,
        { id: 'i2', requestId: 'r1' } as any,
      ]);

      await service.decideItems('r1', {
        decisions: [
          { itemId: 'i1', decision: 'APPROVED' },
          { itemId: 'i2', decision: 'REJECTED' },
        ],
      }, 'user-1');

      expect(mockItemRepo.save).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 'i1', procurementDecision: 'APPROVED', procurementDecidedBy: 'user-1' }),
        expect.objectContaining({ id: 'i2', procurementDecision: 'REJECTED' }),
      ]));
    });

    it('rejects when item not in request', async () => {
      mockItemRepo.findBy.mockResolvedValue([{ id: 'i1', requestId: 'r1' } as any]);
      await expect(service.decideItems('r1', {
        decisions: [{ itemId: 'i-other', decision: 'APPROVED' }],
      }, 'user-1')).rejects.toThrow(/item not in request/i);
    });
  });

  describe('completeProcurement', () => {
    it('transitions to AWAITING_DELIVERY when ≥1 APPROVED', async () => {
      mockReqRepo.findOne.mockResolvedValue({
        id: 'r1', status: 'PROCUREMENT', items: [
          { id: 'i1', procurementDecision: 'APPROVED', deliveryStatus: 'PENDING' },
          { id: 'i2', procurementDecision: 'REJECTED', deliveryStatus: 'PENDING' },
        ],
      } as any);

      const result = await service.completeProcurement('r1', {}, 'ict-1');

      expect(result.status).toBe('AWAITING_DELIVERY');
      expect(mockEmitter.emit).toHaveBeenCalledWith('procurement.completed', expect.any(Object));
    });

    it('transitions to REJECTED when all REJECTED + reason given', async () => {
      mockReqRepo.findOne.mockResolvedValue({
        id: 'r1', status: 'PROCUREMENT', items: [
          { id: 'i1', procurementDecision: 'REJECTED' },
        ],
      } as any);

      const result = await service.completeProcurement('r1', { rejectReason: 'no stock' }, 'ict-1');

      expect(result.status).toBe('REJECTED');
    });

    it('throws if any item undecided', async () => {
      mockReqRepo.findOne.mockResolvedValue({
        id: 'r1', status: 'PROCUREMENT', items: [
          { id: 'i1', procurementDecision: 'APPROVED' },
          { id: 'i2', procurementDecision: null },
        ],
      } as any);

      await expect(service.completeProcurement('r1', {}, 'ict-1'))
        .rejects.toThrow(/undecided items/i);
    });

    it('throws if all REJECTED but no reason', async () => {
      mockReqRepo.findOne.mockResolvedValue({
        id: 'r1', status: 'PROCUREMENT', items: [
          { id: 'i1', procurementDecision: 'REJECTED' },
        ],
      } as any);

      await expect(service.completeProcurement('r1', {}, 'ict-1'))
        .rejects.toThrow(/reason required/i);
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter backend test -- --runInBand procurement-decision.service.spec
```

- [ ] **Step 3: Implement service**

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { ProcurementDecisionDto } from '../dto/procurement-decision.dto';
import { ProcurementCompleteDto } from '../dto/procurement-complete.dto';
import { canTransition } from '../domain/state-machine/request-state';
import { HardwareEvents, ProcurementCompletedPayload } from '../domain/events/hardware-request.events';

@Injectable()
export class ProcurementDecisionService {
  constructor(
    @InjectRepository(HardwareRequestItem)
    private readonly itemRepo: Repository<HardwareRequestItem>,
    @InjectRepository(HardwareRequest)
    private readonly reqRepo: Repository<HardwareRequest>,
    private readonly emitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async decideItems(
    requestId: string,
    dto: ProcurementDecisionDto,
    actorId: string,
  ): Promise<HardwareRequestItem[]> {
    const ids = dto.decisions.map((d) => d.itemId);
    const items = await this.itemRepo.findBy({ id: In(ids) });

    const invalid = items.find((i) => i.requestId !== requestId);
    if (invalid || items.length !== ids.length) {
      throw new BadRequestException('item not in request');
    }

    const now = new Date();
    const updated = items.map((item) => {
      const decision = dto.decisions.find((d) => d.itemId === item.id)!.decision;
      return {
        ...item,
        procurementDecision: decision,
        procurementDecidedAt: now,
        procurementDecidedBy: actorId,
      };
    });
    return this.itemRepo.save(updated as HardwareRequestItem[]);
  }

  async completeProcurement(
    requestId: string,
    dto: ProcurementCompleteDto,
    actorId: string,
  ): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
      const reqRepoTx = mgr.getRepository(HardwareRequest);
      const itemRepoTx = mgr.getRepository(HardwareRequestItem);

      const req = await reqRepoTx.findOne({
        where: { id: requestId },
        relations: ['items'],
      });
      if (!req) throw new NotFoundException('request not found');
      if (req.status !== 'PROCUREMENT') {
        throw new BadRequestException(`cannot complete from status ${req.status}`);
      }

      const undecided = req.items.filter((i) => !i.procurementDecision);
      if (undecided.length > 0) {
        throw new BadRequestException(`undecided items: ${undecided.length}`);
      }

      const approved = req.items.filter((i) => i.procurementDecision === 'APPROVED');
      const rejected = req.items.filter((i) => i.procurementDecision === 'REJECTED');

      if (approved.length === 0 && !dto.rejectReason) {
        throw new BadRequestException('reason required when all items rejected');
      }

      const nextStatus = approved.length > 0 ? 'AWAITING_DELIVERY' : 'REJECTED';
      if (!canTransition(req.status, nextStatus)) {
        throw new BadRequestException(`cannot transition ${req.status} → ${nextStatus}`);
      }

      // sync per-item delivery_status
      await itemRepoTx.save(req.items.map((i) => ({
        ...i,
        deliveryStatus: i.procurementDecision === 'APPROVED' ? 'PENDING' : 'NOT_PROCURED',
      })) as HardwareRequestItem[]);

      const updatedReq = await reqRepoTx.save({
        ...req,
        status: nextStatus,
        rejectReason: nextStatus === 'REJECTED' ? dto.rejectReason : req.rejectReason,
      } as HardwareRequest);

      const payload: ProcurementCompletedPayload = {
        requestId: req.id,
        ownerId: req.userId,
        approvedItems: approved.length,
        rejectedItems: rejected.length,
      };
      this.emitter.emit(HardwareEvents.ProcurementCompleted, payload);

      return updatedReq;
    });
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter backend test -- --runInBand procurement-decision.service.spec
```

- [ ] **Step 5: Register service in module**

```typescript
// hardware-request.module.ts providers:
ProcurementDecisionService,
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/procurement-decision.service.ts \
        apps/backend/src/modules/hardware-request/services/__tests__/procurement-decision.service.spec.ts \
        apps/backend/src/modules/hardware-request/hardware-request.module.ts
git commit -m "feat(hr-be): ProcurementDecisionService with per-item APPROVE/REJECT + auto transition"
```

---

## Task 8: Service — `DeliveryTrackingService`

**Files:**
- Create: `apps/backend/src/modules/hardware-request/services/delivery-tracking.service.ts`
- Create: `apps/backend/src/modules/hardware-request/services/__tests__/delivery-tracking.service.spec.ts`
- Create: `apps/backend/src/modules/hardware-request/dto/item-delivery.dto.ts`

- [ ] **Step 1: DTO**

```typescript
// item-delivery.dto.ts
import { IsEnum } from 'class-validator';

export class ItemDeliveryDto {
  @IsEnum(['ARRIVED', 'PENDING'])
  status!: 'ARRIVED' | 'PENDING';
}
```

- [ ] **Step 2: Failing test**

```typescript
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeliveryTrackingService } from '../delivery-tracking.service';
import { HardwareRequestItem } from '../../domain/entities/hardware-request-item.entity';

describe('DeliveryTrackingService', () => {
  let service: DeliveryTrackingService;
  let mockRepo: jest.Mocked<Repository<HardwareRequestItem>>;
  let mockEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    mockRepo = { findOne: jest.fn(), save: jest.fn() } as any;
    mockEmitter = { emit: jest.fn() } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        DeliveryTrackingService,
        { provide: getRepositoryToken(HardwareRequestItem), useValue: mockRepo },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = moduleRef.get(DeliveryTrackingService);
  });

  it('marks item as ARRIVED + sets arrivedAt + emits event', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'i1', requestId: 'r1', name: 'Monitor',
      deliveryStatus: 'PENDING', procurementDecision: 'APPROVED',
      request: { id: 'r1', userId: 'u1' },
    } as any);
    mockRepo.save.mockImplementation(async (x: any) => x);

    const result = await service.updateDelivery('r1', 'i1', { status: 'ARRIVED' });

    expect(result.deliveryStatus).toBe('ARRIVED');
    expect(result.arrivedAt).toBeInstanceOf(Date);
    expect(mockEmitter.emit).toHaveBeenCalledWith('hardware-item.arrived', expect.objectContaining({
      requestId: 'r1', itemId: 'i1', ownerId: 'u1',
    }));
  });

  it('reverts ARRIVED → PENDING + clears arrivedAt', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'i1', requestId: 'r1',
      deliveryStatus: 'ARRIVED', arrivedAt: new Date(),
      procurementDecision: 'APPROVED',
      request: { id: 'r1', userId: 'u1' },
    } as any);
    mockRepo.save.mockImplementation(async (x: any) => x);

    const result = await service.updateDelivery('r1', 'i1', { status: 'PENDING' });
    expect(result.deliveryStatus).toBe('PENDING');
    expect(result.arrivedAt).toBeNull();
  });

  it('rejects update when item is NOT_PROCURED', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'i1', requestId: 'r1',
      deliveryStatus: 'NOT_PROCURED', procurementDecision: 'REJECTED',
    } as any);

    await expect(service.updateDelivery('r1', 'i1', { status: 'ARRIVED' }))
      .rejects.toThrow(/cannot update non-procured/i);
  });

  it('rejects update when item not in request', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'i1', requestId: 'other', deliveryStatus: 'PENDING',
      procurementDecision: 'APPROVED',
    } as any);

    await expect(service.updateDelivery('r1', 'i1', { status: 'ARRIVED' }))
      .rejects.toThrow(/not in request/i);
  });
});
```

- [ ] **Step 3: Implement**

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { ItemDeliveryDto } from '../dto/item-delivery.dto';
import { HardwareEvents, ItemArrivedPayload } from '../domain/events/hardware-request.events';

@Injectable()
export class DeliveryTrackingService {
  constructor(
    @InjectRepository(HardwareRequestItem)
    private readonly itemRepo: Repository<HardwareRequestItem>,
    private readonly emitter: EventEmitter2,
  ) {}

  async updateDelivery(
    requestId: string,
    itemId: string,
    dto: ItemDeliveryDto,
  ): Promise<HardwareRequestItem> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: ['request'],
    });
    if (!item) throw new NotFoundException('item not found');
    if (item.requestId !== requestId) {
      throw new BadRequestException('item not in request');
    }
    if (item.procurementDecision !== 'APPROVED') {
      throw new BadRequestException('cannot update non-procured item');
    }

    const now = new Date();
    const updated = {
      ...item,
      deliveryStatus: dto.status,
      arrivedAt: dto.status === 'ARRIVED' ? now : null,
    } as HardwareRequestItem;
    const saved = await this.itemRepo.save(updated);

    if (dto.status === 'ARRIVED') {
      const payload: ItemArrivedPayload = {
        requestId,
        itemId,
        itemName: saved.name,
        ownerId: saved.request.userId,
        arrivedAt: now,
      };
      this.emitter.emit(HardwareEvents.ItemArrived, payload);
    }

    return saved;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter backend test -- --runInBand delivery-tracking.service.spec
```

Expected: PASS.

- [ ] **Step 5: Register in module + commit**

```bash
# add DeliveryTrackingService to providers in hardware-request.module.ts
git add apps/backend/src/modules/hardware-request/services/delivery-tracking.service.ts \
        apps/backend/src/modules/hardware-request/services/__tests__/delivery-tracking.service.spec.ts \
        apps/backend/src/modules/hardware-request/dto/item-delivery.dto.ts \
        apps/backend/src/modules/hardware-request/hardware-request.module.ts
git commit -m "feat(hr-be): DeliveryTrackingService for per-item arrival + notif event"
```

---

## Task 9: DTO — Schedule Propose, Select-Slot, Reschedule

**Files:**
- Create: `apps/backend/src/modules/hardware-request/dto/schedule-propose.dto.ts`
- Create: `apps/backend/src/modules/hardware-request/dto/select-slot.dto.ts`
- Create: `apps/backend/src/modules/hardware-request/dto/request-reschedule.dto.ts`

- [ ] **Step 1: Write DTOs**

```typescript
// schedule-propose.dto.ts
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SlotInput {
  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;
}

export class SchedulePropose Dto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  itemIds!: string[];

  @IsUUID()
  technicianId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => SlotInput)
  slots!: SlotInput[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
```

Wait — class name `SchedulePropose Dto` has space, fix:

```typescript
export class ScheduleProposeDto {
  // ... same body
}
```

```typescript
// select-slot.dto.ts
import { IsInt, Max, Min } from 'class-validator';

export class SelectSlotDto {
  @IsInt()
  @Min(0)
  @Max(2)
  slotIndex!: number;
}
```

```typescript
// request-reschedule.dto.ts
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestRescheduleDto {
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/dto/schedule-propose.dto.ts \
        apps/backend/src/modules/hardware-request/dto/select-slot.dto.ts \
        apps/backend/src/modules/hardware-request/dto/request-reschedule.dto.ts
git commit -m "feat(hr-be): mutual scheduling DTOs"
```

---

## Task 10: Service — `MutualSchedulingService`

**Files:**
- Create: `apps/backend/src/modules/hardware-request/services/mutual-scheduling.service.ts`
- Create: `apps/backend/src/modules/hardware-request/services/__tests__/mutual-scheduling.service.spec.ts`

- [ ] **Step 1: Failing tests (key flows)**

```typescript
import { Test } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MutualSchedulingService } from '../mutual-scheduling.service';
import { HardwareRequest } from '../../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../../domain/entities/hardware-request-item.entity';
import { InstallationSchedule } from '../../domain/entities/installation-schedule.entity';
import { InstallationScheduleItem } from '../../domain/entities/installation-schedule-item.entity';

describe('MutualSchedulingService', () => {
  let service: MutualSchedulingService;
  let mockEmitter: jest.Mocked<EventEmitter2>;
  let mockDataSource: any;

  const futureSlot = (hoursFromNow: number) => {
    const start = new Date(Date.now() + hoursFromNow * 3600_000);
    const end = new Date(start.getTime() + 2 * 3600_000);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  beforeEach(async () => {
    mockEmitter = { emit: jest.fn() } as any;
    const itemRepoMock = { findBy: jest.fn() };
    const reqRepoMock = { findOne: jest.fn(), save: jest.fn() };
    const schedRepoMock = { create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: 'sch-1', ...x })), findOne: jest.fn() };
    const linkRepoMock = { create: jest.fn((x) => x), save: jest.fn() };

    mockDataSource = {
      transaction: jest.fn(async (cb) => cb({
        getRepository: (e: any) => {
          if (e === HardwareRequestItem) return itemRepoMock;
          if (e === HardwareRequest) return reqRepoMock;
          if (e === InstallationSchedule) return schedRepoMock;
          if (e === InstallationScheduleItem) return linkRepoMock;
          return {};
        },
      })),
      _itemRepo: itemRepoMock, _reqRepo: reqRepoMock,
      _schedRepo: schedRepoMock, _linkRepo: linkRepoMock,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MutualSchedulingService,
        { provide: getRepositoryToken(HardwareRequestItem), useValue: {} },
        { provide: getRepositoryToken(HardwareRequest), useValue: {} },
        { provide: getRepositoryToken(InstallationSchedule), useValue: {} },
        { provide: getRepositoryToken(InstallationScheduleItem), useValue: {} },
        { provide: EventEmitter2, useValue: mockEmitter },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = moduleRef.get(MutualSchedulingService);
  });

  describe('proposeSchedule', () => {
    it('creates schedule status PROPOSED_AWAITING_USER + links items + emits event', async () => {
      mockDataSource._reqRepo.findOne.mockResolvedValue({
        id: 'r1', userId: 'u1', status: 'AWAITING_DELIVERY',
      });
      mockDataSource._itemRepo.findBy.mockResolvedValue([
        { id: 'i1', requestId: 'r1', deliveryStatus: 'ARRIVED' },
        { id: 'i2', requestId: 'r1', deliveryStatus: 'ARRIVED' },
      ]);

      const slots = [futureSlot(2), futureSlot(24)];
      const result = await service.proposeSchedule('r1', {
        itemIds: ['i1', 'i2'], technicianId: 't1', slots,
      }, 'ict-1');

      expect(result.status).toBe('PROPOSED_AWAITING_USER');
      expect(mockDataSource._linkRepo.save).toHaveBeenCalled();
      expect(mockEmitter.emit).toHaveBeenCalledWith('schedule.proposed', expect.objectContaining({
        requestId: 'r1', ownerId: 'u1', technicianId: 't1',
      }));
    });

    it('rejects if any item not ARRIVED', async () => {
      mockDataSource._reqRepo.findOne.mockResolvedValue({ id: 'r1', status: 'AWAITING_DELIVERY' });
      mockDataSource._itemRepo.findBy.mockResolvedValue([
        { id: 'i1', requestId: 'r1', deliveryStatus: 'PENDING' },
      ]);

      await expect(service.proposeSchedule('r1', {
        itemIds: ['i1'], technicianId: 't1', slots: [futureSlot(2)],
      }, 'ict-1')).rejects.toThrow(/item not arrived/i);
    });

    it('rejects slot with start in past', async () => {
      mockDataSource._reqRepo.findOne.mockResolvedValue({ id: 'r1', status: 'AWAITING_DELIVERY' });
      mockDataSource._itemRepo.findBy.mockResolvedValue([
        { id: 'i1', requestId: 'r1', deliveryStatus: 'ARRIVED' },
      ]);

      const past = { start: new Date(Date.now() - 3600_000).toISOString(),
                     end: new Date(Date.now() + 3600_000).toISOString() };
      await expect(service.proposeSchedule('r1', {
        itemIds: ['i1'], technicianId: 't1', slots: [past],
      }, 'ict-1')).rejects.toThrow(/past/i);
    });

    it('rejects slot end <= start', async () => {
      mockDataSource._reqRepo.findOne.mockResolvedValue({ id: 'r1', status: 'AWAITING_DELIVERY' });
      mockDataSource._itemRepo.findBy.mockResolvedValue([
        { id: 'i1', requestId: 'r1', deliveryStatus: 'ARRIVED' },
      ]);

      const start = new Date(Date.now() + 3600_000);
      const end = new Date(start.getTime() - 60_000);
      await expect(service.proposeSchedule('r1', {
        itemIds: ['i1'], technicianId: 't1',
        slots: [{ start: start.toISOString(), end: end.toISOString() }],
      }, 'ict-1')).rejects.toThrow(/end must be after start/i);
    });
  });

  describe('selectSlot', () => {
    it('confirms schedule, sets scheduled_start/end from chosen slot, emits event', async () => {
      const slots = [futureSlot(2), futureSlot(24)];
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', requestId: 'r1', status: 'PROPOSED_AWAITING_USER',
        proposedSlots: slots, technicianId: 't1',
        request: { id: 'r1', status: 'AWAITING_DELIVERY' },
      });
      mockDataSource._reqRepo.save.mockImplementation(async (x: any) => x);
      mockDataSource._schedRepo.save.mockImplementation(async (x: any) => x);

      const result = await service.selectSlot('r1', 'sch-1', { slotIndex: 1 });

      expect(result.status).toBe('CONFIRMED');
      expect(result.scheduledStart.toISOString()).toBe(slots[1].start);
      expect(mockEmitter.emit).toHaveBeenCalledWith('schedule.confirmed', expect.any(Object));
    });

    it('throws if slotIndex out of range', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', status: 'PROPOSED_AWAITING_USER',
        proposedSlots: [futureSlot(2)],
      });
      await expect(service.selectSlot('r1', 'sch-1', { slotIndex: 2 }))
        .rejects.toThrow(/slot index out of range/i);
    });

    it('throws if schedule not in PROPOSED_AWAITING_USER', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', status: 'CONFIRMED',
      });
      await expect(service.selectSlot('r1', 'sch-1', { slotIndex: 0 }))
        .rejects.toThrow(/not awaiting user/i);
    });
  });

  describe('requestReschedule', () => {
    it('increments count + sets RESCHEDULE_REQUESTED + emits event', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', status: 'PROPOSED_AWAITING_USER',
        rescheduleCount: 0, technicianId: 't1', requestId: 'r1',
      });
      mockDataSource._schedRepo.save.mockImplementation(async (x: any) => x);

      const result = await service.requestReschedule('r1', 'sch-1', { reason: 'busy' });

      expect(result.status).toBe('RESCHEDULE_REQUESTED');
      expect(result.rescheduleCount).toBe(1);
      expect(mockEmitter.emit).toHaveBeenCalledWith('schedule.reschedule-requested', expect.any(Object));
    });

    it('auto-cancels when count would exceed 3', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', status: 'PROPOSED_AWAITING_USER',
        rescheduleCount: 3,
      });
      mockDataSource._schedRepo.save.mockImplementation(async (x: any) => x);

      const result = await service.requestReschedule('r1', 'sch-1', { reason: 'busy again' });

      expect(result.status).toBe('CANCELLED');
      expect(mockEmitter.emit).toHaveBeenCalledWith('schedule.cancelled', expect.any(Object));
    });
  });
});
```

- [ ] **Step 2: Implement service**

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { InstallationScheduleItem } from '../domain/entities/installation-schedule-item.entity';
import { ScheduleProposeDto } from '../dto/schedule-propose.dto';
import { SelectSlotDto } from '../dto/select-slot.dto';
import { RequestRescheduleDto } from '../dto/request-reschedule.dto';
import { canTransition } from '../domain/state-machine/request-state';
import {
  HardwareEvents,
  ScheduleConfirmedPayload,
  ScheduleProposedPayload,
  ScheduleRescheduleRequestedPayload,
} from '../domain/events/hardware-request.events';

const MAX_RESCHEDULE = 3;

@Injectable()
export class MutualSchedulingService {
  constructor(
    @InjectRepository(HardwareRequestItem)
    private readonly itemRepo: Repository<HardwareRequestItem>,
    @InjectRepository(HardwareRequest)
    private readonly reqRepo: Repository<HardwareRequest>,
    @InjectRepository(InstallationSchedule)
    private readonly schedRepo: Repository<InstallationSchedule>,
    @InjectRepository(InstallationScheduleItem)
    private readonly linkRepo: Repository<InstallationScheduleItem>,
    private readonly emitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async proposeSchedule(
    requestId: string,
    dto: ScheduleProposeDto,
    actorId: string,
  ): Promise<InstallationSchedule> {
    return this.dataSource.transaction(async (mgr) => {
      const reqRepo = mgr.getRepository(HardwareRequest);
      const itemRepo = mgr.getRepository(HardwareRequestItem);
      const schedRepo = mgr.getRepository(InstallationSchedule);
      const linkRepo = mgr.getRepository(InstallationScheduleItem);

      const req = await reqRepo.findOne({ where: { id: requestId } });
      if (!req) throw new NotFoundException('request not found');
      if (!['AWAITING_DELIVERY', 'INSTALLATION'].includes(req.status)) {
        throw new BadRequestException(`cannot schedule from status ${req.status}`);
      }

      const items = await itemRepo.findBy({ id: In(dto.itemIds) });
      if (items.length !== dto.itemIds.length) {
        throw new BadRequestException('some items not found');
      }
      for (const item of items) {
        if (item.requestId !== requestId) {
          throw new BadRequestException('item not in request');
        }
        if (item.deliveryStatus !== 'ARRIVED') {
          throw new BadRequestException(`item not arrived: ${item.id}`);
        }
      }

      const now = new Date();
      for (const slot of dto.slots) {
        const start = new Date(slot.start);
        const end = new Date(slot.end);
        if (start <= now) throw new BadRequestException('slot start in past');
        if (end <= start) throw new BadRequestException('slot end must be after start');
      }

      const schedule = schedRepo.create({
        requestId,
        technicianId: dto.technicianId,
        status: 'PROPOSED_AWAITING_USER',
        proposedSlots: dto.slots,
        rescheduleCount: 0,
        // scheduledStart/End null sampai user select
      } as Partial<InstallationSchedule>);
      const saved = await schedRepo.save(schedule);

      const links = items.map((item) =>
        linkRepo.create({ scheduleId: saved.id, itemId: item.id }),
      );
      await linkRepo.save(links);

      const payload: ScheduleProposedPayload = {
        requestId,
        scheduleId: saved.id,
        ownerId: req.userId,
        technicianId: dto.technicianId,
        slots: dto.slots,
      };
      this.emitter.emit(HardwareEvents.ScheduleProposed, payload);

      return saved;
    });
  }

  async selectSlot(
    requestId: string,
    scheduleId: string,
    dto: SelectSlotDto,
  ): Promise<InstallationSchedule> {
    return this.dataSource.transaction(async (mgr) => {
      const schedRepo = mgr.getRepository(InstallationSchedule);
      const reqRepo = mgr.getRepository(HardwareRequest);

      const sched = await schedRepo.findOne({
        where: { id: scheduleId },
        relations: ['request'],
      });
      if (!sched) throw new NotFoundException('schedule not found');
      if (sched.requestId !== requestId) throw new BadRequestException('schedule not in request');
      if (sched.status !== 'PROPOSED_AWAITING_USER') {
        throw new BadRequestException('schedule not awaiting user');
      }
      const slots = sched.proposedSlots ?? [];
      if (dto.slotIndex < 0 || dto.slotIndex >= slots.length) {
        throw new BadRequestException('slot index out of range');
      }

      const chosen = slots[dto.slotIndex];
      const updated = {
        ...sched,
        status: 'CONFIRMED' as const,
        scheduledStart: new Date(chosen.start),
        scheduledEnd: new Date(chosen.end),
        selectedSlotAt: new Date(),
      } as InstallationSchedule;
      const savedSched = await schedRepo.save(updated);

      // transition request status
      if (sched.request.status === 'AWAITING_DELIVERY' && canTransition('AWAITING_DELIVERY', 'INSTALLATION')) {
        await reqRepo.save({ ...sched.request, status: 'INSTALLATION' } as HardwareRequest);
      }

      const payload: ScheduleConfirmedPayload = {
        requestId,
        scheduleId,
        technicianId: sched.technicianId,
        scheduledStart: savedSched.scheduledStart!,
        scheduledEnd: savedSched.scheduledEnd!,
      };
      this.emitter.emit(HardwareEvents.ScheduleConfirmed, payload);

      return savedSched;
    });
  }

  async requestReschedule(
    requestId: string,
    scheduleId: string,
    dto: RequestRescheduleDto,
  ): Promise<InstallationSchedule> {
    return this.dataSource.transaction(async (mgr) => {
      const schedRepo = mgr.getRepository(InstallationSchedule);
      const sched = await schedRepo.findOne({ where: { id: scheduleId } });
      if (!sched) throw new NotFoundException('schedule not found');
      if (sched.requestId !== requestId) throw new BadRequestException('schedule not in request');

      const newCount = sched.rescheduleCount + 1;
      if (newCount > MAX_RESCHEDULE) {
        const cancelled = {
          ...sched,
          status: 'CANCELLED' as const,
          rescheduleReason: dto.reason,
          rescheduleCount: newCount,
        } as InstallationSchedule;
        await schedRepo.save(cancelled);
        this.emitter.emit(HardwareEvents.ScheduleCancelled, {
          requestId, scheduleId, technicianId: sched.technicianId,
        });
        return cancelled;
      }

      const updated = {
        ...sched,
        status: 'RESCHEDULE_REQUESTED' as const,
        rescheduleReason: dto.reason,
        rescheduleCount: newCount,
      } as InstallationSchedule;
      const saved = await schedRepo.save(updated);

      const payload: ScheduleRescheduleRequestedPayload = {
        requestId, scheduleId,
        technicianId: sched.technicianId,
        reason: dto.reason,
        rescheduleCount: newCount,
      };
      this.emitter.emit(HardwareEvents.ScheduleRescheduleRequested, payload);

      return saved;
    });
  }
}
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
pnpm --filter backend test -- --runInBand mutual-scheduling.service.spec
```

- [ ] **Step 4: Register in module**

```typescript
// hardware-request.module.ts providers:
MutualSchedulingService,
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/mutual-scheduling.service.ts \
        apps/backend/src/modules/hardware-request/services/__tests__/mutual-scheduling.service.spec.ts \
        apps/backend/src/modules/hardware-request/hardware-request.module.ts
git commit -m "feat(hr-be): MutualSchedulingService with propose/select/reschedule + auto-cancel at 3"
```

---

## Task 11: Auto-transition `INSTALLATION → DONE`

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts` (find existing `complete()` method)

- [ ] **Step 1: Locate complete handler**

```bash
grep -rn "completeInstall\|install/complete" apps/backend/src/modules/hardware-request/services/
```

- [ ] **Step 2: Add post-complete check**

After existing schedule status set to `DONE`, add:

```typescript
// in completeInstall() method, after schedule saved:
const req = await reqRepo.findOne({ where: { id: requestId }, relations: ['items', 'schedules'] });
const allItemsArrived = req!.items.every(
  (i) => i.deliveryStatus === 'ARRIVED' || i.deliveryStatus === 'NOT_PROCURED',
);
const allSchedulesDone = req!.schedules.every(
  (s) => s.status === 'DONE' || s.status === 'CANCELLED',
);
if (allItemsArrived && allSchedulesDone && canTransition(req!.status, 'DONE')) {
  await reqRepo.save({ ...req!, status: 'DONE' } as HardwareRequest);
}
```

- [ ] **Step 3: Add test in existing service spec**

```typescript
it('transitions request → DONE when all items ARRIVED + all schedules DONE', async () => {
  // mock setup: 2 items ARRIVED, 1 schedule DONE
  // call completeInstall(scheduleId)
  // assert req status === 'DONE'
});

it('keeps request INSTALLATION when an item still PENDING', async () => {
  // mock setup: 1 item ARRIVED, 1 PENDING, schedule DONE
  // call completeInstall
  // assert req status remains 'INSTALLATION'
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter backend test -- --runInBand installation-schedule.service.spec
git add apps/backend/src/modules/hardware-request/services/installation-schedule.service.ts \
        apps/backend/src/modules/hardware-request/services/__tests__/installation-schedule.service.spec.ts
git commit -m "feat(hr-be): auto INSTALLATION→DONE when all items arrived + schedules done"
```

---

## Task 12: Controller — Procurement Endpoints

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/presentation/hardware-request.controller.ts`

- [ ] **Step 1: Add endpoints**

```typescript
import { ProcurementDecisionService } from '../services/procurement-decision.service';
import { ProcurementDecisionDto } from '../dto/procurement-decision.dto';
import { ProcurementCompleteDto } from '../dto/procurement-complete.dto';
// inject in constructor

@Post(':id/procurement/decision')
@HttpCode(200)
@HardwareRoles(HardwareRole.ICT_STAFF)
async decideProcurementItems(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: ProcurementDecisionDto,
  @CurrentUser() user: { id: string },
) {
  const items = await this.procurementService.decideItems(id, dto, user.id);
  return { success: true, data: items };
}

@Post(':id/procurement/complete')
@HttpCode(200)
@HardwareRoles(HardwareRole.ICT_STAFF)
async completeProcurement(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: ProcurementCompleteDto,
  @CurrentUser() user: { id: string },
) {
  const req = await this.procurementService.completeProcurement(id, dto, user.id);
  return { success: true, data: req };
}
```

- [ ] **Step 2: Add e2e/controller test**

Create `apps/backend/src/modules/hardware-request/presentation/__tests__/procurement.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
// ... bootstrap test app with mock guards + service

describe('Procurement endpoints', () => {
  let app: INestApplication;
  // setup omitted for brevity — follow existing controller spec pattern

  it('POST /:id/procurement/decision returns 200 + persists', async () => {
    await request(app.getHttpServer())
      .post('/v1/hardware-requests/r1/procurement/decision')
      .send({ decisions: [{ itemId: 'i1', decision: 'APPROVED' }] })
      .set('Authorization', 'Bearer ICT-TOKEN')
      .expect(200);
  });

  it('POST /:id/procurement/complete returns 200 + transitions status', async () => {
    // ...
  });

  it('rejects USER role with 403', async () => {
    // ...
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter backend test -- --runInBand procurement.controller.spec
git add apps/backend/src/modules/hardware-request/presentation/hardware-request.controller.ts \
        apps/backend/src/modules/hardware-request/presentation/__tests__/procurement.controller.spec.ts
git commit -m "feat(hr-be): procurement decision + complete endpoints"
```

---

## Task 13: Controller — Delivery Endpoint

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/presentation/installation.controller.ts` (atau `hardware-request.controller.ts`)

- [ ] **Step 1: Add endpoint**

```typescript
@Patch(':id/items/:itemId/delivery')
@HttpCode(200)
@HardwareRoles(HardwareRole.ICT_STAFF)
async updateItemDelivery(
  @Param('id', ParseUUIDPipe) id: string,
  @Param('itemId', ParseUUIDPipe) itemId: string,
  @Body() dto: ItemDeliveryDto,
) {
  const item = await this.deliveryService.updateDelivery(id, itemId, dto);
  return { success: true, data: item };
}
```

- [ ] **Step 2: Test**

```typescript
it('PATCH /:id/items/:itemId/delivery as ICT_STAFF returns 200', async () => {
  await request(app.getHttpServer())
    .patch('/v1/hardware-requests/r1/items/i1/delivery')
    .send({ status: 'ARRIVED' })
    .set('Authorization', 'Bearer ICT-TOKEN')
    .expect(200);
});

it('rejects USER with 403', async () => {
  await request(app.getHttpServer())
    .patch('/v1/hardware-requests/r1/items/i1/delivery')
    .send({ status: 'ARRIVED' })
    .set('Authorization', 'Bearer USER-TOKEN')
    .expect(403);
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter backend test -- --runInBand
git add apps/backend/src/modules/hardware-request/presentation/installation.controller.ts \
        apps/backend/src/modules/hardware-request/presentation/__tests__/
git commit -m "feat(hr-be): item delivery PATCH endpoint"
```

---

## Task 14: Controller — Mutual Scheduling Endpoints

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/presentation/installation.controller.ts`

- [ ] **Step 1: Add endpoints**

```typescript
@Post(':id/schedule/propose')
@HttpCode(201)
@HardwareRoles(HardwareRole.ICT_STAFF)
async proposeSchedule(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: ScheduleProposeDto,
  @CurrentUser() user: { id: string },
) {
  const sched = await this.mutualSchedService.proposeSchedule(id, dto, user.id);
  return { success: true, data: sched };
}

@Post(':id/schedule/:scheduleId/select-slot')
@HttpCode(200)
async selectSlot(
  @Param('id', ParseUUIDPipe) id: string,
  @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  @Body() dto: SelectSlotDto,
  @CurrentUser() user: { id: string; role: string },
) {
  // Allow USER (own) atau ICT_STAFF
  await this.guardOwnerOrIct(id, user);
  const sched = await this.mutualSchedService.selectSlot(id, scheduleId, dto);
  return { success: true, data: sched };
}

@Post(':id/schedule/:scheduleId/request-reschedule')
@HttpCode(200)
async requestReschedule(
  @Param('id', ParseUUIDPipe) id: string,
  @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  @Body() dto: RequestRescheduleDto,
  @CurrentUser() user: { id: string; role: string },
) {
  await this.guardOwnerOrIct(id, user);
  const sched = await this.mutualSchedService.requestReschedule(id, scheduleId, dto);
  return { success: true, data: sched };
}

private async guardOwnerOrIct(requestId: string, user: { id: string; role: string }) {
  if (user.role === 'ICT_STAFF') return;
  const req = await this.queryService.findOne(requestId);
  if (req?.userId !== user.id) {
    throw new ForbiddenException('not request owner');
  }
}
```

- [ ] **Step 2: Tests for all 3 endpoints + auth matrix**

```typescript
describe('Schedule propose', () => {
  it('201 as ICT_STAFF', async () => { /* ... */ });
  it('403 as USER', async () => { /* ... */ });
});

describe('Select slot', () => {
  it('200 as USER own', async () => { /* ... */ });
  it('200 as ICT_STAFF', async () => { /* ... */ });
  it('403 as USER other', async () => { /* ... */ });
});

describe('Request reschedule', () => {
  it('200 as USER own', async () => { /* ... */ });
  it('200 as ICT_STAFF', async () => { /* ... */ });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter backend test -- --runInBand installation.controller.spec
git add apps/backend/src/modules/hardware-request/presentation/installation.controller.ts \
        apps/backend/src/modules/hardware-request/presentation/__tests__/
git commit -m "feat(hr-be): mutual scheduling endpoints (propose/select/reschedule)"
```

---

## Task 15: Comments — Remove Status Guard

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/presentation/hardware-comment.controller.ts`
- Modify: `apps/backend/src/modules/hardware-request/services/hardware-comment.service.ts` (if exists)

- [ ] **Step 1: Locate status guard**

```bash
grep -rn "status.*comment\|comment.*status\|cannot comment" apps/backend/src/modules/hardware-request/
```

- [ ] **Step 2: Remove guard, keep auth + ownership only**

Identify any check like `if (request.status === 'DONE') throw ...` and delete. Keep:
- Auth required.
- USER → must own request.
- ICT_STAFF → all.

- [ ] **Step 3: Add test**

```typescript
it('USER can comment on own request in DONE status', async () => {
  await request(app.getHttpServer())
    .post('/v1/hardware-requests/done-request-id/comments')
    .send({ body: 'thanks' })
    .set('Authorization', 'Bearer USER-TOKEN-OWNER')
    .expect(201);
});

it('USER cannot comment on others request', async () => {
  await request(app.getHttpServer())
    .post('/v1/hardware-requests/other-user-request/comments')
    .send({ body: 'hi' })
    .set('Authorization', 'Bearer USER-TOKEN')
    .expect(403);
});

it('ICT_STAFF can comment on any request any status', async () => {
  await request(app.getHttpServer())
    .post('/v1/hardware-requests/cancelled-request-id/comments')
    .send({ body: 'note' })
    .set('Authorization', 'Bearer ICT-TOKEN')
    .expect(201);
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter backend test -- --runInBand hardware-comment
git add apps/backend/src/modules/hardware-request/presentation/hardware-comment.controller.ts \
        apps/backend/src/modules/hardware-request/services/hardware-comment.service.ts \
        apps/backend/src/modules/hardware-request/presentation/__tests__/
git commit -m "fix(hr-be): allow comments in all statuses (auth+ownership only)"
```

---

## Task 16: Listener — `ItemArrivedListener`

**Files:**
- Create: `apps/backend/src/modules/hardware-request/listeners/item-arrived.listener.ts`
- Create: `apps/backend/src/modules/hardware-request/listeners/__tests__/item-arrived.listener.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
import { Test } from '@nestjs/testing';
import { ItemArrivedListener } from '../item-arrived.listener';
import { NotificationService } from '../../../notifications/notification.service';
import { EmailService } from '../../../email/email.service';

describe('ItemArrivedListener', () => {
  let listener: ItemArrivedListener;
  let mockNotif: jest.Mocked<NotificationService>;
  let mockEmail: jest.Mocked<EmailService>;

  beforeEach(async () => {
    mockNotif = { send: jest.fn() } as any;
    mockEmail = { sendTemplate: jest.fn() } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ItemArrivedListener,
        { provide: NotificationService, useValue: mockNotif },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    listener = moduleRef.get(ItemArrivedListener);
  });

  it('sends in-app + email when item arrived', async () => {
    await listener.handle({
      requestId: 'r1', itemId: 'i1', itemName: 'Monitor',
      ownerId: 'u1', arrivedAt: new Date(),
    });

    expect(mockNotif.send).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', type: 'hardware-item.arrived',
    }));
    expect(mockEmail.sendTemplate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HardwareEvents, ItemArrivedPayload } from '../domain/events/hardware-request.events';
import { NotificationService } from '../../notifications/notification.service';
import { EmailService } from '../../email/email.service';

@Injectable()
export class ItemArrivedListener {
  constructor(
    private readonly notif: NotificationService,
    private readonly email: EmailService,
  ) {}

  @OnEvent(HardwareEvents.ItemArrived)
  async handle(payload: ItemArrivedPayload): Promise<void> {
    await this.notif.send({
      userId: payload.ownerId,
      type: HardwareEvents.ItemArrived,
      title: 'Item sudah datang',
      body: `${payload.itemName} telah tiba. Menunggu jadwal instalasi.`,
      meta: { requestId: payload.requestId, itemId: payload.itemId },
    });
    await this.email.sendTemplate({
      to: payload.ownerId,
      template: 'hardware-item-arrived',
      data: { itemName: payload.itemName, requestId: payload.requestId },
    });
  }
}
```

- [ ] **Step 3: Register in module + commit**

```typescript
// hardware-request.module.ts providers:
ItemArrivedListener,
```

```bash
pnpm --filter backend test -- --runInBand item-arrived.listener.spec
git add apps/backend/src/modules/hardware-request/listeners/item-arrived.listener.ts \
        apps/backend/src/modules/hardware-request/listeners/__tests__/item-arrived.listener.spec.ts \
        apps/backend/src/modules/hardware-request/hardware-request.module.ts
git commit -m "feat(hr-be): listener kirim notif item.arrived ke owner"
```

---

## Task 17: Listener — Mutual Scheduling Events

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/listeners/in-app-notifier.listener.ts`
- Modify: `apps/backend/src/modules/hardware-request/listeners/email-notifier.listener.ts`

- [ ] **Step 1: Add `@OnEvent` handlers untuk 4 event baru**

```typescript
// in-app-notifier.listener.ts — add methods:

@OnEvent(HardwareEvents.ScheduleProposed)
async onScheduleProposed(payload: ScheduleProposedPayload) {
  await this.notif.send({
    userId: payload.ownerId,
    type: HardwareEvents.ScheduleProposed,
    title: 'Pilih jadwal instalasi',
    body: `ICT mengusulkan ${payload.slots.length} slot waktu. Silakan pilih.`,
    meta: { requestId: payload.requestId, scheduleId: payload.scheduleId },
  });
}

@OnEvent(HardwareEvents.ScheduleConfirmed)
async onScheduleConfirmed(payload: ScheduleConfirmedPayload) {
  await this.notif.send({
    userId: payload.technicianId,
    type: HardwareEvents.ScheduleConfirmed,
    title: 'Jadwal dikonfirmasi user',
    body: `Instalasi dijadwalkan ${payload.scheduledStart.toLocaleString('id-ID')}.`,
    meta: { requestId: payload.requestId, scheduleId: payload.scheduleId },
  });
}

@OnEvent(HardwareEvents.ScheduleRescheduleRequested)
async onRescheduleRequested(payload: ScheduleRescheduleRequestedPayload) {
  await this.notif.send({
    userId: payload.technicianId,
    type: HardwareEvents.ScheduleRescheduleRequested,
    title: 'User minta reschedule',
    body: `Alasan: ${payload.reason}. Reschedule ke-${payload.rescheduleCount}/3.`,
    meta: { requestId: payload.requestId, scheduleId: payload.scheduleId },
  });
}

@OnEvent(HardwareEvents.ScheduleCancelled)
async onScheduleCancelled(payload: { requestId: string; scheduleId: string; technicianId: string }) {
  // notif both technician + owner
  // ...
}
```

Repeat similar in `email-notifier.listener.ts` with email templates.

- [ ] **Step 2: Tests**

Update `in-app-notifier.listener.spec.ts` & `email-notifier.listener.spec.ts` dengan 4 event baru.

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter backend test -- --runInBand listener
git add apps/backend/src/modules/hardware-request/listeners/
git commit -m "feat(hr-be): listeners untuk mutual scheduling events (proposed/confirmed/reschedule/cancel)"
```

---

## Task 18: Email Templates

**Files:**
- Create: `apps/backend/src/assets/templates/hardware-item-arrived.hbs`
- Create: `apps/backend/src/assets/templates/hardware-schedule-proposed.hbs`
- Create: `apps/backend/src/assets/templates/hardware-schedule-confirmed.hbs`
- Create: `apps/backend/src/assets/templates/hardware-schedule-reschedule-requested.hbs`

- [ ] **Step 1: Write template — item arrived**

```handlebars
{{!-- hardware-item-arrived.hbs --}}
<p>Halo,</p>
<p>Item permintaan Anda <strong>{{itemName}}</strong> telah tiba di kantor.</p>
<p>ICT akan segera mengusulkan jadwal instalasi.</p>
<p><a href="{{appUrl}}/hardware-requests/{{requestId}}">Lihat detail permintaan</a></p>
```

- [ ] **Step 2: Write 3 template lainnya** (similar pattern)

`hardware-schedule-proposed.hbs`:
```handlebars
<p>ICT mengusulkan {{slots.length}} slot waktu untuk instalasi:</p>
<ul>
  {{#each slots}}
    <li>{{formatDate this.start}} - {{formatTime this.end}}</li>
  {{/each}}
</ul>
<p><a href="{{appUrl}}/hardware-requests/{{requestId}}">Pilih jadwal</a></p>
```

`hardware-schedule-confirmed.hbs`:
```handlebars
<p>User telah memilih jadwal instalasi:</p>
<p><strong>{{formatDateTime scheduledStart}}</strong> - {{formatTime scheduledEnd}}</p>
<p><a href="{{appUrl}}/hardware-requests/{{requestId}}">Lihat detail</a></p>
```

`hardware-schedule-reschedule-requested.hbs`:
```handlebars
<p>User meminta reschedule jadwal instalasi.</p>
<p>Alasan: <em>{{reason}}</em></p>
<p>Reschedule ke-{{rescheduleCount}} dari 3 maksimum.</p>
<p><a href="{{appUrl}}/hardware-requests/{{requestId}}">Usulkan slot baru</a></p>
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/assets/templates/hardware-*
git commit -m "feat(hr-be): email templates for delivery + mutual scheduling"
```

---

## Task 19: Integration Test — Full Workflow

**Files:**
- Create: `apps/backend/src/modules/hardware-request/__tests__/workflow-v2.integration.spec.ts`

- [ ] **Step 1: Write end-to-end test**

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
// bootstrap test app w/ test DB

describe('Hardware Request Workflow V2 — full path', () => {
  let app: INestApplication;
  let userToken: string;
  let ictToken: string;
  let requestId: string;
  let itemAId: string;
  let itemBId: string;

  beforeAll(async () => {
    // bootstrap, seed users, get tokens
  });

  it('USER creates + submits request', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/hardware-requests')
      .send({
        items: [
          { name: 'Monitor', qty: 1, catalogId: 'cat-1' },
          { name: 'Keyboard', qty: 1, catalogId: 'cat-2' },
        ],
        purpose: 'Workstation upgrade',
      })
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201);

    requestId = res.body.data.id;
    itemAId = res.body.data.items[0].id;
    itemBId = res.body.data.items[1].id;

    await request(app.getHttpServer())
      .post(`/v1/hardware-requests/${requestId}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
  });

  it('ICT approves → procurement', async () => {
    await request(app.getHttpServer())
      .post(`/v1/hardware-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${ictToken}`)
      .expect(200);
  });

  it('ICT decides items + completes procurement → AWAITING_DELIVERY', async () => {
    await request(app.getHttpServer())
      .post(`/v1/hardware-requests/${requestId}/procurement/decision`)
      .send({
        decisions: [
          { itemId: itemAId, decision: 'APPROVED' },
          { itemId: itemBId, decision: 'APPROVED' },
        ],
      })
      .set('Authorization', `Bearer ${ictToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post(`/v1/hardware-requests/${requestId}/procurement/complete`)
      .send({})
      .set('Authorization', `Bearer ${ictToken}`)
      .expect(200);

    expect(res.body.data.status).toBe('AWAITING_DELIVERY');
  });

  it('ICT marks item A as ARRIVED (partial delivery)', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/hardware-requests/${requestId}/items/${itemAId}/delivery`)
      .send({ status: 'ARRIVED' })
      .set('Authorization', `Bearer ${ictToken}`)
      .expect(200);
  });

  it('ICT proposes schedule for item A only', async () => {
    const slots = [
      { start: new Date(Date.now() + 24 * 3600_000).toISOString(),
        end: new Date(Date.now() + 26 * 3600_000).toISOString() },
    ];
    const res = await request(app.getHttpServer())
      .post(`/v1/hardware-requests/${requestId}/schedule/propose`)
      .send({ itemIds: [itemAId], technicianId: 'ict-1', slots })
      .set('Authorization', `Bearer ${ictToken}`)
      .expect(201);

    expect(res.body.data.status).toBe('PROPOSED_AWAITING_USER');
  });

  it('USER selects slot → CONFIRMED + request → INSTALLATION', async () => {
    const sched = await request(app.getHttpServer())
      .get(`/v1/hardware-requests/${requestId}/schedules`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const scheduleId = sched.body.data[0].id;
    const res = await request(app.getHttpServer())
      .post(`/v1/hardware-requests/${requestId}/schedule/${scheduleId}/select-slot`)
      .send({ slotIndex: 0 })
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.data.status).toBe('CONFIRMED');

    const reqState = await request(app.getHttpServer())
      .get(`/v1/hardware-requests/${requestId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(reqState.body.data.status).toBe('INSTALLATION');
  });

  it('ICT marks item B ARRIVED + proposes batch 2 + USER selects → 2nd schedule', async () => {
    // similar flow
  });

  it('USER comments on DONE status (after all complete)', async () => {
    // complete all schedules, request → DONE
    // POST comment → 201
  });
});
```

- [ ] **Step 2: Run integration test**

```bash
pnpm --filter backend test -- --runInBand workflow-v2.integration.spec
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/hardware-request/__tests__/workflow-v2.integration.spec.ts
git commit -m "test(hr-be): integration test for full v2 workflow with partial delivery"
```

---

## Task 20: Final Backend Verification

- [ ] **Step 1: Run full backend test suite**

```bash
pnpm --filter backend test -- --maxWorkers=2
```

Expected: all tests pass, coverage ≥80% pada module hardware-request.

- [ ] **Step 2: Type check**

```bash
pnpm --filter backend typecheck
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
pnpm --filter backend build
```

Expected: build success.

- [ ] **Step 4: Final commit (jika ada perubahan)**

```bash
git status
git add -A
git commit -m "chore(hr-be): final cleanup post v2 workflow plan"
```

- [ ] **Step 5: Mark plan complete**

Plan 1 done. Lanjut ke Plan 2 (Frontend Workflow).

---

## Notes for Implementer

- **Test runner:** Selalu `--runInBand` atau `--maxWorkers=2` untuk hindari OOM.
- **Migration:** Test di staging DB dulu sebelum prod.
- **Existing endpoints invoice/price:** TIDAK dihapus di plan ini. FE baru tidak isi. Cleanup phase berikutnya.
- **Role guard:** `HardwareRole.ICT_STAFF` sudah ada dari spec 2026-04-19-bugfix. Pastikan plan tsb sudah merged dulu.
- **Notification service:** Reuse existing `NotificationService` & `EmailService`. Path mungkin berbeda — verify saat coding.
