# Hardware Request — Plan 2: Lifecycle API (Review → Approve → Procurement Entry + Comments)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Extend the backend with full ICT-side state machine up to (and entering) PROCUREMENT: review, approve, reject, procurement-field updates, procurement-complete transition, and the comment thread feature. INSTALLATION and COMPLETED ship in Plan 3.

**Architecture:** Builds on Plan 1. Adds `hardware_request_comment` entity, per-role service methods, and controller endpoints guarded by `HardwareRoleGuard` with `@HardwareRoles(...)`.

**Tech Stack:** Same as Plan 1.

**Spec reference:** spec sections 5 (transitions SUBMITTED→UNDER_REVIEW→APPROVED/REJECTED→PROCUREMENT→INSTALLATION-entry), 6 (role matrices), 7 (endpoints: review, approve, reject, items patch, procurement/complete, comments).

**Prerequisites:** Plan 1 merged; migrations applied; `HardwareRoleGuard` available.

---

## Files in this plan

**Create:**
- `apps/backend/src/modules/hardware-request/domain/entities/hardware-request-comment.entity.ts`
- `apps/backend/src/migrations/1776000100000-AddHardwareRequestComments.ts`
- `apps/backend/src/modules/hardware-request/dto/reject-request.dto.ts`
- `apps/backend/src/modules/hardware-request/dto/update-item.dto.ts`
- `apps/backend/src/modules/hardware-request/dto/create-comment.dto.ts`
- `apps/backend/src/modules/hardware-request/dto/update-comment.dto.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-comment.service.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-activity.service.ts`
- `apps/backend/src/modules/hardware-request/presentation/hardware-comment.controller.ts`
- `apps/backend/src/modules/hardware-request/presentation/hardware-activity.controller.ts`
- `apps/backend/src/modules/hardware-request/services/hardware-comment.service.spec.ts`

**Modify:**
- `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts` (add review, approve, reject, updateItem, completeProcurement)
- `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.spec.ts` (add corresponding tests)
- `apps/backend/src/modules/hardware-request/presentation/hardware-request.controller.ts` (add endpoints)
- `apps/backend/src/modules/hardware-request/hardware-request.module.ts` (register new entity, services, controllers)

---

## Task 2.1: `hardware_request_comments` entity + migration

**Files:**
- Create: `apps/backend/src/modules/hardware-request/domain/entities/hardware-request-comment.entity.ts`
- Create: `apps/backend/src/migrations/1776000100000-AddHardwareRequestComments.ts`

- [ ] **Step 1: Entity**

```typescript
import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
    ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { HardwareRequest } from './hardware-request.entity';
import { User } from '../../../users/entities/user.entity';

@Entity('hardware_request_comments')
@Index(['requestId', 'createdAt'])
export class HardwareRequestComment {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Column({ type: 'uuid' }) requestId: string;
    @ManyToOne(() => HardwareRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'requestId' }) request: HardwareRequest;

    @Column({ type: 'uuid' }) authorId: string;
    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'authorId' }) author: User;

    @Column({ type: 'text' }) body: string;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    attachments: Array<{ url: string; name: string; size: number; mimeType: string }>;

    @CreateDateColumn() createdAt: Date;

    @Column({ type: 'timestamptz', nullable: true }) editedAt: Date | null;
    @Column({ type: 'timestamptz', nullable: true }) deletedAt: Date | null;
}
```

- [ ] **Step 2: Migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHardwareRequestComments1776000100000 implements MigrationInterface {
    name = 'AddHardwareRequestComments1776000100000';

    async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE hardware_request_comments (
                id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                request_id  uuid NOT NULL REFERENCES hardware_requests(id) ON DELETE CASCADE,
                author_id   uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                body        text NOT NULL,
                attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
                created_at  timestamptz NOT NULL DEFAULT now(),
                edited_at   timestamptz NULL,
                deleted_at  timestamptz NULL
            );
            CREATE INDEX idx_hardware_request_comments_request_created
                ON hardware_request_comments (request_id, created_at);
        `);
    }
    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE IF EXISTS hardware_request_comments;`);
    }
}
```

- [ ] **Step 3: Run migration**

Run: `cd apps/backend && npm run migration:run`
Expected: applied cleanly.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/hardware-request/domain/entities/hardware-request-comment.entity.ts \
        apps/backend/src/migrations/1776000100000-AddHardwareRequestComments.ts
git commit -m "feat(hardware-request): add comments entity + migration"
```

---

## Task 2.2: DTOs

**Files:**
- Create: `apps/backend/src/modules/hardware-request/dto/reject-request.dto.ts`
- Create: `apps/backend/src/modules/hardware-request/dto/update-item.dto.ts`
- Create: `apps/backend/src/modules/hardware-request/dto/create-comment.dto.ts`
- Create: `apps/backend/src/modules/hardware-request/dto/update-comment.dto.ts`

- [ ] **Step 1: reject-request.dto.ts**

```typescript
import { IsString, MinLength } from 'class-validator';
export class RejectRequestDto {
    @IsString() @MinLength(5)
    reason: string;
}
```

- [ ] **Step 2: update-item.dto.ts**

