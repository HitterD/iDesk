# Hardware Request — Plan 5: Dashboard, Catalog Admin, Legacy Cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Backend aggregator untuk dashboard ICT (KPI, status, aging, top categories, weekly schedule, technician workload), CRUD catalog admin, data migration dari `ict_budget` → `hardware_request`, dan drop module lama + route redirect map. Setelah plan ini seluruh backend siap untuk frontend.

**Architecture:** 2 service baru (`hardware-dashboard.service`, finalize `hardware-catalog.service` dengan admin CRUD). 2 controller (`hardware-dashboard.controller`, `hardware-catalog-admin` endpoints ditambahkan ke `hardware-catalog.controller` Plan 1). 1 migration data transform + 1 migration drop table `ict_budget*`. Route redirect didefinisikan di `main.ts` middleware untuk `/request-center/hardware-*` → `/hardware-requests/*` (frontend side ditangani di Plan 7, backend hanya expose deprecated route yang return 301).

**Tech Stack:** NestJS, TypeORM QueryBuilder, PostgreSQL window functions, existing `class-validator`.

**Spec reference:** §7 dashboard/catalog endpoints, §13 Migration Plan.

**Prerequisites:** Plan 4 merged.

---

## Files in this plan

**Create:**
- `apps/backend/src/modules/hardware-request/services/hardware-dashboard.service.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-dashboard.service.spec.ts`
- `apps/backend/src/modules/hardware-request/presentation/hardware-dashboard.controller.ts`
- `apps/backend/src/modules/hardware-request/presentation/hardware-dashboard.controller.spec.ts`
- `apps/backend/src/modules/hardware-request/dto/dashboard-query.dto.ts`
- `apps/backend/src/migrations/1776000300000-MigrateIctBudgetData.ts`
- `apps/backend/src/migrations/1776000300500-DropIctBudget.ts`
- `apps/backend/src/migrations/1776000301000-CleanupTicketingSchedule.ts`

**Modify:**
- `apps/backend/src/modules/hardware-request/services/hardware-catalog.service.ts` (admin methods)
- `apps/backend/src/modules/hardware-request/presentation/hardware-catalog.controller.ts` (admin endpoints)
- `apps/backend/src/modules/hardware-request/hardware-request.module.ts`
- `apps/backend/src/app.module.ts` (remove `IctBudgetModule`)

**Delete (physically):**
- `apps/backend/src/modules/ict-budget/**`
- `apps/backend/src/modules/ticketing/entities/installation-schedule.entity.ts`
- `apps/backend/src/modules/ticketing/services/hardware-scheduler.service.ts`
- `apps/backend/src/modules/ticketing/listeners/installation-notification.listener.ts`

---

## Task 5.1: `DashboardQueryDto`

**Files:** Create `dto/dashboard-query.dto.ts`

- [ ] **Step 1: DTO**

```typescript
import { IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class DashboardAgingDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    thresholdDays?: number = 3;
}

export class DashboardRangeDto {
    @IsOptional() @IsIn(['30d', '90d'])
    range?: '30d' | '90d' = '30d';
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/dto/dashboard-query.dto.ts
git commit -m "feat(hardware-request): dashboard query DTOs"
```

---

## Task 5.2: `HardwareDashboardService` — KPI + status distribution

**Files:** Create service + spec.

- [ ] **Step 1: Spec (RED)**

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareDashboardService } from './hardware-dashboard.service';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';

