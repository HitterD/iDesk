import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FEATURE_ACCESS_KEY, FeatureAccessRequirement } from '../decorators/feature-access.decorator';
import { User } from '../../../modules/users/entities/user.entity';
import { PermissionPreset, FeatureAccess } from '../../../modules/permissions/entities/permission-preset.entity';
import { UserRole } from '../../../modules/users/enums/user-role.enum';
import { CacheService } from '../cache/cache.service';

/**
 * FeatureAccessGuard
 * 
 * Guards endpoints that require specific feature-level CRUD permissions.
 * Checks user's appliedPreset.permissions for the required feature+action.
 * 
 * Usage with decorator:
 * @UseGuards(JwtAuthGuard, FeatureAccessGuard)
 * @FeatureAccess('tickets', 'create')
 * 
 * Priority:
 * 1. ADMIN role always has access (bypass)
 * 2. Check user's appliedPreset.permissions[feature][action]
 * 3. Default to false if not specified
 */
@Injectable()
export class FeatureAccessGuard implements CanActivate {
    private readonly logger = new Logger(FeatureAccessGuard.name);

    constructor(
        private reflector: Reflector,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(PermissionPreset)
        private readonly presetRepo: Repository<PermissionPreset>,
        private readonly cacheService: CacheService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Get the required feature access from decorator
        const requiredAccess = this.reflector.getAllAndOverride<FeatureAccessRequirement>(
            FEATURE_ACCESS_KEY,
            [context.getHandler(), context.getClass()]
        );

        // No @FeatureAccess decorator = no restriction
        if (!requiredAccess) {
            return true;
        }

        // Get current user from request
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.userId;

        if (!userId) {
            this.logger.warn('FeatureAccessGuard: No userId in request');
            throw new ForbiddenException('Authentication required');
        }

        // Use cache for user lookup (same cache as PageAccessGuard)
        const cacheKey = `featureAccess:${userId}`;
        const cached = await this.cacheService.getOrSet<{ user: User; permissions: any } | null>(
            cacheKey,
            async () => {
                const user = await this.userRepo.findOne({
                    where: { id: userId },
                    select: ['id', 'role', 'appliedPresetId'],
                });

                if (!user) {
                    return null;
                }

                // Get preset permissions
                let permissions = {};
                if (user.appliedPresetId) {
                    const preset = await this.presetRepo.findOne({
                        where: { id: user.appliedPresetId },
                        select: ['id', 'permissions'],
                    });
                    if (preset?.permissions) {
                        permissions = preset.permissions;
                    }
                }

                return { user, permissions };
            },
            300 // 5 min cache
        );

        if (!cached) {
            this.logger.warn(`FeatureAccessGuard: User ${userId} not found`);
            throw new ForbiddenException('User not found');
        }

        const { user, permissions } = cached;

        // ADMIN always has access
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        // Check feature permission
        const { feature, action } = requiredAccess;
        const featureKey = `${feature}.${action}`;
        const featurePermission = permissions[featureKey];

        // Map action to permission property
        const actionMap: Record<string, string> = {
            view: 'canView',
            create: 'canCreate',
            edit: 'canEdit',
            delete: 'canDelete',
        };

        const hasAccess = featurePermission?.[actionMap[action]] === true;

        if (!hasAccess) {
            this.logger.warn(`FeatureAccessGuard: User ${user.id} denied ${feature}.${action}`);
            throw new ForbiddenException(`Access denied: '${feature}.${action}' permission required`);
        }

        return true;
    }
}
