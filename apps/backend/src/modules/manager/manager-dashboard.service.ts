import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Ticket, TicketStatus, TicketPriority } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { DashboardQueryDto } from './dto';
import { CacheService } from '../../shared/core/cache/cache.service';

interface SiteStats {
    siteCode: string;
    siteName: string;
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    criticalTickets: number;
    slaBreach: number;
}

interface AgentStats {
    agentId: string;
    agentName: string;
    siteCode: string;
    openTickets: number;
    resolvedToday: number;
    avgResolutionHours: number;
}

interface TrendData {
    date: string;
    siteCode: string;
    created: number;
    resolved: number;
}

export interface ManagerDashboardStats {
    totalTickets: number;
    ticketsToday: number;
    openTickets: {
        total: number;
        bySite: Record<string, number>;
    };
    criticalTickets: number;
    slaBreach: number;
    siteStats: SiteStats[];
    topAgents: AgentStats[];
    trend: TrendData[];
    recentCritical: any[];
}

@Injectable()
export class ManagerDashboardService {
    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Site)
        private readonly siteRepo: Repository<Site>,
        private readonly cacheService: CacheService,
    ) { }

    async getDashboardStats(query: DashboardQueryDto): Promise<ManagerDashboardStats> {
        // P1 perf: dashboard is hit on every manager page load. 60s cache drops
        // the entire ~30+ query burst to a single Redis hit on warm cache.
        const siteIds = query.siteIds?.length ? [...query.siteIds].sort().join(',') : 'all';
        const cacheKey = `manager-dashboard:${siteIds}:${query.excludeCategory || ''}:${query.days || 7}`;
        return this.cacheService.getOrSet(
            cacheKey,
            () => this.computeDashboardStats(query),
            60,
        );
    }

    private async computeDashboardStats(query: DashboardQueryDto): Promise<ManagerDashboardStats> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sites = query.siteIds?.length
            ? await this.siteRepo.find({ where: { id: In(query.siteIds) } })
            : await this.siteRepo.find({ where: { isActive: true } });

        const siteIds = sites.map(s => s.id);

        // Total tickets
        const totalTickets = await this.ticketRepo.count({
            where: siteIds.length ? { siteId: In(siteIds) } : {},
        });

        // Tickets today
        const ticketsToday = await this.ticketRepo.count({
            where: {
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
                createdAt: MoreThanOrEqual(today),
            },
        });

        // Open tickets by site — P1 perf: was per-site for-loop (1 count per site).
        // Now one grouped query returns counts per siteId in a single round-trip.
        const openBySiteRows = siteIds.length
            ? await this.ticketRepo.createQueryBuilder('t')
                .select('t.siteId', 'siteId')
                .addSelect('COUNT(*)', 'cnt')
                .where('t.siteId IN (:...siteIds)', { siteIds })
                .andWhere('t.status IN (:...openStatuses)', { openStatuses: [TicketStatus.TODO, TicketStatus.IN_PROGRESS] })
                .groupBy('t.siteId')
                .getRawMany()
            : [];
        const openTicketsBySite: Record<string, number> = {};
        let totalOpen = 0;
        for (const row of openBySiteRows) {
            const site = sites.find(s => s.id === row.siteId);
            if (!site) continue;
            openTicketsBySite[site.code] = parseInt(row.cnt, 10);
            totalOpen += openTicketsBySite[site.code];
        }

        // Critical tickets
        const criticalTickets = await this.ticketRepo.count({
            where: {
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
                priority: TicketPriority.CRITICAL,
                status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS]),
            },
        });

        // SLA breach count
        const now = new Date();
        const slaBreach = await this.ticketRepo.count({
            where: {
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
                status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS]),
                slaTarget: LessThanOrEqual(now),
            },
        });

        // Site stats — P1 perf: was 4 counts × N sites. Now one grouped query
        // that aggregates all four metrics per site via COUNT(*) FILTER (WHERE ...).
        const nowForBreach = new Date();
        const openStatuses = [TicketStatus.TODO, TicketStatus.IN_PROGRESS];
        const siteStatRows = siteIds.length
            ? await this.ticketRepo.createQueryBuilder('t')
                .select('t.siteId', 'siteId')
                .addSelect('COUNT(*)', 'totalTickets')
                .addSelect(`COUNT(*) FILTER (WHERE t.status IN (:...openStatuses))`, 'openTickets')
                .addSelect(`COUNT(*) FILTER (WHERE t.status = :resolvedStatus)`, 'resolvedTickets')
                .addSelect(`COUNT(*) FILTER (WHERE t.priority = :criticalPriority AND t.status IN (:...openStatuses))`, 'criticalTickets')
                .addSelect(`COUNT(*) FILTER (WHERE t.status IN (:...openStatuses) AND t."slaTarget" <= :now)`, 'slaBreach')
                .where('t.siteId IN (:...siteIds)', { siteIds })
                .setParameters({
                    openStatuses,
                    resolvedStatus: TicketStatus.RESOLVED,
                    criticalPriority: TicketPriority.CRITICAL,
                    now: nowForBreach,
                })
                .groupBy('t.siteId')
                .getRawMany()
            : [];
        const siteStats: SiteStats[] = siteStatRows.map((row: any) => {
            const site = sites.find(s => s.id === row.siteId);
            return {
                siteCode: site?.code || 'UNKNOWN',
                siteName: site?.name || 'UNKNOWN',
                totalTickets: parseInt(row.totalTickets, 10),
                openTickets: parseInt(row.openTickets, 10),
                resolvedTickets: parseInt(row.resolvedTickets, 10),
                criticalTickets: parseInt(row.criticalTickets, 10),
                slaBreach: parseInt(row.slaBreach, 10),
            };
        });

        // Top agents (by resolved tickets)
        const topAgents = await this.getTopAgents(siteIds);

        // Trend data (last 7 days)
        const trend = await this.getTrendData(siteIds, 7);

        // Recent critical tickets
        const recentCritical = await this.ticketRepo.find({
            where: {
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
                priority: TicketPriority.CRITICAL,
            },
            relations: ['user', 'site', 'assignedTo'],
            order: { createdAt: 'DESC' },
            take: 10,
        });

        return {
            totalTickets,
            ticketsToday,
            openTickets: {
                total: totalOpen,
                bySite: openTicketsBySite,
            },
            criticalTickets,
            slaBreach,
            siteStats,
            topAgents,
            trend,
            recentCritical: recentCritical.map(t => ({
                id: t.id,
                ticketNumber: t.ticketNumber,
                title: t.title,
                status: t.status,
                priority: t.priority,
                createdAt: t.createdAt,
                user: t.user ? { fullName: t.user.fullName } : null,
                site: t.site ? { code: t.site.code } : null,
                assignedTo: t.assignedTo ? { fullName: t.assignedTo.fullName } : null,
            })),
        };
    }

    private async getTopAgents(siteIds: string[]): Promise<AgentStats[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const openStatuses = [TicketStatus.TODO, TicketStatus.IN_PROGRESS];
        const resolvedStatus = TicketStatus.RESOLVED;

        // P1 perf: per-agent loop fired 3 queries per agent (open, resolved-today,
        // last-20-resolved-for-avg). Now one grouped query returns all three
        // metrics per agent in a single round-trip. avgResolutionHours uses
        // SQL EXTRACT(EPOCH) to avoid loading 20 rows per agent into JS.
        const rows: Array<{ agentId: string; openTickets: string; resolvedToday: string; avgResolutionHours: string }> = siteIds.length
            ? await this.ticketRepo.createQueryBuilder('t')
                .select('t.assignedToId', 'agentId')
                .addSelect(`COUNT(*) FILTER (WHERE t.status IN (:...openStatuses))`, 'openTickets')
                .addSelect(`COUNT(*) FILTER (WHERE t.status = :resolvedStatus AND t."resolvedAt" >= :today)`, 'resolvedToday')
                .addSelect(`COALESCE(AVG(EXTRACT(EPOCH FROM (t."resolvedAt" - t."createdAt"))) FILTER (WHERE t.status = :resolvedStatus) / 3600, 0)`, 'avgResolutionHours')
                .where('t.assignedToId IS NOT NULL')
                .andWhere('t.siteId IN (:...siteIds)', { siteIds })
                .setParameters({ openStatuses, resolvedStatus, today })
                .groupBy('t.assignedToId')
                .orderBy(`COUNT(*) FILTER (WHERE t.status = :resolvedStatus AND t."resolvedAt" >= :today)`, 'DESC')
                .limit(10)
                .getRawMany()
            : [];

        if (rows.length === 0) return [];
        const agentIds = rows.map(r => r.agentId);
        const agents = await this.userRepo.find({
            where: { id: In(agentIds) },
            relations: ['site'],
        });
        const agentMap = new Map(agents.map(a => [a.id, a]));

        return rows.map(r => {
            const agent = agentMap.get(r.agentId);
            return {
                agentId: r.agentId,
                agentName: agent?.fullName || 'Unknown',
                siteCode: agent?.site?.code || 'N/A',
                openTickets: parseInt(r.openTickets, 10),
                resolvedToday: parseInt(r.resolvedToday, 10),
                avgResolutionHours: Math.round(parseFloat(r.avgResolutionHours)),
            };
        });
    }

    private async getTrendData(siteIds: string[], days: number): Promise<TrendData[]> {
        if (siteIds.length === 0) return [];
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(start.getDate() - (days - 1));

        // P1 perf: was 2 counts × N sites × 7 days. Now one grouped query
        // using date_trunc('day', ...) so PG aggregates per (day, site) row.
        const rows: Array<{ day: string; siteId: string; created: string; resolved: string }> =
            await this.ticketRepo.createQueryBuilder('t')
                .select(`to_char(date_trunc('day', t."createdAt"), 'YYYY-MM-DD')`, 'day')
                .addSelect('t.siteId', 'siteId')
                .addSelect('COUNT(*)', 'created')
                .addSelect(`COUNT(*) FILTER (WHERE t.status = :resolvedStatus AND t."resolvedAt" IS NOT NULL)`, 'resolved')
                .where('t.siteId IN (:...siteIds)', { siteIds })
                .andWhere('t."createdAt" >= :start', { start })
                .andWhere('t."createdAt" < :endPlus', { endPlus: new Date(end.getTime() + 24 * 60 * 60 * 1000) })
                .setParameters({ resolvedStatus: TicketStatus.RESOLVED })
                .groupBy(`date_trunc('day', t."createdAt")`)
                .addGroupBy('t.siteId')
                .getRawMany();

        const sites = await this.siteRepo.find({ where: { id: In(siteIds) } });
        const siteMap = new Map(sites.map(s => [s.id, s]));

        return rows.map(r => ({
            date: r.day,
            siteCode: siteMap.get(r.siteId)?.code || 'UNKNOWN',
            created: parseInt(r.created, 10),
            resolved: parseInt(r.resolved, 10),
        }));
    }
}
