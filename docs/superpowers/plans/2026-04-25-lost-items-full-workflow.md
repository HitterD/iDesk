# Lost Items Full Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement end-to-end Lost Items workflow — reporter submits report with photos + QR, finder submits found claim, manager reviews side-by-side and confirms return.

**Architecture:** Extend existing `lost-item` NestJS module with 2 new entities (FoundItemClaim, LostItemStatusLog), add QR token + photoUrls to LostItemReport, create FoundClaimService/Controller; wire 6 frontend pages using existing Multer upload infra.

**Tech Stack:** NestJS + TypeORM (backend), React + TanStack Query + Framer Motion (frontend), Multer diskStorage `./uploads/lost-items/`, `qrcode.react` for QR rendering.

**Spec:** `docs/superpowers/specs/2026-04-25-lost-items-design.md`

---

## File Map

### Backend — Create
- `apps/backend/src/migrations/1777200000001-LostItemFullWorkflow.ts`
- `apps/backend/src/modules/lost-item/entities/found-item-claim.entity.ts`
- `apps/backend/src/modules/lost-item/entities/lost-item-status-log.entity.ts`
- `apps/backend/src/modules/lost-item/dto/found-claim.dto.ts`
- `apps/backend/src/modules/lost-item/found-claim.service.ts`
- `apps/backend/src/modules/lost-item/found-claim.controller.ts`

### Backend — Modify
- `apps/backend/src/modules/lost-item/entities/lost-item-report.entity.ts`
- `apps/backend/src/modules/lost-item/dto/lost-item.dto.ts`
- `apps/backend/src/modules/lost-item/dto/index.ts`
- `apps/backend/src/modules/lost-item/lost-item.service.ts`
- `apps/backend/src/modules/lost-item/lost-item.controller.ts`
- `apps/backend/src/modules/lost-item/lost-item.module.ts`
- `apps/backend/src/app.module.ts` (register new entities)

### Frontend — Create
- `apps/frontend/src/features/request-center/api/found-claim.api.ts`
- `apps/frontend/src/features/request-center/components/PhotoUploader.tsx`
- `apps/frontend/src/features/request-center/pages/MyLostReportsPage.tsx`
- `apps/frontend/src/features/request-center/pages/ReportFoundItemPage.tsx`
- `apps/frontend/src/features/request-center/pages/FoundClaimsQueuePage.tsx`
- `apps/frontend/src/features/request-center/components/MatchReviewPanel.tsx`

### Frontend — Modify
- `apps/frontend/src/features/request-center/api/lost-item.api.ts`
- `apps/frontend/src/features/request-center/pages/LostItemListPage.tsx`
- `apps/frontend/src/routes/AppRoutes.tsx`
- `apps/frontend/src/components/layout/BentoSidebar.tsx`
- `apps/frontend/src/components/layout/ManagerSidebar.tsx`

---

## Task 1: Database Migration

**Files:**
- Create: `apps/backend/src/migrations/1777200000001-LostItemFullWorkflow.ts`

- [ ] **Step 1: Create migration file**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class LostItemFullWorkflow1777200000001 implements MigrationInterface {
    name = 'LostItemFullWorkflow1777200000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add columns to lost_item_reports
        await queryRunner.query(`ALTER TABLE "lost_item_reports" ADD COLUMN IF NOT EXISTS "photo_urls" text[] DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" ADD COLUMN IF NOT EXISTS "qr_code_token" varchar UNIQUE`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" ADD COLUMN IF NOT EXISTS "qr_code_url" varchar`);

        // Add new enum values to lost_item_status
        await queryRunner.query(`ALTER TYPE "lost_item_status_enum" ADD VALUE IF NOT EXISTS 'CLAIMED'`);
        await queryRunner.query(`ALTER TYPE "lost_item_status_enum" ADD VALUE IF NOT EXISTS 'VERIFIED'`);
        await queryRunner.query(`ALTER TYPE "lost_item_status_enum" ADD VALUE IF NOT EXISTS 'RETURNED'`);

        // Create found_item_claims table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "found_item_claims" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "finder_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "lost_item_report_id" uuid REFERENCES "lost_item_reports"("id") ON DELETE SET NULL,
                "location_found" text NOT NULL,
                "found_at" timestamp NOT NULL,
                "description" text NOT NULL,
                "photo_urls" text[] DEFAULT '{}',
                "status" varchar NOT NULL DEFAULT 'PENDING',
                "manager_notes" text,
                "matched_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
                "matched_at" timestamp,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now()
            )
        `);

        // Create lost_item_status_logs table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "lost_item_status_logs" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "lost_item_report_id" uuid NOT NULL REFERENCES "lost_item_reports"("id") ON DELETE CASCADE,
                "from_status" varchar,
                "to_status" varchar NOT NULL,
                "changed_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
                "notes" text,
                "timestamp" timestamp NOT NULL DEFAULT now()
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "lost_item_status_logs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "found_item_claims"`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" DROP COLUMN IF EXISTS "qr_code_url"`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" DROP COLUMN IF EXISTS "qr_code_token"`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" DROP COLUMN IF EXISTS "photo_urls"`);
    }
}
```

- [ ] **Step 2: Run migration**

```bash
cd apps/backend && npm run migration:run
```

Expected: `Migration LostItemFullWorkflow1777200000001 has been executed successfully.`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/migrations/1777200000001-LostItemFullWorkflow.ts
git commit -m "feat(lost-item): add migration for photos, qr, found-claims, status-logs"
```

---

## Task 2: Update LostItemReport Entity + Add New Entities

**Files:**
- Modify: `apps/backend/src/modules/lost-item/entities/lost-item-report.entity.ts`
- Create: `apps/backend/src/modules/lost-item/entities/found-item-claim.entity.ts`
- Create: `apps/backend/src/modules/lost-item/entities/lost-item-status-log.entity.ts`

- [ ] **Step 1: Update LostItemReport entity**

Replace the entire file `apps/backend/src/modules/lost-item/entities/lost-item-report.entity.ts`:

```typescript
import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
    UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Ticket } from '../../ticketing/entities/ticket.entity';

export enum LostItemStatus {
    REPORTED = 'REPORTED',
    SEARCHING = 'SEARCHING',
    CLAIMED = 'CLAIMED',
    VERIFIED = 'VERIFIED',
    RETURNED = 'RETURNED',
    FOUND = 'FOUND',         // legacy — keep for existing data
    CLOSED_LOST = 'CLOSED_LOST',
}

@Entity('lost_item_reports')
export class LostItemReport {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    ticketId: string;

    @ManyToOne(() => Ticket)
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column()
    itemType: string;

    @Column()
    itemName: string;

    @Column({ type: 'varchar', nullable: true })
    serialNumber: string;

    @Column({ type: 'varchar', nullable: true })
    assetTag: string;

    @Column('text')
    lastSeenLocation: string;

    @Column()
    lastSeenDatetime: Date;

    @Column('text')
    circumstances: string;

    @Column({ nullable: true, type: 'text' })
    witnessContact: string;

    @Column({ default: false })
    hasPoliceReport: boolean;

    @Column({ type: 'varchar', nullable: true })
    policeReportNumber: string;

    @Column({ nullable: true })
    policeReportFile: string;

    @Column('decimal', { precision: 15, scale: 2, nullable: true })
    estimatedValue: number;

    @Column({ default: false })
    finderRewardOffered: boolean;

    @Column({ type: 'enum', enum: LostItemStatus, default: LostItemStatus.REPORTED })
    status: LostItemStatus;

    @Column({ type: 'timestamp', nullable: true })
    foundAt: Date | null;

    @Column({ nullable: true, type: 'text' })
    foundLocation: string | null;

    @Column({ type: 'varchar', nullable: true })
    foundBy: string | null;

    @Column({ type: 'text', array: true, default: [] })
    photoUrls: string[];

    @Column({ type: 'varchar', nullable: true, unique: true })
    qrCodeToken: string | null;

    @Column({ type: 'varchar', nullable: true })
    qrCodeUrl: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
```

- [ ] **Step 2: Create FoundItemClaim entity**

Create `apps/backend/src/modules/lost-item/entities/found-item-claim.entity.ts`:

```typescript
import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
    UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LostItemReport } from './lost-item-report.entity';

export enum FoundClaimStatus {
    PENDING = 'PENDING',
    MATCHED = 'MATCHED',
    RETURNED = 'RETURNED',
    REJECTED = 'REJECTED',
}

@Entity('found_item_claims')
export class FoundItemClaim {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    finderId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'finder_id' })
    finder: User;

    @Column({ type: 'uuid', nullable: true })
    lostItemReportId: string | null;

    @ManyToOne(() => LostItemReport, { nullable: true })
    @JoinColumn({ name: 'lost_item_report_id' })
    lostItemReport: LostItemReport | null;

    @Column('text')
    locationFound: string;

    @Column()
    foundAt: Date;

    @Column('text')
    description: string;

    @Column({ type: 'text', array: true, default: [] })
    photoUrls: string[];

    @Column({ type: 'varchar', default: FoundClaimStatus.PENDING })
    status: FoundClaimStatus;

    @Column({ type: 'text', nullable: true })
    managerNotes: string | null;

    @Column({ type: 'uuid', nullable: true })
    matchedById: string | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'matched_by_id' })
    matchedBy: User | null;

    @Column({ type: 'timestamp', nullable: true })
    matchedAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
```

- [ ] **Step 3: Create LostItemStatusLog entity**

Create `apps/backend/src/modules/lost-item/entities/lost-item-status-log.entity.ts`:

```typescript
import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
    ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LostItemReport } from './lost-item-report.entity';

@Entity('lost_item_status_logs')
export class LostItemStatusLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    lostItemReportId: string;

    @ManyToOne(() => LostItemReport)
    @JoinColumn({ name: 'lost_item_report_id' })
    lostItemReport: LostItemReport;

    @Column({ type: 'varchar', nullable: true })
    fromStatus: string | null;

    @Column()
    toStatus: string;

    @Column({ type: 'uuid', nullable: true })
    changedById: string | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'changed_by_id' })
    changedBy: User | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @CreateDateColumn()
    timestamp: Date;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/lost-item/entities/
git commit -m "feat(lost-item): add FoundItemClaim + LostItemStatusLog entities, update LostItemReport"
```

---

## Task 3: Update DTOs

**Files:**
- Modify: `apps/backend/src/modules/lost-item/dto/lost-item.dto.ts`
- Create: `apps/backend/src/modules/lost-item/dto/found-claim.dto.ts`
- Modify: `apps/backend/src/modules/lost-item/dto/index.ts`

- [ ] **Step 1: Update lost-item.dto.ts**

Replace `apps/backend/src/modules/lost-item/dto/lost-item.dto.ts`:

```typescript
import { IsString, IsOptional, IsBoolean, IsNumber, IsDateString, Min, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLostItemDto {
    @IsString() itemType: string;
    @IsString() itemName: string;
    @IsOptional() @IsString() serialNumber?: string;
    @IsOptional() @IsString() assetTag?: string;
    @IsString() lastSeenLocation: string;
    @IsDateString() lastSeenDatetime: string;
    @IsString() circumstances: string;
    @IsOptional() @IsString() witnessContact?: string;
    @IsOptional() @IsBoolean() hasPoliceReport?: boolean;
    @IsOptional() @IsString() policeReportNumber?: string;
    @IsOptional() @IsNumber() @Type(() => Number) @Min(0) estimatedValue?: number;
    @IsOptional() @IsBoolean() finderRewardOffered?: boolean;
    @IsOptional() @IsString() title?: string;
    @IsOptional() @IsString() description?: string;
    // photoUrls populated by controller after file upload
    @IsOptional() @IsArray() @IsString({ each: true }) photoUrls?: string[];
}

export class UpdateLostItemStatusDto {
    @IsString() status: string;
    @IsOptional() @IsString() foundLocation?: string;
    @IsOptional() @IsString() foundBy?: string;
    @IsOptional() @IsString() notes?: string;
}
```

- [ ] **Step 2: Create found-claim.dto.ts**

Create `apps/backend/src/modules/lost-item/dto/found-claim.dto.ts`:

```typescript
import { IsString, IsOptional, IsDateString, IsUUID, IsArray } from 'class-validator';

export class CreateFoundClaimDto {
    @IsOptional() @IsUUID() lostItemReportId?: string;
    @IsString() locationFound: string;
    @IsDateString() foundAt: string;
    @IsString() description: string;
    @IsOptional() @IsArray() @IsString({ each: true }) photoUrls?: string[];
}

export class MatchFoundClaimDto {
    @IsOptional() @IsUUID() lostItemReportId?: string;
    @IsOptional() @IsString() notes?: string;
}

export class RejectFoundClaimDto {
    @IsString() notes: string;
}
```

- [ ] **Step 3: Update dto/index.ts**

Replace `apps/backend/src/modules/lost-item/dto/index.ts`:

```typescript
export * from './lost-item.dto';
export * from './found-claim.dto';
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/lost-item/dto/
git commit -m "feat(lost-item): update DTOs, add found-claim DTOs"
```

---

## Task 4: Update LostItemService

**Files:**
- Modify: `apps/backend/src/modules/lost-item/lost-item.service.ts`