describe('HardwareDashboardService', () => {
    let svc: HardwareDashboardService;
    const reqQb: any = {
        select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(), getRawMany: jest.fn(), getCount: jest.fn(),
    };
    const reqRepo = { createQueryBuilder: jest.fn(() => reqQb), count: jest.fn() };
    const schedRepo = { createQueryBuilder: jest.fn(() => reqQb), find: jest.fn() };
    const itemRepo = { createQueryBuilder: jest.fn(() => reqQb) };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                HardwareDashboardService,
                { provide: getRepositoryToken(HardwareRequest), useValue: reqRepo },
                { provide: getRepositoryToken(InstallationSchedule), useValue: schedRepo },
                { provide: getRepositoryToken(HardwareRequestItem), useValue: itemRepo },
            ],
        }).compile();
        svc = mod.get(HardwareDashboardService);
        jest.clearAllMocks();
    });

    it('kpi returns active/procurement/pending-install/completed-this-month', async () => {
        reqRepo.count
            .mockResolvedValueOnce(12)  // active
            .mockResolvedValueOnce(3)   // in procurement
            .mockResolvedValueOnce(5)   // pending install
            .mockResolvedValueOnce(8);  // completed this month

        const r = await svc.kpi();
        expect(r).toEqual({ totalActive: 12, inProcurement: 3, pendingInstall: 5, completedThisMonth: 8 });
    });

    it('statusDistribution returns array', async () => {
        reqQb.getRawMany.mockResolvedValue([
            { status: 'SUBMITTED', count: '4' }, { status: 'APPROVED', count: '2' },
        ]);
        const r = await svc.statusDistribution();
        expect(r).toEqual([{ status: 'SUBMITTED', count: 4 }, { status: 'APPROVED', count: 2 }]);
    });

    it('aging filters by thresholdDays', async () => {
        reqQb.getRawMany.mockResolvedValue([
            { id: 'r1', requestNumber: 'HR-2026-0001', status: 'UNDER_REVIEW', days: '5' },
        ]);
        const r = await svc.aging(3);
        expect(r[0].days).toBe(5);
    });
});
```

- [ ] **Step 2: Implement**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { InstallStatus } from '../domain/enums/install-status.enum';

@Injectable()
export class HardwareDashboardService {
    constructor(
        @InjectRepository(HardwareRequest) private readonly reqs: Repository<HardwareRequest>,
        @InjectRepository(InstallationSchedule) private readonly scheds: Repository<InstallationSchedule>,
        @InjectRepository(HardwareRequestItem) private readonly items: Repository<HardwareRequestItem>,
    ) {}

    async kpi() {
        const active = [
            RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW, RequestStatus.APPROVED,
            RequestStatus.PROCUREMENT, RequestStatus.INSTALLATION,
        ];
        const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);

        const totalActive = await this.reqs.count({ where: { status: In(active) } });
        const inProcurement = await this.reqs.count({ where: { status: RequestStatus.PROCUREMENT } });
        const pendingInstall = await this.reqs.count({ where: { status: RequestStatus.INSTALLATION } });
        const completedThisMonth = await this.reqs.createQueryBuilder('r')
            .where('r.status = :s', { s: RequestStatus.COMPLETED })
            .andWhere('r.completed_at >= :m', { m: monthStart })
            .getCount();

        return { totalActive, inProcurement, pendingInstall, completedThisMonth };
    }

    async statusDistribution() {
        const rows = await this.reqs.createQueryBuilder('r')
            .select('r.status', 'status').addSelect('COUNT(*)', 'count')
            .groupBy('r.status').orderBy('r.status', 'ASC').getRawMany();
        return rows.map(r => ({ status: r.status, count: Number(r.count) }));
    }

    async aging(thresholdDays = 3) {
        const active = [
            RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW, RequestStatus.APPROVED,
            RequestStatus.PROCUREMENT, RequestStatus.INSTALLATION,
        ];
        const rows = await this.reqs.createQueryBuilder('r')
            .select(['r.id AS id', 'r.request_number AS "requestNumber"',
                     'r.status AS status', 'r.requester_id AS "requesterId"',
                     'EXTRACT(DAY FROM (NOW() - r.updated_at)) AS days'])
            .where('r.status IN (:...active)', { active })
            .andWhere('EXTRACT(DAY FROM (NOW() - r.updated_at)) >= :d', { d: thresholdDays })
            .orderBy('days', 'DESC')
            .getRawMany();
        return rows.map(r => ({ ...r, days: Number(r.days) }));
    }

    async topCategories(range: '30d' | '90d') {
        const daysBack = range === '90d' ? 90 : 30;
        const rows = await this.items.createQueryBuilder('i')
            .innerJoin('hardware_requests', 'r', 'r.id = i.request_id')
            .select("COALESCE(i.category_snapshot->>'category', 'OTHER')", 'category')
            .addSelect('SUM(i.quantity)', 'qty')
            .where('r.created_at >= NOW() - make_interval(days => :d)', { d: daysBack })
            .groupBy('category').orderBy('qty', 'DESC').limit(10).getRawMany();
        return rows.map(r => ({ category: r.category, quantity: Number(r.qty) }));
    }

    async weeklySchedule() {
        const weekStart = new Date();
        weekStart.setUTCHours(0,0,0,0);
        weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
        const weekEnd = new Date(weekStart.getTime() + 7*24*3600*1000);

        const rows = await this.scheds.createQueryBuilder('s')
            .leftJoinAndSelect('s.request', 'r')
            .leftJoinAndSelect('s.technician', 't')
            .where('s.scheduled_start >= :from AND s.scheduled_start < :to', { from: weekStart, to: weekEnd })
            .andWhere('s.status IN (:...st)', { st: [InstallStatus.PROPOSED, InstallStatus.CONFIRMED, InstallStatus.IN_PROGRESS] })
            .orderBy('s.scheduled_start', 'ASC').getMany();
        return rows;
    }

    async technicianWorkload() {
        const rows = await this.scheds.createQueryBuilder('s')
            .select('s.technician_id', 'technicianId')
            .addSelect('u.full_name', 'technicianName')
            .addSelect('COUNT(*) FILTER (WHERE s.status IN (\'PROPOSED\',\'CONFIRMED\',\'IN_PROGRESS\'))', 'active')
            .addSelect('COUNT(*) FILTER (WHERE s.status=\'DONE\' AND s.completed_at >= NOW() - INTERVAL \'30 days\')', 'completed30')
            .innerJoin('users', 'u', 'u.id = s.technician_id')
            .groupBy('s.technician_id').addGroupBy('u.full_name')
            .orderBy('active', 'DESC').getRawMany();
        return rows.map(r => ({ technicianId: r.technicianId, technicianName: r.technicianName,
                                active: Number(r.active), completed30: Number(r.completed30) }));
    }
}
```

