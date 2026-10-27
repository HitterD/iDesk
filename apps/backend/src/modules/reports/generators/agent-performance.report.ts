import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { ReportTeam, applyTeamFilter } from '../utils/report-team-scope.util';
import { MetricCounts, metricRate, rankAgents, reportMetricSql } from '../utils/report-metrics.util';

export interface AgentMetrics extends MetricCounts {
    agentId: string;
    agentName: string;
    agentSiteId: string | null;
    agentSiteName: string | null;
    resolutionRate: number | null;
    avgResponseTimeMinutes: number | null;
    avgResolutionTimeMinutes: number | null;
    /** Historical priority counts, including cancelled tickets. */
    ticketsByPriority: Record<string, number>;
}

export interface DateRange { startDate: Date; endDate: Date; }
export interface ReportResult<T> { reportType: string; data: T; generatedAt: Date; }

@Injectable()
export class AgentPerformanceReport {
    private readonly logger = new Logger(AgentPerformanceReport.name);

    constructor(
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    ) {}

    async generate(dateRange: DateRange, options?: { siteId?: string; team?: ReportTeam }): Promise<ReportResult<AgentMetrics[]>> {
        const asOf = new Date();
        const sql = reportMetricSql();
        const qb = this.scopedQuery(dateRange, options)
            .select('ticket.assignedToId', 'agentId')
            .addSelect('user.fullName', 'agentName')
            .addSelect('user.siteId', 'agentSiteId')
            .addSelect('site.name', 'agentSiteName')
            .addSelect('COUNT(ticket.id)', 'totalAssigned')
            .addSelect("SUM(CASE WHEN ticket.status = 'CANCELLED' THEN 1 ELSE 0 END)", 'totalCancelled')
            .addSelect(`SUM(CASE WHEN ${sql.done} THEN 1 ELSE 0 END)`, 'totalResolved')
            .addSelect(`COUNT(${sql.responseMinutes})`, 'responseSamples')
            .addSelect(`SUM(${sql.responseMinutes})`, 'responseTotalMinutes')
            .addSelect(`COUNT(${sql.resolutionMinutes})`, 'resolutionSamples')
            .addSelect(`SUM(${sql.resolutionMinutes})`, 'resolutionTotalMinutes')
            .addSelect(`COUNT(${sql.slaEvaluation})`, 'slaEvaluated')
            .addSelect(`SUM(CASE WHEN (${sql.slaEvaluation}) = 1 THEN 1 ELSE 0 END)`, 'slaCompliant')
            .addSelect(`SUM(CASE WHEN (${sql.slaEvaluation}) = 0 THEN 1 ELSE 0 END)`, 'slaBreached')
            .innerJoin('ticket.assignedTo', 'user')
            .leftJoin('user.site', 'site')
            .andWhere('ticket.createdAt <= :asOf', { asOf })
            .groupBy('ticket.assignedToId').addGroupBy('user.fullName')
            .addGroupBy('user.siteId').addGroupBy('site.name');
        const rows = await qb.getRawMany();
        const priorities = await this.scopedQuery(dateRange, options)
            .select('ticket.assignedToId', 'agentId').addSelect('ticket.priority', 'priority')
            .addSelect('COUNT(*)', 'count').andWhere('ticket.createdAt <= :asOf', { asOf })
            .groupBy('ticket.assignedToId').addGroupBy('ticket.priority').getRawMany();
        const metrics = rows.map(row => this.toMetrics(row, priorities));
        this.logger.debug(`Generated performance report for ${metrics.length} agents`);
        return { reportType: 'AGENT_PERFORMANCE', data: rankAgents(metrics), generatedAt: asOf };
    }

    private scopedQuery(dateRange: DateRange, options?: { siteId?: string; team?: ReportTeam }) {
        const qb = this.ticketRepo.createQueryBuilder('ticket')
            .where('ticket.createdAt BETWEEN :startDate AND :endDate', dateRange)
            .andWhere('ticket.assignedToId IS NOT NULL');
        if (options?.siteId) qb.andWhere('ticket.siteId = :siteId', { siteId: options.siteId });
        return applyTeamFilter(qb, 'ticket', options?.team);
    }

    private toMetrics(row: Record<string, any>, priorities: Record<string, any>[]): AgentMetrics {
        const count = (key: string): number => Number(row[key]) || 0;
        const totalAssigned = count('totalAssigned');
        const totalCancelled = count('totalCancelled');
        const totalEligible = totalAssigned - totalCancelled;
        const responseSamples = count('responseSamples');
        const resolutionSamples = count('resolutionSamples');
        return {
            agentId: row.agentId, agentName: row.agentName || 'Unknown',
            agentSiteId: row.agentSiteId ?? null, agentSiteName: row.agentSiteName ?? null,
            totalAssigned, totalCancelled, totalEligible, totalResolved: count('totalResolved'),
            slaEvaluated: count('slaEvaluated'), slaCompliant: count('slaCompliant'), slaBreached: count('slaBreached'),
            responseSamples, responseTotalMinutes: count('responseTotalMinutes'),
            resolutionSamples, resolutionTotalMinutes: count('resolutionTotalMinutes'),
            resolutionRate: metricRate(count('totalResolved'), totalEligible),
            slaComplianceRate: metricRate(count('slaCompliant'), count('slaEvaluated')),
            avgResponseTimeMinutes: responseSamples ? count('responseTotalMinutes') / responseSamples : null,
            avgResolutionTimeMinutes: resolutionSamples ? count('resolutionTotalMinutes') / resolutionSamples : null,
            ticketsByPriority: Object.fromEntries(priorities.filter(p => p.agentId === row.agentId).map(p => [p.priority, Number(p.count)])),
        };
    }
}