- [ ] **Step 1: Replace lost-item.service.ts**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { LostItemReport, LostItemStatus } from './entities/lost-item-report.entity';
import { LostItemStatusLog } from './entities/lost-item-status-log.entity';
import { Ticket, TicketType, TicketStatus } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { CreateLostItemDto, UpdateLostItemStatusDto } from './dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LostItemService {
    constructor(
        private readonly auditService: AuditService,
        private readonly configService: ConfigService,
        @InjectRepository(LostItemReport)
        private readonly lostItemRepo: Repository<LostItemReport>,
        @InjectRepository(LostItemStatusLog)
        private readonly statusLogRepo: Repository<LostItemStatusLog>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    private generateQrToken(): string {
        return randomUUID();
    }

    private buildQrUrl(token: string): string {
        const base = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
        return `${base}/found?r=${token}`;
    }

    private async logStatusChange(
        lostItemReportId: string,
        fromStatus: string | null,
        toStatus: string,
        changedById?: string,
        notes?: string,
    ): Promise<void> {
        const log = this.statusLogRepo.create({
            lostItemReportId,
            fromStatus,
            toStatus,
            changedById: changedById ?? null,
            notes: notes ?? null,
        });
        await this.statusLogRepo.save(log);
    }

    async create(userId: string, dto: CreateLostItemDto): Promise<LostItemReport> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const ticket = this.ticketRepo.create({
            title: dto.title || `Lost Item Report: ${dto.itemName}`,
            description: dto.description || `${dto.itemType} hilang di ${dto.lastSeenLocation}`,
            ticketType: TicketType.LOST_ITEM,
            status: TicketStatus.TODO,
            priority: 'HIGH',
            category: 'LOST_ITEM',
            userId,
            siteId: user.siteId,
        } as Partial<Ticket>);
        const savedTicket = await this.ticketRepo.save(ticket);

        const qrCodeToken = this.generateQrToken();
        const qrCodeUrl = this.buildQrUrl(qrCodeToken);

        const lostItem = this.lostItemRepo.create({
            ticketId: savedTicket.id,
            itemType: dto.itemType,
            itemName: dto.itemName,
            serialNumber: dto.serialNumber,
            assetTag: dto.assetTag,
            lastSeenLocation: dto.lastSeenLocation,
            lastSeenDatetime: new Date(dto.lastSeenDatetime),
            circumstances: dto.circumstances,
            witnessContact: dto.witnessContact,
            hasPoliceReport: dto.hasPoliceReport || false,
            policeReportNumber: dto.policeReportNumber,
            estimatedValue: dto.estimatedValue,
            finderRewardOffered: dto.finderRewardOffered || false,
            photoUrls: dto.photoUrls || [],
            qrCodeToken,
            qrCodeUrl,
            status: LostItemStatus.REPORTED,
        } as Partial<LostItemReport>);
        const saved = await this.lostItemRepo.save(lostItem);

        await this.logStatusChange(saved.id, null, LostItemStatus.REPORTED, userId, 'Report created');

        this.eventEmitter.emit('lost-item.created', { lostItem: saved, ticket: savedTicket, user });
        this.auditService.logAsync({
            userId,
            action: AuditAction.LOST_ITEM_CREATE,
            entityType: 'LostItemReport',
            entityId: saved.id,
            description: `Created lost item report for ${dto.itemName}`,
            newValue: { itemName: dto.itemName, itemType: dto.itemType },
        });

        return saved;
    }

    async findAll(options: { siteId?: string; status?: string } = {}): Promise<LostItemReport[]> {
        const qb = this.lostItemRepo.createQueryBuilder('r')
            .leftJoinAndSelect('r.ticket', 'ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .orderBy('r.createdAt', 'DESC');
        if (options.status) qb.andWhere('r.status = :status', { status: options.status });
        if (options.siteId) qb.andWhere('ticket.siteId = :siteId', { siteId: options.siteId });
        return qb.getMany();
    }

    async findMy(userId: string): Promise<LostItemReport[]> {
        return this.lostItemRepo.createQueryBuilder('r')
            .leftJoinAndSelect('r.ticket', 'ticket')
            .where('ticket.userId = :userId', { userId })
            .orderBy('r.createdAt', 'DESC')
            .getMany();
    }

    async findOne(id: string): Promise<LostItemReport & { statusLogs: LostItemStatusLog[] }> {
        const lostItem = await this.lostItemRepo.findOne({
            where: { id },
            relations: ['ticket', 'ticket.user'],
        });
        if (!lostItem) throw new NotFoundException('Lost Item report not found');

        const statusLogs = await this.statusLogRepo.find({
            where: { lostItemReportId: id },
            relations: ['changedBy'],
            order: { timestamp: 'ASC' },
        });

        return { ...lostItem, statusLogs };
    }

    async findByTicketId(ticketId: string): Promise<LostItemReport | null> {
        return this.lostItemRepo.findOne({ where: { ticketId }, relations: ['ticket'] });
    }

    async findByQrToken(token: string): Promise<{ reportId: string; itemName: string; itemType: string; photoUrls: string[] }> {
        const report = await this.lostItemRepo.findOne({ where: { qrCodeToken: token } });
        if (!report) throw new NotFoundException('QR code not found or expired');
        return {
            reportId: report.id,
            itemName: report.itemName,
            itemType: report.itemType,
            photoUrls: report.photoUrls,
        };
    }

    async updateStatus(id: string, dto: UpdateLostItemStatusDto, userId?: string): Promise<LostItemReport> {
        const lostItem = await this.lostItemRepo.findOne({ where: { id } });
        if (!lostItem) throw new NotFoundException('Lost Item report not found');

        const prevStatus = lostItem.status;
        lostItem.status = dto.status as LostItemStatus;

        if (dto.status === LostItemStatus.VERIFIED || dto.status === LostItemStatus.FOUND) {
            lostItem.foundAt = new Date();
            lostItem.foundLocation = dto.foundLocation || null;
            lostItem.foundBy = dto.foundBy || null;
        }
        if (dto.status === LostItemStatus.RETURNED) {
            await this.ticketRepo.update(lostItem.ticketId, {
                status: TicketStatus.RESOLVED,
                resolvedAt: new Date(),
            });
        }
        if (dto.status === LostItemStatus.CLOSED_LOST) {
            await this.ticketRepo.update(lostItem.ticketId, { status: TicketStatus.CANCELLED });
        }

        const saved = await this.lostItemRepo.save(lostItem);
        await this.logStatusChange(id, prevStatus, dto.status, userId, dto.notes);
        this.eventEmitter.emit('lost-item.status-updated', { lostItem: saved, newStatus: dto.status });
        return saved;
    }

    async uploadPoliceReport(id: string, filePath: string, reportNumber: string): Promise<LostItemReport> {
        const lostItem = await this.lostItemRepo.findOne({ where: { id } });
        if (!lostItem) throw new NotFoundException('Lost Item report not found');
        lostItem.hasPoliceReport = true;
        lostItem.policeReportNumber = reportNumber;
        lostItem.policeReportFile = filePath;
        return this.lostItemRepo.save(lostItem);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/lost-item/lost-item.service.ts
git commit -m "feat(lost-item): add QR generation, status log, findMy, findByQrToken to service"
```

---

## Task 5: Create FoundClaimService

**Files:**
- Create: `apps/backend/src/modules/lost-item/found-claim.service.ts`

- [ ] **Step 1: Create found-claim.service.ts**

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FoundItemClaim, FoundClaimStatus } from './entities/found-item-claim.entity';
import { LostItemReport, LostItemStatus } from './entities/lost-item-report.entity';
import { LostItemStatusLog } from './entities/lost-item-status-log.entity';
import { CreateFoundClaimDto, MatchFoundClaimDto, RejectFoundClaimDto } from './dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class FoundClaimService {
    constructor(
        @InjectRepository(FoundItemClaim)
        private readonly claimRepo: Repository<FoundItemClaim>,
        @InjectRepository(LostItemReport)
        private readonly reportRepo: Repository<LostItemReport>,
        @InjectRepository(LostItemStatusLog)
        private readonly statusLogRepo: Repository<LostItemStatusLog>,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    private async logReportStatus(reportId: string, from: string, to: string, managerId: string, notes?: string) {
        const log = this.statusLogRepo.create({ lostItemReportId: reportId, fromStatus: from, toStatus: to, changedById: managerId, notes });
        await this.statusLogRepo.save(log);
    }

    async create(finderId: string, dto: CreateFoundClaimDto): Promise<FoundItemClaim> {
        // Auto-hint: check serial/asset match
        let lostItemReportId = dto.lostItemReportId ?? null;

        const claim = this.claimRepo.create({
            finderId,
            lostItemReportId,
            locationFound: dto.locationFound,
            foundAt: new Date(dto.foundAt),
            description: dto.description,
            photoUrls: dto.photoUrls || [],
            status: FoundClaimStatus.PENDING,
        } as Partial<FoundItemClaim>);
        const saved = await this.claimRepo.save(claim);

        if (lostItemReportId) {
            const report = await this.reportRepo.findOne({ where: { id: lostItemReportId } });
            if (report && report.status === LostItemStatus.REPORTED || report?.status === LostItemStatus.SEARCHING) {
                report.status = LostItemStatus.CLAIMED;
                await this.reportRepo.save(report);
                await this.logReportStatus(lostItemReportId, report.status, LostItemStatus.CLAIMED, finderId, 'Found claim submitted');
            }
        }

        this.eventEmitter.emit('found-claim.created', { claim: saved });
        return saved;
    }

    async findAll(options: { status?: string } = {}): Promise<FoundItemClaim[]> {
        const qb = this.claimRepo.createQueryBuilder('c')
            .leftJoinAndSelect('c.finder', 'finder')
            .leftJoinAndSelect('c.lostItemReport', 'report')
            .leftJoinAndSelect('c.matchedBy', 'matchedBy')
            .orderBy('c.createdAt', 'DESC');
        if (options.status) qb.andWhere('c.status = :status', { status: options.status });
        return qb.getMany();
    }

    async findMy(finderId: string): Promise<FoundItemClaim[]> {
        return this.claimRepo.find({
            where: { finderId },
            relations: ['lostItemReport'],
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string): Promise<FoundItemClaim> {
        const claim = await this.claimRepo.findOne({
            where: { id },
            relations: ['finder', 'lostItemReport', 'matchedBy'],
        });
        if (!claim) throw new NotFoundException('Found claim not found');
        return claim;
    }

    async match(id: string, dto: MatchFoundClaimDto, managerId: string): Promise<FoundItemClaim> {
        const claim = await this.findOne(id);
        if (claim.status !== FoundClaimStatus.PENDING) {
            throw new BadRequestException('Claim is not in PENDING status');
        }

        const reportId = dto.lostItemReportId ?? claim.lostItemReportId;
        if (!reportId) throw new BadRequestException('lostItemReportId required for unlinked claims');

        const report = await this.reportRepo.findOne({ where: { id: reportId } });
        if (!report) throw new NotFoundException('Lost item report not found');

        claim.status = FoundClaimStatus.MATCHED;
        claim.lostItemReportId = reportId;
        claim.matchedById = managerId;
        claim.matchedAt = new Date();
        claim.managerNotes = dto.notes ?? null;

        const prevReportStatus = report.status;
        report.status = LostItemStatus.VERIFIED;
        report.foundAt = new Date();

        await this.reportRepo.save(report);
        const saved = await this.claimRepo.save(claim);

        await this.logReportStatus(reportId, prevReportStatus, LostItemStatus.VERIFIED, managerId, dto.notes);
        this.eventEmitter.emit('found-claim.matched', { claim: saved, report });
        return saved;
    }

    async reject(id: string, dto: RejectFoundClaimDto, managerId: string): Promise<FoundItemClaim> {
        const claim = await this.findOne(id);
        if (claim.status !== FoundClaimStatus.PENDING) {
            throw new BadRequestException('Claim is not in PENDING status');
        }

        claim.status = FoundClaimStatus.REJECTED;
        claim.matchedById = managerId;
        claim.matchedAt = new Date();
        claim.managerNotes = dto.notes;

        const saved = await this.claimRepo.save(claim);
        this.eventEmitter.emit('found-claim.rejected', { claim: saved });
        return saved;
    }

    async confirmReturn(id: string, managerId: string): Promise<FoundItemClaim> {
        const claim = await this.findOne(id);
        if (claim.status !== FoundClaimStatus.MATCHED) {
            throw new BadRequestException('Claim must be MATCHED before confirming return');
        }

        claim.status = FoundClaimStatus.RETURNED;
        const saved = await this.claimRepo.save(claim);

        if (claim.lostItemReportId) {
            const report = await this.reportRepo.findOne({ where: { id: claim.lostItemReportId } });
            if (report) {
                const prevStatus = report.status;
                report.status = LostItemStatus.RETURNED;
                await this.reportRepo.save(report);
                await this.logReportStatus(claim.lostItemReportId, prevStatus, LostItemStatus.RETURNED, managerId, 'Item physically returned');
            }
        }

        this.eventEmitter.emit('found-claim.returned', { claim: saved });
        return saved;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/lost-item/found-claim.service.ts
git commit -m "feat(lost-item): add FoundClaimService with match/reject/return logic"
```

---

## Task 6: Update LostItemController + Create FoundClaimController

**Files:**
- Modify: `apps/backend/src/modules/lost-item/lost-item.controller.ts`
- Create: `apps/backend/src/modules/lost-item/found-claim.controller.ts`

- [ ] **Step 1: Replace lost-item.controller.ts**

```typescript
import {
    Controller, Get, Post, Body, Patch, Param, Query,
    UseGuards, Request, ParseUUIDPipe, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { LostItemService } from './lost-item.service';
import { CreateLostItemDto, UpdateLostItemStatusDto } from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { MULTER_OPTIONS, FILE_SIZE_LIMITS } from '../../shared/core/config/upload.config';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';

@ApiTags('Lost Item')
@ApiBearerAuth()
@Controller('lost-item')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LostItemController {
    constructor(
        private readonly lostItemService: LostItemService,
        private readonly configService: ConfigService,
    ) {}

    // NOTE: Static routes MUST come before /:id to avoid NestJS matching 'my' as a UUID param

    @Get('my')
    @ApiOperation({ summary: 'Get my lost item reports' })
    findMy(@Request() req: any) {
        return this.lostItemService.findMy(req.user.userId);
    }

    @Get('qr/:token')
    @ApiOperation({ summary: 'Resolve QR token to report info' })
    findByQrToken(@Param('token') token: string) {
        return this.lostItemService.findByQrToken(token);
    }

    @Post()
    @ApiOperation({ summary: 'Create Lost Item report with optional photos' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FilesInterceptor('photos', 5, {
        storage: diskStorage({
            destination: './uploads/lost-items',
            filename: (req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
        }),
        limits: { fileSize: FILE_SIZE_LIMITS.IMAGE },
    }))
    async create(
        @Request() req: any,
        @Body() dto: CreateLostItemDto,
        @UploadedFiles() photos: Express.Multer.File[],
    ) {
        const baseUrl = this.configService.get<string>('API_URL', 'http://localhost:5050');
        const photoUrls = (photos || []).map(f => `${baseUrl}/uploads/lost-items/${f.filename}`);
        return this.lostItemService.create(req.user.userId, { ...dto, photoUrls });
    }

    @Get()
    @ApiOperation({ summary: 'Get all Lost Item reports (manager)' })
    @ApiQuery({ name: 'siteId', required: false })
    @ApiQuery({ name: 'status', required: false })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    findAll(@Query('siteId') siteId?: string, @Query('status') status?: string) {
        return this.lostItemService.findAll({ siteId, status });
    }

    @Get('ticket/:ticketId')
    @ApiOperation({ summary: 'Get Lost Item report by ticket ID' })
    findByTicketId(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
        return this.lostItemService.findByTicketId(ticketId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get Lost Item report by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.lostItemService.findOne(id);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update Lost Item status' })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateLostItemStatusDto,
        @Request() req: any,
    ) {
        return this.lostItemService.updateStatus(id, dto, req.user.userId);
    }

    @Post(':id/police-report')
    @ApiOperation({ summary: 'Upload police report' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FilesInterceptor('file', 1, {
        storage: diskStorage({
            destination: './uploads/police-reports',
            filename: (req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
        }),
    }))
    uploadPoliceReport(
        @Param('id', ParseUUIDPipe) id: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body('reportNumber') reportNumber: string,
    ) {
        const file = files?.[0];
        if (!file) throw new Error('No file uploaded');
        return this.lostItemService.uploadPoliceReport(id, `/uploads/police-reports/${file.filename}`, reportNumber);
    }
}
```

- [ ] **Step 2: Create found-claim.controller.ts**

```typescript
import {
    Controller, Get, Post, Body, Patch, Param, Query,
    UseGuards, Request, ParseUUIDPipe, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FoundClaimService } from './found-claim.service';
import { CreateFoundClaimDto, MatchFoundClaimDto, RejectFoundClaimDto } from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { FILE_SIZE_LIMITS } from '../../shared/core/config/upload.config';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';

@ApiTags('Found Claims')
@ApiBearerAuth()
@Controller('found-claim')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FoundClaimController {
    constructor(
        private readonly foundClaimService: FoundClaimService,
        private readonly configService: ConfigService,
    ) {}

    @Get('my')
    @ApiOperation({ summary: 'Get my found claims' })
    findMy(@Request() req: any) {
        return this.foundClaimService.findMy(req.user.userId);
    }

    @Post()
    @ApiOperation({ summary: 'Submit a found item claim' })
    @UseInterceptors(FilesInterceptor('photos', 5, {
        storage: diskStorage({
            destination: './uploads/found-items',
            filename: (req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
        }),
        limits: { fileSize: FILE_SIZE_LIMITS.IMAGE },
    }))
    async create(
        @Request() req: any,
        @Body() dto: CreateFoundClaimDto,
        @UploadedFiles() photos: Express.Multer.File[],
    ) {
        const baseUrl = this.configService.get<string>('API_URL', 'http://localhost:5050');
        const photoUrls = (photos || []).map(f => `${baseUrl}/uploads/found-items/${f.filename}`);
        return this.foundClaimService.create(req.user.userId, { ...dto, photoUrls });
    }

    @Get()
    @ApiOperation({ summary: 'List all found claims (manager)' })
    @ApiQuery({ name: 'status', required: false })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    findAll(@Query('status') status?: string) {
        return this.foundClaimService.findAll({ status });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get found claim by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.foundClaimService.findOne(id);
    }

    @Patch(':id/match')
    @ApiOperation({ summary: 'Match found claim to lost report' })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    match(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: MatchFoundClaimDto,
        @Request() req: any,
    ) {
        return this.foundClaimService.match(id, dto, req.user.userId);
    }

    @Patch(':id/reject')
    @ApiOperation({ summary: 'Reject found claim' })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    reject(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: RejectFoundClaimDto,
        @Request() req: any,
    ) {
        return this.foundClaimService.reject(id, dto, req.user.userId);
    }

    @Patch(':id/returned')
    @ApiOperation({ summary: 'Confirm physical handover' })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    confirmReturn(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
        return this.foundClaimService.confirmReturn(id, req.user.userId);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/lost-item/lost-item.controller.ts apps/backend/src/modules/lost-item/found-claim.controller.ts
git commit -m "feat(lost-item): update LostItemController, add FoundClaimController"
```

---

## Task 7: Update LostItemModule + AppModule

**Files:**
- Modify: `apps/backend/src/modules/lost-item/lost-item.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Replace lost-item.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LostItemReport } from './entities/lost-item-report.entity';
import { FoundItemClaim } from './entities/found-item-claim.entity';
import { LostItemStatusLog } from './entities/lost-item-status-log.entity';
import { LostItemService } from './lost-item.service';
import { FoundClaimService } from './found-claim.service';
import { LostItemController } from './lost-item.controller';
import { FoundClaimController } from './found-claim.controller';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([LostItemReport, FoundItemClaim, LostItemStatusLog, Ticket, User]),
        AuthModule,
        AuditModule,
    ],
    controllers: [LostItemController, FoundClaimController],
    providers: [LostItemService, FoundClaimService],
    exports: [LostItemService, FoundClaimService],
})
export class LostItemModule {}
```

- [ ] **Step 2: Register new entities in app.module.ts**

In `apps/backend/src/app.module.ts`, find the `entities` array in `TypeOrmModule.forRoot(...)` and add the new imports. Add near existing `LostItemReport` import:

```typescript
// Add these imports near the existing lost-item imports:
import { FoundItemClaim } from './modules/lost-item/entities/found-item-claim.entity';
import { LostItemStatusLog } from './modules/lost-item/entities/lost-item-status-log.entity';
```

Then add `FoundItemClaim` and `LostItemStatusLog` to the `entities` array in `TypeOrmModule.forRoot`.

- [ ] **Step 3: Create upload directory**

```bash
mkdir -p apps/backend/uploads/lost-items apps/backend/uploads/found-items
```

- [ ] **Step 4: Verify backend builds**

```bash
cd apps/backend && npm run build 2>&1 | tail -20
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/lost-item/lost-item.module.ts apps/backend/src/app.module.ts
git commit -m "feat(lost-item): wire module with new entities and services"
```

---

## Task 8: Frontend — Install qrcode.react + Update API Hooks

**Files:**
- Modify: `apps/frontend/src/features/request-center/api/lost-item.api.ts`
- Create: `apps/frontend/src/features/request-center/api/found-claim.api.ts`

- [ ] **Step 1: Install qrcode.react**

```bash
cd apps/frontend && npm install qrcode.react
```

- [ ] **Step 2: Replace lost-item.api.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export enum LostItemStatus {
    REPORTED = 'REPORTED',
    SEARCHING = 'SEARCHING',
    CLAIMED = 'CLAIMED',
    VERIFIED = 'VERIFIED',
    RETURNED = 'RETURNED',
    CLOSED_LOST = 'CLOSED_LOST',
}

export interface StatusLog {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedBy?: { fullName: string };
    notes?: string;
    timestamp: string;
}

export interface LostItemReport {
    id: string;
    ticketId?: string;
    itemName: string;
    itemType: string;
    serialNumber?: string;
    assetTag?: string;
    locationLost?: string;
    lastSeenLocation: string;
    lastSeenDatetime: string;
    description?: string;
    circumstances: string;
    status: LostItemStatus;
    photoUrls: string[];
    qrCodeUrl?: string;
    qrCodeToken?: string;
    foundAt?: string;
    foundLocation?: string;
    foundBy?: string;
    estimatedValue?: number;
    finderRewardOffered?: boolean;
    reporter?: { id: string; fullName: string; email?: string };
    ticket?: { user?: { fullName: string; email: string } };
    statusLogs?: StatusLog[];
    createdAt: string;
    updatedAt: string;
}

export const useLostItemReports = (filters?: { status?: LostItemStatus; reporterId?: string }) =>
    useQuery<LostItemReport[]>({
        queryKey: ['lost-item-reports', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.append('status', filters.status);
            if (filters?.reporterId) params.append('reporterId', filters.reporterId);
            const res = await api.get(`/lost-item?${params}`);
            return res.data;
        },
    });

export const useMyLostReports = () =>
    useQuery<LostItemReport[]>({
        queryKey: ['lost-item-reports', 'my'],
        queryFn: async () => {
            const res = await api.get('/lost-item/my');
            return res.data;
        },
    });

export const useLostItemReport = (id: string) =>
    useQuery<LostItemReport>({
        queryKey: ['lost-item-report', id],
        queryFn: async () => {
            const res = await api.get(`/lost-item/${id}`);
            return res.data;
        },
        enabled: !!id,
    });

export const useQrTokenReport = (token: string | null) =>
    useQuery<{ reportId: string; itemName: string; itemType: string; photoUrls: string[] }>({
        queryKey: ['lost-item-qr', token],
        queryFn: async () => {
            const res = await api.get(`/lost-item/qr/${token}`);
            return res.data;
        },
        enabled: !!token,
    });

export const useCreateLostItem = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await api.post('/lost-item', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lost-item-reports'] });
        },
    });
};