- [ ] **Step 3: Tests → PASS. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): dashboard aggregator service"
```

---

## Task 5.3: `HardwareDashboardController`

**Files:** Create controller + spec.

- [ ] **Step 1: Controller**

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HardwareRoleGuard, HardwareRoles } from '../guards/hardware-role.guard';
import { HardwareDashboardService } from '../services/hardware-dashboard.service';
import { DashboardAgingDto, DashboardRangeDto } from '../dto/dashboard-query.dto';

@Controller('hardware-requests/dashboard')
@UseGuards(HardwareRoleGuard)
@HardwareRoles('ICT_LEAD', 'ICT_PROCUREMENT', 'ICT_TECHNICIAN')
export class HardwareDashboardController {
    constructor(private readonly svc: HardwareDashboardService) {}

    @Get('kpi') async kpi() {
        return { success: true, data: await this.svc.kpi() };
    }
    @Get('status-distribution') async status() {
        return { success: true, data: await this.svc.statusDistribution() };
    }
    @Get('aging') async aging(@Query() q: DashboardAgingDto) {
        return { success: true, data: await this.svc.aging(q.thresholdDays) };
    }
    @Get('top-categories') async topCategories(@Query() q: DashboardRangeDto) {
        return { success: true, data: await this.svc.topCategories(q.range!) };
    }
    @Get('weekly-schedule') async weekly() {
        return { success: true, data: await this.svc.weeklySchedule() };
    }
    @Get('technician-workload') async workload() {
        return { success: true, data: await this.svc.technicianWorkload() };
    }
}
```

- [ ] **Step 2: Controller spec — supertest happy-path each endpoint 200**

- [ ] **Step 3: Register di module. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): dashboard controller"
```

---

## Task 5.4: Catalog Admin CRUD

**Files:** Modify `hardware-catalog.service.ts` + `hardware-catalog.controller.ts`.

- [ ] **Step 1: Service admin methods (tests first)**

```typescript
// hardware-catalog.service.spec.ts (tambah test)
describe('admin CRUD', () => {
    it('create catalog item', async () => {
        const dto = { code: 'MONITOR_27', name: 'Monitor 27"', category: 'MONITOR' };
        repo.findOne.mockResolvedValue(null); repo.create.mockReturnValue(dto); repo.save.mockResolvedValue({ id: 'c1', ...dto });
        const r = await svc.create(dto as any);
        expect(r.id).toBe('c1');
    });
    it('rejects duplicate code', async () => {
        repo.findOne.mockResolvedValue({ id: 'x' });
        await expect(svc.create({ code: 'MONITOR_27' } as any)).rejects.toThrow(/already exists/i);
    });
    it('soft deletes (active=false)', async () => {
        repo.findOne.mockResolvedValue({ id: 'c1', active: true });
        repo.save.mockImplementation(v => v);
        const r = await svc.softDelete('c1');
        expect(r.active).toBe(false);
    });
});
```

Implementasi tambahkan di service (ConflictException bila duplicate code).

```typescript
async create(dto: CreateCatalogDto): Promise<HardwareCatalog> {
    const exists = await this.repo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException('code already exists');
    const row = this.repo.create({ ...dto, active: true });
    return this.repo.save(row);
}

