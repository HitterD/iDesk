import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractAuditLog, ContractAuditAction } from '../entities/contract-audit-log.entity';
import { RenewalContract } from '../entities/renewal-contract.entity';

export interface AuditLogInput {
    contractId: string;
    action: ContractAuditAction;
    performedById?: string;
    description?: string;
    previousData?: Record<string, any>;
    newData?: Record<string, any>;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

@Injectable()
export class ContractAuditService {
    private readonly logger = new Logger(ContractAuditService.name);

    constructor(
        @InjectRepository(ContractAuditLog)
        private readonly auditLogRepo: Repository<ContractAuditLog>,
    ) { }

    async log(input: AuditLogInput): Promise<ContractAuditLog> {
        const log = this.auditLogRepo.create({
            contractId: input.contractId,
            action: input.action,
            performedById: input.performedById,
            description: input.description || this.generateDescription(input.action),
            previousData: input.previousData,
            newData: input.newData,
            metadata: input.metadata,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });

        const saved = await this.auditLogRepo.save(log);
        this.logger.debug(`Audit log created: ${input.action} for contract ${input.contractId}`);
        return saved;
    }

    async logCreate(contract: RenewalContract, userId: string): Promise<void> {
        await this.log({
            contractId: contract.id,
            action: ContractAuditAction.CREATED,
            performedById: userId,
            newData: this.contractSnapshot(contract),
            description: `Contract created: ${contract.poNumber || contract.originalFileName}`,
        });
    }

    async logUpdate(contractId: string, previousData: Partial<RenewalContract>, newData: Partial<RenewalContract>, userId: string): Promise<void> {
        const changedFields = (Object.keys(newData) as Array<keyof RenewalContract>).filter(key => newData[key] !== previousData[key]);

        await this.log({
            contractId,
            action: ContractAuditAction.UPDATED,
            performedById: userId,
            previousData,
            newData,
            description: `Updated fields: ${changedFields.join(', ')}`,
            metadata: { changedFields },
        });
    }

    async logDelete(contract: RenewalContract, userId: string): Promise<void> {
        await this.log({
            contractId: contract.id,
            action: ContractAuditAction.DELETED,
            performedById: userId,
            previousData: this.contractSnapshot(contract),
            description: `Contract deleted: ${contract.poNumber || contract.originalFileName}`,
        });
    }

    async logAcknowledge(contractId: string, userId: string, acknowledged: boolean): Promise<void> {
        await this.log({
            contractId,
            action: acknowledged ? ContractAuditAction.ACKNOWLEDGED : ContractAuditAction.UNACKNOWLEDGED,
            performedById: userId,
            description: acknowledged ? 'Contract acknowledged' : 'Contract acknowledgement revoked',
        });
    }

    async logStatusChange(contractId: string, previousStatus: string, newStatus: string): Promise<void> {
        await this.log({
            contractId,
            action: ContractAuditAction.STATUS_CHANGED,
            previousData: { status: previousStatus },
            newData: { status: newStatus },
            description: `Status changed from ${previousStatus} to ${newStatus}`,
        });
    }

    async logReminderSent(contractId: string, reminderType: string): Promise<void> {
        await this.log({
            contractId,
            action: ContractAuditAction.REMINDER_SENT,
            description: `${reminderType} reminder sent`,
            metadata: { reminderType },
        });
    }

    async getContractHistory(contractId: string, limit = 50): Promise<ContractAuditLog[]> {
        return this.auditLogRepo.find({
            where: { contractId },
            relations: ['performedBy'],
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }

    async getRecentActivity(limit = 100): Promise<ContractAuditLog[]> {
        return this.auditLogRepo.find({
            relations: ['performedBy', 'contract'],
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }

    private generateDescription(action: ContractAuditAction): string {
        switch (action) {
            case ContractAuditAction.CREATED: return 'Contract created';
            case ContractAuditAction.UPDATED: return 'Contract updated';
            case ContractAuditAction.DELETED: return 'Contract deleted';
            case ContractAuditAction.ACKNOWLEDGED: return 'Contract acknowledged';
            case ContractAuditAction.UNACKNOWLEDGED: return 'Acknowledgement revoked';
            case ContractAuditAction.STATUS_CHANGED: return 'Status changed';
            case ContractAuditAction.REMINDER_SENT: return 'Reminder sent';
            case ContractAuditAction.FILE_UPLOADED: return 'File uploaded';
            default: return 'Action performed';
        }
    }

    private contractSnapshot(contract: RenewalContract): Record<string, any> {
        return {
            id: contract.id,
            poNumber: contract.poNumber,
            vendorName: contract.vendorName,
            description: contract.description,
            category: contract.category,
            contractValue: contract.contractValue,
            startDate: contract.startDate,
            endDate: contract.endDate,
            status: contract.status,
            isAcknowledged: contract.isAcknowledged,
        };
    }

    // === EXPORT AUDIT LOGS ===
    async exportAuditLogs(filters: {
        fromDate?: string;
        toDate?: string;
        contractId?: string;
    }): Promise<{
        data: string;
        filename: string;
        contentType: string;
        count: number;
    }> {
        const query = this.auditLogRepo
            .createQueryBuilder('log')
            .leftJoinAndSelect('log.performedBy', 'user')
            .leftJoinAndSelect('log.contract', 'contract')
            .orderBy('log.createdAt', 'DESC');

        if (filters.contractId) {
            query.andWhere('log.contractId = :contractId', { contractId: filters.contractId });
        }

        if (filters.fromDate) {
            query.andWhere('log.createdAt >= :fromDate', { fromDate: filters.fromDate });
        }

        if (filters.toDate) {
            query.andWhere('log.createdAt <= :toDate', { toDate: filters.toDate });
        }

        const logs = await query.getMany();

        // Generate CSV
        const headers = [
            'Timestamp',
            'Action',
            'Contract PO',
            'Contract Vendor',
            'Performed By',
            'Description',
            'Previous Data',
            'New Data',
        ];

        const rows = logs.map(log => [
            log.createdAt?.toISOString() || '',
            log.action || '',
            log.contract?.poNumber || '',
            log.contract?.vendorName || '',
            log.performedBy?.fullName || log.performedBy?.email || 'System',
            log.description || '',
            log.previousData ? JSON.stringify(log.previousData) : '',
            log.newData ? JSON.stringify(log.newData) : '',
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const timestamp = new Date().toISOString().split('T')[0];

        return {
            data: csvContent,
            filename: `audit-logs-${timestamp}.csv`,
            contentType: 'text/csv',
            count: logs.length,
        };
    }
}
