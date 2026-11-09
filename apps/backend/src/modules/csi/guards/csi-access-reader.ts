import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService } from '../../../shared/core/cache/cache.service';
import { PageAccess } from '../../../shared/core/types/page-access.types';
import { getCachedUserPageAccess } from '../../../shared/core/utils/effective-page-access.util';
import { PermissionPreset } from '../../permissions/entities/permission-preset.entity';
import { User } from '../../users/entities/user.entity';

/** Role and effective page access of an account (cached), for CSI checks made outside CsiAdminGuard. */
@Injectable()
export class CsiAccessReader {
    private readonly cacheTtl: number;

    constructor(
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(PermissionPreset) private readonly presetRepo: Repository<PermissionPreset>,
        private readonly cacheService: CacheService,
        configService: ConfigService,
    ) {
        this.cacheTtl = parseInt(configService.get<string>('PAGE_ACCESS_CACHE_TTL', '300'), 10);
    }

    async load(userId: string): Promise<{ role: string; pageAccess: PageAccess } | null> {
        const cached = await getCachedUserPageAccess(userId, this.userRepo, this.presetRepo, this.cacheService, this.cacheTtl);
        return cached ? { role: cached.user.role, pageAccess: cached.pageAccess } : null;
    }
}
