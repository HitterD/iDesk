import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { CacheService, CacheKeys } from '../../../shared/core/cache';

@Injectable()
export class TicketQueryService {
    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(SlaConfig)
        private readonly slaConfigRepo: Repository<SlaConfig>,
        private readonly cacheService: CacheService,
    ) { }

    async findAll(userId: string, role: UserRole): Promise<Ticket[]> {
        const query = this.ticketRepo.createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .where('ticket.ticketType NOT IN (:...excludedTypes)', { 
                excludedTypes: ['ICT_BUDGET', 'HARDWARE_INSTALLATION'] 
            })
            .orderBy('ticket.createdAt', 'DESC');

        if (role === UserRole.ADMIN) {
            // Admin sees all
            return query.getMany();
        } else if (role === UserRole.AGENT_ORACLE) {
            // Oracle agent sees only Oracle requests
            query.andWhere('ticket.ticketType = :type OR ticket.category = :category', { type: 'ORACLE_REQUEST', category: 'ORACLE_REQUEST' });
            return query.getMany();
        } else if (role === UserRole.AGENT_OPERATIONAL_SUPPORT || role === UserRole.AGENT || role === UserRole.AGENT_ADMIN) {
            // Normal agents see everything EXCEPT Oracle requests
            query.andWhere('ticket.ticketType != :type AND ticket.category != :category', { type: 'ORACLE_REQUEST', category: 'ORACLE_REQUEST' });
            return query.getMany();
        } else {
            // Normal user sees only their own tickets
            // EXCLUDE specialized request types that have their own modules
            query.andWhere('ticket.userId = :userId', { userId });
            query.andWhere('ticket.ticketType NOT IN (:...excludedTypes)', { 
                excludedTypes: ['ICT_BUDGET', 'HARDWARE_INSTALLATION'] 
            });
            return query.getMany();
        }
    }

    async findAllPaginated(
        userId: string,
        role: UserRole,
        userSiteId: string | null, // User's assigned site (null for cross-site roles)
        options: {
            page?: number;
            limit?: number;
            sortBy?: string;
            sortOrder?: 'ASC' | 'DESC';
            status?: string;
            priority?: string;
            category?: string;
            search?: string;
            siteId?: string;      // Single site filter
            siteIds?: string[];   // Multiple site filter (ADMIN/MANAGER only)
            excludeCategory?: string;
            excludeType?: string;
            ticketType?: string;
            startDate?: string;
            endDate?: string;
        } = {}
    ) {
        const {
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
            status,
            priority,
            category,
            search,
            siteId,
            siteIds,
            excludeCategory,
            excludeType,
            ticketType,
            startDate,
            endDate,
        } = options;

        const qb = this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.site', 'site');

        // Role-based filtering
        if (role === UserRole.USER) {
            qb.where('ticket.userId = :userId', { userId });

            // Only apply default exclusion if an explicit ticketType filter is not provided
            if (!ticketType) {
                qb.andWhere('ticket.ticketType NOT IN (:...excludedTypes)', {
                    excludedTypes: ['ICT_BUDGET', 'HARDWARE_INSTALLATION']
                });
            }
        } else if (role === UserRole.AGENT_ORACLE) {            // Oracle agent strictly sees only oracle requests
            qb.andWhere('(ticket.ticketType = :oracleType OR ticket.category = :oracleCategory)', { oracleType: 'ORACLE_REQUEST', oracleCategory: 'ORACLE_REQUEST' });
        } else if (role === UserRole.AGENT_OPERATIONAL_SUPPORT || role === UserRole.AGENT_ADMIN || role === UserRole.AGENT) {
            // Normal agents strictly DO NOT see oracle requests
            qb.andWhere('(ticket.ticketType != :oracleType AND ticket.category != :oracleCategory)', { oracleType: 'ORACLE_REQUEST', oracleCategory: 'ORACLE_REQUEST' });
        }

        // Site isolation filtering
        // ADMIN & MANAGER can view cross-site, USER & AGENT are restricted
        // AGENT_ADMIN can also view cross site if configured, but let's assume they are restricted to their site for now unless specified
        if (role === UserRole.ADMIN || role === UserRole.MANAGER) {
            // Cross-site roles: apply optional site filters
            if (siteIds && siteIds.length > 0) {
                qb.andWhere('ticket.siteId IN (:...siteIds)', { siteIds });
            } else if (siteId) {
                qb.andWhere('ticket.siteId = :siteId', { siteId });
            }
            // If no filter, show all sites
        } else {
            // USER & AGENT & AGENT_ADMIN: strictly filter by their site
            if (userSiteId) {
                qb.andWhere('ticket.siteId = :userSiteId', { userSiteId });
            }
        }

        // Status filter
        if (status) {
            qb.andWhere('ticket.status = :status', { status });
        }

        // Priority filter
        if (priority) {
            qb.andWhere('ticket.priority = :priority', { priority });
        }

        // Category filter
        if (category) {
            qb.andWhere('ticket.category = :category', { category });
        }

        // Search in title and description using PostgreSQL Full-Text Search
        // OPTIMIZED: Uses to_tsvector with GIN index for ~10x faster search on large datasets
        // Fallback to ILIKE for ticket number (exact match pattern)
        if (search) {
            const searchTerm = search.trim();

            // For short queries or ticket number patterns, use ILIKE (more flexible)
            if (searchTerm.length <= 3 || /^\d{6}-/.test(searchTerm)) {
                qb.andWhere(
                    '(ticket.title ILIKE :search OR ticket.description ILIKE :search OR ticket."ticketNumber" ILIKE :search)',
                    { search: `%${searchTerm}%` }
                );
            } else {
                // For longer queries, use Full-Text Search for better performance
                // This requires a GIN index on the search vector (see migration)
                qb.andWhere(
                    `(to_tsvector('indonesian', COALESCE(ticket.title, '') || ' ' || COALESCE(ticket.description, '')) @@ plainto_tsquery('indonesian', :search) OR ticket."ticketNumber" ILIKE :ticketSearch)`,
                    { search: searchTerm, ticketSearch: `%${searchTerm}%` }
                );
            }
        }

        // Exclude Category filter
        if (excludeCategory) {
            const excludeCategories = excludeCategory.split(',').map(c => c.trim());
            qb.andWhere('ticket.category NOT IN (:...excludeCategories)', { excludeCategories });
        }

        // Ticket Type filter (specific type or exclude type)
        if (ticketType === 'HARDWARE_INSTALLATION') {
            qb.andWhere('ticket.isHardwareInstallation = true');
        } else if (ticketType) {
            qb.andWhere('ticket.ticketType = :ticketType', { ticketType });
        }
        
        if (excludeType === 'HARDWARE_INSTALLATION') {
            qb.andWhere('ticket.isHardwareInstallation = false');
        } else if (excludeType) {
            qb.andWhere('ticket.ticketType != :excludeType', { excludeType });
        }

        // Date range filters
        if (startDate) {
            qb.andWhere('ticket.createdAt >= :startDate', { startDate });
        }
        
        if (endDate) {
            qb.andWhere('ticket.createdAt <= :endDate', { endDate });
        }

        // Get total count (before pagination)
        const total = await qb.getCount();

        // Apply sorting
        const validSortFields = ['createdAt', 'updatedAt', 'status', 'priority', 'title'];
        const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        qb.orderBy(`ticket.${actualSortBy}`, sortOrder);

        // Apply pagination
        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);

        const data = await qb.getMany();

        const totalPages = Math.ceil(total / limit);

        // Enrich HW Installation tickets with ictBudgetRequestId
        const hwTicketIds = data
          .filter((t) => t.isHardwareInstallation)
          .map((t) => t.id);

        let hwScheduleMap = new Map<string, string>();
        if (hwTicketIds.length > 0) {
          const schedules = await this.ticketRepo.manager
            .createQueryBuilder()
            .select('s."ticketId"', 'ticketId')
            .addSelect('s."ictBudgetRequestId"', 'ictBudgetRequestId')
            .from('installation_schedules', 's')
            .where('s."ticketId" IN (:...hwTicketIds)', { hwTicketIds })
            .getRawMany();
          hwScheduleMap = new Map(
            schedules.map((s) => [s.ticketId, s.ictBudgetRequestId]),
          );
        }

        const enrichedTickets = data.map((ticket) => ({
          ...ticket,
          ictBudgetRequestId: hwScheduleMap.get(ticket.id) || null,
        }));

        return {
            data: enrichedTickets,
            meta: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        };
    }

    async findOne(id: string): Promise<any> {
        const ticket = await this.ticketRepo.findOne({
            where: { id },
            relations: ['user', 'user.department', 'assignedTo', 'messages', 'messages.sender'],
        });

        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        // Use stored SLA Target if available, otherwise calculate it (for backwards compatibility)
        let slaTarget = ticket.slaTarget;
        if (!slaTarget && ticket.priority) {
            const slaConfig = await this.slaConfigRepo.findOne({ where: { priority: ticket.priority } });
            if (slaConfig) {
                const createdAt = new Date(ticket.createdAt);
                const pausedMinutes = ticket.totalPausedMinutes || 0;
                slaTarget = new Date(createdAt.getTime() + (slaConfig.resolutionTimeMinutes + pausedMinutes) * 60000);

                // Save calculated SLA target to ticket for future reference
                ticket.slaTarget = slaTarget;
                await this.ticketRepo.save(ticket);
            }
        }

        return { ...ticket, slaTarget };
    }

    async getDashboardStats(userId: string, role: UserRole, excludeCategory?: string, days: number = 7) {
        // Always compute fresh stats (cache disabled for real-time accuracy)
        return this.computeDashboardStats(role, excludeCategory, days);
    }

    private async computeDashboardStats(role: UserRole, excludeCategory?: string, chartDays: number = 7) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDaysStart = new Date(today);
        lastDaysStart.setDate(today.getDate() - (chartDays - 1));

        // Use QueryBuilder for efficient aggregations
        const qb = this.ticketRepo.createQueryBuilder('ticket');

        // Exclude Oracle tickets for specific roles
        if (role === UserRole.AGENT_OPERATIONAL_SUPPORT || role === UserRole.AGENT || role === UserRole.AGENT_ADMIN) {
            qb.where('ticket.ticketType != :oracleType AND ticket.category != :oracleCategory', { oracleType: 'ORACLE_REQUEST', oracleCategory: 'ORACLE_REQUEST' });
        } else if (role === UserRole.AGENT_ORACLE) {
            qb.where('ticket.ticketType = :oracleType OR ticket.category = :oracleCategory', { oracleType: 'ORACLE_REQUEST', oracleCategory: 'ORACLE_REQUEST' });
        }

        // Apply string exclusion
        if (excludeCategory) {
            const excludedCategories = excludeCategory.split(',').map((cat) => cat.trim());
            if (excludedCategories.length > 0) {
                // If it already has conditions, use andWhere
                qb.andWhere('ticket.category NOT IN (:...excludedCategories)', { excludedCategories });
            }
        }

        // 1. Status counts - single query with CASE statements
        const statusCounts = await qb
            .select('COUNT(*)', 'total')
            .addSelect(`SUM(CASE WHEN ticket.status = 'TODO' THEN 1 ELSE 0 END)`, 'open')
            .addSelect(`SUM(CASE WHEN ticket.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)`, 'inProgress')
            .addSelect(`SUM(CASE WHEN ticket.status = 'WAITING_VENDOR' THEN 1 ELSE 0 END)`, 'waitingVendor')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' THEN 1 ELSE 0 END)`, 'resolved')
            .addSelect(`SUM(CASE WHEN ticket.status != 'RESOLVED' AND ticket.status != 'CANCELLED' AND ticket."slaTarget" IS NOT NULL AND ticket."slaTarget" < NOW() THEN 1 ELSE 0 END)`, 'overdue')
            .getRawOne();

        const total = parseInt(statusCounts.total) || 0;
        const open = parseInt(statusCounts.open) || 0;
        const inProgress = parseInt(statusCounts.inProgress) || 0;
        const waitingVendor = parseInt(statusCounts.waitingVendor) || 0;
        const resolved = parseInt(statusCounts.resolved) || 0;
        const overdue = parseInt(statusCounts.overdue) || 0;
        const slaCompliance = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

        // 2. Priority counts - single query
        const priorityQb = this.ticketRepo.createQueryBuilder('ticket');

        if (role === UserRole.AGENT_OPERATIONAL_SUPPORT || role === UserRole.AGENT || role === UserRole.AGENT_ADMIN) {
            priorityQb.where('ticket.ticketType != :oracleType AND ticket.category != :oracleCategory', { oracleType: 'ORACLE_REQUEST', oracleCategory: 'ORACLE_REQUEST' });
        } else if (role === UserRole.AGENT_ORACLE) {
            priorityQb.where('ticket.ticketType = :oracleType OR ticket.category = :oracleCategory', { oracleType: 'ORACLE_REQUEST', oracleCategory: 'ORACLE_REQUEST' });
        }

        const priorityCounts = await priorityQb
            .select('ticket.priority', 'priority')
            .addSelect('COUNT(*)', 'count')
            .groupBy('ticket.priority')
            .getRawMany();

        const byPriority = {
            CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0,
        };
        priorityCounts.forEach(p => {
            if (p.priority in byPriority) {
                byPriority[p.priority as keyof typeof byPriority] = parseInt(p.count) || 0;
            }
        });

        // 3. Category counts - single query
        const categoryQb = this.ticketRepo.createQueryBuilder('ticket');

        if (role === UserRole.AGENT_OPERATIONAL_SUPPORT || role === UserRole.AGENT || role === UserRole.AGENT_ADMIN) {
            categoryQb.where('ticket.ticketType != :oracleType AND ticket.category != :oracleCategory', { oracleType: 'ORACLE_REQUEST', oracleCategory: 'ORACLE_REQUEST' });
        } else if (role === UserRole.AGENT_ORACLE) {
            categoryQb.where('ticket.ticketType = :oracleType OR ticket.category = :oracleCategory', { oracleType: 'ORACLE_REQUEST', oracleCategory: 'ORACLE_REQUEST' });
        }

        const categoryCounts = await categoryQb
            .select(`COALESCE(ticket.category, 'GENERAL')`, 'category')
            .addSelect('COUNT(*)', 'count')
            .groupBy('ticket.category')
            .getRawMany();

        const byCategory: Record<string, number> = {};
        categoryCounts.forEach(c => {
            byCategory[c.category || 'GENERAL'] = parseInt(c.count) || 0;
        });

        // 4. Time-based counts - single query
        const timeCounts = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select(`SUM(CASE WHEN ticket."createdAt" >= :today THEN 1 ELSE 0 END)`, 'todayTickets')
            .addSelect(`SUM(CASE WHEN ticket."createdAt" >= :thisWeek THEN 1 ELSE 0 END)`, 'thisWeekTickets')
            .addSelect(`SUM(CASE WHEN ticket."createdAt" >= :thisMonth THEN 1 ELSE 0 END)`, 'thisMonthTickets')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' AND ticket."updatedAt" >= :today THEN 1 ELSE 0 END)`, 'resolvedToday')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' AND ticket."updatedAt" >= :thisWeek THEN 1 ELSE 0 END)`, 'resolvedThisWeek')
            .setParameters({ today, thisWeek: thisWeekStart, thisMonth: thisMonthStart })
            .getRawOne();

        const todayTickets = parseInt(timeCounts.todayTickets) || 0;
        const thisWeekTickets = parseInt(timeCounts.thisWeekTickets) || 0;
        const thisMonthTickets = parseInt(timeCounts.thisMonthTickets) || 0;
        const resolvedToday = parseInt(timeCounts.resolvedToday) || 0;
        const resolvedThisWeek = parseInt(timeCounts.resolvedThisWeek) || 0;

        // 5. Last N days - single query with date grouping
        const dailyStats = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select(`DATE(ticket."createdAt")`, 'date')
            .addSelect('COUNT(*)', 'created')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' THEN 1 ELSE 0 END)`, 'resolved')
            .where(`ticket."createdAt" >= :start`, { start: lastDaysStart })
            .groupBy(`DATE(ticket."createdAt")`)
            .orderBy(`DATE(ticket."createdAt")`, 'ASC')
            .getRawMany();

        // Build last N days array
        const dailyActivityData: { date: string; created: number; resolved: number }[] = [];
        const dailyMap = new Map(dailyStats.map(d => [
            new Date(d.date).toDateString(),
            { created: parseInt(d.created) || 0, resolved: parseInt(d.resolved) || 0 }
        ]));

        for (let i = (chartDays - 1); i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const stats = dailyMap.get(date.toDateString()) || { created: 0, resolved: 0 };
            
            // For longer ranges, format date as 'D MMM' instead of weekday
            const formatStr = chartDays > 7 
                ? date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) 
                : date.toLocaleDateString('en-US', { weekday: 'short' });
                
            dailyActivityData.push({
                date: formatStr,
                created: stats.created,
                resolved: stats.resolved,
            });
        }

        // 6. Recent tickets - limited query with joins
        const recentTickets = await this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoin('ticket.user', 'user')
            .leftJoin('ticket.assignedTo', 'assignedTo')
            .select([
                'ticket.id', 'ticket.ticketNumber', 'ticket.title',
                'ticket.status', 'ticket.priority', 'ticket.category', 'ticket.updatedAt',
                'user.fullName', 'assignedTo.fullName'
            ])
            .orderBy('ticket.updatedAt', 'DESC')
            .take(5)
            .getMany();

        const formattedRecentTickets = recentTickets.map(t => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            title: t.title,
            status: t.status,
            priority: t.priority,
            category: t.category,
            updatedAt: t.updatedAt,
            user: t.user ? { fullName: t.user.fullName } : null,
            assignedTo: t.assignedTo ? { fullName: t.assignedTo.fullName } : null,
        }));

        // 7. Top agents - SQL aggregation
        const agentStats = await this.ticketRepo
            .createQueryBuilder('ticket')
            .innerJoin('ticket.assignedTo', 'agent')
            .select('agent.id', 'agentId')
            .addSelect('agent.fullName', 'name')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' THEN 1 ELSE 0 END)`, 'resolved')
            .addSelect(`SUM(CASE WHEN ticket.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)`, 'inProgress')
            .groupBy('agent.id')
            .addGroupBy('agent.fullName')
            .orderBy('resolved', 'DESC')
            .limit(5)
            .getRawMany();

        const topAgents = agentStats.map(a => ({
            name: a.name,
            resolved: parseInt(a.resolved) || 0,
            inProgress: parseInt(a.inProgress) || 0,
        }));

        // 8. Average resolution time - SQL calculation
        const avgTimeResult = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select(`AVG(EXTRACT(EPOCH FROM (ticket."updatedAt" - ticket."createdAt")) / 60)`, 'avgMinutes')
            .where(`ticket.status = 'RESOLVED'`)
            .getRawOne();

        const avgResolutionMinutes = Math.round(parseFloat(avgTimeResult?.avgMinutes) || 0);
        const avgHours = Math.floor(avgResolutionMinutes / 60);
        const avgMins = avgResolutionMinutes % 60;
        const avgResolutionTime = avgHours > 0 ? `${avgHours}h ${avgMins}m` : `${avgMins}m`;

        return {
            total,
            open,
            inProgress,
            waitingVendor,
            resolved,
            overdue,
            critical: byPriority.CRITICAL,
            slaCompliance,
            byPriority,
            byCategory,
            todayTickets,
            thisWeekTickets,
            thisMonthTickets,
            resolvedToday,
            resolvedThisWeek,
            dailyActivity: dailyActivityData,
            recentTickets: formattedRecentTickets,
            topAgents,
            avgResolutionTime,
        };
    }
}
