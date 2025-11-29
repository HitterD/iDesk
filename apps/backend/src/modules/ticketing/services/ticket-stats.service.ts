import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Ticket } from '../entities/ticket.entity';
import { CacheService, CacheKeys } from '../../../shared/core/cache';
import { UserRole } from '../../users/enums/user-role.enum';

export interface DashboardStats {
    total: number;
    open: number;
    inProgress: number;
    waitingVendor: number;
    resolved: number;
    overdue: number;
    slaCompliance: number;
    byPriority: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
    byCategory: Record<string, number>;
    todayTickets: number;
    thisWeekTickets: number;
    thisMonthTickets: number;
    resolvedToday: number;
    resolvedThisWeek: number;
    last7Days: { date: string; created: number; resolved: number }[];
    recentTickets: any[];
    topAgents: { name: string; resolved: number; inProgress: number }[];
    avgResolutionTime: string;
}

/**
 * Ticket Statistics Service
 * Handles all dashboard statistics and reporting
 */
@Injectable()
export class TicketStatsService {
    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Get dashboard statistics with caching
     * Cache TTL: 120 seconds for dashboard stats (frequently updated but expensive to compute)
     */
    async getDashboardStats(userId: string, _role: UserRole): Promise<DashboardStats> {
        const cacheKey = CacheKeys.dashboardStats(userId);
        
        return this.cacheService.getOrSet(cacheKey, async () => {
            return this.computeDashboardStats();
        }, 120); // 2 minutes cache
    }

    /**
     * Compute dashboard statistics using SQL aggregations
     */
    private async computeDashboardStats(): Promise<DashboardStats> {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const last7DaysStart = new Date(today);
        last7DaysStart.setDate(today.getDate() - 6);

        // 1. Status counts
        const statusCounts = await this.ticketRepo
            .createQueryBuilder('ticket')
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

        // 2. Priority counts
        const priorityCounts = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select('ticket.priority', 'priority')
            .addSelect('COUNT(*)', 'count')
            .groupBy('ticket.priority')
            .getRawMany();

        const byPriority = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        priorityCounts.forEach(p => {
            if (p.priority in byPriority) {
                byPriority[p.priority as keyof typeof byPriority] = parseInt(p.count) || 0;
            }
        });

        // 3. Category counts
        const categoryCounts = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select(`COALESCE(ticket.category, 'GENERAL')`, 'category')
            .addSelect('COUNT(*)', 'count')
            .groupBy('ticket.category')
            .getRawMany();

        const byCategory: Record<string, number> = {};
        categoryCounts.forEach(c => {
            byCategory[c.category || 'GENERAL'] = parseInt(c.count) || 0;
        });

        // 4. Time-based counts
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

        // 5. Last 7 days
        const dailyStats = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select(`DATE(ticket."createdAt")`, 'date')
            .addSelect('COUNT(*)', 'created')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' THEN 1 ELSE 0 END)`, 'resolved')
            .where(`ticket."createdAt" >= :start`, { start: last7DaysStart })
            .groupBy(`DATE(ticket."createdAt")`)
            .orderBy(`DATE(ticket."createdAt")`, 'ASC')
            .getRawMany();

        const last7Days: { date: string; created: number; resolved: number }[] = [];
        const dailyMap = new Map(dailyStats.map(d => [
            new Date(d.date).toDateString(),
            { created: parseInt(d.created) || 0, resolved: parseInt(d.resolved) || 0 }
        ]));

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const stats = dailyMap.get(date.toDateString()) || { created: 0, resolved: 0 };
            last7Days.push({
                date: date.toLocaleDateString('en-US', { weekday: 'short' }),
                created: stats.created,
                resolved: stats.resolved,
            });
        }

        // 6. Recent tickets
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

        // 7. Top agents
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

        // 8. Average resolution time
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
            slaCompliance,
            byPriority,
            byCategory,
            todayTickets,
            thisWeekTickets,
            thisMonthTickets,
            resolvedToday,
            resolvedThisWeek,
            last7Days,
            recentTickets: formattedRecentTickets,
            topAgents,
            avgResolutionTime,
        };
    }

    /**
     * Invalidate dashboard cache
     */
    async invalidateCache(): Promise<void> {
        await this.cacheService.delByPattern('dashboard:stats:*');
    }
}
