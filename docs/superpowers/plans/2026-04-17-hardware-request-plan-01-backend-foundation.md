# Hardware Request — Plan 1: Backend Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the `hardware-request` backend module with schema, entities, catalog CRUD, and request DRAFT → SUBMITTED → CANCELLED lifecycle. Lifecycle steps beyond SUBMITTED ship in Plan 2.

**Architecture:** New NestJS module at `apps/backend/src/modules/hardware-request/` using TypeORM entities, class-validator DTOs, and NestJS guards. Follows existing codebase patterns (see `modules/access-request/` for layout, 4-space indent, snake_case table names). Module `ict-budget` is left in place during Plan 1 — removed in Plan 7 migration.

**Tech Stack:** NestJS 11, TypeORM 0.3.28, class-validator 0.14, Jest 29, PostgreSQL (pg 8.16).

**Spec reference:** `docs/superpowers/specs/2026-04-17-hardware-request-rework-design.md` sections 3, 4, 5 (transitions involving only DRAFT/SUBMITTED/CANCELLED), 6 (USER permissions only), 7 (endpoints: create, list, get, patch draft, submit, cancel, catalog CRUD).

---

## Files in this plan

**Create:**
- `apps/backend/src/modules/hardware-request/hardware-request.module.ts`
- `apps/backend/src/modules/hardware-request/domain/enums/request-status.enum.ts`
- `apps/backend/src/modules/hardware-request/domain/enums/item-category.enum.ts`
- `apps/backend/src/modules/hardware-request/domain/enums/activity-action.enum.ts`
- `apps/backend/src/modules/hardware-request/domain/entities/hardware-catalog.entity.ts`
- `apps/backend/src/modules/hardware-request/domain/entities/hardware-request.entity.ts`
- `apps/backend/src/modules/hardware-request/domain/entities/hardware-request-item.entity.ts`
- `apps/backend/src/modules/hardware-request/domain/entities/hardware-request-activity.entity.ts`
- `apps/backend/src/modules/hardware-request/domain/errors.ts`
- `apps/backend/src/modules/hardware-request/dto/create-request.dto.ts`
- `apps/backend/src/modules/hardware-request/dto/update-draft.dto.ts`
- `apps/backend/src/modules/hardware-request/dto/list-requests.dto.ts`
- `apps/backend/src/modules/hardware-request/dto/create-catalog.dto.ts`
- `apps/backend/src/modules/hardware-request/dto/update-catalog.dto.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-catalog.service.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-request-query.service.ts`
- `apps/backend/src/modules/hardware-request/services/request-number.service.ts`
- `apps/backend/src/modules/hardware-request/guards/hardware-role.guard.ts`
- `apps/backend/src/modules/hardware-request/guards/roles.decorator.ts`
- `apps/backend/src/modules/hardware-request/presentation/hardware-request.controller.ts`
- `apps/backend/src/modules/hardware-request/presentation/hardware-catalog.controller.ts`
- `apps/backend/src/migrations/1776000000000-CreateHardwareRequestFoundation.ts`
- `apps/backend/src/seeds/hardware-catalog.seed.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-catalog.service.spec.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.spec.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-request-query.service.spec.ts`
- `apps/backend/src/modules/hardware-request/services/request-number.service.spec.ts`

**Modify:**
- `apps/backend/src/app.module.ts` (register HardwareRequestModule)
- `apps/backend/src/seeds/run-seed.ts` (invoke hardware-catalog seed)

---

## Conventions used

- **Indent:** 4 spaces (match existing files).
- **Tables:** snake_case plural. Entity column names camelCase; TypeORM will map to snake_case column names via `@Column({ name: 'snake_case' })` where needed, or allow default mapping for simple fields.
- **UUID PK:** `@PrimaryGeneratedColumn('uuid')`.
- **Enums:** PostgreSQL native enum via `@Column({ type: 'enum', enum: Xxx })`.
- **Roles:** match existing `modules/auth` / `modules/permissions` — verified in Task 1.1. For Plan 1, only `USER` action paths are exercised. The role enum declares `ICT_LEAD`, `ICT_PROCUREMENT`, `ICT_TECHNICIAN` even though their endpoints land in Plan 2/3.
- **Testing:** Jest, `.spec.ts` colocated next to service. No real DB in unit tests — repositories mocked via `jest-mock-extended`-style manual mocks.
- **Commits:** one per task, format `feat(hardware-request): <what>` / `test(hardware-request): <what>`.

---

## Task 1.1: Verify existing role/user integration points

**Files:**
- Read-only inspection: `apps/backend/src/modules/auth/`, `apps/backend/src/modules/users/entities/user.entity.ts`, `apps/backend/src/modules/permissions/`.

- [ ] **Step 1: Inspect auth guard export**

Run: `grep -r "JwtAuthGuard\|AuthGuard('jwt')" apps/backend/src/modules/ticketing --include=*.ts | head -n 20`

Expected: find the guard class and decorator used by controllers to inject `request.user`. Note the exact import path (e.g. `../../auth/guards/jwt-auth.guard`).

- [ ] **Step 2: Inspect User entity**

Read `apps/backend/src/modules/users/entities/user.entity.ts` and record:
- property that holds user id (`id`)
- property holding roles/permissions — common options: `roles: Role[]`, `permissions: string[]`, or a single `role: string`.

- [ ] **Step 3: Document findings in a scratch note**

Write findings inline in this plan as a comment before proceeding. Do NOT commit; this is reconnaissance only. Specifically write down: auth guard import path, role-reading approach, and the User primary key field.

If the project uses `CurrentUser()` or similar decorator, note its import path — controllers in later tasks will depend on it.

---

## Task 1.2: Scaffold module folder + empty module class

**Files:**
- Create: `apps/backend/src/modules/hardware-request/hardware-request.module.ts`
- Create (empty placeholders): folders `domain/entities/`, `domain/enums/`, `dto/`, `services/`, `guards/`, `presentation/`.

- [ ] **Step 1: Create empty module file**

```typescript
// apps/backend/src/modules/hardware-request/hardware-request.module.ts
import { Module } from '@nestjs/common';

@Module({
    imports: [],
    controllers: [],
    providers: [],
    exports: [],
})
export class HardwareRequestModule {}
```

- [ ] **Step 2: Verify compile**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/hardware-request/hardware-request.module.ts
git commit -m "feat(hardware-request): scaffold empty module"
```

---

## Task 1.3: Add enums

**Files:**
- Create: `apps/backend/src/modules/hardware-request/domain/enums/request-status.enum.ts`
- Create: `apps/backend/src/modules/hardware-request/domain/enums/item-category.enum.ts`
- Create: `apps/backend/src/modules/hardware-request/domain/enums/activity-action.enum.ts`
- Create: `apps/backend/src/modules/hardware-request/domain/enums/hardware-role.enum.ts`

- [ ] **Step 1: request-status.enum.ts**

```typescript
export enum RequestStatus {
    DRAFT = 'DRAFT',
    SUBMITTED = 'SUBMITTED',
    UNDER_REVIEW = 'UNDER_REVIEW',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    CANCELLED = 'CANCELLED',
    PROCUREMENT = 'PROCUREMENT',
    INSTALLATION = 'INSTALLATION',
    COMPLETED = 'COMPLETED',
}

export const TERMINAL_STATUSES: ReadonlyArray<RequestStatus> = [
    RequestStatus.REJECTED,
    RequestStatus.CANCELLED,
    RequestStatus.COMPLETED,
];
```

- [ ] **Step 2: item-category.enum.ts**

```typescript
export enum ItemCategory {
    LAPTOP = 'LAPTOP',
    MONITOR = 'MONITOR',
    ACCESSORY = 'ACCESSORY',
    NETWORK = 'NETWORK',
    SOFTWARE = 'SOFTWARE',
    OTHER = 'OTHER',
}
```

- [ ] **Step 3: activity-action.enum.ts**

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
    COMMENTED = 'COMMENTED',
    BARCODE_SCANNED = 'BARCODE_SCANNED',
}
```

- [ ] **Step 4: hardware-role.enum.ts**

```typescript
export enum HardwareRole {
    USER = 'USER',
    ICT_LEAD = 'ICT_LEAD',
    ICT_PROCUREMENT = 'ICT_PROCUREMENT',
    ICT_TECHNICIAN = 'ICT_TECHNICIAN',
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/enums
git commit -m "feat(hardware-request): add domain enums"
```

---

## Task 1.4: Add domain errors

**Files:**
- Create: `apps/backend/src/modules/hardware-request/domain/errors.ts`

- [ ] **Step 1: Define error classes**

