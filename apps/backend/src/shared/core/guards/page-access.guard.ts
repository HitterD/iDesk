import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PAGE_ACCESS_KEY } from '../decorators/page-access.decorator';
import { PageKey, PageAccess } from '../types/page-access.types';
import { getCachedUserPageAccess } from '../utils/effective-page-access.util';
import { User } from '../../../modules/users/entities/user.entity';
import { PermissionPreset } from '../../../modules/permissions/entities/permission-preset.entity';
import { UserRole } from '../../../modules/users/enums/user-role.enum';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../../../modules/audit/audit.service';
import { AuditAction, AuditSeverity } from '../../../modules/audit/entities/audit-log.entity';

/**
 * PageAccessGuard
 * 
 * A guard that checks if the current user has access to the required page
 * based on their applied preset's pageAccess configuration.
 * 
 * This replaces role-based guards with a more flexible preset-based system.
 * 
 * Priority order:
 * 1. ADMIN role always has access (bypass)
 * 2. Check user's appliedPreset.pageAccess (CACHED)
 * 3. Fallback to role-based defaults if no preset
 * 
 * Performance: Uses CacheService to avoid DB queries on every request
 * Cache TTL is configurable via PAGE_ACCESS_CACHE_TTL env var (default: 300 seconds)
 */
@Injectable()
export class PageAccessGuard implements CanActivate {
    private readonly logger = new Logger(PageAccessGuard.name);
    private readonly cacheTtl: number;
    private readonly maxDenials: number;
    private readonly denialLockoutMinutes: number;

    constructor(
        private reflector: Reflector,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(PermissionPreset)
        private readonly presetRepo: Repository<PermissionPreset>,
        private readonly cacheService: CacheService,
        private readonly configService: ConfigService,
        private readonly auditService: AuditService,
    ) {
        // Configurable cache TTL via environment variable (default: 300 seconds = 5 minutes)
        this.cacheTtl = parseInt(
            this.configService.get<string>('PAGE_ACCESS_CACHE_TTL', '300'),
            10
        );
        // Rate limiting config (default: 10 denials, 15 min lockout)
        this.maxDenials = parseInt(
            this.configService.get<string>('PAGE_ACCESS_MAX_DENIALS', '10'),
            10
        );
        this.denialLockoutMinutes = parseInt(
            this.configService.get<string>('PAGE_ACCESS_LOCKOUT_MINUTES', '15'),
            10
        );
        this.logger.log(`PageAccessGuard initialized with cache TTL: ${this.cacheTtl}s, max denials: ${this.maxDenials}, lockout: ${this.denialLockoutMinutes}min`);
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Get the required page access from decorator
        const requiredAccess = this.reflector.getAllAndOverride<PageKey | { type: 'any' | 'all'; pages: PageKey[] }>(
            PAGE_ACCESS_KEY,
            [context.getHandler(), context.getClass()]
        );

        // No @PageAccess decorator = no restriction
        if (!requiredAccess) {
            return true;
        }

        // Get current user from request
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.userId;

        if (!userId) {
            this.logger.warn('PageAccessGuard: No userId in request');
            throw new ForbiddenException('Authentication required');
        }

        // Use cache-aside pattern: check cache first, fetch from DB if miss
        const cached = await getCachedUserPageAccess(
            userId, this.userRepo, this.presetRepo, this.cacheService, this.cacheTtl,
        );

        if (!cached) {
            this.logger.warn(`PageAccessGuard: User ${userId} not found`);
            throw new ForbiddenException('User not found');
        }

        const { user, pageAccess } = cached;

        // ADMIN always has access
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        // Check access based on requirement type
        if (typeof requiredAccess === 'string') {
            // Single page requirement
            return this.checkSingleAccess(pageAccess, requiredAccess, user, request);
        } else if (requiredAccess.type === 'any') {
            // Any of the pages
            return this.checkAnyAccess(pageAccess, requiredAccess.pages, user, request);
        } else if (requiredAccess.type === 'all') {
            // All pages required
            return this.checkAllAccess(pageAccess, requiredAccess.pages, user, request);
        }

        return false;
    }

