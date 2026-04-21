import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, ILike } from 'typeorm';
import { ZoomAuditLog } from '../entities';

export interface AuditLogFilters {
    action?: string;
    userId?: string;
    zoomBookingId?: string;
    startDate?: Date;
    endDate?: Date;
}

@Injectable()
export class ZoomAuditLogService {
    private readonly logger = new Logger(ZoomAuditLogService.name);

    constructor(
        @InjectRepository(ZoomAuditLog)
        private readonly auditLogRepo: Repository<ZoomAuditLog>,
    ) { }

    /**
     * Create audit log entry
     */
    async log(data: {
        action: string;
        userId: string;
        zoomBookingId?: string;
        oldValues?: Record<string, any>;
        newValues?: Record<string, any>;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<ZoomAuditLog> {
        const log = this.auditLogRepo.create(data);
        return this.auditLogRepo.save(log);
    }

    /**
     * Find audit logs with pagination and filters
     */
    async findAll(
        page: number = 1,
        limit: number = 20,
        filters?: AuditLogFilters,
    ): Promise<{
        data: ZoomAuditLog[];
        total: number;
        totalPages: number;
        page: number;
        limit: number;
    }> {
        const where: any = {};

        if (filters?.action) {
            where.action = filters.action;
        }

        if (filters?.userId) {
            where.userId = filters.userId;
        }

        if (filters?.zoomBookingId) {
            where.zoomBookingId = filters.zoomBookingId;
        }

        if (filters?.startDate && filters?.endDate) {
            where.createdAt = Between(filters.startDate, filters.endDate);
        } else if (filters?.startDate) {
            where.createdAt = MoreThanOrEqual(filters.startDate);
        } else if (filters?.endDate) {
            where.createdAt = LessThanOrEqual(filters.endDate);
        }

        const [data, total] = await this.auditLogRepo.findAndCount({
            where,
            relations: ['user', 'booking'],
            order: { createdAt: 'DESC' },
            take: limit,
            skip: (page - 1) * limit,
        });

        // Transform for frontend
        const transformedData = data.map(log => ({
            id: log.id,
            action: log.action,
            entityType: log.zoomBookingId ? 'BOOKING' : 'SETTINGS',
            entityId: log.zoomBookingId,
            details: this.formatDetails(log),
            performedBy: log.user ? {
                id: log.user.id,
                fullName: log.user.fullName,
                email: log.user.email,
            } : undefined,
            createdAt: log.createdAt.toISOString(),
        }));

        return {
            data: transformedData as any,
            total,
            totalPages: Math.ceil(total / limit),
            page,
            limit,
        };
    }

    /**
     * Format log details for display
     */
    private formatDetails(log: ZoomAuditLog): string {
        const action = log.action;

        switch (action) {
            case 'BOOKING_CREATED':
                return `Created booking "${log.newValues?.title || 'N/A'}"`;
            case 'BOOKING_CANCELLED':
                return `Cancelled booking. Reason: ${log.newValues?.cancellationReason || 'N/A'}`;
            case 'BOOKING_UPDATED':
                return `Updated booking fields: ${Object.keys(log.newValues || {}).join(', ')}`;
            case 'SETTINGS_UPDATED':
                return `Updated settings: ${Object.keys(log.newValues || {}).join(', ')}`;
            case 'ACCOUNT_UPDATED':
                return `Updated account: ${log.newValues?.name || 'N/A'}`;
            default:
                return JSON.stringify(log.newValues || {});
        }
    }

    /**
     * Get recent activity for dashboard
     */
    async getRecentActivity(limit: number = 10): Promise<ZoomAuditLog[]> {
        return this.auditLogRepo.find({
            relations: ['user', 'booking'],
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }
}
