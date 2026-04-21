import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, In, DataSource } from 'typeorm';
import { RenewalContract, ContractStatus, ContractCategory } from './entities/renewal-contract.entity';
import { PdfExtractionService } from './services/pdf-extraction.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import * as fs from 'fs';
import * as path from 'path';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class RenewalService {
    private readonly logger = new Logger(RenewalService.name);

    constructor(
        private readonly auditService: AuditService,
        @InjectRepository(RenewalContract)
        private readonly contractRepo: Repository<RenewalContract>,
        private readonly pdfExtractionService: PdfExtractionService,
        private readonly dataSource: DataSource,
    ) { }

    // === DUPLICATE CHECK ===
    async checkDuplicate(poNumber: string): Promise<{ isDuplicate: boolean; existingContract?: RenewalContract }> {
        if (!poNumber) return { isDuplicate: false };

        const existing = await this.contractRepo.findOne({
            where: { poNumber },
            relations: ['uploadedBy'],
        });

        if (existing) {
            this.logger.warn(`Duplicate PO number detected: ${poNumber}`);
            return { isDuplicate: true, existingContract: existing };
        }

        return { isDuplicate: false };
    }

    // === UPLOAD & EXTRACT ===
    async uploadAndExtract(
        file: Express.Multer.File,
        uploadedById: string,
    ): Promise<{ contract: RenewalContract; extraction: any }> {
        // 1. Extract data from PDF
        const extraction = await this.pdfExtractionService.extractFromFile(file.path);

        // 2. Create contract record
        const contract = this.contractRepo.create({
            originalFileName: file.originalname,
            filePath: `/uploads/contracts/${file.filename}`,
            fileSize: file.size,
            uploadedById,
            poNumber: extraction.poNumber,
            vendorName: extraction.vendorName,
            startDate: extraction.startDate,
            endDate: extraction.endDate,
            description: extraction.description,
            contractValue: extraction.contractValue,
            extractionStrategy: extraction.strategy,
            extractionConfidence: extraction.confidence,
            rawExtractedData: extraction,
            status: extraction.endDate ? ContractStatus.ACTIVE : ContractStatus.DRAFT,
        } as Partial<RenewalContract>);

        // 3. Calculate initial status
        if (contract.endDate) {
            contract.status = this.calculateStatus(contract.endDate);
        }

        const saved = await this.contractRepo.save(contract);

        this.logger.log(`Contract uploaded: ${saved.id} (${extraction.strategy}, confidence: ${extraction.confidence})`);

        return { contract: saved, extraction };
    }

    // === CREATE MANUAL (No PDF) ===
    async createManual(
        dto: CreateContractDto,
        uploadedById: string,
    ): Promise<RenewalContract> {
        // ENFORCE DUPLICATE CHECK
        if (dto.poNumber) {
            const { isDuplicate, existingContract } = await this.checkDuplicate(dto.poNumber);
            if (isDuplicate) {
                throw new ConflictException({
                    message: `Contract with PO number "${dto.poNumber}" already exists`,
                    existingId: existingContract?.id,
                    existingVendor: existingContract?.vendorName,
                });
            }
        }

        const contract = this.contractRepo.create({
            originalFileName: 'Manual Entry',
            filePath: '',
            fileSize: 0,
            uploadedById,
            poNumber: dto.poNumber || null,
            vendorName: dto.vendorName || null,
            startDate: dto.startDate ? new Date(dto.startDate) : null,
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            description: dto.description || null,
            contractValue: dto.contractValue || null,
            extractionStrategy: 'MANUAL',
            extractionConfidence: 1.0,
            status: dto.endDate ? ContractStatus.ACTIVE : ContractStatus.DRAFT,
        } as Partial<RenewalContract>);

        // Calculate status if endDate exists
        if (contract.endDate) {
            contract.status = this.calculateStatus(contract.endDate);
        }

        const saved = await this.contractRepo.save(contract);
        this.logger.log(`Contract created manually: ${saved.id}`);

        return saved;
    }

    // === BULK OPERATIONS ===
    async bulkAcknowledge(ids: string[], userId: string): Promise<{ affected: number }> {
        if (!ids || ids.length === 0) {
            throw new BadRequestException('No contract IDs provided');
        }

        const result = await this.contractRepo.update(
            { id: In(ids) },
            {
                isAcknowledged: true,
                acknowledgedById: userId,
                acknowledgedAt: new Date(),
            },
        );

        this.logger.log(`Bulk acknowledged ${result.affected} contracts by user ${userId}`);
        return { affected: result.affected || 0 };
    }

    async bulkDelete(ids: string[], userId?: string): Promise<{ affected: number; filesDeleted: number }> {
        if (!ids || ids.length === 0) {
            throw new BadRequestException('No contract IDs provided');
        }

        // Use transaction for data consistency
        return await this.dataSource.transaction(async (manager) => {
            // Get contracts to find file paths for cleanup
            const contracts = await manager.find(RenewalContract, { where: { id: In(ids) } });

            // Delete from database within transaction
            const result = await manager.softDelete(RenewalContract, { id: In(ids) });

            // Clean up files (after successful DB deletion)
            let filesDeleted = 0;
            for (const contract of contracts) {
                if (contract.filePath && contract.filePath !== '') {
                    try {
                        const fullPath = path.join(process.cwd(), contract.filePath);
                        if (fs.existsSync(fullPath)) {
                            fs.unlinkSync(fullPath);
                            filesDeleted++;
                        }
                    } catch (err) {
                        this.logger.warn(`Failed to delete file for contract ${contract.id}: ${err.message}`);
                    }
                }
            }

            this.logger.log(`Bulk deleted ${result.affected} contracts, removed ${filesDeleted} files`);
            return { affected: result.affected || 0, filesDeleted };
        });
    }

    // === CRUD OPERATIONS ===
    async findAll(filters?: {
        status?: ContractStatus;
        category?: ContractCategory;
        search?: string;
        page?: number;
        limit?: number;
        fromDate?: string;  // ISO date string
        toDate?: string;    // ISO date string
    }): Promise<{ items: RenewalContract[]; total: number; page: number; limit: number; totalPages: number }> {
        const page = Math.max(1, filters?.page || 1);
        const limit = Math.min(100, Math.max(1, filters?.limit || 25));
        const skip = (page - 1) * limit;

        const query = this.contractRepo
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.uploadedBy', 'uploader')
            .leftJoinAndSelect('c.acknowledgedBy', 'acknowledger')
            .orderBy('c.endDate', 'ASC', 'NULLS LAST');

        if (filters?.status) {
            query.andWhere('c.status = :status', { status: filters.status });
        }

        if (filters?.category) {
            query.andWhere('c.category = :category', { category: filters.category });
        }

        if (filters?.search) {
            query.andWhere(
                '(c.poNumber ILIKE :search OR c.vendorName ILIKE :search OR c.originalFileName ILIKE :search)',
                { search: `%${filters.search}%` },
            );
        }

        // Date range filtering for calendar performance
        if (filters?.fromDate) {
            query.andWhere('c.endDate >= :fromDate', { fromDate: filters.fromDate });
        }

        if (filters?.toDate) {
            query.andWhere('c.endDate <= :toDate', { toDate: filters.toDate });
        }

        const [items, total] = await query
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findOne(id: string): Promise<RenewalContract> {
        const contract = await this.contractRepo.findOne({
            where: { id },
            relations: ['uploadedBy'],
        });

        if (!contract) {
            throw new NotFoundException(`Contract with ID ${id} not found`);
        }

        return contract;
    }

    async update(id: string, dto: UpdateContractDto, userId?: string): Promise<RenewalContract> {
        const contract = await this.findOne(id);

        // Update fields
        if (dto.poNumber !== undefined) contract.poNumber = dto.poNumber;
        if (dto.vendorName !== undefined) contract.vendorName = dto.vendorName;
        if (dto.description !== undefined) contract.description = dto.description;
        if (dto.contractValue !== undefined) contract.contractValue = dto.contractValue;
        if (dto.startDate !== undefined) contract.startDate = dto.startDate ? new Date(dto.startDate) : null;

        // Recalculate status if endDate changed
        if (dto.endDate !== undefined) {
            contract.endDate = dto.endDate ? new Date(dto.endDate) : null;
            if (contract.endDate) {
                contract.status = this.calculateStatus(contract.endDate);
            } else {
                contract.status = ContractStatus.DRAFT;
            }
        }

        return this.contractRepo.save(contract);
    }

    async delete(id: string, userId?: string): Promise<void> {
        const contract = await this.findOne(id);
        await this.contractRepo.softRemove(contract);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.CONTRACT_DELETE,
                entityType: 'RenewalContract',
                entityId: id,
                description: `Deleted contract ${contract.poNumber || contract.id}`,
            });
        }
    }

    // === RENEWAL WORKFLOW ===
    /**
     * Create a new contract version as renewal of an existing contract
     * Copies data from previous contract with new dates
     */
    async renewContract(
        id: string,
        renewalData: {
            newEndDate: Date;
            newStartDate?: Date;
            newContractValue?: number;
            notes?: string;
        },
        renewedById: string,
    ): Promise<RenewalContract> {
        const previousContract = await this.findOne(id);

        const newContract = this.contractRepo.create({
            // Copy from previous
            poNumber: `${previousContract.poNumber}-R`,
            vendorName: previousContract.vendorName,
            description: renewalData.notes || previousContract.description,
            category: previousContract.category,
            contractValue: renewalData.newContractValue ?? previousContract.contractValue,
            originalFileName: `Renewal of ${previousContract.originalFileName}`,
            filePath: previousContract.filePath, // Can override later with new PDF

            // New dates
            startDate: renewalData.newStartDate || new Date(),
            endDate: renewalData.newEndDate,
            status: this.calculateStatus(renewalData.newEndDate),

            // Relations
            uploadedBy: { id: renewedById } as any,

            // Link to previous contract
            previousContractId: previousContract.id,
        } as Partial<RenewalContract>);

        const saved = await this.contractRepo.save(newContract);

        // Mark previous contract as renewed
        previousContract.isRenewed = true;
        previousContract.renewedContractId = saved.id;
        await this.contractRepo.save(previousContract);

        this.logger.log(`Contract ${id} renewed to ${saved.id}`);

        return saved;
    }

    // === DASHBOARD STATS ===
    async getDashboardStats(): Promise<{
        total: number;
        active: number;
        expiringSoon: number;
        expired: number;
        draft: number;
        // Cost analytics
        totalContractValue: number;
        activeContractValue: number;
        expiringSoonValue: number;
        valueByCategory: Record<string, number>;
    }> {
        const [total, active, expiringSoon, expired, draft] = await Promise.all([
            this.contractRepo.count(),
            this.contractRepo.count({ where: { status: ContractStatus.ACTIVE } }),
            this.contractRepo.count({ where: { status: ContractStatus.EXPIRING_SOON } }),
            this.contractRepo.count({ where: { status: ContractStatus.EXPIRED } }),
            this.contractRepo.count({ where: { status: ContractStatus.DRAFT } }),
        ]);

        // Cost analytics
        const contracts = await this.contractRepo.find({
            select: ['contractValue', 'status', 'category'],
        });

        const totalContractValue = contracts.reduce((sum, c) => sum + (Number(c.contractValue) || 0), 0);
        const activeContractValue = contracts
            .filter(c => c.status === ContractStatus.ACTIVE)
            .reduce((sum, c) => sum + (Number(c.contractValue) || 0), 0);
        const expiringSoonValue = contracts
            .filter(c => c.status === ContractStatus.EXPIRING_SOON)
            .reduce((sum, c) => sum + (Number(c.contractValue) || 0), 0);

        // Group by category
        const valueByCategory: Record<string, number> = {};
        contracts.forEach(c => {
            const cat = c.category || 'OTHER';
            valueByCategory[cat] = (valueByCategory[cat] || 0) + (Number(c.contractValue) || 0);
        });

        return {
            total, active, expiringSoon, expired, draft,
            totalContractValue, activeContractValue, expiringSoonValue,
            valueByCategory,
        };
    }

    // === STATUS CALCULATION ===
    calculateStatus(endDate: Date): ContractStatus {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return ContractStatus.EXPIRED;
        if (diffDays <= 30) return ContractStatus.EXPIRING_SOON;
        return ContractStatus.ACTIVE;
    }

    // === ACKNOWLEDGE FEATURE ===
    async acknowledgeContract(id: string, userId: string): Promise<RenewalContract> {
        const contract = await this.findOne(id);

        if (contract.isAcknowledged) {
            throw new BadRequestException('Contract already acknowledged');
        }

        contract.isAcknowledged = true;
        contract.acknowledgedAt = new Date();
        contract.acknowledgedById = userId;

        this.logger.log(`Contract ${id} acknowledged by user ${userId}`);

        return this.contractRepo.save(contract);
    }

    async unacknowledgeContract(id: string): Promise<RenewalContract> {
        const contract = await this.findOne(id);

        if (!contract.isAcknowledged) {
            throw new BadRequestException('Contract is not acknowledged');
        }

        contract.isAcknowledged = false;
        contract.acknowledgedAt = null;
        contract.acknowledgedById = null;

        this.logger.log(`Contract ${id} unacknowledged`);

        return this.contractRepo.save(contract);
    }

    // === FOR SCHEDULER ===
    async findContractsNeedingReminder(daysUntilExpiry: number): Promise<RenewalContract[]> {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysUntilExpiry);
        targetDate.setHours(0, 0, 0, 0);

        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const reminderField = daysUntilExpiry === 60 ? 'reminderD60Sent'
            : daysUntilExpiry === 30 ? 'reminderD30Sent'
                : daysUntilExpiry === 7 ? 'reminderD7Sent'
                    : 'reminderD1Sent';

        return this.contractRepo
            .createQueryBuilder('c')
            .where('c.endDate >= :targetDate', { targetDate })
            .andWhere('c.endDate < :nextDay', { nextDay })
            .andWhere(`c.${reminderField} = false`)
            .andWhere('c.status != :draft', { draft: ContractStatus.DRAFT })
            .andWhere('c.isAcknowledged = false') // Skip acknowledged contracts
            .getMany();
    }

    async markReminderSent(id: string, days: 60 | 30 | 7 | 1): Promise<void> {
        const field = days === 60 ? 'reminderD60Sent'
            : days === 30 ? 'reminderD30Sent'
                : days === 7 ? 'reminderD7Sent'
                    : 'reminderD1Sent';

        await this.contractRepo.update(id, { [field]: true });
    }

    // === NIGHTLY STATUS UPDATE ===
    async updateAllStatuses(): Promise<number> {
        const contracts = await this.contractRepo.find({
            where: { endDate: Not(IsNull()) },
        });

        let updated = 0;
        for (const contract of contracts) {
            const newStatus = this.calculateStatus(contract.endDate!);
            if (newStatus !== contract.status) {
                contract.status = newStatus;
                await this.contractRepo.save(contract);
                updated++;
            }
        }

        return updated;
    }
}
