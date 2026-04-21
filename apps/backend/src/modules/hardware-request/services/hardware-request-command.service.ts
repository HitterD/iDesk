// apps/backend/src/modules/hardware-request/services/hardware-request-command.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { HR_EVT } from '../domain/events/hardware-request.events';
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
import { UpdateDraftDto } from '../dto/update-draft.dto';
import { RejectRequestDto } from '../dto/reject-request.dto';
import { UpdateItemDto } from '../dto/update-item.dto';
import {
    HardwareRequestNotFoundError,
    InvalidStateTransitionError,
    PermissionDeniedError,
} from '../domain/errors';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { InstallStatus } from '../domain/enums/install-status.enum';
import { HardwareAssetService } from './hardware-asset.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActingUser } from './installation-schedule.service';

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
        @InjectRepository(InstallationSchedule)
        private readonly scheduleRepo: Repository<InstallationSchedule>,
        private readonly assetSvc: HardwareAssetService,
        private readonly emitter: EventEmitter2,
    ) {}

    async createDraft(userId: string, dto: CreateRequestDto): Promise<HardwareRequest> {
        return this.dataSource.transaction(async (mgr) => {
            const requestRepo = mgr.getRepository(HardwareRequest);
            const activityRepo = mgr.getRepository(HardwareRequestActivity);

            const itemsWithSnapshot = [];
            for (const i of dto.items) {
                const cat = await this.catalog.ensureActive(i.catalogId);
                const snapshot = {
                    code: cat.code,
                    name: cat.name,
                    category: cat.category,
                    specs: cat.defaultSpecs ?? {},
                    customFields: i.customFields ?? {},
                };
                for (let qty = 0; qty < i.quantity; qty++) {
                    itemsWithSnapshot.push({
                        catalogId: cat.id,
                        quantity: 1, // expanded for individual tracking
                        notes: i.notes ?? null,
                        categorySnapshot: snapshot,
                    });
                }
            }

            const requestNumber = await this.numberer.generate();
            const entity = requestRepo.create({
                requestNumber,
                requesterId: userId,
                recipientId: dto.recipientId ?? null,
                recipientName: dto.recipientName ?? null,
                division: dto.division ?? null,
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
            if (dto.recipientName !== undefined) existing.recipientName = dto.recipientName ?? null;
            if (dto.division !== undefined) existing.division = dto.division ?? null;
            if (dto.justification !== undefined) existing.justification = dto.justification;

            if (dto.items) {
                // Replace items wholesale: delete old, create new snapshots.
                await itemRepo.delete({ requestId: existing.id });
                const expandedItems = [];
                for (const i of dto.items) {
                    const cat = await this.catalog.ensureActive(i.catalogId);
                    const snapshot = {
                        code: cat.code,
                        name: cat.name,
                        category: cat.category,
                        specs: cat.defaultSpecs ?? {},
                        customFields: i.customFields ?? {},
                    };
                    for (let qty = 0; qty < i.quantity; qty++) {
                        expandedItems.push(itemRepo.create({
                            requestId: existing.id,
                            catalogId: cat.id,
                            quantity: 1, // expanded for individual tracking
                            notes: i.notes ?? null,
                            categorySnapshot: snapshot,
                        }));
                    }
                }
                existing.items = expandedItems;
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

            this.emitter.emit(HR_EVT.SUBMITTED, {
                requestId: saved.id,
                actorId: userId,
                occurredAt: new Date(),
                requesterId: saved.requesterId,
            });

            return saved;
        });
    }

    async cancel(actor: { id: string, role: string }, requestId: string): Promise<HardwareRequest> {
        return this.dataSource.transaction(async (mgr) => {
            const requestRepo = mgr.getRepository(HardwareRequest);
            const activityRepo = mgr.getRepository(HardwareRequestActivity);

            const existing = await requestRepo.findOne({ where: { id: requestId } });
            if (!existing) throw new HardwareRequestNotFoundError(requestId);
            
            const isOwner = existing.requesterId === actor.id;
            const isIct = actor.role === 'ICT_STAFF';
            
            if (!isOwner && !isIct) {
                throw new PermissionDeniedError('cancel this request');
            }

            const CANCELLABLE_USER = [RequestStatus.DRAFT, RequestStatus.SUBMITTED];
            const CANCELLABLE_ICT = [RequestStatus.DRAFT, RequestStatus.SUBMITTED, RequestStatus.AWAITING_DELIVERY, RequestStatus.INSTALLATION];

            const allowedStatuses = isIct ? CANCELLABLE_ICT : CANCELLABLE_USER;

            if (!allowedStatuses.includes(existing.status)) {
                throw new InvalidStateTransitionError(existing.status, RequestStatus.CANCELLED);
            }

            const fromStatus = existing.status;
            existing.status = RequestStatus.CANCELLED;
            const saved = await requestRepo.save(existing);

            await activityRepo.save(activityRepo.create({
                requestId: saved.id,
                actorId: actor.id,
                action: ActivityAction.CANCELLED,
                fromStatus: fromStatus,
                toStatus: RequestStatus.CANCELLED,
                metadata: {},
            }));

            this.emitter.emit(HR_EVT.CANCELLED, {
                requestId: saved.id,
                actorId: actor.id,
                occurredAt: new Date(),
                requesterId: saved.requesterId,
                fromStatus: fromStatus,
            });

            return saved;
        });
    }

    async close(userId: string, requestId: string): Promise<HardwareRequest> {
        return this.dataSource.transaction(async (mgr) => {
            const requestRepo = mgr.getRepository(HardwareRequest);
            const activityRepo = mgr.getRepository(HardwareRequestActivity);

            const existing = await requestRepo.findOne({ where: { id: requestId } });
            if (!existing) throw new HardwareRequestNotFoundError(requestId);
            
            if (existing.status !== RequestStatus.COMPLETED) {
                throw new InvalidStateTransitionError(existing.status, RequestStatus.CLOSED);
            }

            existing.status = RequestStatus.CLOSED;
            const saved = await requestRepo.save(existing);

            await activityRepo.save(activityRepo.create({
                requestId: saved.id,
                actorId: userId,
                action: ActivityAction.CLOSED,
                fromStatus: RequestStatus.COMPLETED,
                toStatus: RequestStatus.CLOSED,
                metadata: {},
            }));

            this.emitter.emit(HR_EVT.CLOSED, {
                requestId: saved.id,
                actorId: userId,
                occurredAt: new Date(),
                requesterId: saved.requesterId,
            });

            return saved;
        });
    }

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

            this.emitter.emit(HR_EVT.APPROVED, {
                requestId: saved.id,
                actorId: userId,
                occurredAt: new Date(),
                requesterId: saved.requesterId,
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

            this.emitter.emit(HR_EVT.REJECTED, {
                requestId: saved.id,
                actorId: userId,
                occurredAt: new Date(),
                requesterId: saved.requesterId,
                reason: dto.reason,
            });

            return saved;
        });
    }

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

    async completeInstallation(requestId: string, actor: ActingUser): Promise<HardwareRequest> {
        const req = await this.requestRepo.findOne({
            where: { id: requestId }, relations: ['items'],
        });
        if (!req) throw new NotFoundException('request');
        if (req.status !== RequestStatus.INSTALLATION) throw new ConflictException('HR_INVALID_TRANSITION');
        if (actor.role !== 'ICT_STAFF') throw new ForbiddenException('HR_PERMISSION_DENIED');

        const sched = await this.scheduleRepo.findOne({ where: { requestId, status: InstallStatus.DONE }, order: { createdAt: 'DESC' } });
        if (!sched) throw new ConflictException('schedule not done');

        req.status = RequestStatus.COMPLETED;
        req.completedAt = new Date();
        req.version += 1;
        const saved = await this.requestRepo.save(req);

        await this.activityRepo.save(this.activityRepo.create({
            requestId: saved.id, actorId: actor.id, action: ActivityAction.INSTALL_COMPLETED,
            metadata: { scheduleId: sched.id },
            fromStatus: RequestStatus.INSTALLATION, toStatus: RequestStatus.COMPLETED,
        }));
        
        this.emitter.emit(HR_EVT.INSTALL_COMPLETED, {
            requestId,
            actorId: actor.id,
            occurredAt: new Date(),
            requesterId: saved.requesterId,
        });

        return saved;
    }
}
