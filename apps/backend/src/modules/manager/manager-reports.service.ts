import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, MoreThanOrEqual } from 'typeorm';
import { Ticket, TicketStatus, TicketPriority } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { ReportQueryDto, ReportType, ReportPeriod, ManagerReportSection } from './dto';
import { SiteActor, resolveSiteScope } from '../../shared/core/utils/site-scope.util';

interface TicketStats {
    total: number;
    byPriority: Record<string, number>;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    created: number;
    resolved: number;
}

interface AgentPerformance {
    agentId: string;
    agentName: string;
    siteCode: string;
    totalAssigned: number;
    resolved: number;
    avgResolutionHours: number;
    slaCompliance: number;
}

interface SlaMetrics {
    totalTickets: number;
    onTime: number;
    breached: number;
    complianceRate: number;
    avgResponseTimeMinutes: number;
    avgResolutionTimeHours: number;
}

export interface TrendPoint {
    date: string; // YYYY-MM-DD
    created: number;
    resolved: number;
}

export interface CriticalTicketRow {
    id: string;
    ticketNumber: string | null;
    title: string;
    status: string;
    createdAt: Date;
    assignedToName: string | null;
}

export interface ManagerReport {
    reportType: ReportType;
    period: string;
    generatedAt: Date;
    sites: string[];
    sections: ManagerReportSection[];
    ticketStats?: TicketStats;
    agentPerformance?: AgentPerformance[];
    slaMetrics?: SlaMetrics;
    trends?: TrendPoint[];
    criticalTickets?: CriticalTicketRow[];
    summary?: {
        totalTickets: number;
        resolvedTickets: number;
        slaComplianceRate: number;
        siteCount: number;
        agentCount: number;
    };
    siteComparison?: Array<{
        siteCode: string;
        siteName: string;
        ticketStats: TicketStats;
        slaMetrics: SlaMetrics;
    }>;
}

