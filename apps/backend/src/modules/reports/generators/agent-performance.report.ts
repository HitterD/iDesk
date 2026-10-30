import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { HandlingTeam, Ticket, TicketStatus } from '../../ticketing/entities/ticket.entity';
import { DEV_HANDLING_TEAMS, ReportTeam, applyTeamFilter } from '../utils/report-team-scope.util';
import { MetricCounts, metricRate, rankAgents, reportMetricSql } from '../utils/report-metrics.util';

export interface AgentMetrics extends MetricCounts {
    agentId: string;
    agentName: string;
    resolutionRate: number | null;
    avgResponseTimeMinutes: number | null;
    avgResolutionTimeMinutes: number | null;
    ticketsByPriority: Record<string, number>;
}

export interface DateRange { startDate: Date; endDate: Date; }
export interface ReportResult<T> { reportType: string; data: T; generatedAt: Date; }

/**
 * Agent performance for a cohort of tickets created in the period.
 * Cancelled tickets are left out entirely. In a site report, IT Support work is
 * listed only for that site's own agents; dev teams work across sites and stay listed.
 */
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
        const rows = await this.scopedQuery(dateRange, asOf, options)
            .select('ticket.assignedToId', 'agentId')
            .addSelect('user.fullName', 'agentName')
            .addSelect('COUNT(ticket.id)', 'totalAssigned')
            .addSelect(`SUM(CASE WHEN ${sql.done} THEN 1 ELSE 0 END)`, 'totalResolved')
            .addSelect(`COUNT(${sql.responseMinutes})`, 'responseSamples')
            .addSelect(`SUM(${sql.responseMinutes})`, 'responseTotalMinutes')
            .addSelect(`COUNT(${sql.resolutionMinutes})`, 'resolutionSamples')
            .addSelect(`SUM(${sql.resolutionMinutes})`, 'resolutionTotalMinutes')
            .addSelect(`COUNT(${sql.slaEvaluation})`, 'slaEvaluated')
            .addSelect(`SUM(CASE WHEN (${sql.slaEvaluation}) = 1 THEN 1 ELSE 0 END)`, 'slaCompliant')
            .addSelect(`SUM(CASE WHEN (${sql.slaEvaluation}) = 0 THEN 1 ELSE 0 END)`, 'slaBreached')
            .groupBy('ticket.assignedToId').addGroupBy('user.fullName')
            .getRawMany();
        const priorities = await this.scopedQuery(dateRange, asOf, options)
            .select('ticket.assignedToId', 'agentId').addSelect('ticket.priority', 'priority')
            .addSelect('COUNT(*)', 'count')
            .groupBy('ticket.assignedToId').addGroupBy('ticket.priority').getRawMany();
        const metrics = rows.map(row => this.toMetrics(row, priorities));
        this.logger.debug(`Generated performance report for ${metrics.length} agents`);
        return { reportType: 'AGENT_PERFORMANCE', data: rankAgents(metrics), generatedAt: asOf };
    }

    private scopedQuery(dateRange: DateRange, asOf: Date, options?: { siteId?: string; team?: ReportTeam }) {
        const qb = this.ticketRepo.createQueryBuilder('ticket')
            .innerJoin('ticket.assignedTo', 'user')
            .where('ticket.createdAt BETWEEN :startDate AND :endDate', dateRange)
            .andWhere('ticket.createdAt <= :asOf', { asOf })
            .andWhere('ticket.assignedToId IS NOT NULL')
            .andWhere(`ticket.status <> '${TicketStatus.CANCELLED}'`);
        if (options?.siteId) {
            qb.andWhere('ticket.siteId = :siteId', { siteId: options.siteId });
            // IT Support work in a site report belongs to that site's own agents, so a visiting
            // agent's tickets are not listed. Dev teams work across sites centrally and stay listed.
            if (!options.team || options.team === HandlingTeam.OPS_SUPPORT) {
                qb.andWhere('(ticket.handlingTeam IN (:...devTeams) OR user.siteId = :siteId)', { siteId: options.siteId, devTeams: DEV_HANDLING_TEAMS });
            }
        }
        return applyTeamFilter(qb, 'ticket', options?.team);
    }

    private toMetrics(row: Record<string, any>, priorities: Record<string, any>[]): AgentMetrics {
        const count = (key: string): number => Number(row[key]) || 0;
        const totalAssigned = count('totalAssigned');
        const responseSamples = count('responseSamples');
        const resolutionSamples = count('resolutionSamples');
        return {
            agentId: row.agentId, agentName: row.agentName || 'Unknown',
            totalAssigned, totalResolved: count('totalResolved'),
            slaEvaluated: count('slaEvaluated'), slaCompliant: count('slaCompliant'), slaBreached: count('slaBreached'),
            responseSamples, responseTotalMinutes: count('responseTotalMinutes'),
            resolutionSamples, resolutionTotalMinutes: count('resolutionTotalMinutes'),
            resolutionRate: metricRate(count('totalResolved'), totalAssigned),
            slaComplianceRate: metricRate(count('slaCompliant'), count('slaEvaluated')),
            avgResponseTimeMinutes: responseSamples ? count('responseTotalMinutes') / responseSamples : null,
            avgResolutionTimeMinutes: resolutionSamples ? count('resolutionTotalMinutes') / resolutionSamples : null,
            ticketsByPriority: Object.fromEntries(priorities.filter(p => p.agentId === row.agentId).map(p => [p.priority, Number(p.count)])),
        };
    }
}