    /**
     * Check single page access with rate limiting and audit logging
     */
    private async checkSingleAccess(pageAccess: PageAccess, page: PageKey, user: User, request: any): Promise<boolean> {
        const hasAccess = pageAccess[page] === true;

        if (!hasAccess) {
            // FI-6: Rate limiting - check if user is locked out
            const denialKey = `accessDenials:${user.id}`;
            const lockoutKey = `accessLockout:${user.id}`;

            // Check if currently locked out
            const isLockedOut = await this.cacheService.getAsync<boolean>(lockoutKey);
            if (isLockedOut) {
                throw new ForbiddenException(`Account temporarily locked due to repeated access violations. Try again in ${this.denialLockoutMinutes} minutes.`);
            }

            // Increment denial count
            const currentDenials = (await this.cacheService.getAsync<number>(denialKey)) || 0;
            const newDenialCount = currentDenials + 1;
            await this.cacheService.setAsync(denialKey, newDenialCount, 300); // 5 min window

            // FI-5: Persist to database via AuditService
            this.auditService.logAsync({
                userId: user.id,
                action: AuditAction.PAGE_ACCESS_DENIED,
                entityType: 'page',
                entityId: page,
                newValue: {
                    requestedPage: page,
                    presetId: user.appliedPresetId || 'none',
                    denialCount: newDenialCount,
                },
                description: `User denied access to '${page}' (denial #${newDenialCount})`,
                request,
            });

            // Check if should lock out
            if (newDenialCount >= this.maxDenials) {
                // Lock out user
                await this.cacheService.setAsync(lockoutKey, true, this.denialLockoutMinutes * 60);
                await this.cacheService.delAsync(denialKey); // Reset counter

                // Log lockout event
                this.auditService.logAsync({
                    userId: user.id,
                    action: AuditAction.PAGE_ACCESS_LOCKOUT,
                    entityType: 'user',
                    entityId: user.id,
                    newValue: {
                        lockoutMinutes: this.denialLockoutMinutes,
                        totalDenials: newDenialCount,
                    },
                    description: `User locked out for ${this.denialLockoutMinutes} minutes after ${newDenialCount} access denials`,
                    request,
                });

                this.logger.warn(`User ${user.id} locked out after ${newDenialCount} access denials`);
                throw new ForbiddenException(`Account locked due to repeated access violations. Try again in ${this.denialLockoutMinutes} minutes.`);
            }

            throw new ForbiddenException(`Access denied: '${page}' permission required`);
        }

        return true;
    }

    /**
     * Check if user has access to ANY of the pages
     */
    private checkAnyAccess(pageAccess: PageAccess, pages: PageKey[], user: User, request: any): boolean {
        const hasAccess = pages.some(page => pageAccess[page] === true);

        if (!hasAccess) {
            this.logger.warn(`PageAccessGuard: User ${user.id} (${user.role}) denied access - needs any of: ${pages.join(', ')}`);
            throw new ForbiddenException(`Access denied: one of [${pages.join(', ')}] permissions required`);
        }

        return true;
    }

    /**
     * Check if user has access to ALL pages
     */
    private checkAllAccess(pageAccess: PageAccess, pages: PageKey[], user: User, request: any): boolean {
        const hasAccess = pages.every(page => pageAccess[page] === true);

        if (!hasAccess) {
            const missingPages = pages.filter(page => pageAccess[page] !== true);
            this.logger.warn(`PageAccessGuard: User ${user.id} (${user.role}) denied access - missing: ${missingPages.join(', ')}`);
            throw new ForbiddenException(`Access denied: missing permissions for [${missingPages.join(', ')}]`);
        }

        return true;
    }
}