export const useUpdateLostItemStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, status, notes }: { id: string; status: LostItemStatus; notes?: string }) => {
            const res = await api.patch(`/lost-item/${id}/status`, { status, notes });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lost-item-reports'] });
        },
    });
};
```

- [ ] **Step 3: Create found-claim.api.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export enum FoundClaimStatus {
    PENDING = 'PENDING',
    MATCHED = 'MATCHED',
    RETURNED = 'RETURNED',
    REJECTED = 'REJECTED',
}

export interface FoundItemClaim {
    id: string;
    finderId: string;
    finder?: { fullName: string; email: string };
    lostItemReportId?: string;
    lostItemReport?: { id: string; itemName: string; itemType: string; photoUrls: string[] };
    locationFound: string;
    foundAt: string;
    description: string;
    photoUrls: string[];
    status: FoundClaimStatus;
    managerNotes?: string;
    matchedBy?: { fullName: string };
    matchedAt?: string;
    createdAt: string;
}

export const useFoundClaims = (filters?: { status?: FoundClaimStatus }) =>
    useQuery<FoundItemClaim[]>({
        queryKey: ['found-claims', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.append('status', filters.status);
            const res = await api.get(`/found-claim?${params}`);
            return res.data;
        },
    });

export const useMyFoundClaims = () =>
    useQuery<FoundItemClaim[]>({
        queryKey: ['found-claims', 'my'],
        queryFn: async () => {
            const res = await api.get('/found-claim/my');
            return res.data;
        },
    });

export const useFoundClaim = (id: string) =>
    useQuery<FoundItemClaim>({
        queryKey: ['found-claim', id],
        queryFn: async () => {
            const res = await api.get(`/found-claim/${id}`);
            return res.data;
        },
        enabled: !!id,
    });

export const useCreateFoundClaim = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await api.post('/found-claim', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['found-claims'] });
        },
    });
};

export const useMatchFoundClaim = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, lostItemReportId, notes }: { id: string; lostItemReportId?: string; notes?: string }) => {
            const res = await api.patch(`/found-claim/${id}/match`, { lostItemReportId, notes });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['found-claims'] });
            queryClient.invalidateQueries({ queryKey: ['lost-item-reports'] });
        },
    });
};

export const useRejectFoundClaim = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
            const res = await api.patch(`/found-claim/${id}/reject`, { notes });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['found-claims'] });
        },
    });
};

export const useConfirmReturn = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.patch(`/found-claim/${id}/returned`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['found-claims'] });
            queryClient.invalidateQueries({ queryKey: ['lost-item-reports'] });
        },
    });
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/request-center/api/
git commit -m "feat(lost-item): add frontend API hooks for lost-item and found-claim"
```

