import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { RenewalContract, ContractStatus } from './entities/renewal-contract.entity';
import { PdfExtractionService } from './services/pdf-extraction.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class RenewalService {
    private readonly logger = new Logger(RenewalService.name);

    constructor(
        @InjectRepository(RenewalContract)
        private readonly contractRepo: Repository<RenewalContract>,
        private readonly pdfExtractionService: PdfExtractionService,
    ) { }

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
        });

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
        });

        // Calculate status if endDate exists
        if (contract.endDate) {
            contract.status = this.calculateStatus(contract.endDate);
        }

        const saved = await this.contractRepo.save(contract);
        this.logger.log(`Contract created manually: ${saved.id}`);

        return saved;
    }

    // === CRUD OPERATIONS ===
    async findAll(filters?: {
        status?: ContractStatus;
        search?: string;
    }): Promise<RenewalContract[]> {
        const query = this.contractRepo
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.uploadedBy', 'uploader')
            .orderBy('c.endDate', 'ASC', 'NULLS LAST');

        if (filters?.status) {
            query.andWhere('c.status = :status', { status: filters.status });
        }

        if (filters?.search) {
            query.andWhere(
                '(c.poNumber ILIKE :search OR c.vendorName ILIKE :search OR c.originalFileName ILIKE :search)',
                { search: `%${filters.search}%` },
            );
        }

        return query.getMany();
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

    async update(id: string, dto: UpdateContractDto): Promise<RenewalContract> {
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

    async delete(id: string): Promise<void> {
        const contract = await this.findOne(id);
        await this.contractRepo.remove(contract);
    }

    // === DASHBOARD STATS ===
    async getDashboardStats(): Promise<{
        total: number;
        active: number;
        expiringSoon: number;
        expired: number;
        draft: number;
    }> {
        const [total, active, expiringSoon, expired, draft] = await Promise.all([
            this.contractRepo.count(),
            this.contractRepo.count({ where: { status: ContractStatus.ACTIVE } }),
            this.contractRepo.count({ where: { status: ContractStatus.EXPIRING_SOON } }),
            this.contractRepo.count({ where: { status: ContractStatus.EXPIRED } }),
            this.contractRepo.count({ where: { status: ContractStatus.DRAFT } }),
        ]);

        return { total, active, expiringSoon, expired, draft };
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
            const newStatus = this.calculateStatus(contract.endDate);
            if (newStatus !== contract.status) {
                contract.status = newStatus;
                await this.contractRepo.save(contract);
                updated++;
            }
        }

        return updated;
    }
}
