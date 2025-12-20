import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from './entities/site.entity';
import { CreateSiteDto, UpdateSiteDto } from './dto';

@Injectable()
export class SitesService {
    constructor(
        @InjectRepository(Site)
        private readonly siteRepo: Repository<Site>,
    ) { }

    async findAll(): Promise<Site[]> {
        return this.siteRepo.find({
            order: { code: 'ASC' },
        });
    }

    async findActive(): Promise<Site[]> {
        return this.siteRepo.find({
            where: { isActive: true },
            order: { code: 'ASC' },
        });
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

    async create(createSiteDto: CreateSiteDto): Promise<Site> {
        // Check if code already exists
        const existing = await this.siteRepo.findOne({
            where: { code: createSiteDto.code },
        });
        if (existing) {
            throw new ConflictException(`Site with code ${createSiteDto.code} already exists`);
        }

        const site = this.siteRepo.create(createSiteDto);
        return this.siteRepo.save(site);
    }

    async update(id: string, updateSiteDto: UpdateSiteDto): Promise<Site> {
        const site = await this.findOne(id);

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
        return this.siteRepo.save(site);
    }

    async remove(id: string): Promise<void> {
        const site = await this.findOne(id);

        // Don't allow deleting server host site
        if (site.isServerHost) {
            throw new ConflictException('Cannot delete the server host site');
        }

        await this.siteRepo.remove(site);
    }

    async getServerHostSite(): Promise<Site | null> {
        return this.siteRepo.findOne({ where: { isServerHost: true } });
    }

    async getSiteStats(): Promise<{ code: string; name: string; userCount: number; ticketCount: number }[]> {
        // This will be enhanced later to include actual counts
        const sites = await this.findActive();
        return sites.map(site => ({
            code: site.code,
            name: site.name,
            userCount: 0, // TODO: Implement actual counts
            ticketCount: 0,
        }));
    }
}