```typescript
import { IsDateString, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateItemDto {
    @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
    actualCost?: number;
    @IsOptional() @IsString() @Length(1, 255) vendor?: string;
    @IsOptional() @IsString() @Length(1, 100) invoiceNumber?: string;
    @IsOptional() @IsDateString() invoiceDate?: string;
    @IsOptional() @IsString() notes?: string;
}
```

- [ ] **Step 3: create-comment.dto.ts**

```typescript
import { IsArray, IsOptional, IsString, IsUrl, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CommentAttachmentDto {
    @IsUrl() url: string;
    @IsString() name: string;
    @IsString() mimeType: string;
    @IsOptional() size?: number;
}

export class CreateCommentDto {
    @IsString() @MinLength(1)
    body: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CommentAttachmentDto)
    attachments?: CommentAttachmentDto[];
}
```

- [ ] **Step 4: update-comment.dto.ts**

```typescript
import { IsString, MinLength } from 'class-validator';
export class UpdateCommentDto {
    @IsString() @MinLength(1)
    body: string;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/dto
git commit -m "feat(hardware-request): add lifecycle + comment DTOs"
```

---

## Task 2.3: Command service — review/approve/reject (TDD)

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts`
- Modify: `apps/backend/src/modules/hardware-request/services/hardware-request-command.service.spec.ts`

- [ ] **Step 1: Add failing tests**

Append to existing spec (new describe block `describe('LEAD transitions', ...)`):

```typescript
describe('LEAD transitions', () => {
    it('review transitions SUBMITTED → UNDER_REVIEW and records reviewer', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', status: RequestStatus.SUBMITTED, items: [{}],
        } as any);
        const res = await service.review('lead-1', 'req-1');
        expect(res.status).toBe(RequestStatus.UNDER_REVIEW);
        expect(res.reviewedById).toBe('lead-1');
        expect(res.reviewedAt).toBeInstanceOf(Date);
        expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            action: ActivityAction.REVIEWED,
            fromStatus: RequestStatus.SUBMITTED,
            toStatus: RequestStatus.UNDER_REVIEW,
        }));
    });

    it('approve transitions UNDER_REVIEW → APPROVED', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', status: RequestStatus.UNDER_REVIEW, items: [{}],
        } as any);
        const res = await service.approve('lead-1', 'req-1');
        expect(res.status).toBe(RequestStatus.APPROVED);
        expect(res.approvedById).toBe('lead-1');
        expect(res.approvedAt).toBeInstanceOf(Date);
    });

    it('reject transitions UNDER_REVIEW → REJECTED with reason', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', status: RequestStatus.UNDER_REVIEW, items: [{}],
        } as any);
        const res = await service.reject('lead-1', 'req-1', { reason: 'Duplicate' });
        expect(res.status).toBe(RequestStatus.REJECTED);
        expect(res.rejectReason).toBe('Duplicate');
        expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            action: ActivityAction.REJECTED,
            metadata: expect.objectContaining({ reason: 'Duplicate' }),
        }));
    });

    it('review rejects from non-SUBMITTED', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', status: RequestStatus.APPROVED, items: [{}],
        } as any);
        await expect(service.review('lead-1', 'req-1')).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }),
        });
    });

    it('approve rejects from non-UNDER_REVIEW', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', status: RequestStatus.SUBMITTED, items: [{}],
        } as any);
        await expect(service.approve('lead-1', 'req-1')).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }),
        });
    });
});
```

- [ ] **Step 2: Run — expect failures**

Run: `cd apps/backend && npx jest src/modules/hardware-request/services/hardware-request-command.service.spec.ts`

- [ ] **Step 3: Implement methods**

Add to `HardwareRequestCommandService`:

```typescript
import { RejectRequestDto } from '../dto/reject-request.dto';

// --- private helper ---
private async loadRequestOrThrow(mgr: any, id: string): Promise<HardwareRequest> {
    const repo = mgr.getRepository(HardwareRequest);
    const found = await repo.findOne({ where: { id }, relations: { items: true } });
    if (!found) throw new HardwareRequestNotFoundError(id);
    return found;
}

private async logActivity(
    mgr: any,
    params: {
        requestId: string;
        actorId: string;
        action: ActivityAction;
        fromStatus?: RequestStatus | null;
        toStatus?: RequestStatus | null;
        metadata?: Record<string, unknown>;
    },
) {
    const activityRepo = mgr.getRepository(HardwareRequestActivity);
    await activityRepo.save(activityRepo.create({
        requestId: params.requestId,
        actorId: params.actorId,
        action: params.action,
        fromStatus: params.fromStatus ?? null,
        toStatus: params.toStatus ?? null,
        metadata: params.metadata ?? {},
    }));
}

// --- transitions ---
async review(userId: string, requestId: string): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
        const existing = await this.loadRequestOrThrow(mgr, requestId);
        if (existing.status !== RequestStatus.SUBMITTED) {
            throw new InvalidStateTransitionError(existing.status, RequestStatus.UNDER_REVIEW);
        }
        existing.status = RequestStatus.UNDER_REVIEW;
        existing.reviewedById = userId;
        existing.reviewedAt = new Date();
        const saved = await mgr.getRepository(HardwareRequest).save(existing);
        await this.logActivity(mgr, {
            requestId: saved.id, actorId: userId,
            action: ActivityAction.REVIEWED,
            fromStatus: RequestStatus.SUBMITTED, toStatus: RequestStatus.UNDER_REVIEW,
        });
        return saved;
    });
}

