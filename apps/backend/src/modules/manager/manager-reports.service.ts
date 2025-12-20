import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, MoreThanOrEqual } from 'typeorm';
import { Ticket, TicketStatus, TicketPriority } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { ReportQueryDto, ReportType, ReportPeriod } from './dto';

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

export interface ManagerReport {
    reportType: ReportType;
    period: string;
    generatedAt: Date;
    sites: string[];
    ticketStats?: TicketStats;
    agentPerformance?: AgentPerformance[];
    slaMetrics?: SlaMetrics;
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

    async generateReport(query: ReportQueryDto): Promise<ManagerReport> {
        const { startDate, endDate } = this.getDateRange(query);

        const sites = query.siteIds?.length
            ? await this.siteRepo.find({ where: { id: In(query.siteIds) } })
            : await this.siteRepo.find({ where: { isActive: true } });

        const siteIds = sites.map(s => s.id);

        const report: ManagerReport = {
            reportType: query.reportType || ReportType.CONSOLIDATED,
            period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
            generatedAt: new Date(),
            sites: sites.map(s => s.code),
        };

        // Generate sections based on query
        if (query.includeTicketStats !== false) {
            report.ticketStats = await this.getTicketStats(siteIds, startDate, endDate);
        }

        if (query.includeAgentPerformance !== false) {
            report.agentPerformance = await this.getAgentPerformance(siteIds, startDate, endDate);
        }

        if (query.includeSlaMetrics !== false) {
            report.slaMetrics = await this.getSlaMetrics(siteIds, startDate, endDate);
        }

        // Per-site comparison if requested
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

        const performances: AgentPerformance[] = [];

        for (const agent of agents) {
            // Total assigned in period
            const totalAssigned = await this.ticketRepo.count({
                where: {
                    assignedToId: agent.id,
                    createdAt: Between(startDate, endDate),
                },
            });

            // Resolved in period
            const resolved = await this.ticketRepo.count({
                where: {
                    assignedToId: agent.id,
                    resolvedAt: Between(startDate, endDate),
                },
            });

            // Avg resolution time
            const resolvedTickets = await this.ticketRepo.find({
                where: {
                    assignedToId: agent.id,
                    resolvedAt: Between(startDate, endDate),
                },
            });

            let avgResolutionHours = 0;
            if (resolvedTickets.length > 0) {
                const totalHours = resolvedTickets.reduce((sum, t) => {
                    if (t.resolvedAt && t.createdAt) {
                        return sum + (t.resolvedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
                    }
                    return sum;
                }, 0);
                avgResolutionHours = Math.round((totalHours / resolvedTickets.length) * 10) / 10;
            }

            // SLA compliance
            const slaBreached = resolvedTickets.filter(t =>
                t.slaTarget && t.resolvedAt && t.resolvedAt > t.slaTarget
            ).length;
            const slaCompliance = resolvedTickets.length > 0
                ? Math.round(((resolvedTickets.length - slaBreached) / resolvedTickets.length) * 100)
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
        const comparison = [];

        for (const site of sites) {
            const ticketStats = await this.getTicketStats([site.id], startDate, endDate);
            const slaMetrics = await this.getSlaMetrics([site.id], startDate, endDate);

            comparison.push({
                siteCode: site.code,
                siteName: site.name,
                ticketStats,
                slaMetrics,
            });
        }

        return comparison;
    }
}
