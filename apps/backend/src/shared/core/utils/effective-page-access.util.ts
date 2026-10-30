import { Repository } from 'typeorm';
import { User } from '../../../modules/users/entities/user.entity';
import { PermissionPreset } from '../../../modules/permissions/entities/permission-preset.entity';
import { CacheService } from '../cache/cache.service';
import { PageAccess, getRoleDefaultPageAccess } from '../types/page-access.types';

export async function resolveEffectivePageAccess(
    user: User,
    presetRepo: Repository<PermissionPreset>,
): Promise<PageAccess> {
    if (user.appliedPresetId) {
        const preset = await presetRepo.findOne({
            where: { id: user.appliedPresetId },
            select: ['id', 'pageAccess'],
        });
        if (preset?.pageAccess) {
            return preset.pageAccess;
        }
    }
    return getRoleDefaultPageAccess(user.role);
}

export function getCachedUserPageAccess(
    userId: string,
    userRepo: Repository<User>,
    presetRepo: Repository<PermissionPreset>,
    cacheService: CacheService,
    cacheTtl: number,
): Promise<{ user: User; pageAccess: PageAccess } | null> {
    return cacheService.getOrSet<{ user: User; pageAccess: PageAccess } | null>(
        `pageAccess:${userId}`,
        async () => {
            const user = await userRepo.findOne({
                where: { id: userId },
                select: ['id', 'role', 'appliedPresetId'],
            });
            if (!user) {
                return null;
            }
            const pageAccess = await resolveEffectivePageAccess(user, presetRepo);
            return { user, pageAccess };
        },
        cacheTtl,
    );
}
