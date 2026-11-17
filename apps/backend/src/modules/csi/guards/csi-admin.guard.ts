import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
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
import { CsiServiceReportOwner } from '../entities/csi-service-report-owner.entity';

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

/** Methods that only read; every other method needs write (admin) access. */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const WRITER_ONLY_KEY = 'csiWriterOnly';
export const READ_ONLY_MESSAGE = 'Hanya lihat: akun Anda tidak dapat mengubah data CSI.';

/** Marks a GET handler that exposes rater identities / raw data: read-only viewers are refused there. */
export const CsiWriterOnly = () => SetMetadata(WRITER_ONLY_KEY, true);

/**
 * Who may open (read) the CSI admin pages of a scope, read-only: everyone who may administer it, any MANAGER and
 * ADMIN, and the report owners of the scope (any role). HC_ADMIN stays HC only, unless it is an owner.
 */
export function canReadCsiScope(role: string, pageAccess: PageAccess, scope: ServiceScope, isOwner: boolean): boolean {
    if (canAdminCsiScope(role, pageAccess, scope)) return true;
    if (isOwner) return true;
    if (role === UserRole.HC_ADMIN) return false;
    return role === UserRole.ADMIN || role === UserRole.MANAGER;
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
        @InjectRepository(CsiServiceReportOwner)
        private readonly ownerRepo: Repository<CsiServiceReportOwner>,
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
        const writer = canAdminCsiScope(user.role, pageAccess, scope);
        if (!writer) {
            const isOwner = (await this.ownerRepo.count({ where: { scope, userId } })) > 0;
            if (!canReadCsiScope(user.role, pageAccess, scope, isOwner)) {
                throw new ForbiddenException('Akses admin CSI tidak diizinkan.');
            }
            const writerOnly = Reflect.getMetadata(WRITER_ONLY_KEY, context.getHandler()) === true;
            if (!READ_METHODS.has(String(request.method).toUpperCase()) || writerOnly) {
                throw new ForbiddenException(READ_ONLY_MESSAGE);
            }
        }

        request.csiScope = scope;
        request.csiReadOnly = !writer;
        return true;
    }
}