async approve(userId: string, requestId: string): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
        const existing = await this.loadRequestOrThrow(mgr, requestId);
        if (existing.status !== RequestStatus.UNDER_REVIEW) {
            throw new InvalidStateTransitionError(existing.status, RequestStatus.APPROVED);
        }
        existing.status = RequestStatus.APPROVED;
        existing.approvedById = userId;
        existing.approvedAt = new Date();
        const saved = await mgr.getRepository(HardwareRequest).save(existing);
        await this.logActivity(mgr, {
            requestId: saved.id, actorId: userId,
            action: ActivityAction.APPROVED,
            fromStatus: RequestStatus.UNDER_REVIEW, toStatus: RequestStatus.APPROVED,
        });
        return saved;
    });
}

async reject(
    userId: string, requestId: string, dto: RejectRequestDto,
): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
        const existing = await this.loadRequestOrThrow(mgr, requestId);
        if (existing.status !== RequestStatus.UNDER_REVIEW) {
            throw new InvalidStateTransitionError(existing.status, RequestStatus.REJECTED);
        }
        existing.status = RequestStatus.REJECTED;
        existing.rejectReason = dto.reason;
        const saved = await mgr.getRepository(HardwareRequest).save(existing);
        await this.logActivity(mgr, {
            requestId: saved.id, actorId: userId,
            action: ActivityAction.REJECTED,
            fromStatus: RequestStatus.UNDER_REVIEW, toStatus: RequestStatus.REJECTED,
            metadata: { reason: dto.reason },
        });
        return saved;
    });
}
```

- [ ] **Step 4: Run tests — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-request-command.service*.ts \
        apps/backend/src/modules/hardware-request/dto/reject-request.dto.ts
git commit -m "feat(hardware-request): add review/approve/reject transitions"
```

---

## Task 2.4: Command service — updateItem + completeProcurement (TDD)

**Files:**
- Modify: command service + spec.

- [ ] **Step 1: Add failing tests**

```typescript
describe('PROCUREMENT transitions', () => {
    const approvedReq = {
        id: 'req-1', status: RequestStatus.APPROVED, items: [
            { id: 'i1', quantity: 1, actualCost: null, vendor: null, invoiceNumber: null },
        ],
    };

    beforeEach(() => {
        reqRepo.findOne.mockResolvedValue(JSON.parse(JSON.stringify(approvedReq)));
    });

    it('updateItem auto-enters PROCUREMENT from APPROVED when first patch arrives', async () => {
        const res = await service.updateItem('proc-1', 'req-1', 'i1', {
            actualCost: 15000000, vendor: 'Acme', invoiceNumber: 'INV-001',
        });
        expect(res.status).toBe(RequestStatus.PROCUREMENT);
        expect(res.items[0].actualCost).toBe('15000000.00');
        expect(res.items[0].vendor).toBe('Acme');
        expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            action: ActivityAction.PROCUREMENT_UPDATED,
            metadata: expect.objectContaining({ itemId: 'i1' }),
        }));
    });

    it('updateItem keeps status PROCUREMENT on subsequent patches', async () => {
        reqRepo.findOne.mockResolvedValue({
            ...approvedReq, status: RequestStatus.PROCUREMENT,
        });
        const res = await service.updateItem('proc-1', 'req-1', 'i1', { vendor: 'Bravo' });
        expect(res.status).toBe(RequestStatus.PROCUREMENT);
    });

    it('updateItem forbids edits in non-APPROVED/non-PROCUREMENT status', async () => {
        reqRepo.findOne.mockResolvedValue({
            ...approvedReq, status: RequestStatus.SUBMITTED,
        });
        await expect(
            service.updateItem('proc-1', 'req-1', 'i1', { vendor: 'x' }),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }) });
    });

    it('completeProcurement transitions PROCUREMENT → INSTALLATION when all items filled', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', status: RequestStatus.PROCUREMENT,
            items: [
                { id: 'i1', actualCost: '15000000.00', vendor: 'Acme', invoiceNumber: 'A1', quantity: 1 },
                { id: 'i2', actualCost: '500000.00', vendor: 'Acme', invoiceNumber: 'A1', quantity: 2 },
            ],
        });
        const res = await service.completeProcurement('proc-1', 'req-1');
        expect(res.status).toBe(RequestStatus.INSTALLATION);
        expect(res.procuredById).toBe('proc-1');
    });

    it('completeProcurement blocks when any item missing actualCost/vendor/invoice', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', status: RequestStatus.PROCUREMENT,
            items: [
                { id: 'i1', actualCost: '15000000.00', vendor: 'Acme', invoiceNumber: null, quantity: 1 },
            ],
        });
        await expect(
            service.completeProcurement('proc-1', 'req-1'),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_VALIDATION' }) });
    });
});
```

- [ ] **Step 2: Run — expect failures**

- [ ] **Step 3: Implement**