```typescript
// apps/backend/src/modules/hardware-request/domain/errors.ts
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { RequestStatus } from './enums/request-status.enum';

export class InvalidStateTransitionError extends ConflictException {
    constructor(from: RequestStatus, to: RequestStatus) {
        super({
            code: 'HR_INVALID_TRANSITION',
            message: `Cannot transition from ${from} to ${to}`,
            from,
            to,
        });
    }
}

export class PermissionDeniedError extends ForbiddenException {
    constructor(action: string) {
        super({
            code: 'HR_PERMISSION_DENIED',
            message: `You are not allowed to ${action}`,
        });
    }
}

export class CatalogItemInactiveError extends BadRequestException {
    constructor(catalogId: string) {
        super({
            code: 'HR_CATALOG_INACTIVE',
            message: `Catalog item ${catalogId} is inactive or does not exist`,
        });
    }
}

export class OptimisticLockError extends ConflictException {
    constructor() {
        super({
            code: 'HR_OPTIMISTIC_LOCK',
            message: 'Resource was modified by another transaction; refresh and retry',
        });
    }
}

export class HardwareRequestNotFoundError extends NotFoundException {
    constructor(id: string) {
        super({
            code: 'HR_NOT_FOUND',
            message: `Hardware request ${id} not found`,
        });
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/errors.ts
git commit -m "feat(hardware-request): add domain error classes"
```

---

## Task 1.5: Catalog entity

**Files:**
- Create: `apps/backend/src/modules/hardware-request/domain/entities/hardware-catalog.entity.ts`

- [ ] **Step 1: Write entity**

```typescript
// apps/backend/src/modules/hardware-request/domain/entities/hardware-catalog.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { ItemCategory } from '../enums/item-category.enum';

@Entity('hardware_catalog')
@Index(['active', 'displayOrder'])
export class HardwareCatalog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 80, unique: true })
    code: string;

    @Column({ type: 'varchar', length: 160 })
    name: string;

    @Column({ type: 'enum', enum: ItemCategory })
    category: ItemCategory;

    @Column({ type: 'jsonb', default: () => "'{}'" })
    defaultSpecs: Record<string, unknown>;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    requiredFields: Array<{
        key: string;
        label: string;
        type: 'text' | 'number' | 'select';
        options?: string[];
        required?: boolean;
    }>;

    @Column({ type: 'boolean', default: true })
    active: boolean;

    @Column({ type: 'int', default: 0 })
    displayOrder: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/entities/hardware-catalog.entity.ts
git commit -m "feat(hardware-request): add HardwareCatalog entity"
```

---

## Task 1.6: HardwareRequest entity

**Files:**
- Create: `apps/backend/src/modules/hardware-request/domain/entities/hardware-request.entity.ts`

- [ ] **Step 1: Write entity**

```typescript
// apps/backend/src/modules/hardware-request/domain/entities/hardware-request.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    VersionColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { Site } from '../../../sites/entities/site.entity';
import { RequestStatus } from '../enums/request-status.enum';
import { HardwareRequestItem } from './hardware-request-item.entity';

@Entity('hardware_requests')
@Index(['status', 'createdAt'])
@Index(['requesterId', 'createdAt'])
export class HardwareRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 32, unique: true })
    requestNumber: string;

    @Column({ type: 'uuid' })
    requesterId: string;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'requesterId' })
    requester: User;

    @Column({ type: 'uuid', nullable: true })
    recipientId: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'recipientId' })
    recipient: User | null;

    @Column({ type: 'uuid' })
    siteId: string;

    @ManyToOne(() => Site, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'siteId' })
    site: Site;

    @Column({ type: 'text' })
    justification: string;

    @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.DRAFT })
    status: RequestStatus;

    @Column({ type: 'timestamptz', nullable: true })
    submittedAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    reviewedAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    approvedAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    procuredAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    installedAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    completedAt: Date | null;

    @Column({ type: 'uuid', nullable: true })
    reviewedById: string | null;

    @Column({ type: 'uuid', nullable: true })
    approvedById: string | null;

    @Column({ type: 'uuid', nullable: true })
    procuredById: string | null;

    @Column({ type: 'text', nullable: true })
    rejectReason: string | null;

    @VersionColumn()
    version: number;

    @OneToMany(() => HardwareRequestItem, (item) => item.request, {
        cascade: ['insert', 'update'],
    })
    items: HardwareRequestItem[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/entities/hardware-request.entity.ts
git commit -m "feat(hardware-request): add HardwareRequest entity"
```

---

## Task 1.7: HardwareRequestItem entity

**Files:**
- Create: `apps/backend/src/modules/hardware-request/domain/entities/hardware-request-item.entity.ts`

- [ ] **Step 1: Write entity**

```typescript
// apps/backend/src/modules/hardware-request/domain/entities/hardware-request-item.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { HardwareRequest } from './hardware-request.entity';
import { HardwareCatalog } from './hardware-catalog.entity';

@Entity('hardware_request_items')
@Index(['requestId'])
export class HardwareRequestItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    requestId: string;

    @ManyToOne(() => HardwareRequest, (req) => req.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'requestId' })
    request: HardwareRequest;

    @Column({ type: 'uuid', nullable: true })
    catalogId: string | null;

    @ManyToOne(() => HardwareCatalog, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'catalogId' })
    catalog: HardwareCatalog | null;

    @Column({ type: 'jsonb' })
    categorySnapshot: {
        code: string;
        name: string;
        category: string;
        specs: Record<string, unknown>;
        customFields: Record<string, unknown>;
    };

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
    actualCost: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    vendor: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    invoiceNumber: string | null;

    @Column({ type: 'date', nullable: true })
    invoiceDate: Date | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;
}
```

Note: `actualCost` uses `string` because TypeORM returns decimal as string to preserve precision; services convert to/from `number` explicitly where needed.

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/entities/hardware-request-item.entity.ts
git commit -m "feat(hardware-request): add HardwareRequestItem entity"
```

---

## Task 1.8: HardwareRequestActivity entity

**Files:**
- Create: `apps/backend/src/modules/hardware-request/domain/entities/hardware-request-activity.entity.ts`

- [ ] **Step 1: Write entity**

```typescript
// apps/backend/src/modules/hardware-request/domain/entities/hardware-request-activity.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { HardwareRequest } from './hardware-request.entity';
import { User } from '../../../users/entities/user.entity';
import { ActivityAction } from '../enums/activity-action.enum';
import { RequestStatus } from '../enums/request-status.enum';

@Entity('hardware_request_activities')
@Index(['requestId', 'createdAt'])
export class HardwareRequestActivity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    requestId: string;

    @ManyToOne(() => HardwareRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'requestId' })
    request: HardwareRequest;

    @Column({ type: 'uuid' })
    actorId: string;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'actorId' })
    actor: User;

    @Column({ type: 'enum', enum: ActivityAction })
    action: ActivityAction;

    @Column({ type: 'enum', enum: RequestStatus, nullable: true })
    fromStatus: RequestStatus | null;

    @Column({ type: 'enum', enum: RequestStatus, nullable: true })
    toStatus: RequestStatus | null;

    @Column({ type: 'jsonb', default: () => "'{}'" })
    metadata: Record<string, unknown>;

    @CreateDateColumn()
    createdAt: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/entities/hardware-request-activity.entity.ts
