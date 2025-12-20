import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../modules/users/enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no roles required, allow access
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        // Guard against missing user
        if (!user || !user.role) {
            return false;
        }

        // Handle role as string (most common case)
        if (typeof user.role === 'string') {
            return requiredRoles.includes(user.role as UserRole);
        }

        // Handle role as array (if applicable)
        if (Array.isArray(user.role)) {
            return requiredRoles.some((role) => user.role.includes(role));
        }

        return false;
    }
}
