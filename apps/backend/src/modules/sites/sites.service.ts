import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Site } from './entities/site.entity';
import { CreateSiteDto, UpdateSiteDto } from './dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { CacheService } from '../../shared/core/cache';
import { User } from '../users/entities/user.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';

@Injectable()
export class SitesService {
    private static readonly CACHE_KEY_ACTIVE = 'sites:active';
    private static readonly CACHE_TTL_ACTIVE = 300; // 5 min — sites change rarely

    constructor(
        private readonly auditService: AuditService,
        @InjectRepository(Site)
        private readonly siteRepo: Repository<Site>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        private readonly cacheService: CacheService,
    ) { }

    async findAll(): Promise<Site[]> {
        return this.siteRepo.find({
            order: { code: 'ASC' },
        });
    }

    async findActive(): Promise<Site[]> {
        // P1 perf: hot lookup referenced by many modules. 5min cache
        // because site list changes rarely (admin adds site maybe
        // once a month). Mutations invalidate the key below.
        return this.cacheService.getOrSet(
            SitesService.CACHE_KEY_ACTIVE,
            () => this.siteRepo.find({
                where: { isActive: true },
                order: { code: 'ASC' },
            }),
            SitesService.CACHE_TTL_ACTIVE,
        );
    }

    private async invalidateActiveCache(): Promise<void> {
        await this.cacheService
            .delAsync(SitesService.CACHE_KEY_ACTIVE)
            .catch(() => undefined);
    }

    async findOne(id: string): Promise<Site> {
        const site = await this.siteRepo.findOne({ where: { id } });
        if (!site) {
            throw new NotFoundException(`Site with ID ${id} not found`);
        }
        return site;
    }

    async findByCode(code: string): Promise<Site> {
        const site = await this.siteRepo.findOne({ where: { code } });
        if (!site) {
            throw new NotFoundException(`Site with code ${code} not found`);
        }
        return site;
    }

    async create(createSiteDto: CreateSiteDto, userId?: string): Promise<Site> {
        // Check if code already exists
        const existing = await this.siteRepo.findOne({
            where: { code: createSiteDto.code },
        });
        if (existing) {
            throw new ConflictException(`Site with code ${createSiteDto.code} already exists`);
        }

        const site = this.siteRepo.create(createSiteDto);
        const saved = await this.siteRepo.save(site);
        await this.invalidateActiveCache();
        return saved;
    }

    async update(id: string, updateSiteDto: UpdateSiteDto, userId?: string): Promise<Site> {
        const site = await this.findOne(id);
        const oldValue = { ...site };

        // If updating code, check for conflicts
        if (updateSiteDto.code && updateSiteDto.code !== site.code) {
            const existing = await this.siteRepo.findOne({
                where: { code: updateSiteDto.code },
            });
            if (existing) {
                throw new ConflictException(`Site with code ${updateSiteDto.code} already exists`);
            }
        }

        Object.assign(site, updateSiteDto);
        const saved = await this.siteRepo.save(site);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.SITE_UPDATE,
                entityType: 'Site',
                entityId: saved.id,
                description: `Updated site: ${saved.name} (${saved.code})`,
                oldValue,
                newValue: updateSiteDto,
            });
        }

        await this.invalidateActiveCache();
        return saved;
    }

    async remove(id: string, userId?: string): Promise<void> {
        const site = await this.findOne(id);

        // Don't allow deleting server host site
        if (site.isServerHost) {
            throw new ConflictException('Cannot delete the server host site');
        }

        await this.siteRepo.remove(site);
        await this.invalidateActiveCache();
    }

    async generateTvToken(id: string, userId?: string): Promise<Site> {
        const site = await this.findOne(id);
        const token = randomBytes(24).toString('hex');
        site.tvToken = token;
        const saved = await this.siteRepo.save(site);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.SITE_TV_TOKEN_GENERATE,
                entityType: 'Site',
                entityId: saved.id,
                description: `Generated TV board token for site: ${saved.name} (${saved.code})`,
            });
        }

        return saved;
    }

    async revokeTvToken(id: string, userId?: string): Promise<Site> {
        const site = await this.findOne(id);
        site.tvToken = null;
        const saved = await this.siteRepo.save(site);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.SITE_TV_TOKEN_REVOKE,
                entityType: 'Site',
                entityId: saved.id,
                description: `Revoked TV board token for site: ${saved.name} (${saved.code})`,
            });
        }

        return saved;
    }

    async getServerHostSite(): Promise<Site | null> {
        return this.siteRepo.findOne({ where: { isServerHost: true } });
    }

    async getSiteStats(): Promise<{ code: string; name: string; userCount: number; ticketCount: number }[]> {
        // P1 fix: was returning hardcoded 0 for userCount/ticketCount. Now
        // real COUNT queries per site, run in parallel where possible.
        const sites = await this.findActive();
        const stats = await Promise.all(
            sites.map(async (site) => {
                const [userCount, ticketCount] = await Promise.all([
                    this.userRepo.count({ where: { siteId: site.id, isActive: true } }),
                    this.ticketRepo.count({ where: { siteId: site.id } }),
                ]);
                return {
                    code: site.code,
                    name: site.name,
                    userCount,
                    ticketCount,
                };
            }),
        );
        return stats;
    }
}
