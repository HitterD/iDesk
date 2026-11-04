import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService } from '../../../shared/core/cache/cache.service';
import { getCachedUserPageAccess } from '../../../shared/core/utils/effective-page-access.util';
import { PermissionPreset } from '../../permissions/entities/permission-preset.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { CSI_ADMIN_PAGE_KEY, parseCsiScope } from '../csi.constants';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { PageAccess } from '../../../shared/core/types/page-access.types';

/**
 * Who may administer CSI of a scope:
 * - HC_ADMIN: HC only, always (it is the role's purpose); never ICT.
 * - ADMIN: HC always; ICT with the explicit page key (no bypass, as before).
 * - MANAGER: with the explicit page key of the scope.
 */
export function canAdminCsiScope(role: string, pageAccess: PageAccess, scope: ServiceScope): boolean {
    if (role === UserRole.HC_ADMIN) return scope === ServiceScope.HC;
    if (role === UserRole.ADMIN && scope === ServiceScope.HC) return true;
    const allowedRole = role === UserRole.ADMIN || role === UserRole.MANAGER;
    return allowedRole && pageAccess[CSI_ADMIN_PAGE_KEY[scope]] === true;
}

@Injectable()
export class CsiAdminGuard implements CanActivate {
    private readonly cacheTtl: number;

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(PermissionPreset)
        private readonly presetRepo: Repository<PermissionPreset>,
        private readonly cacheService: CacheService,
        configService: ConfigService,
    ) {
        this.cacheTtl = parseInt(configService.get<string>('PAGE_ACCESS_CACHE_TTL', '300'), 10);
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const scope = parseCsiScope(request.params?.scope);
        const userId = request.user?.userId;
        if (!userId) {
            throw new ForbiddenException('Authentication required');
        }

        const cached = await getCachedUserPageAccess(
            userId, this.userRepo, this.presetRepo, this.cacheService, this.cacheTtl,
        );
        if (!cached) {
            throw new ForbiddenException('User not found');
        }
        const { user, pageAccess } = cached;
        if (!canAdminCsiScope(user.role, pageAccess, scope)) {
            throw new ForbiddenException('Akses admin CSI tidak diizinkan.');
        }

        request.csiScope = scope;
        return true;
    }
}
