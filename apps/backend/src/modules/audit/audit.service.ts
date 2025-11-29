import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';
import { Request } from 'express';

interface LogOptions {
    userId: string;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
    description?: string;
    request?: Request;
}

interface QueryOptions {
    userId?: string;
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(
        @InjectRepository(AuditLog)
        private readonly auditRepo: Repository<AuditLog>,
    ) {}

    async log(options: LogOptions): Promise<AuditLog> {
        const { userId, action, entityType, entityId, oldValue, newValue, description, request } = options;

        const auditLog = this.auditRepo.create({
            userId,
            action,
            entityType,
            entityId,
            oldValue,
            newValue,
            description,
            ipAddress: request ? this.getClientIp(request) : null,
            userAgent: request?.headers['user-agent'] || null,
        });

        const saved = await this.auditRepo.save(auditLog);
        this.logger.debug(`Audit log created: ${action} on ${entityType}/${entityId} by ${userId}`);
        return saved;
    }

    async findAll(options: QueryOptions = {}) {
        const {
            userId,
            action,
            entityType,
            entityId,
            startDate,
            endDate,
            page = 1,
            limit = 50,
        } = options;

        const qb = this.auditRepo
            .createQueryBuilder('audit')
            .leftJoinAndSelect('audit.user', 'user')
            .orderBy('audit.createdAt', 'DESC');

        if (userId) {
            qb.andWhere('audit.userId = :userId', { userId });
        }

        if (action) {
            qb.andWhere('audit.action = :action', { action });
        }

        if (entityType) {
            qb.andWhere('audit.entityType = :entityType', { entityType });
        }

        if (entityId) {
            qb.andWhere('audit.entityId = :entityId', { entityId });
        }

        if (startDate) {
            qb.andWhere('audit.createdAt >= :startDate', { startDate });
        }

        if (endDate) {
            qb.andWhere('audit.createdAt <= :endDate', { endDate });
        }

        const total = await qb.getCount();
        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);

        const data = await qb.getMany();

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
        return this.auditRepo.find({
            where: { entityType, entityId },
            relations: ['user'],
            order: { createdAt: 'DESC' },
        });
    }

    async getRecentActivity(limit: number = 20): Promise<AuditLog[]> {
        return this.auditRepo.find({
            relations: ['user'],
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }

    private getClientIp(request: Request): string {
        const forwarded = request.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
            return forwarded.split(',')[0].trim();
        }
        return request.ip || request.socket?.remoteAddress || 'unknown';
    }
}