git commit -m "feat(hardware-request): add HardwareRequestActivity entity"
```

---

## Task 1.9: Migration to create tables

**Files:**
- Create: `apps/backend/src/migrations/1776000000000-CreateHardwareRequestFoundation.ts`

- [ ] **Step 1: Write migration (uses explicit SQL for readability)**

```typescript
// apps/backend/src/migrations/1776000000000-CreateHardwareRequestFoundation.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHardwareRequestFoundation1776000000000
    implements MigrationInterface
{
    name = 'CreateHardwareRequestFoundation1776000000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE hr_item_category AS ENUM
                ('LAPTOP','MONITOR','ACCESSORY','NETWORK','SOFTWARE','OTHER');
        `);
        await queryRunner.query(`
            CREATE TYPE hr_request_status AS ENUM
                ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED',
                 'CANCELLED','PROCUREMENT','INSTALLATION','COMPLETED');
        `);
        await queryRunner.query(`
            CREATE TYPE hr_activity_action AS ENUM
                ('CREATED','UPDATED','SUBMITTED','REVIEWED','APPROVED','REJECTED',
                 'CANCELLED','PROCUREMENT_UPDATED','PROCUREMENT_COMPLETED',
                 'INSTALL_SCHEDULED','INSTALL_CONFIRMED','INSTALL_RESCHEDULED',
                 'INSTALL_STARTED','INSTALL_COMPLETED','COMMENTED','BARCODE_SCANNED');
        `);

        await queryRunner.query(`
            CREATE TABLE hardware_catalog (
                id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                code             varchar(80) NOT NULL UNIQUE,
                name             varchar(160) NOT NULL,
                category         hr_item_category NOT NULL,
                default_specs    jsonb NOT NULL DEFAULT '{}'::jsonb,
                required_fields  jsonb NOT NULL DEFAULT '[]'::jsonb,
                active           boolean NOT NULL DEFAULT true,
                display_order    integer NOT NULL DEFAULT 0,
                created_at       timestamptz NOT NULL DEFAULT now(),
                updated_at       timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX idx_hardware_catalog_active_order
                ON hardware_catalog (active, display_order);
        `);

        await queryRunner.query(`
            CREATE TABLE hardware_requests (
                id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                request_number    varchar(32) NOT NULL UNIQUE,
                requester_id      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                recipient_id      uuid NULL REFERENCES users(id) ON DELETE SET NULL,
                site_id           uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
                justification     text NOT NULL,
                status            hr_request_status NOT NULL DEFAULT 'DRAFT',
                submitted_at      timestamptz NULL,
                reviewed_at       timestamptz NULL,
                approved_at       timestamptz NULL,
                procured_at       timestamptz NULL,
                installed_at      timestamptz NULL,
                completed_at      timestamptz NULL,
                reviewed_by_id    uuid NULL REFERENCES users(id) ON DELETE SET NULL,
                approved_by_id    uuid NULL REFERENCES users(id) ON DELETE SET NULL,
                procured_by_id    uuid NULL REFERENCES users(id) ON DELETE SET NULL,
                reject_reason     text NULL,
                version           integer NOT NULL DEFAULT 1,
                created_at        timestamptz NOT NULL DEFAULT now(),
                updated_at        timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX idx_hardware_requests_status_created
                ON hardware_requests (status, created_at DESC);
            CREATE INDEX idx_hardware_requests_requester_created
                ON hardware_requests (requester_id, created_at DESC);
        `);

        await queryRunner.query(`
            CREATE TABLE hardware_request_items (
                id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                request_id        uuid NOT NULL REFERENCES hardware_requests(id) ON DELETE CASCADE,
                catalog_id        uuid NULL REFERENCES hardware_catalog(id) ON DELETE SET NULL,
                category_snapshot jsonb NOT NULL,
                quantity          integer NOT NULL CHECK (quantity > 0),
                actual_cost       numeric(14,2) NULL,
                vendor            varchar(255) NULL,
                invoice_number    varchar(100) NULL,
                invoice_date      date NULL,
                notes             text NULL
            );
            CREATE INDEX idx_hardware_request_items_request
                ON hardware_request_items (request_id);
        `);

        await queryRunner.query(`
            CREATE TABLE hardware_request_activities (
                id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                request_id   uuid NOT NULL REFERENCES hardware_requests(id) ON DELETE CASCADE,
                actor_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                action       hr_activity_action NOT NULL,
                from_status  hr_request_status NULL,
                to_status    hr_request_status NULL,
                metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
                created_at   timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX idx_hardware_request_activities_request_created
                ON hardware_request_activities (request_id, created_at);
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS hardware_request_activities;`);
        await queryRunner.query(`DROP TABLE IF EXISTS hardware_request_items;`);
        await queryRunner.query(`DROP TABLE IF EXISTS hardware_requests;`);
        await queryRunner.query(`DROP TABLE IF EXISTS hardware_catalog;`);
        await queryRunner.query(`DROP TYPE IF EXISTS hr_activity_action;`);
        await queryRunner.query(`DROP TYPE IF EXISTS hr_request_status;`);
        await queryRunner.query(`DROP TYPE IF EXISTS hr_item_category;`);
    }
}
```

- [ ] **Step 2: Run migration on local dev DB**

Run: `cd apps/backend && npm run migration:run`
Expected: logs show migration applied, no errors. If `uuid_generate_v4` fails, prepend `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` at top of `up()`.

- [ ] **Step 3: Verify tables exist**

Run: `psql $DATABASE_URL -c '\d hardware_catalog' -c '\d hardware_requests' -c '\d hardware_request_items' -c '\d hardware_request_activities'`
Expected: all 4 tables shown with FK constraints.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/migrations/1776000000000-CreateHardwareRequestFoundation.ts
git commit -m "feat(hardware-request): add foundation migration (catalog, requests, items, activities)"
```

---

## Task 1.10: Request number service (unit-tested)

**Files:**
- Create: `apps/backend/src/modules/hardware-request/services/request-number.service.ts`
- Create: `apps/backend/src/modules/hardware-request/services/request-number.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/backend/src/modules/hardware-request/services/request-number.service.spec.ts
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestNumberService } from './request-number.service';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

describe('RequestNumberService', () => {
    let service: RequestNumberService;
    let repoCount: jest.Mock;

    beforeEach(async () => {
        repoCount = jest.fn();
        const moduleRef = await Test.createTestingModule({
            providers: [
                RequestNumberService,
                {
                    provide: getRepositoryToken(HardwareRequest),
                    useValue: { count: repoCount } as Partial<Repository<HardwareRequest>>,
                },
            ],
        }).compile();
        service = moduleRef.get(RequestNumberService);
    });

    it('generates HR-YYYY-0001 when no requests exist this year', async () => {
        repoCount.mockResolvedValue(0);
        const now = new Date('2026-04-17T10:00:00Z');
        const num = await service.generate(now);
        expect(num).toBe('HR-2026-0001');
    });

    it('increments sequence based on count this year', async () => {
        repoCount.mockResolvedValue(42);
        const now = new Date('2026-04-17T10:00:00Z');
        const num = await service.generate(now);
        expect(num).toBe('HR-2026-0043');
    });

    it('pads to 4 digits minimum', async () => {
        repoCount.mockResolvedValue(9999);
        const num = await service.generate(new Date('2026-01-01Z'));
        expect(num).toBe('HR-2026-10000');
    });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `cd apps/backend && npx jest src/modules/hardware-request/services/request-number.service.spec.ts`
Expected: FAIL — `RequestNumberService` not defined.

- [ ] **Step 3: Implement**

```typescript
// apps/backend/src/modules/hardware-request/services/request-number.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

@Injectable()
export class RequestNumberService {
    constructor(
        @InjectRepository(HardwareRequest)
        private readonly repo: Repository<HardwareRequest>,
    ) {}

    async generate(now: Date = new Date()): Promise<string> {
        const year = now.getUTCFullYear();
        const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
        const yearEnd = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
        const existing = await this.repo.count({
            where: { createdAt: Between(yearStart, yearEnd) },
        });
        const next = existing + 1;
        const seq = next.toString().padStart(4, '0');
        return `HR-${year}-${seq}`;
    }
}
```

- [ ] **Step 4: Re-run test**

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/request-number.service*.ts
git commit -m "feat(hardware-request): add request number generator"
```

Note: this uses `count` per generate call — acceptable for moderate volume. For high concurrency, later plan can swap to a Postgres sequence per year. Not in Plan 1 scope.

---

## Task 1.11: DTOs

**Files:**
- Create: `apps/backend/src/modules/hardware-request/dto/create-request.dto.ts`
- Create: `apps/backend/src/modules/hardware-request/dto/update-draft.dto.ts`
- Create: `apps/backend/src/modules/hardware-request/dto/list-requests.dto.ts`
- Create: `apps/backend/src/modules/hardware-request/dto/create-catalog.dto.ts`
- Create: `apps/backend/src/modules/hardware-request/dto/update-catalog.dto.ts`

- [ ] **Step 1: create-request.dto.ts**

```typescript
import {
    ArrayMinSize,
    IsArray,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequestItemDto {
    @IsUUID()
    catalogId: string;

    @IsInt()
    @Min(1)
    quantity: number;

    @IsObject()
    @IsOptional()
    customFields?: Record<string, unknown>;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class CreateRequestDto {
    @IsUUID()
    siteId: string;

    @IsUUID()
    @IsOptional()
    recipientId?: string;

    @IsString()
    @MinLength(20)
    justification: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateRequestItemDto)
    items: CreateRequestItemDto[];
}
```

- [ ] **Step 2: update-draft.dto.ts**

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateRequestDto } from './create-request.dto';

export class UpdateDraftDto extends PartialType(CreateRequestDto) {}
```

- [ ] **Step 3: list-requests.dto.ts**

```typescript
import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsEnum,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
} from 'class-validator';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { ItemCategory } from '../domain/enums/item-category.enum';

export class ListRequestsDto {
    @IsOptional()
    @IsArray()
    @IsEnum(RequestStatus, { each: true })
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    status?: RequestStatus[];

    @IsOptional()
    @IsArray()
    @IsEnum(ItemCategory, { each: true })
    @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
    category?: ItemCategory[];

    @IsOptional()
    @IsUUID()
    siteId?: string;

    @IsOptional()
    @IsUUID()
    requesterId?: string;

    @IsOptional()
    @IsIn(['my', 'all'])
    scope?: 'my' | 'all';

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    pageSize?: number = 20;
}
```

- [ ] **Step 4: create-catalog.dto.ts**

```typescript
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    Length,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCategory } from '../domain/enums/item-category.enum';

export class CatalogRequiredFieldDto {
    @IsString() @Length(1, 80) key: string;
    @IsString() @Length(1, 160) label: string;
    @IsEnum(['text', 'number', 'select']) type: 'text' | 'number' | 'select';
    @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
    @IsOptional() @IsBoolean() required?: boolean;
}

export class CreateCatalogDto {
    @IsString() @Length(1, 80) code: string;
    @IsString() @Length(1, 160) name: string;
    @IsEnum(ItemCategory) category: ItemCategory;

    @IsOptional() @IsObject() defaultSpecs?: Record<string, unknown>;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CatalogRequiredFieldDto)
    requiredFields?: CatalogRequiredFieldDto[];

    @IsOptional() @IsBoolean() active?: boolean;
    @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}
```

- [ ] **Step 5: update-catalog.dto.ts**

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateCatalogDto } from './create-catalog.dto';

export class UpdateCatalogDto extends PartialType(CreateCatalogDto) {}
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/hardware-request/dto
git commit -m "feat(hardware-request): add DTOs for request + catalog"
```

---

## Task 1.12: HardwareCatalogService (TDD)

**Files:**
- Create: `apps/backend/src/modules/hardware-request/services/hardware-catalog.service.ts`
- Create: `apps/backend/src/modules/hardware-request/services/hardware-catalog.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/backend/src/modules/hardware-request/services/hardware-catalog.service.spec.ts
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareCatalogService } from './hardware-catalog.service';
import { HardwareCatalog } from '../domain/entities/hardware-catalog.entity';
import { ItemCategory } from '../domain/enums/item-category.enum';

type R = jest.Mocked<Pick<Repository<HardwareCatalog>, 'find' | 'findOne' | 'save' | 'create'>>;

describe('HardwareCatalogService', () => {
    let service: HardwareCatalogService;
    let repo: R;

    beforeEach(async () => {
        repo = {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn((x) => Promise.resolve({ id: 'new-id', ...x })),
            create: jest.fn((x) => x as any),
        } as unknown as R;

        const moduleRef = await Test.createTestingModule({
            providers: [
                HardwareCatalogService,
                { provide: getRepositoryToken(HardwareCatalog), useValue: repo },
            ],
        }).compile();

        service = moduleRef.get(HardwareCatalogService);
    });

    it('listActive returns active catalog sorted by displayOrder', async () => {
        repo.find.mockResolvedValue([
            { id: '1', code: 'LAPTOP_STD', active: true, displayOrder: 1 } as any,
        ]);
        const res = await service.listActive();
        expect(repo.find).toHaveBeenCalledWith({
            where: { active: true },
            order: { displayOrder: 'ASC', name: 'ASC' },
        });
        expect(res).toHaveLength(1);
    });

    it('create persists new catalog item', async () => {
        repo.findOne.mockResolvedValue(null);
        const dto = {
            code: 'MOUSE_STD',
            name: 'Standard Mouse',
            category: ItemCategory.ACCESSORY,
        };
        const result = await service.create(dto as any);
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining(dto));
        expect(repo.save).toHaveBeenCalled();
        expect(result.id).toBe('new-id');
    });

    it('create rejects duplicate code', async () => {
        repo.findOne.mockResolvedValue({ id: 'existing', code: 'LAPTOP_STD' } as any);
        await expect(
            service.create({ code: 'LAPTOP_STD', name: 'x', category: ItemCategory.LAPTOP } as any),
        ).rejects.toThrow(/already exists/i);
    });

    it('softDelete sets active=false', async () => {
        const existing = { id: 'c1', active: true } as any;
        repo.findOne.mockResolvedValue(existing);
        await service.softDelete('c1');
        expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', active: false }));
    });

    it('ensureActive throws CatalogItemInactiveError when inactive', async () => {
        repo.findOne.mockResolvedValue({ id: 'c1', active: false } as any);
        await expect(service.ensureActive('c1')).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'HR_CATALOG_INACTIVE' }),
        });
    });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd apps/backend && npx jest src/modules/hardware-request/services/hardware-catalog.service.spec.ts`
Expected: FAIL (service not defined).

- [ ] **Step 3: Implement**

```typescript
// apps/backend/src/modules/hardware-request/services/hardware-catalog.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HardwareCatalog } from '../domain/entities/hardware-catalog.entity';
import { CatalogItemInactiveError } from '../domain/errors';
import { CreateCatalogDto } from '../dto/create-catalog.dto';
import { UpdateCatalogDto } from '../dto/update-catalog.dto';