```typescript
import { UpdateItemDto } from '../dto/update-item.dto';

async updateItem(
    userId: string, requestId: string, itemId: string, dto: UpdateItemDto,
): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
        const existing = await this.loadRequestOrThrow(mgr, requestId);
        if (![RequestStatus.APPROVED, RequestStatus.PROCUREMENT].includes(existing.status)) {
            throw new InvalidStateTransitionError(existing.status, RequestStatus.PROCUREMENT);
        }
        const item = existing.items.find((x) => x.id === itemId);
        if (!item) {
            throw new HardwareRequestNotFoundError(`item ${itemId}`);
        }

        if (dto.actualCost !== undefined) item.actualCost = dto.actualCost.toFixed(2);
        if (dto.vendor !== undefined) item.vendor = dto.vendor;
        if (dto.invoiceNumber !== undefined) item.invoiceNumber = dto.invoiceNumber;
        if (dto.invoiceDate !== undefined) item.invoiceDate = new Date(dto.invoiceDate);
        if (dto.notes !== undefined) item.notes = dto.notes;

        const fromStatus = existing.status;
        if (existing.status === RequestStatus.APPROVED) {
            existing.status = RequestStatus.PROCUREMENT;
            existing.procuredById = userId;
        }

        const saved = await mgr.getRepository(HardwareRequest).save(existing);
        await mgr.getRepository(HardwareRequestItem).save(item);

        await this.logActivity(mgr, {
            requestId: saved.id, actorId: userId,
            action: ActivityAction.PROCUREMENT_UPDATED,
            fromStatus, toStatus: saved.status,
            metadata: { itemId, changed: Object.keys(dto) },
        });
        return saved;
    });
}

async completeProcurement(userId: string, requestId: string): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
        const existing = await this.loadRequestOrThrow(mgr, requestId);
        if (existing.status !== RequestStatus.PROCUREMENT) {
            throw new InvalidStateTransitionError(existing.status, RequestStatus.INSTALLATION);
        }
        const incomplete = existing.items.filter(
            (i) => !i.actualCost || !i.vendor || !i.invoiceNumber,
        );
        if (incomplete.length > 0) {
            throw new BadRequestException({
                code: 'HR_VALIDATION',
                message: 'All items must have actual cost, vendor, and invoice before completing procurement',
                incompleteItemIds: incomplete.map((i) => i.id),
            });
        }

        existing.status = RequestStatus.INSTALLATION;
        existing.procuredAt = new Date();
        if (!existing.procuredById) existing.procuredById = userId;
        const saved = await mgr.getRepository(HardwareRequest).save(existing);

        await this.logActivity(mgr, {
            requestId: saved.id, actorId: userId,
            action: ActivityAction.PROCUREMENT_COMPLETED,
            fromStatus: RequestStatus.PROCUREMENT, toStatus: RequestStatus.INSTALLATION,
        });
        return saved;
    });
}
```

- [ ] **Step 4: Run tests — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-request-command.service*.ts \
        apps/backend/src/modules/hardware-request/dto/update-item.dto.ts
git commit -m "feat(hardware-request): add procurement update + complete transition"
```

---

## Task 2.5: Comment service (TDD)

**Files:**
- Create: `apps/backend/src/modules/hardware-request/services/hardware-comment.service.ts`
- Create: `apps/backend/src/modules/hardware-request/services/hardware-comment.service.spec.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareCommentService } from './hardware-comment.service';
import { HardwareRequestComment } from '../domain/entities/hardware-request-comment.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestActivity } from '../domain/entities/hardware-request-activity.entity';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { DataSource } from 'typeorm';

