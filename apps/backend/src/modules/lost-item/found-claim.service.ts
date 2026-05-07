import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FoundItemClaim, FoundClaimStatus } from './entities/found-item-claim.entity';
import { LostItemReport, LostItemStatus } from './entities/lost-item-report.entity';
import { LostItemStatusLog } from './entities/lost-item-status-log.entity';
import { CreateFoundClaimDto, MatchFoundClaimDto, RejectFoundClaimDto } from './dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class FoundClaimService {
    constructor(
        @InjectRepository(FoundItemClaim)
        private readonly claimRepo: Repository<FoundItemClaim>,
        @InjectRepository(LostItemReport)
        private readonly reportRepo: Repository<LostItemReport>,
        @InjectRepository(LostItemStatusLog)
        private readonly statusLogRepo: Repository<LostItemStatusLog>,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    private async logReportStatus(reportId: string, from: string, to: string, managerId: string, notes?: string): Promise<void> {
        const log = this.statusLogRepo.create({ lostItemReportId: reportId, fromStatus: from, toStatus: to, changedById: managerId, notes });
        await this.statusLogRepo.save(log);
    }

    async create(finderId: string, dto: CreateFoundClaimDto): Promise<FoundItemClaim> {
        const lostItemReportId = dto.lostItemReportId ?? null;

        const claim = this.claimRepo.create({
            finderId,
            lostItemReportId,
            locationFound: dto.locationFound,
            foundAt: new Date(dto.foundAt),
            description: dto.description,
            photoUrls: dto.photoUrls || [],
            status: FoundClaimStatus.PENDING,
        } as Partial<FoundItemClaim>);
        const saved = await this.claimRepo.save(claim);

        if (lostItemReportId) {
            const report = await this.reportRepo.findOne({ where: { id: lostItemReportId } });
            if (report && (report.status === LostItemStatus.REPORTED || report.status === LostItemStatus.SEARCHING)) {
                const prevStatus = report.status;
                report.status = LostItemStatus.CLAIMED;
                await this.reportRepo.save(report);
                await this.logReportStatus(lostItemReportId, prevStatus, LostItemStatus.CLAIMED, finderId, 'Found claim submitted');
            }
        }

        this.eventEmitter.emit('found-claim.created', { claim: saved });
        return saved;
    }

    async findAll(options: { status?: string } = {}): Promise<FoundItemClaim[]> {
        const qb = this.claimRepo.createQueryBuilder('c')
            .leftJoinAndSelect('c.finder', 'finder')
            .leftJoinAndSelect('c.lostItemReport', 'report')
            .leftJoinAndSelect('c.matchedBy', 'matchedBy')
            .orderBy('c.createdAt', 'DESC');
        if (options.status) qb.andWhere('c.status = :status', { status: options.status });
        return qb.getMany();
    }

    async findMy(finderId: string): Promise<FoundItemClaim[]> {
        return this.claimRepo.find({
            where: { finderId },
            relations: ['lostItemReport'],
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string): Promise<FoundItemClaim> {
        const claim = await this.claimRepo.findOne({
            where: { id },
            relations: ['finder', 'lostItemReport', 'matchedBy'],
        });
        if (!claim) throw new NotFoundException('Found claim not found');
        return claim;
    }

    async match(id: string, dto: MatchFoundClaimDto, managerId: string): Promise<FoundItemClaim> {
        const claim = await this.findOne(id);
        if (claim.status !== FoundClaimStatus.PENDING) {
            throw new BadRequestException('Claim is not in PENDING status');
        }

        const reportId = dto.lostItemReportId ?? claim.lostItemReportId;
        if (!reportId) throw new BadRequestException('lostItemReportId required for unlinked claims');

        const report = await this.reportRepo.findOne({ where: { id: reportId } });
        if (!report) throw new NotFoundException('Lost item report not found');

        claim.status = FoundClaimStatus.MATCHED;
        claim.lostItemReportId = reportId;
        claim.matchedById = managerId;
        claim.matchedAt = new Date();
        claim.managerNotes = dto.notes ?? null;

        const saved = await this.claimRepo.save(claim);

        this.eventEmitter.emit('found-claim.matched', { claim: saved, report });
        return saved;
    }

    async reject(id: string, dto: RejectFoundClaimDto, managerId: string): Promise<FoundItemClaim> {
        const claim = await this.findOne(id);
        if (claim.status !== FoundClaimStatus.PENDING) {
            throw new BadRequestException('Claim is not in PENDING status');
        }

        claim.status = FoundClaimStatus.REJECTED;
        claim.matchedById = managerId;
        claim.matchedAt = new Date();
        claim.managerNotes = dto.notes;

        const saved = await this.claimRepo.save(claim);
        this.eventEmitter.emit('found-claim.rejected', { claim: saved });
        return saved;
    }

    async confirmReturn(id: string, managerId: string): Promise<FoundItemClaim> {
        const claim = await this.findOne(id);
        if (claim.status !== FoundClaimStatus.MATCHED && claim.status !== FoundClaimStatus.PENDING) {
            throw new BadRequestException('Claim must be MATCHED or PENDING before confirming return');
        }

        claim.status = FoundClaimStatus.RETURNED;
        const saved = await this.claimRepo.save(claim);

        if (claim.lostItemReportId) {
            const report = await this.reportRepo.findOne({ where: { id: claim.lostItemReportId } });
            if (report) {
                const prevStatus = report.status;
                report.status = LostItemStatus.RETURNED;
                await this.reportRepo.save(report);
                await this.logReportStatus(claim.lostItemReportId, prevStatus, LostItemStatus.RETURNED, managerId, 'Item physically returned');
            }
        }

        this.eventEmitter.emit('found-claim.returned', { claim: saved });
        return saved;
    }
}
