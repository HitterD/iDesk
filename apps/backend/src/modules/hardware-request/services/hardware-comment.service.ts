import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HR_EVT } from '../domain/events/hardware-request.events';
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
        private readonly emitter: EventEmitter2,
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
            order: { createdAt: 'DESC' },
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

            // Compute subscribers: requester + anyone who acted on the request
            const activities = await activityRepo.find({ where: { requestId }, select: ['actorId'] });
            const reqData = await this.requestRepo.findOne({ where: { id: requestId } });
            const subs = new Set<string>();
            if (reqData?.requesterId) subs.add(reqData.requesterId);
            activities.forEach(a => {
                if (a.actorId) subs.add(a.actorId);
            });

            this.emitter.emit(HR_EVT.COMMENTED, {
                requestId,
                actorId: user.id,
                occurredAt: new Date(),
                commentId: saved.id,
                body: saved.body,
                subscribers: Array.from(subs),
            });

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
        const isLead = user.role === HardwareRole.ICT_STAFF;
        if (!isAuthor && !isLead) {
            throw new PermissionDeniedError('delete this comment');
        }
        existing.deletedAt = new Date();
        await this.repo.save(existing);
    }
}
