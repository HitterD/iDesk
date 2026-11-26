import type { Repository, SelectQueryBuilder } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { applySiteFilter } from '../utils/site-access.util';
import { applyServiceScopeFilter } from '../../../shared/core/utils/service-scope.util';
import { TICKET_ACTIVE_STATUSES_SQL, TICKET_DONE_STATUSES_SQL } from '../utils/ticket-status-sql.util';
import { wibDateSql, wibStartOfMonth, wibStartOfToday, wibStartOfWeek } from '../../../shared/core/utils/wib-date.util';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { isSlaTicketSql } from '../utils/non-sla-ticket.util';
import { OVERDUE_SQL, applyOracleFilter } from './ticket-dev-queue.helper';

const RESOLVED_AT_SQL = 'COALESCE(ticket."resolvedAt", ticket."updatedAt")';
const CREATED_WIB_DATE = wibDateSql('ticket."createdAt"');
const MS_PER_DAY = 86_400_000;

export function buildFilteredTicketQb(
    ticketRepo: Repository<Ticket>,
    role: UserRole,
    userSiteId: string | null,
    excludeCategory?: string,
): SelectQueryBuilder<Ticket> {
    const qb = ticketRepo.createQueryBuilder('ticket');
    applyOracleFilter(qb, role);
    applySiteFilter(qb, role, userSiteId);
    applyServiceScopeFilter(qb, role);
    if (excludeCategory) {
        const excludedCategories = excludeCategory.split(',').map((cat) => cat.trim());
        if (excludedCategories.length > 0) {
            qb.andWhere('ticket.category NOT IN (:...excludedCategories)', { excludedCategories });
        }
    }
    return qb;
}

