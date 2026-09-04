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
import { UserRole } from '../../users/enums/user-role.enum';
import { SiteActor, resolveSiteScope, assertSiteAccess } from '../../../shared/core/utils/site-scope.util';

export interface ActingUser {
    id: string;
    role: HardwareRole;
    // Site isolation context: pass through from req.user (UserRole + siteId)
    // HardwareRoleGuard flattens roles to HardwareRole; we still need the real UserRole for cross-site decisions.
    siteId?: string | null;
    userRole?: UserRole;
}

@Injectable()
export class HardwareRequestQueryService {
    constructor(
        @InjectRepository(HardwareRequest)
        private readonly repo: Repository<HardwareRequest>,
    ) {}

    async list(
        user: ActingUser & { siteId?: string | null; userRole?: UserRole },
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

        // Site isolation via SiteActor (UserRole + siteId). dto.siteId may be used by cross-site to narrow.
        const actor: SiteActor = {
            role: (user.userRole as UserRole) ?? (user.role as any as UserRole),
            siteId: user.siteId ?? null,
        };
        const scope = resolveSiteScope(actor);
        if (scope.mode === 'site') {
            qb.andWhere('r.siteId = :siteId', { siteId: scope.siteId });
        } else if (scope.mode === 'none') {
            qb.andWhere('1 = 0');
        }
        if (scope.mode === 'all' && dto.siteId) {
            qb.andWhere('r.siteId = :siteId', { siteId: dto.siteId });
        }

        if (dto.requesterId && user.role !== HardwareRole.USER) {
            qb.andWhere('r.requesterId = :reqId', { reqId: dto.requesterId });
        }
        if (dto.search) {
            qb.andWhere(
                '(r.requestNumber ILIKE :q OR r.justification ILIKE :q OR items.categorySnapshot->>\'name\' ILIKE :q OR requester.fullName ILIKE :q)',
                { q: `%${dto.search}%` },
            );
        }

        const page = dto.page ?? 1;
        const pageSize = dto.pageSize ?? 20;
        qb.orderBy('r.createdAt', 'DESC').skip((page - 1) * pageSize).take(pageSize);

        const [rows, total] = await qb.getManyAndCount();
        return { rows, total };
    }

    async getById(user: ActingUser & { siteId?: string | null; userRole?: UserRole }, id: string): Promise<HardwareRequest> {
        const found = await this.repo.findOne({
            where: { id },
            relations: {
                items: true,
                requester: true,
                recipient: true,
                site: true,
                schedules: {
                    technician: true,
                    items: {
                        item: true,
                    },
                },
            },
        });
        if (!found) throw new HardwareRequestNotFoundError(id);

        // Site isolation: if actor carries site context, enforce it (fail-closed for non-cross)
        if (user.siteId !== undefined && user.siteId !== null) {
            const actorRole = (user.userRole as UserRole) ?? (user.role as any as UserRole);
            const actor: SiteActor = { role: actorRole, siteId: user.siteId };
            assertSiteAccess(actor, found.siteId);
        }

        if (user.role === HardwareRole.USER && found.requesterId !== user.id) {
            throw new PermissionDeniedError('view this request');
        }
        return found;
    }

    async findById(id: string): Promise<HardwareRequest> {
        const found = await this.repo.findOne({
            where: { id },
            relations: {
                items: true,
                requester: true,
                recipient: true,
                site: true,
                schedules: {
                    technician: true,
                    items: {
                        item: true,
                    },
                },
            },
        });
        if (!found) throw new HardwareRequestNotFoundError(id);
        return found;
    }
}