async update(id: string, dto: UpdateCatalogDto): Promise<HardwareCatalog> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('catalog');
    Object.assign(row, dto);
    return this.repo.save(row);
}

async softDelete(id: string): Promise<HardwareCatalog> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('catalog');
    row.active = false;
    return this.repo.save(row);
}
```

- [ ] **Step 2: DTOs**

`dto/create-catalog.dto.ts`, `dto/update-catalog.dto.ts`:

```typescript
import { IsString, IsEnum, IsOptional, IsObject, IsInt, Min, Matches, MaxLength } from 'class-validator';
import { ItemCategory } from '../domain/enums/item-category.enum';

export class CreateCatalogDto {
    @IsString() @Matches(/^[A-Z0-9_]+$/) @MaxLength(64) code: string;
    @IsString() @MaxLength(200) name: string;
    @IsEnum(ItemCategory) category: ItemCategory;
    @IsOptional() @IsObject() defaultSpecs?: Record<string, unknown>;
    @IsOptional() @IsObject() requiredFields?: Record<string, unknown>;
    @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export class UpdateCatalogDto {
    @IsOptional() @IsString() @MaxLength(200) name?: string;
    @IsOptional() @IsEnum(ItemCategory) category?: ItemCategory;
    @IsOptional() @IsObject() defaultSpecs?: Record<string, unknown>;
    @IsOptional() @IsObject() requiredFields?: Record<string, unknown>;
    @IsOptional() @IsInt() @Min(0) displayOrder?: number;
    @IsOptional() active?: boolean;
}
```

- [ ] **Step 3: Controller admin endpoints**

```typescript
@Post()
@HardwareRoles('ICT_LEAD')
async create(@Body() dto: CreateCatalogDto) {
    return { success: true, data: await this.svc.create(dto) };
}

@Patch(':id')
@HardwareRoles('ICT_LEAD')
async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCatalogDto) {
    return { success: true, data: await this.svc.update(id, dto) };
}

@Delete(':id')
@HardwareRoles('ICT_LEAD')
async remove(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.svc.softDelete(id) };
}
```

- [ ] **Step 4: Tests PASS. Commit.**

```bash
git add -A && git commit -m "feat(hardware-request): catalog admin CRUD"
```

---

## Task 5.5: Data migration — `ict_budget` → `hardware_request`

**Files:** `migrations/1776000300000-MigrateIctBudgetData.ts`

> Pemetaan status best-effort. Bila skema lama tidak punya kolom justification → fallback `"Migrated from ICT budget"`. Status yg tak jelas → `COMPLETED` bila punya `procured_at`, else `CANCELLED`. Item lama → 1 baris per row.

- [ ] **Step 1: Inspect schema lama dulu (manual):**

```bash
psql $DB_URL -c "\d ict_budgets"
psql $DB_URL -c "\d ict_budget_items"
```

Catat column actual di implementation notes. Skrip di bawah menganggap:
- `ict_budgets(id, user_id, site_id, note, status, created_at, approved_at, completed_at)`
- `ict_budget_items(id, budget_id, name, quantity, cost, vendor, invoice)`

Jika beda, sesuaikan.

- [ ] **Step 2: Migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateIctBudgetData1776000300000 implements MigrationInterface {
    name = 'MigrateIctBudgetData1776000300000';

    async up(q: QueryRunner): Promise<void> {
        const hasBudgets = await q.hasTable('ict_budgets');
        if (!hasBudgets) return;

        // increment sequence dari existing HR-YYYY-NNNN untuk avoid collision
        await q.query(`
            INSERT INTO hardware_requests
                (id, request_number, requester_id, site_id, justification, status,
                 submitted_at, approved_at, procured_at, completed_at, version, created_at, updated_at)
            SELECT
                b.id,
                'HR-' || EXTRACT(YEAR FROM b.created_at) || '-' ||
                    LPAD((ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM b.created_at) ORDER BY b.created_at) + 9000)::text, 4, '0'),
                b.user_id,
                COALESCE(b.site_id, (SELECT id FROM sites ORDER BY created_at LIMIT 1)),
                COALESCE(NULLIF(b.note, ''), 'Migrated from ICT budget'),
                CASE
                    WHEN b.completed_at IS NOT NULL THEN 'COMPLETED'::request_status_enum
                    WHEN b.approved_at IS NOT NULL THEN 'PROCUREMENT'::request_status_enum
                    ELSE 'CANCELLED'::request_status_enum
                END,
                b.created_at, b.approved_at, b.approved_at, b.completed_at,
                1, b.created_at, COALESCE(b.completed_at, b.approved_at, b.created_at)
            FROM ict_budgets b
            WHERE NOT EXISTS (SELECT 1 FROM hardware_requests r WHERE r.id = b.id);
        `);

        const hasItems = await q.hasTable('ict_budget_items');
        if (hasItems) {
            await q.query(`
                INSERT INTO hardware_request_items
                    (id, request_id, catalog_id, category_snapshot, quantity, actual_cost, vendor, invoice_number)
                SELECT
                    i.id,
                    i.budget_id,
                    NULL,
                    jsonb_build_object('category', 'OTHER', 'name', COALESCE(i.name, 'Item legacy'), 'code', 'LEGACY'),
                    COALESCE(i.quantity, 1),
                    i.cost, i.vendor, i.invoice
                FROM ict_budget_items i
                WHERE EXISTS (SELECT 1 FROM hardware_requests r WHERE r.id = i.budget_id)
                  AND NOT EXISTS (SELECT 1 FROM hardware_request_items h WHERE h.id = i.id);
            `);
        }
    }

    async down(_q: QueryRunner): Promise<void> {
        // no-op (data one-way; rollback via DB backup)
    }
}
```