@Injectable()
export class HardwareCatalogService {
    constructor(
        @InjectRepository(HardwareCatalog)
        private readonly repo: Repository<HardwareCatalog>,
    ) {}

    listActive(): Promise<HardwareCatalog[]> {
        return this.repo.find({
            where: { active: true },
            order: { displayOrder: 'ASC', name: 'ASC' },
        });
    }

    listAll(): Promise<HardwareCatalog[]> {
        return this.repo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
    }

    async getById(id: string): Promise<HardwareCatalog> {
        const found = await this.repo.findOne({ where: { id } });
        if (!found) {
            throw new NotFoundException({ code: 'HR_CATALOG_NOT_FOUND', message: 'Catalog not found' });
        }
        return found;
    }

    async ensureActive(id: string): Promise<HardwareCatalog> {
        const found = await this.repo.findOne({ where: { id } });
        if (!found || !found.active) {
            throw new CatalogItemInactiveError(id);
        }
        return found;
    }

    async create(dto: CreateCatalogDto): Promise<HardwareCatalog> {
        const dup = await this.repo.findOne({ where: { code: dto.code } });
        if (dup) {
            throw new BadRequestException({
                code: 'HR_CATALOG_DUPLICATE_CODE',
                message: `Catalog code ${dto.code} already exists`,
            });
        }
        const entity = this.repo.create({
            code: dto.code,
            name: dto.name,
            category: dto.category,
            defaultSpecs: dto.defaultSpecs ?? {},
            requiredFields: dto.requiredFields ?? [],
            active: dto.active ?? true,
            displayOrder: dto.displayOrder ?? 0,
        });
        return this.repo.save(entity);
    }

    async update(id: string, dto: UpdateCatalogDto): Promise<HardwareCatalog> {
        const existing = await this.getById(id);
        Object.assign(existing, dto);
        return this.repo.save(existing);
    }

    async softDelete(id: string): Promise<void> {
        const existing = await this.getById(id);
        existing.active = false;
        await this.repo.save(existing);
    }
}
```

- [ ] **Step 4: Run tests — expect all pass**

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-catalog.service*.ts
git commit -m "feat(hardware-request): add HardwareCatalogService"
```

---

## Task 1.13: HardwareRequestCommandService — create DRAFT (TDD)

**Files:**
- Create: `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts`
- Create: `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.spec.ts`

- [ ] **Step 1: Write failing tests for `createDraft`**

```typescript
// apps/backend/src/modules/hardware-request/services/hardware-request-command.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareRequestCommandService } from './hardware-request-command.service';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { HardwareRequestActivity } from '../domain/entities/hardware-request-activity.entity';
import { HardwareCatalogService } from './hardware-catalog.service';
import { RequestNumberService } from './request-number.service';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { ActivityAction } from '../domain/enums/activity-action.enum';
import { ItemCategory } from '../domain/enums/item-category.enum';

describe('HardwareRequestCommandService', () => {
    let service: HardwareRequestCommandService;
    let reqRepo: any;
    let activityRepo: any;
    let catalog: jest.Mocked<Pick<HardwareCatalogService, 'ensureActive'>>;
    let numberer: jest.Mocked<Pick<RequestNumberService, 'generate'>>;
    let dataSource: any;

    const mockCatalogItem = {
        id: 'cat-1',
        code: 'LAPTOP_STD',
        name: 'Laptop Standard',
        category: ItemCategory.LAPTOP,
        defaultSpecs: { ram: '16GB' },
    };

    beforeEach(async () => {
        reqRepo = {
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve({ id: 'req-1', ...x })),
            findOne: jest.fn(),
        };
        activityRepo = {
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve(x)),
        };
        catalog = {
            ensureActive: jest.fn().mockResolvedValue(mockCatalogItem as any),
        };
        numberer = { generate: jest.fn().mockResolvedValue('HR-2026-0001') };
        dataSource = {
            transaction: jest.fn(async (cb: any) => cb({
                getRepository: (e: any) => (e === HardwareRequest ? reqRepo :
                                           e === HardwareRequestActivity ? activityRepo : reqRepo),
            })),
        };

        const moduleRef = await Test.createTestingModule({
            providers: [
                HardwareRequestCommandService,
                { provide: getRepositoryToken(HardwareRequest), useValue: reqRepo },
                { provide: getRepositoryToken(HardwareRequestItem), useValue: {} },
                { provide: getRepositoryToken(HardwareRequestActivity), useValue: activityRepo },
                { provide: HardwareCatalogService, useValue: catalog },
                { provide: RequestNumberService, useValue: numberer },
                { provide: DataSource, useValue: dataSource },
            ],
        }).compile();
        service = moduleRef.get(HardwareRequestCommandService);
    });

    it('createDraft creates DRAFT request with items and activity', async () => {
        const result = await service.createDraft('user-1', {
            siteId: 'site-1',
            justification: 'Need laptops for new hire onboarding batch',
            items: [{ catalogId: 'cat-1', quantity: 2 }],
        });

        expect(numberer.generate).toHaveBeenCalled();
        expect(catalog.ensureActive).toHaveBeenCalledWith('cat-1');
        expect(reqRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            requestNumber: 'HR-2026-0001',
            requesterId: 'user-1',
            siteId: 'site-1',
            status: RequestStatus.DRAFT,
            items: expect.arrayContaining([
                expect.objectContaining({
                    catalogId: 'cat-1',
                    quantity: 2,
                    categorySnapshot: expect.objectContaining({ code: 'LAPTOP_STD' }),
                }),
            ]),
        }));
        expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            action: ActivityAction.CREATED,
            actorId: 'user-1',
            toStatus: RequestStatus.DRAFT,
        }));
        expect(result.id).toBe('req-1');
    });

    it('createDraft rejects inactive catalog item', async () => {
        catalog.ensureActive.mockRejectedValueOnce(new Error('inactive'));
        await expect(
            service.createDraft('user-1', {
                siteId: 'site-1',
                justification: 'x'.repeat(25),
                items: [{ catalogId: 'bad', quantity: 1 }],
            }),
        ).rejects.toThrow();
    });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd apps/backend && npx jest src/modules/hardware-request/services/hardware-request-command.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement createDraft**

```typescript
// apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { HardwareRequestActivity } from '../domain/entities/hardware-request-activity.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { ActivityAction } from '../domain/enums/activity-action.enum';
import { HardwareCatalogService } from './hardware-catalog.service';
import { RequestNumberService } from './request-number.service';
import { CreateRequestDto } from '../dto/create-request.dto';