export async function computeDashboardStatsData(
    createQb: () => SelectQueryBuilder<Ticket>,
    chartDays: number = 7,
) {
    const now = new Date();
    const today = wibStartOfToday(now);
    const thisWeekStart = wibStartOfWeek(now);
    const thisMonthStart = wibStartOfMonth(now);
    const lastDaysStart = new Date(today.getTime() - (chartDays - 1) * MS_PER_DAY);

    const statusCounts = await createQb()
        .select('COUNT(*)', 'total')
        .addSelect(`SUM(CASE WHEN ${isSlaTicketSql('ticket')} THEN 1 ELSE 0 END)`, 'slaEligible')
        .addSelect(`SUM(CASE WHEN ticket.status = 'TODO' THEN 1 ELSE 0 END)`, 'open')
        .addSelect(`SUM(CASE WHEN ticket.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)`, 'inProgress')
        .addSelect(`SUM(CASE WHEN ticket.status = 'WAITING_VENDOR' THEN 1 ELSE 0 END)`, 'waitingVendor')
        .addSelect(`SUM(CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) THEN 1 ELSE 0 END)`, 'resolved')
        .addSelect(`SUM(CASE WHEN ${OVERDUE_SQL} THEN 1 ELSE 0 END)`, 'overdue')
        .addSelect(`SUM(CASE WHEN ticket.priority = 'CRITICAL' AND ticket.status IN (${TICKET_ACTIVE_STATUSES_SQL}) THEN 1 ELSE 0 END)`, 'activeCritical')
        .getRawOne();

    const total = parseInt(statusCounts.total) || 0;
    const open = parseInt(statusCounts.open) || 0;
    const inProgress = parseInt(statusCounts.inProgress) || 0;
    const waitingVendor = parseInt(statusCounts.waitingVendor) || 0;
    const resolved = parseInt(statusCounts.resolved) || 0;
    const overdue = parseInt(statusCounts.overdue) || 0;
    const activeCritical = parseInt(statusCounts.activeCritical) || 0;
    const slaEligible = statusCounts.slaEligible !== undefined ? (parseInt(statusCounts.slaEligible) || 0) : total;
    const slaCompliance = slaEligible > 0 ? Math.max(0, Math.round(((slaEligible - overdue) / slaEligible) * 100)) : 100;

    const priorityCounts = await createQb()
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

    const categoryCounts = await createQb()
        .select(`COALESCE(ticket.category, 'GENERAL')`, 'category')
        .addSelect('COUNT(*)', 'count')
        .groupBy('ticket.category')
        .getRawMany();

    const byCategory: Record<string, number> = {};
    categoryCounts.forEach(c => {
        byCategory[c.category || 'GENERAL'] = parseInt(c.count) || 0;
    });

    const timeCounts = await createQb()
        .select(`SUM(CASE WHEN ticket."createdAt" >= :today THEN 1 ELSE 0 END)`, 'todayTickets')
        .addSelect(`SUM(CASE WHEN ticket."createdAt" >= :thisWeek THEN 1 ELSE 0 END)`, 'thisWeekTickets')
        .addSelect(`SUM(CASE WHEN ticket."createdAt" >= :thisMonth THEN 1 ELSE 0 END)`, 'thisMonthTickets')
        .addSelect(`SUM(CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) AND ${RESOLVED_AT_SQL} >= :today THEN 1 ELSE 0 END)`, 'resolvedToday')
        .addSelect(`SUM(CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) AND ${RESOLVED_AT_SQL} >= :thisWeek THEN 1 ELSE 0 END)`, 'resolvedThisWeek')
        .setParameters({ today, thisWeek: thisWeekStart, thisMonth: thisMonthStart })
        .getRawOne();

    const dailyStats = await createQb()
        .select(`to_char(${CREATED_WIB_DATE}, 'YYYY-MM-DD')`, 'date')
        .addSelect('COUNT(*)', 'created')
        .addSelect(`SUM(CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) THEN 1 ELSE 0 END)`, 'resolved')
        .andWhere(`ticket."createdAt" >= :start`, { start: lastDaysStart })
        .groupBy(CREATED_WIB_DATE)
        .orderBy(CREATED_WIB_DATE, 'ASC')
        .getRawMany();

    const dailyActivity: { date: string; created: number; resolved: number }[] = [];
    const dailyMap = new Map(dailyStats.map(d => [d.date as string, { created: parseInt(d.created) || 0, resolved: parseInt(d.resolved) || 0 }]));
    for (let i = (chartDays - 1); i >= 0; i--) {
        const date = new Date(today.getTime() - i * MS_PER_DAY + MS_PER_DAY / 2);
        const stats = dailyMap.get(localDateKey(date)) || { created: 0, resolved: 0 };
        const formatStr = chartDays > 7
            ? date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: DEFAULT_TIMEZONE })
            : date.toLocaleDateString('en-US', { weekday: 'short', timeZone: DEFAULT_TIMEZONE });
        dailyActivity.push({ date: formatStr, created: stats.created, resolved: stats.resolved });
    }

    const recentTickets = await createQb()
        .leftJoin('ticket.user', 'user')
        .leftJoin('ticket.assignedTo', 'assignedTo')
        .select([
            'ticket.id', 'ticket.ticketNumber', 'ticket.title',
            'ticket.status', 'ticket.priority', 'ticket.category', 'ticket.updatedAt',
            'user.fullName', 'assignedTo.fullName',
        ])
        .orderBy('ticket.updatedAt', 'DESC')
        .take(5)
        .getMany();

    const agentStats = await createQb()
        .innerJoin('ticket.assignedTo', 'agent')
        .select('agent.id', 'agentId')
        .addSelect('agent.fullName', 'name')
        .addSelect(`SUM(CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) THEN 1 ELSE 0 END)`, 'resolved')
        .addSelect(`SUM(CASE WHEN ticket.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)`, 'inProgress')
        .groupBy('agent.id')
        .addGroupBy('agent.fullName')
        .orderBy('resolved', 'DESC')
        .limit(5)
        .getRawMany();

    const avgTimeResult = await createQb()
        .select(`AVG(EXTRACT(EPOCH FROM (${RESOLVED_AT_SQL} - ticket."createdAt")) / 60)`, 'avgMinutes')
        .andWhere(`ticket.status IN (${TICKET_DONE_STATUSES_SQL})`)
        .getRawOne();

    const avgResolutionMinutes = Math.round(parseFloat(avgTimeResult?.avgMinutes) || 0);
    const avgHours = Math.floor(avgResolutionMinutes / 60);
    const avgMins = avgResolutionMinutes % 60;

    return {
        total, open, inProgress, waitingVendor, resolved, overdue,
        critical: activeCritical,
        slaCompliance,
        byPriority, byCategory,
        todayTickets: parseInt(timeCounts.todayTickets) || 0,
        thisWeekTickets: parseInt(timeCounts.thisWeekTickets) || 0,
        thisMonthTickets: parseInt(timeCounts.thisMonthTickets) || 0,
        resolvedToday: parseInt(timeCounts.resolvedToday) || 0,
        resolvedThisWeek: parseInt(timeCounts.resolvedThisWeek) || 0,
        dailyActivity,
        recentTickets: recentTickets.map(t => ({
            id: t.id, ticketNumber: t.ticketNumber, title: t.title,
            status: t.status, priority: t.priority, category: t.category, updatedAt: t.updatedAt,
            user: t.user ? { fullName: t.user.fullName } : null,
            assignedTo: t.assignedTo ? { fullName: t.assignedTo.fullName } : null,
        })),
        topAgents: agentStats.map(a => ({
            name: a.name, resolved: parseInt(a.resolved) || 0, inProgress: parseInt(a.inProgress) || 0,
        })),
        avgResolutionTime: avgHours > 0 ? `${avgHours}h ${avgMins}m` : `${avgMins}m`,
    };
}