---

## Task 9: PhotoUploader Component

**Files:**
- Create: `apps/frontend/src/features/request-center/components/PhotoUploader.tsx`

- [ ] **Step 1: Create PhotoUploader.tsx**

```tsx
import React, { useRef, useState } from 'react';
import { ImagePlus, X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoUploaderProps {
    files: File[];
    onChange: (files: File[]) => void;
    maxFiles?: number;
    className?: string;
}

export const PhotoUploader = ({ files, onChange, maxFiles = 5, className }: PhotoUploaderProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const previews = files.map(f => URL.createObjectURL(f));

    const addFiles = (incoming: File[]) => {
        const valid = incoming.filter(f => f.type.startsWith('image/'));
        const next = [...files, ...valid].slice(0, maxFiles);
        onChange(next);
    };

    const remove = (idx: number) => {
        const next = files.filter((_, i) => i !== idx);
        onChange(next);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
    };

    return (
        <div className={cn('space-y-3', className)}>
            <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                    'border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors duration-150',
                    dragging
                        ? 'border-rose-400 bg-rose-50/20 dark:bg-rose-900/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-rose-400/50 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                    files.length >= maxFiles && 'opacity-50 pointer-events-none'
                )}
            >
                <Upload className="w-7 h-7 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {files.length >= maxFiles
                        ? `Max ${maxFiles} foto tercapai`
                        : `Drag & drop atau klik · max ${maxFiles} foto`}
                </p>
                <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP · max 5MB</p>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => addFiles(Array.from(e.target.files || []))}
            />

            {previews.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                    {previews.map((src, idx) => (
                        <div key={idx} className="relative group aspect-square">
                            <img
                                src={src}
                                alt={`photo-${idx}`}
                                className="w-full h-full object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                            />
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); remove(idx); }}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {files.length < maxFiles && (
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="aspect-square rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:border-rose-400 hover:text-rose-400 transition-colors"
                        >
                            <ImagePlus className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/components/PhotoUploader.tsx
git commit -m "feat(lost-item): add PhotoUploader component (drag & drop, max 5, preview)"
```

---

## Task 10: Wire LostItemListPage to Real API

