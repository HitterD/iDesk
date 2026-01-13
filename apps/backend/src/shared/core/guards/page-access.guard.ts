import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PAGE_ACCESS_KEY } from '../decorators/page-access.decorator';
import { PageKey, PageAccess } from '../types/page-access.types';
import { User } from '../../../modules/users/entities/user.entity';
import { PermissionPreset } from '../../../modules/permissions/entities/permission-preset.entity';
import { UserRole } from '../../../modules/users/enums/user-role.enum';

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
 * 2. Check user's appliedPreset.pageAccess
 * 3. Fallback to role-based defaults if no preset
 */
@Injectable()
export class PageAccessGuard implements CanActivate {
    private readonly logger = new Logger(PageAccessGuard.name);

    constructor(
        private reflector: Reflector,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(PermissionPreset)
        private readonly presetRepo: Repository<PermissionPreset>,
    ) { }

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

        // Fetch user with role and preset info
        const user = await this.userRepo.findOne({
            where: { id: userId },
            select: ['id', 'role', 'appliedPresetId'],
        });

        if (!user) {
            this.logger.warn(`PageAccessGuard: User ${userId} not found`);
            throw new ForbiddenException('User not found');
        }

        // ADMIN always has access
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        // Get user's page access from preset or role defaults
        const pageAccess = await this.getUserPageAccess(user);

        // Check access based on requirement type
        if (typeof requiredAccess === 'string') {
            // Single page requirement
            return this.checkSingleAccess(pageAccess, requiredAccess, user);
        } else if (requiredAccess.type === 'any') {
            // Any of the pages
            return this.checkAnyAccess(pageAccess, requiredAccess.pages, user);
        } else if (requiredAccess.type === 'all') {
            // All pages required
            return this.checkAllAccess(pageAccess, requiredAccess.pages, user);
        }

        return false;
    }

    /**
     * Get user's page access from their preset or role defaults
     */
    private async getUserPageAccess(user: User): Promise<PageAccess> {
        // If user has an applied preset, use its pageAccess
        if (user.appliedPresetId) {
            const preset = await this.presetRepo.findOne({
                where: { id: user.appliedPresetId },
                select: ['id', 'pageAccess'],
            });

            if (preset?.pageAccess) {
                return preset.pageAccess;
            }
        }

        // Fallback to role-based defaults
        return this.getDefaultPageAccess(user.role);
    }

    /**
     * Default page access based on role
     */
    private getDefaultPageAccess(role: UserRole): PageAccess {
        switch (role) {
            case UserRole.ADMIN:
                return {
                    dashboard: true,
                    tickets: true,
                    zoom_calendar: true,
                    knowledge_base: true,
                    notifications: true,
                    reports: true,
                    renewal: true,
                    agents: true,
                    automation: true,
                    audit_logs: true,
                    system_health: true,
                    settings: true,
                };
            case UserRole.MANAGER:
                return {
                    dashboard: true,
                    tickets: true,
                    zoom_calendar: true,
                    knowledge_base: true,
                    notifications: true,
                    reports: true,
                    renewal: true,
                    agents: false,
                    automation: false,
                    audit_logs: false,
                    system_health: false,
                    settings: false,
                };
            case UserRole.AGENT:
                return {
                    dashboard: true,
                    tickets: true,
                    zoom_calendar: true,
                    knowledge_base: true,
                    notifications: true,
                    reports: false,
                    renewal: false,
                    agents: false,
                    automation: false,
                    audit_logs: false,
                    system_health: false,
                    settings: false,
                };
            case UserRole.USER:
            default:
                return {
                    dashboard: true,
                    tickets: true,
                    zoom_calendar: false,
                    knowledge_base: true,
                    notifications: true,
                    reports: false,
                    renewal: false,
                    agents: false,
                    automation: false,
                    audit_logs: false,
                    system_health: false,
                    settings: false,
                };
        }
    }

    /**
     * Check single page access
     */
    private checkSingleAccess(pageAccess: PageAccess, page: PageKey, user: User): boolean {
        const hasAccess = pageAccess[page] === true;

        if (!hasAccess) {
            this.logger.warn(`PageAccessGuard: User ${user.id} (${user.role}) denied access to '${page}'`);
            throw new ForbiddenException(`Access denied: '${page}' permission required`);
        }

        return true;
    }

    /**
     * Check if user has access to ANY of the pages
     */
    private checkAnyAccess(pageAccess: PageAccess, pages: PageKey[], user: User): boolean {
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
    private checkAllAccess(pageAccess: PageAccess, pages: PageKey[], user: User): boolean {
        const hasAccess = pages.every(page => pageAccess[page] === true);

        if (!hasAccess) {
            const missingPages = pages.filter(page => pageAccess[page] !== true);
            this.logger.warn(`PageAccessGuard: User ${user.id} (${user.role}) denied access - missing: ${missingPages.join(', ')}`);
            throw new ForbiddenException(`Access denied: missing permissions for [${missingPages.join(', ')}]`);
        }

        return true;
    }
}
