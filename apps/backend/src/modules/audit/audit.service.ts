import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, ILike } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';
import { Request } from 'express';
import * as ExcelJS from 'exceljs';

export interface LogOptions {
    userId: string;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
    description?: string;
    request?: Request;
}

export interface QueryOptions {
    userId?: string;
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    searchQuery?: string;
    page?: number;
    limit?: number;
}

export interface AuditStats {
    totalLogs: number;
    loginsToday: number;
    changesLast24h: number;
    failedAuthAttempts: number;
    topActions: { action: string; count: number }[];
}

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(
        @InjectRepository(AuditLog)
        private readonly auditRepo: Repository<AuditLog>,
    ) { }

    /**
     * Log an audit event (synchronous)
     */
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
        } as Partial<AuditLog>);

        const saved = await this.auditRepo.save(auditLog);
        this.logger.debug(`Audit log created: ${action} on ${entityType}/${entityId} by ${userId}`);
        return saved;
    }

    /**
     * Log an audit event (non-blocking, fire-and-forget)
     * Use this for performance-critical paths where audit logging should not block
     */
    logAsync(options: LogOptions): void {
        setImmediate(async () => {
            try {
                await this.log(options);
            } catch (error) {
                this.logger.error(`Failed to log audit event: ${error.message}`, error.stack);
            }
        });
    }

    /**
     * Find all audit logs with optional filters
     */
    async findAll(options: QueryOptions = {}) {
        const {
            userId,
            action,
            entityType,
            entityId,
            startDate,
            endDate,
            searchQuery,
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

        // Server-side search across multiple fields
        if (searchQuery) {
            qb.andWhere(
                `(user.fullName ILIKE :search OR user.email ILIKE :search OR audit.description ILIKE :search OR CAST(audit.entityId AS TEXT) ILIKE :search)`,
                { search: `%${searchQuery}%` }
            );
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

    /**
     * Get audit statistics for dashboard cards
     */
    async getStats(): Promise<AuditStats> {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Total logs count
        const totalLogs = await this.auditRepo.count();

        // Logins today
        const loginsToday = await this.auditRepo.count({
            where: {
                action: AuditAction.USER_LOGIN,
                createdAt: MoreThanOrEqual(todayStart),
            },
        });

        // Changes in last 24 hours (excluding login/logout)
        const changesLast24h = await this.auditRepo
            .createQueryBuilder('audit')
            .where('audit.createdAt >= :yesterday', { yesterday })
            .andWhere('audit.action NOT IN (:...excludeActions)', {
                excludeActions: [AuditAction.USER_LOGIN, AuditAction.USER_LOGOUT],
            })
            .getCount();

        // Failed auth attempts (last 24h)
        const failedAuthAttempts = await this.auditRepo.count({
            where: {
                action: AuditAction.LOGIN_FAILED,
                createdAt: MoreThanOrEqual(yesterday),
            },
        });

        // Top actions (last 7 days)
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const topActionsRaw = await this.auditRepo
            .createQueryBuilder('audit')
            .select('audit.action', 'action')
            .addSelect('COUNT(*)', 'count')
            .where('audit.createdAt >= :weekAgo', { weekAgo })
            .groupBy('audit.action')
            .orderBy('count', 'DESC')
            .limit(5)
            .getRawMany();

        const topActions = topActionsRaw.map(row => ({
            action: row.action,
            count: parseInt(row.count),
        }));

        return {
            totalLogs,
            loginsToday,
            changesLast24h,
            failedAuthAttempts,
            topActions,
        };
    }

    /**
     * Export audit logs to CSV format
     */
    async exportCsv(options: QueryOptions = {}): Promise<{ data: string; filename: string }> {
        // Remove pagination for export
        const { page, limit, ...exportOptions } = options;
        const result = await this.findAll({ ...exportOptions, page: 1, limit: 10000 });

        const headers = ['Timestamp', 'User', 'Email', 'Action', 'Entity Type', 'Entity ID', 'Description', 'IP Address'];
        const rows = result.data.map(log => [
            log.createdAt.toISOString(),
            log.user?.fullName || 'System',
            log.user?.email || '-',
            log.action,
            log.entityType,
            log.entityId || '-',
            log.description || '-',
            log.ipAddress || '-',
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        ].join('\n');

        return {
            data: csvContent,
            filename: `audit-logs-${new Date().toISOString().split('T')[0]}.csv`,
        };
    }

    /**
     * Export audit logs to XLSX format
     */
    async exportXlsx(options: QueryOptions = {}): Promise<Buffer> {
        // Remove pagination for export
        const { page, limit, ...exportOptions } = options;
        const result = await this.findAll({ ...exportOptions, page: 1, limit: 10000 });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'iDesk Audit System';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Audit Logs');

        // Headers
        const headers = ['Timestamp', 'User', 'Email', 'Action', 'Entity Type', 'Entity ID', 'Description', 'IP Address'];
        const headerRow = sheet.addRow(headers);
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
            cell.alignment = { horizontal: 'center' };
        });

        // Data rows
        for (const log of result.data) {
            sheet.addRow([
                log.createdAt.toISOString(),
                log.user?.fullName || 'System',
                log.user?.email || '-',
                log.action,
                log.entityType,
                log.entityId || '-',
                log.description || '-',
                log.ipAddress || '-',
            ]);
        }

        // Auto-fit columns
        sheet.columns.forEach(column => {
            column.width = 20;
        });

        return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    /**
     * Get logs grouped by date for timeline view
     */
    async getTimeline(date: string): Promise<{ hour: string; logs: AuditLog[] }[]> {
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

        const logs = await this.auditRepo.find({
            where: {
                createdAt: Between(startOfDay, endOfDay),
            },
            relations: ['user'],
            order: { createdAt: 'DESC' },
        });

        // Group by hour
        const grouped = new Map<string, AuditLog[]>();
        for (const log of logs) {
            const hour = log.createdAt.toISOString().slice(11, 13) + ':00';
            if (!grouped.has(hour)) {
                grouped.set(hour, []);
            }
            grouped.get(hour)!.push(log);
        }

        return Array.from(grouped.entries())
            .map(([hour, logs]) => ({ hour, logs }))
            .sort((a, b) => b.hour.localeCompare(a.hour));
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
