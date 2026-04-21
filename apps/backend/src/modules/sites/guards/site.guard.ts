import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/enums/user-role.enum';

/**
 * SiteGuard enforces site isolation for USER and AGENT roles.
 * ADMIN and MANAGER can access all sites.
 * 
 * Usage:
 * @UseGuards(JwtAuthGuard, SiteGuard)
 * 
 * The guard:
 * 1. Allows ADMIN and MANAGER to bypass site isolation
 * 2. For USER/AGENT, injects their siteId into the request query
 * 3. Blocks access if requesting data from a different site
 */
@Injectable()
export class SiteGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // No user means not authenticated - let other guards handle this
        if (!user) {
            return true;
        }

        // ADMIN & MANAGER bypass site isolation completely
        if ([UserRole.ADMIN, UserRole.MANAGER].includes(user.role)) {
            return true;
        }

        // USER & AGENT can only access their own site's data
        const requestedSiteId = this.extractSiteId(request);

        // If a specific site is requested and it doesn't match user's site, deny
        if (requestedSiteId && requestedSiteId !== user.siteId) {
            throw new ForbiddenException(
                'You do not have permission to access data from other sites',
            );
        }

        // Auto-inject user's siteId into query for filtering
        if (!request.query) {
            request.query = {};
        }
        request.query.siteId = user.siteId;

        // Also inject into body if it's a POST/PUT/PATCH
        if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
            // Only set if not already set (don't override explicit values)
            if (!request.body.siteId) {
                request.body.siteId = user.siteId;
            }
        }

        return true;
    }

    private extractSiteId(request: any): string | null {
        // Check multiple places for site ID
        return (
            request.params?.siteId ||
            request.query?.siteId ||
            request.body?.siteId ||
            null
        );
    }
}

/**
 * Decorator to skip site guard for specific endpoints
 */
import { SetMetadata } from '@nestjs/common';
export const SKIP_SITE_GUARD_KEY = 'skipSiteGuard';
export const SkipSiteGuard = () => SetMetadata(SKIP_SITE_GUARD_KEY, true);
