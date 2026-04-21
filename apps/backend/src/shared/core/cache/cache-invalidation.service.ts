import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Centralized Cache Invalidation Service
 * 
 * Provides a single source of truth for cache invalidation patterns.
 * Instead of scattering invalidation logic across services, all cache
 * invalidation should go through this service.
 * 
 * Benefits:
 * - Consistent invalidation patterns
 * - Easy to add new invalidation triggers
 * - Single place to debug caching issues
 */
@Injectable()
export class CacheInvalidationService {
    private readonly logger = new Logger(CacheInvalidationService.name);

    constructor(private readonly cacheService: CacheService) { }

    /**
     * Invalidate all caches related to a ticket change
     * Call this when a ticket is created, updated, or deleted
     * 
     * @param ticketId - The ID of the changed ticket
     * @param options - Additional invalidation options
     */
    async onTicketChange(ticketId: string, options?: {
        invalidateDashboard?: boolean;
        invalidateList?: boolean;
        invalidateDetail?: boolean;
    }) {
        const {
            invalidateDashboard = true,
            invalidateList = true,
            invalidateDetail = true,
        } = options || {};

        const promises: Promise<any>[] = [];

        // Dashboard stats for all users
        if (invalidateDashboard) {
            promises.push(
                this.cacheService.delByPattern('dashboard:stats:*')
                    .then(count => this.logger.debug(`Invalidated ${count} dashboard cache entries`))
            );
        }

        // Ticket list cache for all users
        if (invalidateList) {
            promises.push(
                this.cacheService.delByPattern('tickets:list:*')
                    .then(count => this.logger.debug(`Invalidated ${count} ticket list cache entries`))
            );
        }

        // Specific ticket detail cache
        if (invalidateDetail && ticketId) {
            promises.push(
                this.cacheService.delAsync(`ticket:${ticketId}`)
                    .then(() => this.logger.debug(`Invalidated ticket detail cache for ${ticketId}`))
            );
        }

        await Promise.all(promises);
        this.logger.log(`Cache invalidated for ticket ${ticketId}`);
    }

    /**
     * Invalidate all caches related to a user change
     * Call this when a user is created, updated, or deleted
     * 
     * @param userId - The ID of the changed user (optional for full invalidation)
     */
    async onUserChange(userId?: string) {
        const promises: Promise<any>[] = [];

        // Agents list cache
        promises.push(
            this.cacheService.delAsync('agents:all')
                .then(() => this.logger.debug('Invalidated agents list cache'))
        );

        // Specific user profile cache
        if (userId) {
            promises.push(
                this.cacheService.delAsync(`user:${userId}`)
                    .then(() => this.logger.debug(`Invalidated user cache for ${userId}`))
            );
        }

        // User-related dashboard stats might need updating
        promises.push(
            this.cacheService.delByPattern('dashboard:stats:*')
                .then(count => this.logger.debug(`Invalidated ${count} dashboard cache entries`))
        );

        await Promise.all(promises);
        this.logger.log(`Cache invalidated for user ${userId || 'all'}`);
    }

    /**
     * Invalidate all caches related to SLA configuration change
     */
    async onSlaConfigChange() {
        await this.cacheService.delAsync('sla:config');
        this.logger.log('SLA config cache invalidated');
    }

    /**
     * Invalidate all caches related to knowledge base changes
     * 
     * @param articleId - The ID of the changed article (optional)
     */
    async onKnowledgeBaseChange(articleId?: string) {
        const promises: Promise<any>[] = [];

        // All KB article list pages
        promises.push(
            this.cacheService.delByPattern('kb:articles:*')
                .then(count => this.logger.debug(`Invalidated ${count} KB list cache entries`))
        );

        // Specific article cache
        if (articleId) {
            promises.push(
                this.cacheService.delAsync(`kb:article:${articleId}`)
                    .then(() => this.logger.debug(`Invalidated KB article cache for ${articleId}`))
            );
        }

        await Promise.all(promises);
        this.logger.log(`KB cache invalidated for article ${articleId || 'all'}`);
    }

    /**
     * Invalidate all caches (use sparingly!)
     * Should only be used for major system changes or debugging
     */
    async invalidateAll() {
        await this.cacheService.clear();
        this.logger.warn('All caches have been invalidated');
    }
}