@Injectable()
export class HardwareRequestCommandService {
    constructor(
        @InjectRepository(HardwareRequest)
        private readonly requestRepo: Repository<HardwareRequest>,
        @InjectRepository(HardwareRequestItem)
        private readonly itemRepo: Repository<HardwareRequestItem>,
        @InjectRepository(HardwareRequestActivity)
        private readonly activityRepo: Repository<HardwareRequestActivity>,
        private readonly catalog: HardwareCatalogService,
        private readonly numberer: RequestNumberService,
        private readonly dataSource: DataSource,
    ) {}

    async createDraft(userId: string, dto: CreateRequestDto): Promise<HardwareRequest> {
        return this.dataSource.transaction(async (mgr) => {
            const requestRepo = mgr.getRepository(HardwareRequest);
            const activityRepo = mgr.getRepository(HardwareRequestActivity);

            const itemsWithSnapshot = await Promise.all(
                dto.items.map(async (i) => {
                    const cat = await this.catalog.ensureActive(i.catalogId);
                    return {
                        catalogId: cat.id,
                        quantity: i.quantity,
                        notes: i.notes ?? null,
                        categorySnapshot: {
                            code: cat.code,
                            name: cat.name,
                            category: cat.category,
                            specs: cat.defaultSpecs ?? {},
                            customFields: i.customFields ?? {},
                        },
                    };
                }),
            );

            const requestNumber = await this.numberer.generate();
            const entity = requestRepo.create({
                requestNumber,
                requesterId: userId,
                recipientId: dto.recipientId ?? null,
                siteId: dto.siteId,
                justification: dto.justification,
                status: RequestStatus.DRAFT,
                items: itemsWithSnapshot as any,
            });
            const saved = await requestRepo.save(entity);

            const activity = activityRepo.create({
                requestId: saved.id,
                actorId: userId,
                action: ActivityAction.CREATED,
                fromStatus: null,
                toStatus: RequestStatus.DRAFT,
                metadata: { requestNumber: saved.requestNumber },
            });
            await activityRepo.save(activity);

            return saved;
        });
    }
}
```

- [ ] **Step 4: Run — expect pass (2 tests)**

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-request-command.service*.ts
git commit -m "feat(hardware-request): add createDraft to command service"
```

---

## Task 1.14: Command service — updateDraft (TDD)

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts`
- Modify: `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.spec.ts`

- [ ] **Step 1: Add failing tests**

Append to `describe('HardwareRequestCommandService', ...)`:

```typescript
it('updateDraft updates request fields when status=DRAFT and actor=requester', async () => {
    reqRepo.findOne.mockResolvedValue({
        id: 'req-1',
        requesterId: 'user-1',
        status: RequestStatus.DRAFT,
        items: [],
    } as any);

    const updated = await service.updateDraft('user-1', 'req-1', {
        justification: 'Updated justification with enough characters',
    });

    expect(reqRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'req-1',
        justification: 'Updated justification with enough characters',
    }));
    expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        action: ActivityAction.UPDATED,
    }));
});

it('updateDraft rejects when actor is not requester', async () => {
    reqRepo.findOne.mockResolvedValue({
        id: 'req-1', requesterId: 'user-1', status: RequestStatus.DRAFT, items: [],
    } as any);
    await expect(
        service.updateDraft('other-user', 'req-1', { justification: 'x'.repeat(25) }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }) });
});

it('updateDraft rejects when status != DRAFT', async () => {
    reqRepo.findOne.mockResolvedValue({
        id: 'req-1', requesterId: 'user-1', status: RequestStatus.SUBMITTED, items: [],
    } as any);
    await expect(
        service.updateDraft('user-1', 'req-1', { justification: 'x'.repeat(25) }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }) });
});
```

- [ ] **Step 2: Run — expect failures**

- [ ] **Step 3: Implement**

Add method to `HardwareRequestCommandService`:

```typescript
import {
    HardwareRequestNotFoundError,
    InvalidStateTransitionError,
    PermissionDeniedError,
} from '../domain/errors';
import { UpdateDraftDto } from '../dto/update-draft.dto';

// ... inside class
async updateDraft(
    userId: string,
    requestId: string,
    dto: UpdateDraftDto,
): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
        const requestRepo = mgr.getRepository(HardwareRequest);
        const activityRepo = mgr.getRepository(HardwareRequestActivity);
        const itemRepo = mgr.getRepository(HardwareRequestItem);

        const existing = await requestRepo.findOne({
            where: { id: requestId },
            relations: { items: true },
        });
        if (!existing) throw new HardwareRequestNotFoundError(requestId);
        if (existing.requesterId !== userId) {
            throw new PermissionDeniedError('update this request');
        }
        if (existing.status !== RequestStatus.DRAFT) {
            throw new InvalidStateTransitionError(existing.status, RequestStatus.DRAFT);
        }

        if (dto.siteId !== undefined) existing.siteId = dto.siteId;
        if (dto.recipientId !== undefined) existing.recipientId = dto.recipientId ?? null;
        if (dto.justification !== undefined) existing.justification = dto.justification;

        if (dto.items) {
            // Replace items wholesale: delete old, create new snapshots.
            await itemRepo.delete({ requestId: existing.id });
            existing.items = await Promise.all(
                dto.items.map(async (i) => {
                    const cat = await this.catalog.ensureActive(i.catalogId);
                    return itemRepo.create({
                        requestId: existing.id,
                        catalogId: cat.id,
                        quantity: i.quantity,
                        notes: i.notes ?? null,
                        categorySnapshot: {
                            code: cat.code,
                            name: cat.name,
                            category: cat.category,
                            specs: cat.defaultSpecs ?? {},
                            customFields: i.customFields ?? {},
                        },
                    });
                }),
            );
        }

        const saved = await requestRepo.save(existing);

        await activityRepo.save(activityRepo.create({
            requestId: saved.id,
            actorId: userId,
            action: ActivityAction.UPDATED,
            fromStatus: RequestStatus.DRAFT,
            toStatus: RequestStatus.DRAFT,
            metadata: { fields: Object.keys(dto) },
        }));

        return saved;
    });
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-request-command.service*.ts
git commit -m "feat(hardware-request): add updateDraft"
```

---

## Task 1.15: Command service — submit (TDD)

**Files:**
- Modify: same command service + spec.

- [ ] **Step 1: Add failing tests**

```typescript
it('submit transitions DRAFT → SUBMITTED and sets submittedAt', async () => {
    const draft: any = {
        id: 'req-1', requesterId: 'user-1', status: RequestStatus.DRAFT,
        items: [{ id: 'i1' }], justification: 'x'.repeat(25),
    };
    reqRepo.findOne.mockResolvedValue(draft);

    const res = await service.submit('user-1', 'req-1');
    expect(res.status).toBe(RequestStatus.SUBMITTED);
    expect(res.submittedAt).toBeInstanceOf(Date);
    expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        action: ActivityAction.SUBMITTED,
        fromStatus: RequestStatus.DRAFT,
        toStatus: RequestStatus.SUBMITTED,
    }));
});

it('submit rejects when not in DRAFT', async () => {
    reqRepo.findOne.mockResolvedValue({
        id: 'req-1', requesterId: 'user-1', status: RequestStatus.SUBMITTED, items: [{}],
    } as any);
    await expect(service.submit('user-1', 'req-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }),
    });
});

it('submit rejects when requester mismatched', async () => {
    reqRepo.findOne.mockResolvedValue({
        id: 'req-1', requesterId: 'user-1', status: RequestStatus.DRAFT, items: [{}],
    } as any);
    await expect(service.submit('other', 'req-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }),
    });
});

it('submit rejects when no items', async () => {
    reqRepo.findOne.mockResolvedValue({
        id: 'req-1', requesterId: 'user-1', status: RequestStatus.DRAFT, items: [],
    } as any);
    await expect(service.submit('user-1', 'req-1')).rejects.toThrow(/at least one item/i);
});
```

- [ ] **Step 2: Run — expect failures**

- [ ] **Step 3: Implement**

```typescript
import { BadRequestException } from '@nestjs/common';