describe('HardwareCommentService', () => {
    let service: HardwareCommentService;
    let commentRepo: any;
    let requestRepo: any;
    let activityRepo: any;
    let ds: any;

    beforeEach(async () => {
        commentRepo = {
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve({ id: 'c1', ...x, createdAt: new Date() })),
            find: jest.fn(),
            findOne: jest.fn(),
        };
        requestRepo = { findOne: jest.fn() };
        activityRepo = {
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve(x)),
        };
        ds = {
            transaction: (cb: any) => cb({
                getRepository: (e: any) =>
                    e === HardwareRequestComment ? commentRepo :
                    e === HardwareRequestActivity ? activityRepo : requestRepo,
            }),
        };
        const moduleRef = await Test.createTestingModule({
            providers: [
                HardwareCommentService,
                { provide: getRepositoryToken(HardwareRequestComment), useValue: commentRepo },
                { provide: getRepositoryToken(HardwareRequest), useValue: requestRepo },
                { provide: getRepositoryToken(HardwareRequestActivity), useValue: activityRepo },
                { provide: DataSource, useValue: ds },
            ],
        }).compile();
        service = moduleRef.get(HardwareCommentService);
    });

    it('add creates comment + activity when user owns request', async () => {
        requestRepo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'u1' });
        const res = await service.add(
            { id: 'u1', role: HardwareRole.USER }, 'r1',
            { body: 'Hi' },
        );
        expect(res.id).toBe('c1');
        expect(activityRepo.save).toHaveBeenCalled();
    });

    it('add forbids non-requester USER', async () => {
        requestRepo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'owner' });
        await expect(
            service.add({ id: 'other', role: HardwareRole.USER }, 'r1', { body: 'x' }),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }) });
    });

    it('list returns non-deleted comments sorted asc', async () => {
        commentRepo.find.mockResolvedValue([{ id: 'c1', createdAt: new Date() }]);
        const res = await service.list(
            { id: 'lead', role: HardwareRole.ICT_LEAD }, 'r1',
        );
        expect(commentRepo.find).toHaveBeenCalledWith({
            where: { requestId: 'r1', deletedAt: expect.anything() },
            order: { createdAt: 'ASC' },
            relations: { author: true },
        });
        expect(res).toHaveLength(1);
    });

    it('edit allowed within 15min by author only', async () => {
        const now = new Date();
        const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
        commentRepo.findOne.mockResolvedValue({
            id: 'c1', authorId: 'u1', createdAt: tenMinAgo, body: 'old', request: { id: 'r1' },
        });
        const res = await service.edit(
            { id: 'u1', role: HardwareRole.USER }, 'r1', 'c1', { body: 'new' },
        );
        expect(res.body).toBe('new');
        expect(res.editedAt).toBeInstanceOf(Date);
    });

    it('edit rejects after 15min', async () => {
        const old = new Date(Date.now() - 20 * 60 * 1000);
        commentRepo.findOne.mockResolvedValue({
            id: 'c1', authorId: 'u1', createdAt: old, body: 'old',
        });
        await expect(
            service.edit({ id: 'u1', role: HardwareRole.USER }, 'r1', 'c1', { body: 'new' }),
        ).rejects.toThrow(/edit window/i);
    });

    it('softDelete by author works', async () => {
        commentRepo.findOne.mockResolvedValue({ id: 'c1', authorId: 'u1' });
        await service.softDelete(
            { id: 'u1', role: HardwareRole.USER }, 'r1', 'c1',
        );
        expect(commentRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'c1', deletedAt: expect.any(Date) }),
        );
    });

    it('softDelete by ICT_LEAD works even if not author', async () => {
        commentRepo.findOne.mockResolvedValue({ id: 'c1', authorId: 'other' });
        await service.softDelete(
            { id: 'lead', role: HardwareRole.ICT_LEAD }, 'r1', 'c1',
        );
        expect(commentRepo.save).toHaveBeenCalled();
    });

    it('softDelete denies non-author non-lead', async () => {
        commentRepo.findOne.mockResolvedValue({ id: 'c1', authorId: 'other' });
        await expect(
            service.softDelete({ id: 'u1', role: HardwareRole.USER }, 'r1', 'c1'),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }) });
    });
});
```

- [ ] **Step 2: Run — expect failures**

- [ ] **Step 3: Implement**

```typescript
// apps/backend/src/modules/hardware-request/services/hardware-comment.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { HardwareRequestComment } from '../domain/entities/hardware-request-comment.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestActivity } from '../domain/entities/hardware-request-activity.entity';
import { ActivityAction } from '../domain/enums/activity-action.enum';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import {
    HardwareRequestNotFoundError,
    PermissionDeniedError,
} from '../domain/errors';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { UpdateCommentDto } from '../dto/update-comment.dto';
import { ActingUser } from './hardware-request-query.service';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class HardwareCommentService {
    constructor(
        @InjectRepository(HardwareRequestComment)
        private readonly repo: Repository<HardwareRequestComment>,
        @InjectRepository(HardwareRequest)
        private readonly requestRepo: Repository<HardwareRequest>,
        @InjectRepository(HardwareRequestActivity)
        private readonly activityRepo: Repository<HardwareRequestActivity>,
        private readonly dataSource: DataSource,
    ) {}

    private async ensureAccess(user: ActingUser, requestId: string) {
        const req = await this.requestRepo.findOne({ where: { id: requestId } });
        if (!req) throw new HardwareRequestNotFoundError(requestId);
        if (user.role === HardwareRole.USER && req.requesterId !== user.id) {
            throw new PermissionDeniedError('comment on this request');
        }
        return req;
    }

    async list(user: ActingUser, requestId: string): Promise<HardwareRequestComment[]> {
        await this.ensureAccess(user, requestId);
        return this.repo.find({
            where: { requestId, deletedAt: IsNull() },
            order: { createdAt: 'ASC' },
            relations: { author: true },
        });
    }

    async add(user: ActingUser, requestId: string, dto: CreateCommentDto): Promise<HardwareRequestComment> {
        await this.ensureAccess(user, requestId);
        return this.dataSource.transaction(async (mgr) => {
            const commentRepo = mgr.getRepository(HardwareRequestComment);
            const activityRepo = mgr.getRepository(HardwareRequestActivity);

            const saved = await commentRepo.save(
                commentRepo.create({
                    requestId,
                    authorId: user.id,
                    body: dto.body,
                    attachments: dto.attachments ?? [],
                }),
            );
            await activityRepo.save(activityRepo.create({
                requestId,
                actorId: user.id,
                action: ActivityAction.COMMENTED,
                metadata: { commentId: saved.id },
            }));
            return saved;
        });
    }

    async edit(
        user: ActingUser, requestId: string, commentId: string, dto: UpdateCommentDto,
    ): Promise<HardwareRequestComment> {
        const existing = await this.repo.findOne({ where: { id: commentId, requestId } });
        if (!existing) throw new HardwareRequestNotFoundError(commentId);
        if (existing.authorId !== user.id) {
            throw new PermissionDeniedError('edit this comment');
        }
        if (Date.now() - new Date(existing.createdAt).getTime() > EDIT_WINDOW_MS) {
            throw new BadRequestException({
                code: 'HR_VALIDATION',
                message: 'Comment edit window (15 min) has passed',
            });
        }
        existing.body = dto.body;
        existing.editedAt = new Date();
        return this.repo.save(existing);
    }

    async softDelete(user: ActingUser, requestId: string, commentId: string): Promise<void> {
        const existing = await this.repo.findOne({ where: { id: commentId, requestId } });
        if (!existing) throw new HardwareRequestNotFoundError(commentId);
        const isAuthor = existing.authorId === user.id;
        const isLead = user.role === HardwareRole.ICT_LEAD;
        if (!isAuthor && !isLead) {
            throw new PermissionDeniedError('delete this comment');
        }
        existing.deletedAt = new Date();
        await this.repo.save(existing);
    }
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-comment.service*.ts \
        apps/backend/src/modules/hardware-request/dto/create-comment.dto.ts \
        apps/backend/src/modules/hardware-request/dto/update-comment.dto.ts
git commit -m "feat(hardware-request): add comment service with edit window"
```

---

## Task 2.6: Activity service + controller

**Files:**
- Create: `apps/backend/src/modules/hardware-request/services/hardware-activity.service.ts`
- Create: `apps/backend/src/modules/hardware-request/presentation/hardware-activity.controller.ts`

- [ ] **Step 1: Service**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HardwareRequestActivity } from '../domain/entities/hardware-request-activity.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import {
    HardwareRequestNotFoundError,
    PermissionDeniedError,
} from '../domain/errors';
import { ActingUser } from './hardware-request-query.service';

@Injectable()
export class HardwareActivityService {
    constructor(
        @InjectRepository(HardwareRequestActivity)
        private readonly repo: Repository<HardwareRequestActivity>,
        @InjectRepository(HardwareRequest)
        private readonly requestRepo: Repository<HardwareRequest>,
    ) {}

    async listForRequest(user: ActingUser, requestId: string): Promise<HardwareRequestActivity[]> {
        const req = await this.requestRepo.findOne({ where: { id: requestId } });
        if (!req) throw new HardwareRequestNotFoundError(requestId);
        if (user.role === HardwareRole.USER && req.requesterId !== user.id) {
            throw new PermissionDeniedError('view activity for this request');
        }
        return this.repo.find({
            where: { requestId },
            order: { createdAt: 'ASC' },
            relations: { actor: true },
        });
    }
}
```

- [ ] **Step 2: Controller**

```typescript
import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HardwareRoleGuard, pickRole } from '../guards/hardware-role.guard';
import { HardwareActivityService } from '../services/hardware-activity.service';

@Controller('hardware-requests/:id/activity')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
export class HardwareActivityController {
    constructor(private readonly service: HardwareActivityService) {}

    @Get()
    async list(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) requestId: string,
    ) {
        const role = pickRole(req.user);
        const data = await this.service.listForRequest({ id: req.user.id, role }, requestId);
        return { success: true, data };
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/hardware-request/services/hardware-activity.service.ts \
        apps/backend/src/modules/hardware-request/presentation/hardware-activity.controller.ts
git commit -m "feat(hardware-request): add activity listing service + controller"
```

---

## Task 2.7: Comment controller

**Files:**
- Create: `apps/backend/src/modules/hardware-request/presentation/hardware-comment.controller.ts`

- [ ] **Step 1: Controller**

```typescript
import {
    Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe,
    Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HardwareRoleGuard, pickRole } from '../guards/hardware-role.guard';
import { HardwareCommentService } from '../services/hardware-comment.service';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { UpdateCommentDto } from '../dto/update-comment.dto';

@Controller('hardware-requests/:id/comments')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
export class HardwareCommentController {
    constructor(private readonly service: HardwareCommentService) {}

    @Get()
    async list(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) requestId: string,
    ) {
        const role = pickRole(req.user);
        const data = await this.service.list({ id: req.user.id, role }, requestId);
        return { success: true, data };
    }

    @Post()
    async add(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) requestId: string,
        @Body() dto: CreateCommentDto,
    ) {
        const role = pickRole(req.user);
        const data = await this.service.add({ id: req.user.id, role }, requestId, dto);
        return { success: true, data };
    }

    @Patch(':commentId')
    async edit(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) requestId: string,
        @Param('commentId', new ParseUUIDPipe()) commentId: string,
        @Body() dto: UpdateCommentDto,
    ) {
        const role = pickRole(req.user);
        const data = await this.service.edit(
            { id: req.user.id, role }, requestId, commentId, dto,
        );
        return { success: true, data };
    }

    @Delete(':commentId')
    @HttpCode(204)
    async remove(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) requestId: string,
        @Param('commentId', new ParseUUIDPipe()) commentId: string,
    ) {
        const role = pickRole(req.user);
        await this.service.softDelete({ id: req.user.id, role }, requestId, commentId);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/presentation/hardware-comment.controller.ts
git commit -m "feat(hardware-request): add comment controller"
```

---

## Task 2.8: Add lifecycle endpoints to request controller

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/presentation/hardware-request.controller.ts`

- [ ] **Step 1: Append endpoints**

Add these methods to `HardwareRequestController`:

```typescript
import { HardwareRoles } from '../guards/roles.decorator';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { RejectRequestDto } from '../dto/reject-request.dto';
import { UpdateItemDto } from '../dto/update-item.dto';

@Post(':id/review')
@HttpCode(200)
@HardwareRoles(HardwareRole.ICT_LEAD)
async review(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.commands.review(req.user.id, id);
    return { success: true, data };
}

@Post(':id/approve')
@HttpCode(200)
@HardwareRoles(HardwareRole.ICT_LEAD)
async approve(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.commands.approve(req.user.id, id);
    return { success: true, data };
}

@Post(':id/reject')
@HttpCode(200)
@HardwareRoles(HardwareRole.ICT_LEAD)
async reject(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectRequestDto,
) {
    const data = await this.commands.reject(req.user.id, id, dto);
    return { success: true, data };
}

@Patch(':id/items/:itemId')
@HardwareRoles(HardwareRole.ICT_PROCUREMENT)
async updateItem(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: UpdateItemDto,
) {
    const data = await this.commands.updateItem(req.user.id, id, itemId, dto);
    return { success: true, data };
}

@Post(':id/procurement/complete')
@HttpCode(200)
@HardwareRoles(HardwareRole.ICT_PROCUREMENT)
async completeProcurement(
    @Req() req: any, @Param('id', new ParseUUIDPipe()) id: string,
) {
    const data = await this.commands.completeProcurement(req.user.id, id);
    return { success: true, data };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/hardware-request/presentation/hardware-request.controller.ts
git commit -m "feat(hardware-request): wire lifecycle endpoints to controller"
```

---

## Task 2.9: Register new pieces in module

**Files:**
- Modify: `apps/backend/src/modules/hardware-request/hardware-request.module.ts`

- [ ] **Step 1: Update module**

```typescript
import { HardwareRequestComment } from './domain/entities/hardware-request-comment.entity';
import { HardwareCommentService } from './services/hardware-comment.service';
import { HardwareActivityService } from './services/hardware-activity.service';
import { HardwareCommentController } from './presentation/hardware-comment.controller';
import { HardwareActivityController } from './presentation/hardware-activity.controller';

// Update TypeOrmModule.forFeature:
TypeOrmModule.forFeature([
    HardwareCatalog,
    HardwareRequest,
    HardwareRequestItem,
    HardwareRequestActivity,
    HardwareRequestComment,
]),

// Add to controllers:
controllers: [
    HardwareRequestController,
    HardwareCatalogController,
    HardwareCommentController,
    HardwareActivityController,
],

// Add providers:
providers: [
    HardwareCatalogService,
    HardwareRequestCommandService,
    HardwareRequestQueryService,
    HardwareCommentService,
    HardwareActivityService,
    RequestNumberService,
    HardwareRoleGuard,
],

// Add to exports:
exports: [
    HardwareCatalogService,
    HardwareRequestCommandService,
    HardwareRequestQueryService,
    HardwareCommentService,
    HardwareActivityService,
],
```

- [ ] **Step 2: Build + sanity check**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json && npm run start:dev`
Expected: server boots with new routes:
- `POST /hardware-requests/:id/review`
- `POST /hardware-requests/:id/approve`
- `POST /hardware-requests/:id/reject`
- `PATCH /hardware-requests/:id/items/:itemId`
- `POST /hardware-requests/:id/procurement/complete`
- `GET/POST /hardware-requests/:id/comments`
- `PATCH/DELETE /hardware-requests/:id/comments/:commentId`
- `GET /hardware-requests/:id/activity`

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/hardware-request/hardware-request.module.ts
git commit -m "feat(hardware-request): register comment/activity in module"
```

---

## Task 2.10: Integration test — full happy path

**Files:**
- Create: `apps/backend/src/modules/hardware-request/hardware-request.integration.spec.ts`

- [ ] **Step 1: Write integration test**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HardwareRequestModule } from './hardware-request.module';
import { HardwareCatalog } from './domain/entities/hardware-catalog.entity';
import { HardwareRequest } from './domain/entities/hardware-request.entity';
import { HardwareRequestItem } from './domain/entities/hardware-request-item.entity';
import { HardwareRequestActivity } from './domain/entities/hardware-request-activity.entity';
import { HardwareRequestComment } from './domain/entities/hardware-request-comment.entity';
import { HardwareRequestCommandService } from './services/hardware-request-command.service';
import { HardwareRequestQueryService } from './services/hardware-request-query.service';
import { HardwareCatalogService } from './services/hardware-catalog.service';
import { HardwareCommentService } from './services/hardware-comment.service';
import { ItemCategory } from './domain/enums/item-category.enum';
import { RequestStatus } from './domain/enums/request-status.enum';
import { HardwareRole } from './domain/enums/hardware-role.enum';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';

describe('HardwareRequest happy path (integration)', () => {
    let app: TestingModule;
    let ds: DataSource;
    let commands: HardwareRequestCommandService;
    let queries: HardwareRequestQueryService;
    let catalog: HardwareCatalogService;
    let comments: HardwareCommentService;
    let userId: string;
    let leadId: string;
    let procId: string;
    let siteId: string;

    beforeAll(async () => {
        app = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    type: 'postgres',
                    url: process.env.TEST_DATABASE_URL,
                    entities: [
                        HardwareCatalog, HardwareRequest, HardwareRequestItem,
                        HardwareRequestActivity, HardwareRequestComment, User, Site,
                    ],
                    synchronize: false,
                    dropSchema: false,
                }),
                HardwareRequestModule,
            ],
        }).compile();

        ds = app.get(DataSource);
        commands = app.get(HardwareRequestCommandService);
        queries = app.get(HardwareRequestQueryService);
        catalog = app.get(HardwareCatalogService);
        comments = app.get(HardwareCommentService);

        // Prepare test users + site via direct inserts
        const userRepo = ds.getRepository(User);
        const siteRepo = ds.getRepository(Site);
        userId = (await userRepo.save(userRepo.create({
            email: `user-${Date.now()}@test`, fullName: 'Test User',
        } as any))).id;
        leadId = (await userRepo.save(userRepo.create({
            email: `lead-${Date.now()}@test`, fullName: 'Test Lead',
        } as any))).id;
        procId = (await userRepo.save(userRepo.create({
            email: `proc-${Date.now()}@test`, fullName: 'Test Proc',
        } as any))).id;
        siteId = (await siteRepo.save(siteRepo.create({
            name: `Test Site ${Date.now()}`,
        } as any))).id;
    });

    afterAll(async () => {
        await ds.destroy();
        await app.close();
    });

    it('runs DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → PROCUREMENT → INSTALLATION', async () => {
        const cat = await catalog.create({
            code: `TEST-${Date.now()}`, name: 'Test Laptop', category: ItemCategory.LAPTOP,
        } as any);

        const draft = await commands.createDraft(userId, {
            siteId, justification: 'Integration test journey end to end',
            items: [{ catalogId: cat.id, quantity: 1 }],
        } as any);
        expect(draft.status).toBe(RequestStatus.DRAFT);

        const submitted = await commands.submit(userId, draft.id);
        expect(submitted.status).toBe(RequestStatus.SUBMITTED);

        const reviewed = await commands.review(leadId, draft.id);
        expect(reviewed.status).toBe(RequestStatus.UNDER_REVIEW);

        const approved = await commands.approve(leadId, draft.id);
        expect(approved.status).toBe(RequestStatus.APPROVED);

        const itemId = approved.items[0].id;
        const procured = await commands.updateItem(procId, draft.id, itemId, {
            actualCost: 15000000, vendor: 'Acme', invoiceNumber: 'INV-1',
        } as any);
        expect(procured.status).toBe(RequestStatus.PROCUREMENT);

        const complete = await commands.completeProcurement(procId, draft.id);
        expect(complete.status).toBe(RequestStatus.INSTALLATION);

        // Comment by user
        const c1 = await comments.add(
            { id: userId, role: HardwareRole.USER }, draft.id, { body: 'Thanks!' },
        );
        expect(c1.body).toBe('Thanks!');

        // Query from user scope shows it
        const list = await queries.list(
            { id: userId, role: HardwareRole.USER }, { page: 1, pageSize: 10 } as any,
        );
        expect(list.rows.map((r) => r.id)).toContain(draft.id);
    });
});
```

- [ ] **Step 2: Configure `TEST_DATABASE_URL`**

Ensure a dedicated test DB is available. If none, this test can be skipped in CI with `describe.skip` gated on env var.

- [ ] **Step 3: Run**

Run: `cd apps/backend && TEST_DATABASE_URL=postgres://... npx jest hardware-request.integration`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/hardware-request/hardware-request.integration.spec.ts
git commit -m "test(hardware-request): add lifecycle integration test"
```

---

## Task 2.11: Final verification

- [ ] **Step 1: Unit tests**

Run: `cd apps/backend && npx jest src/modules/hardware-request`
Expected: all green, coverage still ≥80%.

- [ ] **Step 2: Lint**

Run: `cd apps/backend && npm run lint`

- [ ] **Step 3: Migration round-trip**

Run: `cd apps/backend && npm run migration:revert && npm run migration:run`
Expected: both migrations apply cleanly.

---

## Deliverables (Plan 2)

- [x] Entity: `HardwareRequestComment` + migration.
- [x] Command methods: `review`, `approve`, `reject`, `updateItem`, `completeProcurement`.
- [x] Services: `HardwareCommentService`, `HardwareActivityService`.
- [x] Controllers: comment, activity, extended request.
- [x] DTOs: reject, update-item, create/update-comment.
- [x] Unit + integration coverage.

---

## Out of Scope

- Plan 3: INSTALLATION + COMPLETED flow, barcode, WebSocket, notifications.
- Plan 4+: frontend.
