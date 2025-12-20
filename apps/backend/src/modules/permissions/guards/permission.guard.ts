import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSION_KEY, RequiredPermission } from '../decorators/require-permission.decorator';
import { PermissionsService } from '../permissions.service';
import { UserRole } from '../../users/enums/user-role.enum';

@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private permissionsService: PermissionsService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermission = this.reflector.getAllAndOverride<RequiredPermission>(
            REQUIRED_PERMISSION_KEY,
            [context.getHandler(), context.getClass()],
        );

        // If no permission required, allow access
        if (!requiredPermission) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        // ADMIN always has full access
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        // MANAGER has access to most features except admin-only
        if (user.role === UserRole.MANAGER) {
            // Check if this is an admin-only feature
            const adminOnlyFeatures = ['admin.users', 'admin.settings', 'admin.permissions'];
            if (!adminOnlyFeatures.some(f => requiredPermission.feature.startsWith(f))) {
                return true;
            }
        }

        // Check user's specific permission
        const hasPermission = await this.permissionsService.hasPermission(
            user.id,
            requiredPermission.feature,
            requiredPermission.action,
        );

        if (!hasPermission) {
            throw new ForbiddenException(
                `You don't have permission to ${requiredPermission.action} ${requiredPermission.feature}`,
            );
        }

        return true;
    }
}