@Injectable()
export class ManagerReportsService {
    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Site)
        private readonly siteRepo: Repository<Site>,
    ) { }

    async generateReport(query: ReportQueryDto & { sections?: ManagerReportSection[] }, actor: SiteActor): Promise<ManagerReport> {
        const { startDate, endDate } = this.getDateRange(query);

        // Q5: MANAGER/ADMIN cross-site (lihat CROSS_SITE_ROLES di site-scope.util).
        // resolveSiteScope() dipakai agar jalurnya seragam dengan modul lain; untuk
        // role site-locked scope ini membatasi ke sitenya masing-masing (fail-closed).
        const scope = resolveSiteScope(actor);

        const sites =
            scope.mode === 'site'
                ? await this.siteRepo.find({ where: { id: scope.siteId } })
                : query.siteIds?.length
                    ? await this.siteRepo.find({ where: { id: In(query.siteIds) } })
                    : await this.siteRepo.find({ where: { isActive: true } });

        const siteIds = sites.map(s => s.id);
        const requestedSections = query.sections;

        const wantSummary = !requestedSections || requestedSections.includes('summary');
        const wantTickets = (requestedSections?.includes('tickets') ?? true) || wantSummary; // Q8: butuh data utk summary
        const wantSla = (requestedSections?.includes('sla') ?? true) || wantSummary;
        const wantAgents = requestedSections?.includes('agents') ?? true;
        const wantTrends = requestedSections?.includes('trends') ?? false;
        const wantCritical = requestedSections?.includes('critical') ?? false;

        const report: ManagerReport = {
            reportType: query.reportType || ReportType.CONSOLIDATED,
            period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
            generatedAt: new Date(),
            sites: sites.map(s => s.code),
            sections: requestedSections ?? ['summary', 'tickets', 'sla'],
        };

        // Jalankan section yang dibutuhkan secara paralel (Q15 — hindari serial round-trip).
        const [ticketStats, agentPerformance, slaMetrics, trends, criticalTickets] = await Promise.all([
            wantTickets ? this.getTicketStats(siteIds, startDate, endDate) : Promise.resolve(undefined),
            wantAgents ? this.getAgentPerformance(siteIds, startDate, endDate) : Promise.resolve(undefined),
            wantSla ? this.getSlaMetrics(siteIds, startDate, endDate) : Promise.resolve(undefined),
            wantTrends ? this.getTrendsForRange(siteIds, startDate, endDate) : Promise.resolve(undefined),
            wantCritical ? this.getCriticalTickets(siteIds, startDate, endDate) : Promise.resolve(undefined),
        ]);

        if (wantTickets && ticketStats) report.ticketStats = ticketStats;
        if (wantAgents && agentPerformance) report.agentPerformance = agentPerformance;
        if (wantSla && slaMetrics) report.slaMetrics = slaMetrics;
        if (wantTrends && trends) report.trends = trends;
        if (wantCritical && criticalTickets) report.criticalTickets = criticalTickets;

        // Ringkasan turunan (Q8): nol query tambahan.
        if (wantSummary) {
            report.summary = {
                totalTickets: report.ticketStats?.total ?? 0,
                resolvedTickets: report.ticketStats?.resolved ?? report.slaMetrics?.totalTickets ?? 0,
                slaComplianceRate: report.slaMetrics?.complianceRate ?? 100,
                siteCount: sites.length,
                agentCount: report.agentPerformance?.length ?? 0,
            };
        }

        // Per-site comparison jika diminta
        if (query.reportType === ReportType.COMPARISON || query.reportType === ReportType.PER_SITE) {
            report.siteComparison = await this.getSiteComparison(sites, startDate, endDate);
        }

        return report;
    }

    private getDateRange(query: ReportQueryDto): { startDate: Date; endDate: Date } {
        let startDate: Date;
        let endDate = new Date();

        if (query.startDate && query.endDate) {
            startDate = new Date(query.startDate);
            endDate = new Date(query.endDate);
        } else {
            startDate = new Date();
            switch (query.period) {
                case ReportPeriod.DAILY:
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                case ReportPeriod.WEEKLY:
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case ReportPeriod.MONTHLY:
                default:
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
            }
        }

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        return { startDate, endDate };
    }

    private async getTicketStats(siteIds: string[], startDate: Date, endDate: Date): Promise<TicketStats> {
        const whereClause = {
            ...(siteIds.length ? { siteId: In(siteIds) } : {}),
            createdAt: Between(startDate, endDate),
        };

        // Total tickets in period
        const tickets = await this.ticketRepo.find({ where: whereClause });

        // By priority
        const byPriority: Record<string, number> = {};
        Object.values(TicketPriority).forEach(p => byPriority[p] = 0);
        tickets.forEach(t => byPriority[t.priority] = (byPriority[t.priority] || 0) + 1);

        // By status
        const byStatus: Record<string, number> = {};
        Object.values(TicketStatus).forEach(s => byStatus[s] = 0);
        tickets.forEach(t => byStatus[t.status] = (byStatus[t.status] || 0) + 1);

        // By category
        const byCategory: Record<string, number> = {};
        tickets.forEach(t => {
            const cat = t.category || 'GENERAL';
            byCategory[cat] = (byCategory[cat] || 0) + 1;
        });

        // Resolved in period
        const resolved = await this.ticketRepo.count({
            where: {
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
                resolvedAt: Between(startDate, endDate),
            },
        });

        return {
            total: tickets.length,
            byPriority,
            byStatus,
            byCategory,
            created: tickets.length,
            resolved,
        };
    }

    private async getAgentPerformance(siteIds: string[], startDate: Date, endDate: Date): Promise<AgentPerformance[]> {
        const agents = await this.userRepo.find({
            where: {
                role: UserRole.AGENT,
                isActive: true,
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
            },
            relations: ['site'],
        });

        if (agents.length === 0) {
            return [];
        }

        const agentIds = agents.map(a => a.id);

        // One grouped count for "assigned in period" instead of one query per agent.
        const assignedRows = await this.ticketRepo.createQueryBuilder('t')
            .select('t.assignedToId', 'agentId')
            .addSelect('COUNT(*)', 'count')
            .where('t.assignedToId IN (:...agentIds)', { agentIds })
            .andWhere('t.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .groupBy('t.assignedToId')
            .getRawMany<{ agentId: string; count: string }>();
        const totalAssignedByAgent = new Map(assignedRows.map(r => [r.agentId, Number(r.count)]));

        // One fetch for every resolved ticket in the period instead of one per agent.
        const resolvedTickets = await this.ticketRepo.find({
            where: {
                assignedToId: In(agentIds),
                resolvedAt: Between(startDate, endDate),
            },
        });
        const resolvedByAgent = new Map<string, typeof resolvedTickets>();
        for (const ticket of resolvedTickets) {
            const agentId = ticket.assignedToId as string;
            const list = resolvedByAgent.get(agentId) ?? [];
            list.push(ticket);
            resolvedByAgent.set(agentId, list);
        }

        const performances: AgentPerformance[] = [];

        for (const agent of agents) {
            const totalAssigned = totalAssignedByAgent.get(agent.id) ?? 0;
            const agentResolvedTickets = resolvedByAgent.get(agent.id) ?? [];
            const resolved = agentResolvedTickets.length;

            let avgResolutionHours = 0;
            if (agentResolvedTickets.length > 0) {
                const totalHours = agentResolvedTickets.reduce((sum, t) => {
                    if (t.resolvedAt && t.createdAt) {
                        return sum + (t.resolvedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
                    }
                    return sum;
                }, 0);
                avgResolutionHours = Math.round((totalHours / agentResolvedTickets.length) * 10) / 10;
            }

            // SLA compliance
            const slaBreached = agentResolvedTickets.filter(t =>
                t.slaTarget && t.resolvedAt && t.resolvedAt > t.slaTarget
            ).length;
            const slaCompliance = agentResolvedTickets.length > 0
                ? Math.round(((agentResolvedTickets.length - slaBreached) / agentResolvedTickets.length) * 100)
                : 100;

            performances.push({
                agentId: agent.id,
                agentName: agent.fullName,
                siteCode: agent.site?.code || 'N/A',
                totalAssigned,
                resolved,
                avgResolutionHours,
                slaCompliance,
            });
        }

        return performances.sort((a, b) => b.resolved - a.resolved);
    }

    private async getSlaMetrics(siteIds: string[], startDate: Date, endDate: Date): Promise<SlaMetrics> {
        const resolvedTickets = await this.ticketRepo.find({
            where: {
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
                resolvedAt: Between(startDate, endDate),
            },
        });

        const totalTickets = resolvedTickets.length;
        const breached = resolvedTickets.filter(t =>
            t.slaTarget && t.resolvedAt && t.resolvedAt > t.slaTarget
        ).length;
        const onTime = totalTickets - breached;
        const complianceRate = totalTickets > 0 ? Math.round((onTime / totalTickets) * 100) : 100;

        // Avg response time
        let totalResponseMinutes = 0;
        let responseCount = 0;
        resolvedTickets.forEach(t => {
            if (t.firstResponseAt && t.createdAt) {
                totalResponseMinutes += (t.firstResponseAt.getTime() - t.createdAt.getTime()) / (1000 * 60);
                responseCount++;
            }
        });
        const avgResponseTimeMinutes = responseCount > 0
            ? Math.round(totalResponseMinutes / responseCount)
            : 0;

        // Avg resolution time
        let totalResolutionHours = 0;
        resolvedTickets.forEach(t => {
            if (t.resolvedAt && t.createdAt) {
                totalResolutionHours += (t.resolvedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
            }
        });
        const avgResolutionTimeHours = totalTickets > 0
            ? Math.round((totalResolutionHours / totalTickets) * 10) / 10
            : 0;

        return {
            totalTickets,
            onTime,
            breached,
            complianceRate,
            avgResponseTimeMinutes,
            avgResolutionTimeHours,
        };
    }

    private async getSiteComparison(sites: Site[], startDate: Date, endDate: Date) {
        // Q15: paralel — versi lama serial per site dan bisa lewat timeout request.
        const results = await Promise.all(
            sites.map(async (site) => ({
                siteCode: site.code,
                siteName: site.name,
                ticketStats: await this.getTicketStats([site.id], startDate, endDate),
                slaMetrics: await this.getSlaMetrics([site.id], startDate, endDate),
            })),
        );

        return results;
    }

    /**
     * Q7: trend per hari yang MENGHORMATI rentang tanggal permintaan.
     * getTrendData() di manager-dashboard.service hardcode 7 hari terakhir —
     * tidak dipakai ulang di sini supaya periode laporan akurat.
     */
    private async getTrendsForRange(siteIds: string[], startDate: Date, endDate: Date): Promise<TrendPoint[]> {
        if (siteIds.length === 0) return [];

        const rows = await this.ticketRepo.createQueryBuilder('t')
            .select(`to_char(date_trunc('day', t."createdAt"), 'YYYY-MM-DD')`, 'day')
            .addSelect('COUNT(*)', 'created')
            .addSelect(`COUNT(*) FILTER (WHERE t.status = :resolvedStatus AND t."resolvedAt" IS NOT NULL)`, 'resolved')
            .where('t."siteId" IN (:...ids)', { ids: siteIds })
            .andWhere('t."createdAt" BETWEEN :startDate AND :endDate', { startDate, endDate })
            .setParameters({ resolvedStatus: TicketStatus.RESOLVED })
            .groupBy(`date_trunc('day', t."createdAt")`)
            .orderBy(`date_trunc('day', t."createdAt")`, 'ASC')
            .getRawMany<{ day: string; created: string; resolved: string }>();

        return rows.map(r => ({
            date: r.day,
            created: parseInt(r.created, 10),
            resolved: parseInt(r.resolved, 10),
        }));
    }

    /** Q7: tiket kritis dalam rentang permintaan (dashboard pakai take-10 tanpa filter tanggal). */
    private async getCriticalTickets(siteIds: string[], startDate: Date, endDate: Date): Promise<CriticalTicketRow[]> {
        const tickets = await this.ticketRepo.find({
            where: {
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
                priority: TicketPriority.CRITICAL,
                createdAt: Between(startDate, endDate),
            },
            relations: ['assignedTo'],
            order: { createdAt: 'DESC' },
        });

        return tickets.map(t => ({
            id: t.id,
            ticketNumber: t.ticketNumber ?? null,
            title: t.title,
            status: t.status,
            createdAt: t.createdAt,
            assignedToName: t.assignedTo?.fullName ?? null,
        }));
    }
}