- [ ] **Step 3: Dry-run di staging clone**

```bash
pnpm --filter backend typeorm migration:run -d ./src/data-source-staging.ts
psql $STAGING_DB -c "SELECT status, COUNT(*) FROM hardware_requests GROUP BY status"
```

- [ ] **Step 4: Verify kolom/count sesuai, commit**

```bash
git add -A && git commit -m "feat(hardware-request): data migration ict-budget -> hardware-request"
```

---

## Task 5.6: Drop legacy tables + module

**Files:**
- Migration `1776000300500-DropIctBudget.ts`
- Migration `1776000301000-CleanupTicketingSchedule.ts`
- Delete `ict-budget/**`

- [ ] **Step 1: Drop migration (after verification window + user approval)**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropIctBudget1776000300500 implements MigrationInterface {
    name = 'DropIctBudget1776000300500';
    async up(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE IF EXISTS ict_budget_items CASCADE`);
        await q.query(`DROP TABLE IF EXISTS ict_budgets CASCADE`);
    }
    async down(_q: QueryRunner): Promise<void> { /* manual restore */ }
}
```

- [ ] **Step 2: Cleanup ticketing schedule residues**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupTicketingSchedule1776000301000 implements MigrationInterface {
    name = 'CleanupTicketingSchedule1776000301000';
    async up(q: QueryRunner): Promise<void> {
        // drop kolom ticket-specific bila masih ada
        const hasTicketId = await q.query(`
            SELECT 1 FROM information_schema.columns
            WHERE table_name='installation_schedules' AND column_name='ticket_id'
        `);
        if (hasTicketId.length) {
            await q.query(`ALTER TABLE installation_schedules DROP COLUMN ticket_id`);
        }
    }
    async down(_q: QueryRunner): Promise<void> { /* no-op */ }
}
```

- [ ] **Step 3: Delete fisik file TS**

```bash
rm -rf apps/backend/src/modules/ict-budget
rm apps/backend/src/modules/ticketing/entities/installation-schedule.entity.ts
rm apps/backend/src/modules/ticketing/services/hardware-scheduler.service.ts
rm apps/backend/src/modules/ticketing/listeners/installation-notification.listener.ts
```

Hapus import di `ticketing.module.ts` dan `app.module.ts` (`IctBudgetModule` import + registrasi).

- [ ] **Step 4: Build + full test suite**

```bash
pnpm --filter backend build
pnpm --filter backend test
pnpm --filter backend test:integration
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(hardware-request): drop ict-budget + ticketing schedule residue"
```

---

## Task 5.7: Route redirect (backend-side deprecation shim)

**Files:** Modify `apps/backend/src/main.ts`.

Tujuan: bila client lama masih call `/api/ict-budget/*` → 410 Gone dengan pointer ke endpoint baru.

- [ ] **Step 1: Express middleware**

```typescript
app.use((req, res, next) => {
    if (req.path.startsWith('/api/ict-budget')) {
        return res.status(410).json({
            success: false,
            error: 'This module has been replaced by /api/hardware-requests',
        });
    }
    next();
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/main.ts
git commit -m "feat(hardware-request): 410 Gone for /api/ict-budget"
```

---

## Task 5.8: Seed initial catalog

**Files:** Create `migrations/1776000302000-SeedHardwareCatalog.ts`

- [ ] **Step 1: Seed**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedHardwareCatalog1776000302000 implements MigrationInterface {
    name = 'SeedHardwareCatalog1776000302000';

    async up(q: QueryRunner): Promise<void> {
        const items = [
            ['LAPTOP_STD', 'Laptop Standard', 'LAPTOP'],
            ['LAPTOP_DESIGN', 'Laptop Design/Heavy', 'LAPTOP'],
            ['MONITOR_24', 'Monitor 24"', 'MONITOR'],
            ['MONITOR_27', 'Monitor 27"', 'MONITOR'],
            ['MOUSE_STD', 'Mouse', 'ACCESSORY'],
            ['KEYBOARD_STD', 'Keyboard', 'ACCESSORY'],
            ['HEADSET_STD', 'Headset', 'ACCESSORY'],
            ['NET_CABLE', 'Network Cable', 'NETWORK'],
            ['NET_AP', 'Access Point', 'NETWORK'],
            ['SW_LICENSE_GEN', 'Software License (Generic)', 'SOFTWARE'],
        ];
        let order = 10;
        for (const [code, name, category] of items) {
            await q.query(
                `INSERT INTO hardware_catalogs (code, name, category, display_order, active, created_at, updated_at)
                 VALUES ($1, $2, $3::item_category_enum, $4, TRUE, NOW(), NOW())
                 ON CONFLICT (code) DO NOTHING`,
                [code, name, category, order],
            );
            order += 10;
        }
    }
    async down(q: QueryRunner): Promise<void> {
        await q.query(`DELETE FROM hardware_catalogs WHERE code IN (
            'LAPTOP_STD','LAPTOP_DESIGN','MONITOR_24','MONITOR_27','MOUSE_STD',
            'KEYBOARD_STD','HEADSET_STD','NET_CABLE','NET_AP','SW_LICENSE_GEN'
        )`);
    }
}
```

- [ ] **Step 2: Run + verify**

```bash
pnpm --filter backend typeorm migration:run
psql $DB_URL -c "SELECT code, name FROM hardware_catalogs ORDER BY display_order"
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(hardware-request): seed initial catalog"
```

---

## Task 5.9: Module wiring cleanup

**Files:** Modify `hardware-request.module.ts`, `app.module.ts`.

- [ ] **Step 1: Pastikan `HardwareDashboardService` + controller + catalog admin terdaftar**

```typescript
providers: [..., HardwareDashboardService]
controllers: [..., HardwareDashboardController]
```

- [ ] **Step 2: `app.module.ts` — hapus `IctBudgetModule` dari `imports`.**

- [ ] **Step 3: Build + smoke**

```bash
pnpm --filter backend build
pnpm --filter backend start:dev
# curl http://localhost:3000/api/hardware-requests/dashboard/kpi
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore(hardware-request): module wiring cleanup"
```

---

## Task 5.10: Integration test — dashboard aggregates

**Files:** Create `test/integration/hr-dashboard.e2e-spec.ts`.

- [ ] **Step 1: Test**

```typescript
describe('Dashboard aggregator', () => {
    // seed 10 requests (mix status), 4 schedules, 3 items
    // GET /hardware-requests/dashboard/kpi → assert shape
    // GET /hardware-requests/dashboard/status-distribution → assert includes SUBMITTED count
    // GET /hardware-requests/dashboard/aging?thresholdDays=1 → assert filter
    // GET /hardware-requests/dashboard/top-categories?range=30d → assert top >0
});
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter backend test:integration -- hr-dashboard
git add -A && git commit -m "test(hardware-request): dashboard aggregator e2e"
```

---

## Verification Checklist (Plan 5)

- [ ] `/dashboard/kpi` returns 4 counters
- [ ] `/dashboard/status-distribution` sum = total requests
- [ ] `/dashboard/aging` filter correct
- [ ] `/dashboard/top-categories?range=30d` response stable
- [ ] `/dashboard/weekly-schedule` returns current week events
- [ ] `/dashboard/technician-workload` active+completed30 accurate
- [ ] Catalog POST/PATCH/DELETE ICT_LEAD only
- [ ] `ict_budget` data migrated, tables dropped
- [ ] `/api/ict-budget/*` → 410 Gone
- [ ] Seed catalog hadir (10 baris)
- [ ] Backend build hijau, full test pass

**Next:** Plan 6 — Frontend Core (List, Create Wizard, Detail).