// ... inside class
async submit(userId: string, requestId: string): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
        const requestRepo = mgr.getRepository(HardwareRequest);
        const activityRepo = mgr.getRepository(HardwareRequestActivity);

        const existing = await requestRepo.findOne({
            where: { id: requestId },
            relations: { items: true },
        });
        if (!existing) throw new HardwareRequestNotFoundError(requestId);
        if (existing.requesterId !== userId) {
            throw new PermissionDeniedError('submit this request');
        }
        if (existing.status !== RequestStatus.DRAFT) {
            throw new InvalidStateTransitionError(existing.status, RequestStatus.SUBMITTED);
        }
        if (!existing.items || existing.items.length === 0) {
            throw new BadRequestException({
                code: 'HR_VALIDATION',
                message: 'Request must have at least one item',
            });
        }

        existing.status = RequestStatus.SUBMITTED;
        existing.submittedAt = new Date();
        const saved = await requestRepo.save(existing);

        await activityRepo.save(activityRepo.create({
            requestId: saved.id,
            actorId: userId,
            action: ActivityAction.SUBMITTED,
            fromStatus: RequestStatus.DRAFT,
            toStatus: RequestStatus.SUBMITTED,
            metadata: {},
        }));

        return saved;
    });
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-request-command.service*.ts
git commit -m "feat(hardware-request): add submit transition"
```

---

## Task 1.16: Command service — cancel (TDD)

**Files:**
- Modify: same command service + spec.

- [ ] **Step 1: Add failing tests**

```typescript
it('cancel transitions SUBMITTED → CANCELLED (requester only)', async () => {
    const r: any = {
        id: 'req-1', requesterId: 'user-1', status: RequestStatus.SUBMITTED,
        items: [{}],
    };
    reqRepo.findOne.mockResolvedValue(r);
    const res = await service.cancel('user-1', 'req-1');
    expect(res.status).toBe(RequestStatus.CANCELLED);
    expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        action: ActivityAction.CANCELLED,
        fromStatus: RequestStatus.SUBMITTED,
        toStatus: RequestStatus.CANCELLED,
    }));
});

it('cancel rejects if not SUBMITTED', async () => {
    reqRepo.findOne.mockResolvedValue({
        id: 'req-1', requesterId: 'user-1', status: RequestStatus.UNDER_REVIEW, items: [{}],
    } as any);
    await expect(service.cancel('user-1', 'req-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }),
    });
});

it('cancel rejects non-requester', async () => {
    reqRepo.findOne.mockResolvedValue({
        id: 'req-1', requesterId: 'user-1', status: RequestStatus.SUBMITTED, items: [{}],
    } as any);
    await expect(service.cancel('other', 'req-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }),
    });
});
```

- [ ] **Step 2: Run — expect failures**

- [ ] **Step 3: Implement**

```typescript
async cancel(userId: string, requestId: string): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
        const requestRepo = mgr.getRepository(HardwareRequest);
        const activityRepo = mgr.getRepository(HardwareRequestActivity);

        const existing = await requestRepo.findOne({ where: { id: requestId } });
        if (!existing) throw new HardwareRequestNotFoundError(requestId);
        if (existing.requesterId !== userId) {
            throw new PermissionDeniedError('cancel this request');
        }
        if (existing.status !== RequestStatus.SUBMITTED) {
            throw new InvalidStateTransitionError(existing.status, RequestStatus.CANCELLED);
        }
        existing.status = RequestStatus.CANCELLED;
        const saved = await requestRepo.save(existing);

        await activityRepo.save(activityRepo.create({
            requestId: saved.id,
            actorId: userId,
            action: ActivityAction.CANCELLED,
            fromStatus: RequestStatus.SUBMITTED,
            toStatus: RequestStatus.CANCELLED,
            metadata: {},
        }));
        return saved;
    });
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-request-command.service*.ts
git commit -m "feat(hardware-request): add cancel transition"
```

---

## Task 1.17: Query service — list + getById with scope/permission (TDD)

**Files:**
- Create: `apps/backend/src/modules/hardware-request/services/hardware-request-query.service.ts`
- Create: `apps/backend/src/modules/hardware-request/services/hardware-request-query.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/backend/src/modules/hardware-request/services/hardware-request-query.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareRequestQueryService } from './hardware-request-query.service';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { HardwareRole } from '../domain/enums/hardware-role.enum';

describe('HardwareRequestQueryService', () => {
    let service: HardwareRequestQueryService;
    let qb: any;
    let repo: any;

    beforeEach(async () => {
        qb = {
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'r1' }], 1]),
        };
        repo = {
            createQueryBuilder: jest.fn().mockReturnValue(qb),
            findOne: jest.fn(),
        };
        const moduleRef = await Test.createTestingModule({
            providers: [
                HardwareRequestQueryService,
                { provide: getRepositoryToken(HardwareRequest), useValue: repo },
            ],
        }).compile();
        service = moduleRef.get(HardwareRequestQueryService);
    });

    it('list enforces USER scope to own requests', async () => {
        await service.list(
            { id: 'user-1', role: HardwareRole.USER },
            { page: 1, pageSize: 20 },
        );
        expect(qb.andWhere).toHaveBeenCalledWith('r.requesterId = :uid', { uid: 'user-1' });
    });

    it('list allows ICT_LEAD to see all without uid filter', async () => {
        await service.list(
            { id: 'lead-1', role: HardwareRole.ICT_LEAD },
            { page: 1, pageSize: 20 },
        );
        const calls = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
        expect(calls.some((s: string) => s.includes('requesterId = :uid'))).toBe(false);
    });

    it('list filters by status when provided', async () => {
        await service.list(
            { id: 'lead-1', role: HardwareRole.ICT_LEAD },
            { status: [RequestStatus.SUBMITTED], page: 1, pageSize: 20 },
        );
        expect(qb.andWhere).toHaveBeenCalledWith('r.status IN (:...statuses)', { statuses: [RequestStatus.SUBMITTED] });
    });

    it('getById allows USER only for own request', async () => {
        repo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'user-1' });
        const res = await service.getById({ id: 'user-1', role: HardwareRole.USER }, 'r1');
        expect(res.id).toBe('r1');
    });

    it('getById denies USER for others request', async () => {
        repo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'other' });
        await expect(
            service.getById({ id: 'user-1', role: HardwareRole.USER }, 'r1'),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }) });
    });

    it('getById throws not-found when missing', async () => {
        repo.findOne.mockResolvedValue(null);
        await expect(
            service.getById({ id: 'x', role: HardwareRole.ICT_LEAD }, 'missing'),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_NOT_FOUND' }) });
    });
});
```

- [ ] **Step 2: Run — expect failures**

- [ ] **Step 3: Implement**

```typescript
// apps/backend/src/modules/hardware-request/services/hardware-request-query.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { ListRequestsDto } from '../dto/list-requests.dto';
import {
    HardwareRequestNotFoundError,
    PermissionDeniedError,
} from '../domain/errors';

export interface ActingUser {
    id: string;
    role: HardwareRole;
}

@Injectable()
export class HardwareRequestQueryService {
    constructor(
        @InjectRepository(HardwareRequest)
        private readonly repo: Repository<HardwareRequest>,
    ) {}

    async list(
        user: ActingUser,
        dto: ListRequestsDto,
    ): Promise<{ rows: HardwareRequest[]; total: number }> {
        const qb = this.repo
            .createQueryBuilder('r')
            .leftJoinAndSelect('r.items', 'items')
            .leftJoinAndSelect('r.requester', 'requester')
            .leftJoinAndSelect('r.recipient', 'recipient')
            .leftJoinAndSelect('r.site', 'site')
            .where('1=1');

        if (user.role === HardwareRole.USER || dto.scope === 'my') {
            qb.andWhere('r.requesterId = :uid', { uid: user.id });
        }

        if (dto.status && dto.status.length > 0) {
            qb.andWhere('r.status IN (:...statuses)', { statuses: dto.status });
        }
        if (dto.siteId) qb.andWhere('r.siteId = :siteId', { siteId: dto.siteId });
        if (dto.requesterId && user.role !== HardwareRole.USER) {
            qb.andWhere('r.requesterId = :reqId', { reqId: dto.requesterId });
        }
        if (dto.search) {
            qb.andWhere(
                '(r.requestNumber ILIKE :q OR r.justification ILIKE :q)',
                { q: `%${dto.search}%` },
            );
        }

        const page = dto.page ?? 1;
        const pageSize = dto.pageSize ?? 20;
        qb.orderBy('r.createdAt', 'DESC').skip((page - 1) * pageSize).take(pageSize);

        const [rows, total] = await qb.getManyAndCount();
        return { rows, total };
    }

    async getById(user: ActingUser, id: string): Promise<HardwareRequest> {
        const found = await this.repo.findOne({
            where: { id },
            relations: {
                items: true,
                requester: true,
                recipient: true,
                site: true,
            },
        });
        if (!found) throw new HardwareRequestNotFoundError(id);
        if (user.role === HardwareRole.USER && found.requesterId !== user.id) {
            throw new PermissionDeniedError('view this request');
        }
        return found;
    }
}
```

- [ ] **Step 4: Run — expect all pass**

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-request-query.service*.ts
git commit -m "feat(hardware-request): add query service with scope-based listing"
```

---

## Task 1.18: Role guard + decorator

**Files:**
- Create: `apps/backend/src/modules/hardware-request/guards/roles.decorator.ts`
- Create: `apps/backend/src/modules/hardware-request/guards/hardware-role.guard.ts`