**Files:**
- Modify: `apps/frontend/src/features/request-center/pages/LostItemListPage.tsx`

- [ ] **Step 1: Replace dummy data with real API hooks**

Replace the top of `LostItemListPage.tsx` — remove `DUMMY_LOST_ITEMS` and wire real data. The key changes:

1. Remove `const DUMMY_LOST_ITEMS = [...]`
2. Add hook calls at top of component:

```tsx
import { useLostItemReports, useUpdateLostItemStatus, LostItemStatus, LostItemReport } from '../api/lost-item.api';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

export const LostItemListPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<LostItemReport | null>(null);
    const [statusFilter, setStatusFilter] = useState('ALL');

    const { data: items = [], isLoading, refetch } = useLostItemReports(
        statusFilter !== 'ALL' ? { status: statusFilter as LostItemStatus } : undefined
    );
    const updateStatus = useUpdateLostItemStatus();

    const handleRefresh = () => { refetch(); toast.success('Reports updated'); };

    const filteredItems = useMemo(() => items.filter(item => {
        const name = item.ticket?.user?.fullName || '';
        const matchesSearch =
            item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    }), [items, searchQuery]);

    const stats = useMemo(() => ({
        total: items.length,
        reported: items.filter(i => i.status === LostItemStatus.REPORTED).length,
        found: items.filter(i => i.status === LostItemStatus.VERIFIED || i.status === LostItemStatus.RETURNED).length,
        lost: items.filter(i => i.status === LostItemStatus.CLOSED_LOST).length,
    }), [items]);
```

3. In the detail drawer footer, wire the "MARK AS FOUND" button:

```tsx
<button
    onClick={() => {
        if (!selectedItem) return;
        updateStatus.mutate(
            { id: selectedItem.id, status: LostItemStatus.VERIFIED },
            { onSuccess: () => { setSelectedItem(null); toast.success('Marked as found'); } }
        );
    }}
    disabled={updateStatus.isPending}
    className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-rose-600/20 disabled:opacity-50"
>
    {updateStatus.isPending ? 'UPDATING...' : 'MARK AS FOUND'}
</button>
<button
    onClick={() => {
        if (!selectedItem) return;
        updateStatus.mutate(
            { id: selectedItem.id, status: LostItemStatus.CLOSED_LOST },
            { onSuccess: () => { setSelectedItem(null); toast.success('Report closed'); } }
        );
    }}
    className="px-6 py-4 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-100 transition-colors duration-150"
>
    CLOSE REPORT
</button>
```

4. Add QR code display in detail drawer (inside the scrollable section, after Location & Time):

```tsx
{selectedItem?.qrCodeUrl && (
    <section>
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4">QR Code</h3>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-3">
            <QRCodeSVG value={selectedItem.qrCodeUrl} size={120} />
            <p className="text-xs text-slate-400 text-center">Finder scan untuk lapor temuan</p>
        </div>
    </section>
)}
```

5. Add loading state:

```tsx
if (isLoading) return (
    <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
    </div>
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/LostItemListPage.tsx
git commit -m "feat(lost-item): wire LostItemListPage to real API, add QR display, wire action buttons"
```

---

## Task 11: MyLostReportsPage

**Files:**
- Create: `apps/frontend/src/features/request-center/pages/MyLostReportsPage.tsx`

- [ ] **Step 1: Create MyLostReportsPage.tsx**

```tsx
import React, { useState } from 'react';
import { PackageSearch, Plus, Clock, CheckCircle2, XCircle, Search, QrCode, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useMyLostReports, useUpdateLostItemStatus, LostItemStatus, LostItemReport } from '../api/lost-item.api';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    REPORTED:    { label: 'Dilaporkan',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',   icon: Clock },
    SEARCHING:   { label: 'Dicari',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       icon: Search },
    CLAIMED:     { label: 'Ada Penemu',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: CheckCircle2 },
    VERIFIED:    { label: 'Terverifikasi', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
    RETURNED:    { label: 'Dikembalikan', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',  icon: CheckCircle2 },
    CLOSED_LOST: { label: 'Tidak Ditemukan', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400', icon: XCircle },
};

const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.REPORTED;
    return (
        <Badge className={cn('px-3 py-1 rounded-full text-[10px] font-extrabold uppercase', cfg.color)}>
            {cfg.label}
        </Badge>
    );
};

export const MyLostReportsPage = () => {
    const { data: reports = [], isLoading, refetch } = useMyLostReports();
    const updateStatus = useUpdateLostItemStatus();
    const [selectedReport, setSelectedReport] = useState<LostItemReport | null>(null);
    const [showQr, setShowQr] = useState<string | null>(null);

    const handleCancel = (report: LostItemReport) => {
        if (!confirm('Yakin tutup laporan ini sebagai tidak ditemukan?')) return;
        updateStatus.mutate(
            { id: report.id, status: LostItemStatus.CLOSED_LOST, notes: 'Ditutup oleh reporter' },
            { onSuccess: () => { toast.success('Laporan ditutup'); refetch(); } }
        );
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                        <PackageSearch className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Laporan Saya</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Lacak status barang yang kamu laporkan hilang</p>
                    </div>
                </div>
                <button
                    onClick={() => window.location.href = '/lost-items'}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors duration-150 shadow-sm text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Laporan Baru
                </button>
            </div>

            {reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                    <PackageSearch className="w-16 h-16 mb-4 opacity-30" />
                    <p className="font-bold text-lg">Belum ada laporan</p>
                    <p className="text-sm mt-1">Klik "Laporan Baru" untuk melaporkan barang hilang</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {reports.map((report, idx) => (
                        <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow duration-150"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs font-extrabold text-rose-500 uppercase tracking-widest">{report.id.slice(0, 8)}…</span>
                                        <StatusBadge status={report.status} />
                                    </div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-lg leading-tight">{report.itemName}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">{report.itemType} · {report.lastSeenLocation}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Dilaporkan {format(new Date(report.createdAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {report.qrCodeUrl && (
                                        <button
                                            onClick={() => setShowQr(showQr === report.id ? null : report.id)}
                                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-rose-500 transition-colors"
                                            title="Tampilkan QR"
                                        >
                                            <QrCode className="w-5 h-5" />
                                        </button>
                                    )}
                                    {(report.status === LostItemStatus.REPORTED || report.status === LostItemStatus.SEARCHING) && (
                                        <button
                                            onClick={() => handleCancel(report)}
                                            className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10"
                                        >
                                            Tutup
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedReport(report)}
                                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-rose-500 hover:text-white transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <AnimatePresence>
                                {showQr === report.id && report.qrCodeUrl && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col items-center gap-3">
                                            <QRCodeSVG value={report.qrCodeUrl} size={140} />
                                            <p className="text-xs text-slate-400 text-center">
                                                Bagikan QR ini ke orang yang menemukan barang kamu
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {report.photoUrls?.length > 0 && (
                                <div className="flex gap-2 mt-3">
                                    {report.photoUrls.slice(0, 4).map((url, i) => (
                                        <img key={i} src={url} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/MyLostReportsPage.tsx
git commit -m "feat(lost-item): add MyLostReportsPage with QR toggle and cancel"
```

---

## Task 12: ReportFoundItemPage

**Files:**
- Create: `apps/frontend/src/features/request-center/pages/ReportFoundItemPage.tsx`

- [ ] **Step 1: Create ReportFoundItemPage.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PackageCheck, MapPin, Clock, FileText, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { PhotoUploader } from '../components/PhotoUploader';
import { useCreateFoundClaim } from '../api/found-claim.api';
import { useQrTokenReport } from '../api/lost-item.api';

const schema = z.object({
    locationFound: z.string().min(3, 'Minimal 3 karakter'),
    foundAt: z.string().min(1, 'Wajib diisi'),
    description: z.string().min(10, 'Minimal 10 karakter'),
});

type FormData = z.infer<typeof schema>;

