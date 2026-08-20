import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FoundItemClaim, FoundClaimStatus } from './entities/found-item-claim.entity';
import { LostItemReport, LostItemStatus } from './entities/lost-item-report.entity';
import { LostItemStatusLog } from './entities/lost-item-status-log.entity';
import { CreateFoundClaimDto, MatchFoundClaimDto, RejectFoundClaimDto } from './dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SiteActor, assertSiteAccess, resolveSiteScope } from '../../shared/core/utils/site-scope.util';

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
        private readonly dataSource: DataSource,
    ) {}

    private async logReportStatus(reportId: string, from: string, to: string, managerId: string, notes?: string): Promise<void> {
        const log = this.statusLogRepo.create({ lostItemReportId: reportId, fromStatus: from, toStatus: to, changedById: managerId, notes });
        await this.statusLogRepo.save(log);
    }

    async create(finderId: string, dto: CreateFoundClaimDto, actor: SiteActor): Promise<FoundItemClaim> {
        const lostItemReportId = dto.lostItemReportId ?? null;

        const saved = await this.dataSource.transaction(async (mgr) => {
            const claimRepo = mgr.getRepository(FoundItemClaim);
            const reportRepo = mgr.getRepository(LostItemReport);
            const logRepo = mgr.getRepository(LostItemStatusLog);

            const claim = claimRepo.create({
                finderId,
                lostItemReportId,
                siteId: actor.siteId,
                locationFound: dto.locationFound,
                foundAt: new Date(dto.foundAt),
                description: dto.description,
                photoUrls: dto.photoUrls || [],
                status: FoundClaimStatus.PENDING,
            } as Partial<FoundItemClaim>);
            const result = await claimRepo.save(claim);

            if (lostItemReportId) {
                const report = await reportRepo.findOne({ where: { id: lostItemReportId } });
                if (report && (report.status === LostItemStatus.REPORTED || report.status === LostItemStatus.SEARCHING)) {
                    const prevStatus = report.status;
                    report.status = LostItemStatus.CLAIMED;
                    await reportRepo.save(report);
                    await logRepo.save(logRepo.create({ lostItemReportId, fromStatus: prevStatus, toStatus: LostItemStatus.CLAIMED, changedById: finderId, notes: 'Found claim submitted' }));
                }
            }

            return result;
        });

        this.eventEmitter.emit('found-claim.created', { claim: saved });
        return saved;
    }

    async findAll(actor: SiteActor, options: { status?: string } = {}): Promise<FoundItemClaim[]> {
        const qb = this.claimRepo.createQueryBuilder('c')
            .leftJoinAndSelect('c.finder', 'finder')
            .leftJoinAndSelect('c.lostItemReport', 'report')
            .leftJoinAndSelect('c.matchedBy', 'matchedBy')
            .orderBy('c.createdAt', 'DESC');

        const scope = resolveSiteScope(actor);
        if (scope.mode === 'site') {
            qb.andWhere('c.siteId = :userSiteId', { userSiteId: scope.siteId });
        } else if (scope.mode === 'none') {
            qb.andWhere('1 = 0');
        }

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

    async findOne(id: string, actor: SiteActor): Promise<FoundItemClaim> {
        const claim = await this.claimRepo.findOne({
            where: { id },
            relations: ['finder', 'lostItemReport', 'matchedBy'],
        });
        if (!claim) throw new NotFoundException('Found claim not found');
        assertSiteAccess(actor, claim.siteId);
        return claim;
    }

    async match(id: string, dto: MatchFoundClaimDto, managerId: string, actor: SiteActor): Promise<FoundItemClaim> {
        // P0 fix: was findOne → check status → save (TOCTOU race between
        // check and save). Two concurrent matches could both pass the check
        // and double-save. Now atomic conditional UPDATE — the DB enforces
        // the precondition, so exactly one wins.
        const reportId = dto.lostItemReportId ?? null;
        if (!reportId) throw new BadRequestException('lostItemReportId required for unlinked claims');

        return this.dataSource.transaction(async (mgr) => {
            const claimRepo = mgr.getRepository(FoundItemClaim);
            const reportRepo = mgr.getRepository(LostItemReport);

            // Verify site access before mutation (fail-closed via assert)
            const claimForCheck = await claimRepo.findOne({ where: { id } });
            if (claimForCheck) {
                assertSiteAccess(actor, claimForCheck.siteId);
            }

            // Atomic status guard
            const result = await claimRepo.update(
                { id, status: FoundClaimStatus.PENDING },
                {
                    status: FoundClaimStatus.MATCHED,
                    lostItemReportId: reportId,
                    matchedById: managerId,
                    matchedAt: new Date(),
                    managerNotes: dto.notes ?? null,
                },
            );
            if (!result.affected) {
                throw new BadRequestException('Claim is not in PENDING status');
            }

            // Reload the saved claim with the relations the caller expects
            const saved = await claimRepo.findOne({ where: { id } });
            if (!saved) throw new NotFoundException('Found claim not found after update');

            const report = await reportRepo.findOne({ where: { id: reportId } });
            this.eventEmitter.emit('found-claim.matched', { claim: saved, report });
            return saved;
        });
    }

    async reject(id: string, dto: RejectFoundClaimDto, managerId: string, actor: SiteActor): Promise<FoundItemClaim> {
        // Same TOCTOU fix as match(): atomic conditional UPDATE.
        return this.dataSource.transaction(async (mgr) => {
            const claimRepo = mgr.getRepository(FoundItemClaim);

            // Verify site access before mutation
            const claimForCheck = await claimRepo.findOne({ where: { id } });
            if (claimForCheck) {
                assertSiteAccess(actor, claimForCheck.siteId);
            }

            const result = await claimRepo.update(
                { id, status: FoundClaimStatus.PENDING },
                {
                    status: FoundClaimStatus.REJECTED,
                    matchedById: managerId,
                    matchedAt: new Date(),
                    managerNotes: dto.notes,
                },
            );
            if (!result.affected) {
                throw new BadRequestException('Claim is not in PENDING status');
            }

            const saved = await claimRepo.findOne({ where: { id } });
            if (!saved) throw new NotFoundException('Found claim not found after update');
            this.eventEmitter.emit('found-claim.rejected', { claim: saved });
            return saved;
        });
    }

    async confirmReturn(id: string, managerId: string, actor: SiteActor): Promise<FoundItemClaim> {
        const claim = await this.findOne(id, actor);
        if (claim.status !== FoundClaimStatus.MATCHED && claim.status !== FoundClaimStatus.PENDING) {
            throw new BadRequestException('Claim must be MATCHED or PENDING before confirming return');
        }

        // Re-assert site access using the already-loaded claim (defensive)
        assertSiteAccess(actor, claim.siteId);

        const saved = await this.dataSource.transaction(async (mgr) => {
            const claimRepo = mgr.getRepository(FoundItemClaim);
            const reportRepo = mgr.getRepository(LostItemReport);
            const logRepo = mgr.getRepository(LostItemStatusLog);

            claim.status = FoundClaimStatus.RETURNED;
            const result = await claimRepo.save(claim);

            if (claim.lostItemReportId) {
                const report = await reportRepo.findOne({ where: { id: claim.lostItemReportId } });
                if (report) {
                    const prevStatus = report.status;
                    report.status = LostItemStatus.RETURNED;
                    await reportRepo.save(report);
                    await logRepo.save(logRepo.create({ lostItemReportId: claim.lostItemReportId, fromStatus: prevStatus, toStatus: LostItemStatus.RETURNED, changedById: managerId, notes: 'Item physically returned' }));
                }
            }

            return result;
        });

        this.eventEmitter.emit('found-claim.returned', { claim: saved });
        return saved;
    }
}