- [ ] **Step 1: roles.decorator.ts**

```typescript
import { SetMetadata } from '@nestjs/common';
import { HardwareRole } from '../domain/enums/hardware-role.enum';

export const HARDWARE_ROLES_KEY = 'hardware_roles';
export const HardwareRoles = (...roles: HardwareRole[]) =>
    SetMetadata(HARDWARE_ROLES_KEY, roles);
```

- [ ] **Step 2: hardware-role.guard.ts**

IMPORTANT: This assumes Task 1.1 established how to read the current user's role. Replace `pickRole(user)` body below to map your project's actual User model to `HardwareRole`. Example below maps from common `user.roles: string[]` and `user.role: string`. If your project only has generic roles (e.g. "ADMIN", "USER"), adjust logic accordingly.

```typescript
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { HARDWARE_ROLES_KEY } from './roles.decorator';
import { PermissionDeniedError } from '../domain/errors';

export function pickRole(user: any): HardwareRole {
    if (!user) return HardwareRole.USER;
    // 1. Prefer an explicit hardware role stored on the user record:
    if (user.hardwareRole && Object.values(HardwareRole).includes(user.hardwareRole)) {
        return user.hardwareRole;
    }
    // 2. Map from project permissions/role strings:
    const roles: string[] = user.roles?.map((r: any) => r?.name ?? r) ?? [];
    const single: string | undefined = user.role;
    const all = [...roles, single].filter(Boolean) as string[];

    if (all.some((r) => ['ICT_LEAD', 'ICT_MANAGER', 'ADMIN'].includes(r.toUpperCase()))) {
        return HardwareRole.ICT_LEAD;
    }
    if (all.some((r) => ['ICT_PROCUREMENT', 'PROCUREMENT'].includes(r.toUpperCase()))) {
        return HardwareRole.ICT_PROCUREMENT;
    }
    if (all.some((r) => ['ICT_TECHNICIAN', 'TECHNICIAN', 'ICT_STAFF'].includes(r.toUpperCase()))) {
        return HardwareRole.ICT_TECHNICIAN;
    }
    return HardwareRole.USER;
}

@Injectable()
export class HardwareRoleGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(ctx: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<HardwareRole[]>(
            HARDWARE_ROLES_KEY,
            [ctx.getHandler(), ctx.getClass()],
        );
        const req = ctx.switchToHttp().getRequest();
        const user = req.user;
        if (!user) throw new UnauthorizedException();

        const role = pickRole(user);
        req.hardwareRole = role; // for controllers to read

        if (!required || required.length === 0) return true;
        if (!required.includes(role)) {
            throw new PermissionDeniedError('access this resource');
        }
        return true;
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/hardware-request/guards
git commit -m "feat(hardware-request): add role guard + decorator"
```

---

## Task 1.19: Controllers

**Files:**
- Create: `apps/backend/src/modules/hardware-request/presentation/hardware-request.controller.ts`
- Create: `apps/backend/src/modules/hardware-request/presentation/hardware-catalog.controller.ts`

Both use your project's `JwtAuthGuard` — replace the import path below based on Task 1.1 findings.

- [ ] **Step 1: hardware-request.controller.ts**

```typescript
import {
    Body,
    Controller,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // VERIFY PATH in Task 1.1
import { HardwareRoleGuard, pickRole } from '../guards/hardware-role.guard';
import { HardwareRequestCommandService } from '../services/hardware-request-command.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import { CreateRequestDto } from '../dto/create-request.dto';
import { UpdateDraftDto } from '../dto/update-draft.dto';
import { ListRequestsDto } from '../dto/list-requests.dto';

@Controller('hardware-requests')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
export class HardwareRequestController {
    constructor(
        private readonly commands: HardwareRequestCommandService,
        private readonly queries: HardwareRequestQueryService,
    ) {}

    @Get()
    async list(@Req() req: any, @Query() dto: ListRequestsDto) {
        const role = pickRole(req.user);
        const result = await this.queries.list({ id: req.user.id, role }, dto);
        return {
            success: true,
            data: result.rows,
            meta: {
                total: result.total,
                page: dto.page ?? 1,
                pageSize: dto.pageSize ?? 20,
            },
        };
    }

    @Get(':id')
    async getOne(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        const role = pickRole(req.user);
        const data = await this.queries.getById({ id: req.user.id, role }, id);
        return { success: true, data };
    }

    @Post()
    async create(@Req() req: any, @Body() dto: CreateRequestDto) {
        const data = await this.commands.createDraft(req.user.id, dto);
        return { success: true, data };
    }

    @Patch(':id')
    async update(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateDraftDto,
    ) {
        const data = await this.commands.updateDraft(req.user.id, id, dto);
        return { success: true, data };
    }

    @Post(':id/submit')
    @HttpCode(200)
    async submit(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        const data = await this.commands.submit(req.user.id, id);
        return { success: true, data };
    }

    @Post(':id/cancel')
    @HttpCode(200)
    async cancel(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        const data = await this.commands.cancel(req.user.id, id);
        return { success: true, data };
    }
}
```

- [ ] **Step 2: hardware-catalog.controller.ts**

```typescript
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // VERIFY PATH
import { HardwareRoleGuard } from '../guards/hardware-role.guard';
import { HardwareRoles } from '../guards/roles.decorator';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { HardwareCatalogService } from '../services/hardware-catalog.service';
import { CreateCatalogDto } from '../dto/create-catalog.dto';
import { UpdateCatalogDto } from '../dto/update-catalog.dto';

@Controller('hardware-requests/catalog')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
export class HardwareCatalogController {
    constructor(private readonly service: HardwareCatalogService) {}

    // Any authenticated user can view the catalog (needed by request form).
    @Get()
    async list(@Query('includeInactive') includeInactive?: string) {
        const data = includeInactive === 'true'
            ? await this.service.listAll()
            : await this.service.listActive();
        return { success: true, data };
    }

    @Get(':id')
    async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
        return { success: true, data: await this.service.getById(id) };
    }

    @Post()
    @HardwareRoles(HardwareRole.ICT_LEAD)
    async create(@Body() dto: CreateCatalogDto) {
        return { success: true, data: await this.service.create(dto) };
    }

    @Patch(':id')
    @HardwareRoles(HardwareRole.ICT_LEAD)
    async update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateCatalogDto,
    ) {
        return { success: true, data: await this.service.update(id, dto) };
    }

    @Delete(':id')
    @HardwareRoles(HardwareRole.ICT_LEAD)
    async remove(@Param('id', new ParseUUIDPipe()) id: string) {
        await this.service.softDelete(id);
        return { success: true };
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/hardware-request/presentation
git commit -m "feat(hardware-request): add request + catalog controllers"
```

---

## Task 1.20: Wire up HardwareRequestModule

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/hardware-request.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Fill module file**

```typescript
// apps/backend/src/modules/hardware-request/hardware-request.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HardwareCatalog } from './domain/entities/hardware-catalog.entity';
import { HardwareRequest } from './domain/entities/hardware-request.entity';
import { HardwareRequestItem } from './domain/entities/hardware-request-item.entity';
import { HardwareRequestActivity } from './domain/entities/hardware-request-activity.entity';
import { HardwareCatalogService } from './services/hardware-catalog.service';
import { HardwareRequestCommandService } from './services/hardware-request-command.service';
import { HardwareRequestQueryService } from './services/hardware-request-query.service';
import { RequestNumberService } from './services/request-number.service';
import { HardwareRoleGuard } from './guards/hardware-role.guard';
import { HardwareRequestController } from './presentation/hardware-request.controller';
import { HardwareCatalogController } from './presentation/hardware-catalog.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            HardwareCatalog,
            HardwareRequest,
            HardwareRequestItem,
            HardwareRequestActivity,
        ]),
        AuthModule,
    ],
    controllers: [HardwareRequestController, HardwareCatalogController],
    providers: [
        HardwareCatalogService,
        HardwareRequestCommandService,
        HardwareRequestQueryService,
        RequestNumberService,
        HardwareRoleGuard,
    ],
    exports: [
        HardwareCatalogService,
        HardwareRequestCommandService,
        HardwareRequestQueryService,
    ],
})
export class HardwareRequestModule {}
```

- [ ] **Step 2: Register in app.module.ts**

Locate the imports array in `apps/backend/src/app.module.ts` and add:

```typescript
import { HardwareRequestModule } from './modules/hardware-request/hardware-request.module';

// inside @Module({ imports: [ ... ] })
HardwareRequestModule,
```

- [ ] **Step 3: Build**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors. If errors about User/Site relations, add those imports to `TypeOrmModule.forFeature` or verify entities are registered globally.

- [ ] **Step 4: Start server sanity check**

Run: `cd apps/backend && npm run start:dev`
Expected: server boots without error; route mappings include:
- `POST /hardware-requests`
- `GET /hardware-requests`
- `GET /hardware-requests/:id`
- `PATCH /hardware-requests/:id`
- `POST /hardware-requests/:id/submit`
- `POST /hardware-requests/:id/cancel`
- `GET /hardware-requests/catalog`
- `POST /hardware-requests/catalog`
- `PATCH /hardware-requests/catalog/:id`
- `DELETE /hardware-requests/catalog/:id`

