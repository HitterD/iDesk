import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from './entities/site.entity';

/**
 * Where a request from a site is handled: the site's `handledBySiteId` when set (Sukodono → Sepanjang),
 * otherwise the site itself. Single hop on purpose: a handling site is never forwarded again.
 */
@Injectable()
export class HandlingSiteService {
    constructor(@InjectRepository(Site) private readonly siteRepo: Repository<Site>) { }

    async handlingSiteId(siteId: string | null | undefined): Promise<string | null> {
        if (!siteId) return null;
        const site = await this.siteRepo.findOne({ where: { id: siteId }, select: ['id', 'handledBySiteId'] });
        return site?.handledBySiteId ?? siteId;
    }
}