export const ReportFoundItemPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('r');
    const [photos, setPhotos] = useState<File[]>([]);
    const [submitted, setSubmitted] = useState(false);

    const { data: qrInfo, isLoading: qrLoading } = useQrTokenReport(token);
    const createClaim = useCreateFoundClaim();

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { foundAt: new Date().toISOString().slice(0, 16) },
    });

    const onSubmit = async (data: FormData) => {
        const formData = new FormData();
        formData.append('locationFound', data.locationFound);
        formData.append('foundAt', new Date(data.foundAt).toISOString());
        formData.append('description', data.description);
        if (qrInfo?.reportId) formData.append('lostItemReportId', qrInfo.reportId);
        photos.forEach(f => formData.append('photos', f));

        createClaim.mutate(formData, {
            onSuccess: () => setSubmitted(true),
            onError: () => toast.error('Gagal mengirim laporan temuan'),
        });
    };

    if (submitted) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
            </motion.div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Laporan Terkirim!</h2>
            <p className="text-slate-500 text-center max-w-sm">Manager akan memverifikasi temuanmu. Kamu akan mendapat notifikasi hasilnya.</p>
            <button onClick={() => navigate('/')} className="mt-4 px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">
                Kembali ke Home
            </button>
        </div>
    );

    return (
        <div className="max-w-lg mx-auto space-y-6 animate-fade-in-up">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <PackageCheck className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Saya Menemukan Barang</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Bantu kembalikan barang ke pemiliknya</p>
                </div>
            </div>

            {qrInfo && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">Terhubung ke Laporan</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{qrInfo.itemName}</p>
                    <p className="text-sm text-slate-500">{qrInfo.itemType}</p>
                    {qrInfo.photoUrls?.length > 0 && (
                        <div className="flex gap-2 mt-2">
                            {qrInfo.photoUrls.slice(0, 3).map((url, i) => (
                                <img key={i} src={url} alt="" className="w-12 h-12 object-cover rounded-lg border border-emerald-200" />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {qrLoading && token && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-500">Memuat info laporan dari QR…</span>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1 block">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Lokasi Ditemukan *
                    </label>
                    <Input {...register('locationFound')} placeholder="e.g., Lobby lantai 1, dekat lift" />
                    {errors.locationFound && <p className="text-[10px] text-red-500 mt-0.5">{errors.locationFound.message}</p>}
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1 block">
                        <Clock className="w-3.5 h-3.5 text-blue-500" /> Waktu Ditemukan *
                    </label>
                    <Input type="datetime-local" {...register('foundAt')} />
                    {errors.foundAt && <p className="text-[10px] text-red-500 mt-0.5">{errors.foundAt.message}</p>}
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1 block">
                        <FileText className="w-3.5 h-3.5 text-slate-400" /> Deskripsi Barang *
                    </label>
                    <Textarea {...register('description')} placeholder="Jelaskan kondisi barang, ciri khas, warna, dll…" className="min-h-[80px] resize-none" />
                    {errors.description && <p className="text-[10px] text-red-500 mt-0.5">{errors.description.message}</p>}
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                        Foto Barang (opsional, max 5)
                    </label>
                    <PhotoUploader files={photos} onChange={setPhotos} maxFiles={5} />
                </div>

                <button
                    type="submit"
                    disabled={createClaim.isPending}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors duration-150 shadow-lg shadow-emerald-600/20"
                >
                    {createClaim.isPending ? 'Mengirim…' : 'KIRIM LAPORAN TEMUAN'}
                </button>
            </form>
        </div>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/ReportFoundItemPage.tsx
git commit -m "feat(lost-item): add ReportFoundItemPage with QR pre-fill and photo upload"
```

---

## Task 13: FoundClaimsQueuePage + MatchReviewPanel

**Files:**
- Create: `apps/frontend/src/features/request-center/pages/FoundClaimsQueuePage.tsx`
- Create: `apps/frontend/src/features/request-center/components/MatchReviewPanel.tsx`

- [ ] **Step 1: Create MatchReviewPanel.tsx**

```tsx
import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { FoundItemClaim } from '../api/found-claim.api';
import { useMatchFoundClaim, useRejectFoundClaim } from '../api/found-claim.api';

interface MatchReviewPanelProps {
    claim: FoundItemClaim;
    onClose: () => void;
}

export const MatchReviewPanel = ({ claim, onClose }: MatchReviewPanelProps) => {
    const [notes, setNotes] = useState('');
    const matchClaim = useMatchFoundClaim();
    const rejectClaim = useRejectFoundClaim();

    const report = claim.lostItemReport;

    const handleMatch = () => {
        matchClaim.mutate(
            { id: claim.id, lostItemReportId: claim.lostItemReportId ?? undefined, notes },
            {
                onSuccess: () => { toast.success('Claim matched ✓'); onClose(); },
                onError: () => toast.error('Gagal match claim'),
            }
        );
    };

    const handleReject = () => {
        if (!notes.trim()) { toast.error('Notes wajib diisi saat reject'); return; }
        rejectClaim.mutate(
            { id: claim.id, notes },
            {
                onSuccess: () => { toast.success('Claim rejected'); onClose(); },
                onError: () => toast.error('Gagal reject claim'),
            }
        );
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100]"
                onClick={onClose}
            />
            <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl z-[101] flex flex-col border-l border-slate-200 dark:border-slate-800"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Match Review</h2>
                        <p className="text-sm text-slate-500">Claim ID: {claim.id.slice(0, 8)}…</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Side by side */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Lost Report side */}
                        <div className="space-y-3">
                            <div className="text-xs font-black uppercase tracking-widest text-rose-500 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" /> Laporan Hilang
                            </div>
                            {report ? (
                                <div className="bg-rose-50/50 dark:bg-rose-900/10 rounded-xl p-4 border border-rose-100 dark:border-rose-900/30 space-y-2">
                                    <p className="font-black text-slate-900 dark:text-white">{report.itemName}</p>
                                    <p className="text-sm text-slate-500">{report.itemType}</p>
                                    {report.photoUrls?.length > 0 && (
                                        <div className="grid grid-cols-2 gap-1.5 mt-2">
                                            {report.photoUrls.slice(0, 4).map((url, i) => (
                                                <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm text-slate-400 italic">
                                    Claim belum terhubung ke laporan — pilih laporan manual di bawah
                                </div>
                            )}
                        </div>

                        {/* Found Claim side */}
                        <div className="space-y-3">
                            <div className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Laporan Temuan
                            </div>
                            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                                <p className="font-black text-slate-900 dark:text-white">{claim.finder?.fullName}</p>
                                <p className="text-sm text-slate-500">{claim.locationFound}</p>
                                <p className="text-sm text-slate-500">{format(new Date(claim.foundAt), 'dd MMM yyyy HH:mm')}</p>
                                <p className="text-xs text-slate-400 italic">"{claim.description}"</p>
                                {claim.photoUrls?.length > 0 && (
                                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                                        {claim.photoUrls.slice(0, 4).map((url, i) => (
                                            <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">
                            Notes Manager <span className="text-red-400">(wajib jika REJECT)</span>
                        </label>
                        <Textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Tuliskan alasan atau catatan verifikasi…"
                            className="resize-none min-h-[80px]"
                        />
                    </div>
                </div>

                {/* Footer actions */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                    <button
                        onClick={handleMatch}
                        disabled={matchClaim.isPending}
                        className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        {matchClaim.isPending ? 'MATCHING…' : 'MATCH ✓'}
                    </button>
                    <button
                        onClick={handleReject}
                        disabled={rejectClaim.isPending}
                        className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                    >
                        <XCircle className="w-4 h-4" />
                        {rejectClaim.isPending ? 'REJECTING…' : 'REJECT ✗'}
                    </button>
                </div>
            </motion.div>
        </>
    );
};
```

- [ ] **Step 2: Create FoundClaimsQueuePage.tsx**

```tsx
import React, { useState } from 'react';
import { PackageCheck, RefreshCw, Filter, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useFoundClaims, useConfirmReturn, FoundClaimStatus, FoundItemClaim } from '../api/found-claim.api';
import { MatchReviewPanel } from '../components/MatchReviewPanel';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PENDING:  { label: 'Pending',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    MATCHED:  { label: 'Matched',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    RETURNED: { label: 'Returned',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    REJECTED: { label: 'Rejected',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export const FoundClaimsQueuePage = () => {
    const [statusFilter, setStatusFilter] = useState<FoundClaimStatus | 'ALL'>('ALL');
    const [reviewClaim, setReviewClaim] = useState<FoundItemClaim | null>(null);

    const { data: claims = [], isLoading, refetch } = useFoundClaims(
        statusFilter !== 'ALL' ? { status: statusFilter } : undefined
    );
    const confirmReturn = useConfirmReturn();

    const handleConfirmReturn = (claim: FoundItemClaim) => {
        if (!confirm('Konfirmasi barang sudah diserahkan secara fisik?')) return;
        confirmReturn.mutate(claim.id, {
            onSuccess: () => { toast.success('Return dikonfirmasi ✓'); refetch(); },
            onError: () => toast.error('Gagal konfirmasi return'),
        });
    };

    const pendingCount = claims.filter(c => c.status === FoundClaimStatus.PENDING).length;

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <PackageCheck className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Found Claims
                            {pendingCount > 0 && (
                                <span className="ml-3 inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-black">
                                    {pendingCount}
                                </span>
                            )}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Review dan verifikasi laporan barang temuan</p>
                    </div>
                </div>
                <button onClick={() => refetch()} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:text-emerald-500 transition-colors shadow-sm">
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2">
                {(['ALL', 'PENDING', 'MATCHED', 'RETURNED', 'REJECTED'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                            'px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors duration-150',
                            statusFilter === s
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                        )}
                    >
                        {s === 'ALL' ? 'Semua' : STATUS_CONFIG[s]?.label}
                    </button>
                ))}
            </div>

            {claims.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                    <PackageCheck className="w-16 h-16 mb-4 opacity-30" />
                    <p className="font-bold text-lg">Tidak ada claims</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-6 py-4">Finder</th>
                                    <th className="px-6 py-4">Lokasi Ditemukan</th>
                                    <th className="px-6 py-4">Terhubung ke</th>
                                    <th className="px-6 py-4">Waktu</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {claims.map(claim => (
                                    <tr key={claim.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar user={{ fullName: claim.finder?.fullName || '?' }} size="sm" />
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{claim.finder?.fullName}</p>
                                                    <p className="text-[10px] text-slate-400">{claim.finder?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium max-w-[160px] truncate">
                                            {claim.locationFound}
                                        </td>
                                        <td className="px-6 py-4">
                                            {claim.lostItemReport ? (
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{claim.lostItemReport.itemName}</p>
                                                    <p className="text-[10px] text-slate-400">{claim.lostItemReport.itemType}</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-amber-500 font-bold flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> Unlinked
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                                            {format(new Date(claim.createdAt), 'dd MMM, HH:mm')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge className={cn('px-3 py-1 rounded-full text-[10px] font-extrabold uppercase', STATUS_CONFIG[claim.status]?.color)}>
                                                {STATUS_CONFIG[claim.status]?.label}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {claim.status === FoundClaimStatus.PENDING && (
                                                    <button
                                                        onClick={() => setReviewClaim(claim)}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                                                    >
                                                        Review
                                                    </button>
                                                )}
                                                {claim.status === FoundClaimStatus.MATCHED && (
                                                    <button
                                                        onClick={() => handleConfirmReturn(claim)}
                                                        disabled={confirmReturn.isPending}
                                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                                                    >
                                                        Confirm Return
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {reviewClaim && (
                    <MatchReviewPanel claim={reviewClaim} onClose={() => setReviewClaim(null)} />
                )}
            </AnimatePresence>
        </div>
    );
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/FoundClaimsQueuePage.tsx apps/frontend/src/features/request-center/components/MatchReviewPanel.tsx
git commit -m "feat(lost-item): add FoundClaimsQueuePage and MatchReviewPanel"
```

---

## Task 14: Routes + Navigation

**Files:**
- Modify: `apps/frontend/src/routes/AppRoutes.tsx`
- Modify: `apps/frontend/src/components/layout/BentoSidebar.tsx`
- Modify: `apps/frontend/src/components/layout/ManagerSidebar.tsx`

- [ ] **Step 1: Add lazy imports in AppRoutes.tsx**

Find the `LostItemListPage` lazy import and add below it:

```tsx
const MyLostReportsPage = lazy(() => import('../features/request-center/pages/MyLostReportsPage').then(m => ({ default: m.MyLostReportsPage })));
const ReportFoundItemPage = lazy(() => import('../features/request-center/pages/ReportFoundItemPage').then(m => ({ default: m.ReportFoundItemPage })));
const FoundClaimsQueuePage = lazy(() => import('../features/request-center/pages/FoundClaimsQueuePage').then(m => ({ default: m.FoundClaimsQueuePage })));
```

- [ ] **Step 2: Add routes in AppRoutes.tsx**

Find the existing `lost-items` route (appears 3 times for client/agent/manager layouts). In **each** layout block, add the new sub-routes alongside the existing `lost-items` route:

```tsx
{/* Existing: */}
<Route path="lost-items" element={<LazyRoute component={LostItemListPage} featureName="Lost Items" requiredPageAccess="lost_items" />} />

{/* Add these: */}
<Route path="lost-items/my" element={<LazyRoute component={MyLostReportsPage} featureName="My Lost Reports" requiredPageAccess="lost_items" />} />
<Route path="found" element={<LazyRoute component={ReportFoundItemPage} featureName="Report Found Item" />} />
```

In the **manager** layout block, also add:

```tsx
<Route path="lost-items/claims" element={<LazyRoute component={FoundClaimsQueuePage} featureName="Found Claims" requiredPageAccess="lost_items" />} />
```

- [ ] **Step 3: Update BentoSidebar.tsx — add sub-nav items**

In `BentoSidebar.tsx`, find the `lost_items` nav item (line ~229):

```tsx
{ key: 'lost_items', icon: Search, label: 'Lost Items', path: '/lost-items' },
```

Replace with:

```tsx
{ key: 'lost_items', icon: Search, label: 'Lost Items', path: '/lost-items' },
{ key: 'my_lost_reports', icon: PackageSearch, label: 'Laporan Saya', path: '/lost-items/my' },
{ key: 'report_found', icon: PackageCheck, label: 'Saya Temukan', path: '/found' },
```

Add imports at top: `import { PackageSearch, PackageCheck } from 'lucide-react';`

Add the new keys to the visible items arrays (line ~291):

```tsx
USER:    [..., 'lost_items', 'my_lost_reports', 'report_found', ...],
AGENT:   [..., 'lost_items', 'my_lost_reports', 'report_found', ...],
MANAGER: [..., 'lost_items', 'my_lost_reports', 'report_found', ...],
```

- [ ] **Step 4: Update ManagerSidebar.tsx — add Found Claims link**

Find the `lost_items` item in ManagerSidebar (~line 47):

```tsx
{ key: 'lost_items', icon: SearchSlash, label: 'Lost Items', path: '/manager/lost-items' },
```

Add below it:

```tsx
{ key: 'found_claims', icon: PackageCheck, label: 'Found Claims', path: '/manager/lost-items/claims' },
```

Add import: `import { PackageCheck } from 'lucide-react';`

- [ ] **Step 5: Verify TypeScript builds cleanly**

```bash
cd apps/frontend && npm run build 2>&1 | tail -30
```

Expected: No errors.

- [ ] **Step 6: Final commit**

```bash
git add apps/frontend/src/routes/AppRoutes.tsx apps/frontend/src/components/layout/BentoSidebar.tsx apps/frontend/src/components/layout/ManagerSidebar.tsx
git commit -m "feat(lost-item): add routes and nav for My Reports, Report Found, Found Claims"
```

---

## Self-Review

**Spec coverage:**
- ✓ Reporter submits lost report with photos → Task 4 (service), 6 (controller), 10 (page)
- ✓ QR generated per report, finder scans → Task 4 (generate), 10 (display), 12 (resolve)
- ✓ Finder submits found claim → Task 5, 6, 12
- ✓ Manager reviews side-by-side → Task 13 (MatchReviewPanel)
- ✓ Manager match/reject → Task 5, 13
- ✓ Manager confirms return → Task 5, 13
- ✓ Status chain REPORTED→…→RETURNED + CLOSED_LOST → Task 2, 4, 5
- ✓ Notification events emitted → Tasks 4, 5 (eventEmitter.emit — consumed by existing NotificationCenterService)
- ✓ All logged-in users can submit found claim → Task 6 (no role restriction on POST /found-claim)
- ✓ Photos optional max 5 → Task 6 (FilesInterceptor 5), 9 (PhotoUploader), 11/12 (forms)
- ✓ My Lost Reports page → Task 11
- ✓ Database migration → Task 1
- ✓ Routes + navigation → Task 14

**Placeholder scan:** No TBD/TODO in tasks. ✓

**Type consistency:**
- `LostItemStatus` enum used consistently across Task 2, 4, 8
- `FoundClaimStatus` enum consistent across Task 2, 5, 8
- `useCreateLostItem` takes `FormData` → controller expects `multipart/form-data` ✓
- `useCreateFoundClaim` takes `FormData` → controller expects `multipart/form-data` ✓
- `useMatchFoundClaim` params `{ id, lostItemReportId?, notes? }` → `MatchFoundClaimDto` ✓
- `QRCodeSVG` from `qrcode.react` used in Task 10, 11 — install in Task 8 ✓