Stop server.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/hardware-request.module.ts apps/backend/src/app.module.ts
git commit -m "feat(hardware-request): register module in app"
```

---

## Task 1.21: Catalog seed

**Files:**
- Create: `apps/backend/src/seeds/hardware-catalog.seed.ts`
- Modify: `apps/backend/src/seeds/run-seed.ts`

- [ ] **Step 1: Seed file**

```typescript
// apps/backend/src/seeds/hardware-catalog.seed.ts
import { DataSource } from 'typeorm';
import { HardwareCatalog } from '../modules/hardware-request/domain/entities/hardware-catalog.entity';
import { ItemCategory } from '../modules/hardware-request/domain/enums/item-category.enum';

export async function seedHardwareCatalog(ds: DataSource): Promise<void> {
    const repo = ds.getRepository(HardwareCatalog);

    const initial: Array<Partial<HardwareCatalog>> = [
        { code: 'LAPTOP_STD', name: 'Laptop Standard',
          category: ItemCategory.LAPTOP,
          defaultSpecs: { cpu: 'i5', ram: '16GB', storage: '512GB SSD' },
          requiredFields: [
              { key: 'preferredBrand', label: 'Preferred Brand', type: 'text', required: false },
          ],
          displayOrder: 10 },
        { code: 'LAPTOP_DESIGN', name: 'Laptop Design',
          category: ItemCategory.LAPTOP,
          defaultSpecs: { cpu: 'i7', ram: '32GB', storage: '1TB SSD', gpu: 'dedicated' },
          displayOrder: 20 },
        { code: 'MONITOR_24', name: 'Monitor 24 inch',
          category: ItemCategory.MONITOR,
          defaultSpecs: { resolution: '1920x1080', panel: 'IPS' },
          displayOrder: 30 },
        { code: 'MONITOR_27', name: 'Monitor 27 inch',
          category: ItemCategory.MONITOR,
          defaultSpecs: { resolution: '2560x1440', panel: 'IPS' },
          displayOrder: 40 },
        { code: 'MOUSE_STD', name: 'Mouse Standard',
          category: ItemCategory.ACCESSORY, displayOrder: 50 },
        { code: 'KEYBOARD_STD', name: 'Keyboard Standard',
          category: ItemCategory.ACCESSORY, displayOrder: 60 },
        { code: 'HEADSET_STD', name: 'Headset',
          category: ItemCategory.ACCESSORY, displayOrder: 70 },
        { code: 'CABLE_LAN', name: 'Network Cable (LAN)',
          category: ItemCategory.NETWORK, displayOrder: 80 },
        { code: 'AP_STD', name: 'Access Point',
          category: ItemCategory.NETWORK, displayOrder: 90 },
        { code: 'LICENSE_GENERIC', name: 'Software License (Generic)',
          category: ItemCategory.SOFTWARE,
          requiredFields: [
              { key: 'softwareName', label: 'Software Name', type: 'text', required: true },
              { key: 'seats', label: 'Seats', type: 'number', required: true },
          ],
          displayOrder: 100 },
    ];

    for (const data of initial) {
        const existing = await repo.findOne({ where: { code: data.code! } });
        if (existing) continue;
        await repo.save(repo.create(data));
    }
    console.log(`[seed] hardware_catalog ready (${initial.length} items)`);
}
```

- [ ] **Step 2: Wire into run-seed.ts**

Read `apps/backend/src/seeds/run-seed.ts`, then add the import and call:

```typescript
import { seedHardwareCatalog } from './hardware-catalog.seed';

// inside the main() after dataSource is initialized:
await seedHardwareCatalog(dataSource);
```

- [ ] **Step 3: Run seed**

Run: `cd apps/backend && npm run seed`
Expected: log line `[seed] hardware_catalog ready (10 items)`. Re-run: no duplicates.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/seeds/hardware-catalog.seed.ts apps/backend/src/seeds/run-seed.ts
git commit -m "feat(hardware-request): seed initial catalog"
```

---

## Task 1.22: Smoke test via HTTP

**Files:**
- Create (temporary): `apps/backend/test/hardware-request.smoke.http`

- [ ] **Step 1: Start backend**

Run: `cd apps/backend && npm run start:dev` in a dedicated terminal.

- [ ] **Step 2: Exercise endpoints (replace TOKEN with a valid JWT for a regular user + a lead user)**

Use whichever HTTP client the project prefers (REST Client extension, curl, Thunder Client). Example curl:

```bash
USER_TOKEN=... # USER role
LEAD_TOKEN=... # ICT_LEAD role

# List catalog (should return 10 items)
curl -s -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/hardware-requests/catalog | jq '.data | length'
# expect 10

# Grab first catalog id
CAT_ID=$(curl -s -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/hardware-requests/catalog | jq -r '.data[0].id')

# Grab a valid site id from your DB
SITE_ID=... # real uuid

# Create draft
REQ=$(curl -s -X POST -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"siteId\":\"$SITE_ID\",\"justification\":\"Demo request for smoke test purposes\",\"items\":[{\"catalogId\":\"$CAT_ID\",\"quantity\":1}]}" \
  http://localhost:3000/hardware-requests)
echo $REQ | jq
REQ_ID=$(echo $REQ | jq -r '.data.id')

# Submit
curl -s -X POST -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/hardware-requests/$REQ_ID/submit | jq '.data.status'
# expect "SUBMITTED"

# Cancel
curl -s -X POST -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/hardware-requests/$REQ_ID/cancel | jq '.data.status'
# expect "CANCELLED"
```

Expected: all responses `{ success: true, data: ... }`, status transitions as commented.

- [ ] **Step 3: Stop server**

- [ ] **Step 4: Commit smoke script (optional)**

```bash
# Only if you kept a reusable smoke file; otherwise skip.
```

---

## Task 1.23: Final verification

- [ ] **Step 1: Run all unit tests**

Run: `cd apps/backend && npx jest src/modules/hardware-request`
Expected: all green. Target coverage ≥80% for services in this plan.

- [ ] **Step 2: Run migrations on a clean DB to verify idempotency**

Run: `cd apps/backend && npm run migration:revert && npm run migration:run && npm run seed`
Expected: clean down + up + seed, no errors.

- [ ] **Step 3: Lint**

Run: `cd apps/backend && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit any lint fixes**

```bash
git add -A apps/backend/src/modules/hardware-request
git commit -m "chore(hardware-request): final lint sweep"
```

---

## Deliverables Checklist (Plan 1)

- [x] Enums: `RequestStatus`, `ItemCategory`, `ActivityAction`, `HardwareRole`.
- [x] Entities: `HardwareCatalog`, `HardwareRequest`, `HardwareRequestItem`, `HardwareRequestActivity`.
- [x] Migration: `CreateHardwareRequestFoundation`.
- [x] Services: `HardwareCatalogService`, `HardwareRequestCommandService` (createDraft, updateDraft, submit, cancel), `HardwareRequestQueryService`, `RequestNumberService`.
- [x] Guards: `HardwareRoleGuard`, `HardwareRoles` decorator.
- [x] Controllers: `HardwareRequestController`, `HardwareCatalogController`.
- [x] DTOs: create/update request, list, catalog create/update.
- [x] Seed: 10 initial catalog rows.
- [x] Unit tests ≥80% on services.
- [x] Smoke test via HTTP.

---

## Out of Scope (covered by later plans)

- Plans 2: `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `PROCUREMENT` state transitions + ICT Lead/Procurement endpoints + comments + permissions for ICT roles beyond read.
- Plan 3: Installation scheduling, barcode, WebSocket gateway, notifications (in-app + email), event listeners, cron aging reminders.
- Plan 4–7: Frontend, migration from `ict-budget`, E2E, cleanup.

---

## Self-Review

**Spec coverage (Plan 1 scope only):**
- Sec 3 Architecture — module layout ✓ (Task 1.2, 1.20).
- Sec 4 Data Model (catalog, request, item, activity) ✓ (Tasks 1.5-1.9).
- Sec 5 Transitions for DRAFT/SUBMITTED/CANCELLED ✓ (Tasks 1.13-1.16).
- Sec 6 Permissions (USER view own, ICT_LEAD manage catalog) ✓ (Tasks 1.17-1.19).
- Sec 7 Endpoints in scope ✓ (Task 1.19).

**Placeholder scan:** No "TBD/TODO" in code. Tasks 1.1 and 1.18 explicitly flag role-mapping details that require real codebase inspection; they provide sensible defaults with clear customization points.

**Type consistency:** property names consistent across entity → DTO → service → controller (e.g. `requesterId`, `siteId`, `categorySnapshot`, `requestNumber`). `actualCost` declared as string in entity (decimal) — not used in Plan 1 yet but documented.

**Out of scope respected:** No `installation_schedule`, `hardware_request_comment`, `hardware_asset` tables — those ship with Plan 3/2 so their absence here is intentional and documented.

---

## Execution Handoff

**Plan 1 complete and saved to `docs/superpowers/plans/2026-04-17-hardware-request-plan-01-backend-foundation.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session with checkpoints.

Plans 2–7 will be written after Plan 1 is executed and verified, so later decisions can be informed by actual implementation details.

Which approach?
