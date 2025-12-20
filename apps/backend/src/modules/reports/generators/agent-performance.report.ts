import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Ticket } from '../../ticketing/entities/ticket.entity';

export interface AgentMetrics {
    agentId: string;
    agentName: string;
    totalAssigned: number;
    totalResolved: number;
    resolutionRate: number;
    avgResponseTimeMinutes: number;
    avgResolutionTimeMinutes: number;
    ticketsByPriority: Record<string, number>;
    slaComplianceRate: number;
}

export interface DateRange {
    startDate: Date;
    endDate: Date;
}

export interface ReportResult<T> {
    reportType: string;
    data: T;
    generatedAt: Date;
}

/**
 * Agent Performance Report Generator
 * OPTIMIZED: Uses single SQL query with aggregations instead of N+1 pattern
 */
@Injectable()
export class AgentPerformanceReport {
    private readonly logger = new Logger(AgentPerformanceReport.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
    ) { }

    /**
     * Generate agent performance metrics using optimized SQL aggregation
     * Single query instead of N queries (one per agent)
     */
    async generate(dateRange: DateRange): Promise<ReportResult<AgentMetrics[]>> {
        // Single optimized query with GROUP BY for all metrics
        const rawMetrics = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select('ticket.assignedToId', 'agentId')
            .addSelect('user.fullName', 'agentName')
            .addSelect('COUNT(ticket.id)', 'totalAssigned')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' THEN 1 ELSE 0 END)`, 'totalResolved')
            .addSelect(`
                AVG(CASE 
                    WHEN ticket.status = 'RESOLVED' 
                    THEN EXTRACT(EPOCH FROM (ticket.updatedAt - ticket.createdAt)) / 60 
                    ELSE NULL 
                END)
            `, 'avgResolutionTimeMinutes')
            .addSelect(`
                SUM(CASE 
                    WHEN ticket.slaTarget IS NOT NULL AND ticket.updatedAt > ticket.slaTarget 
                    THEN 1 
                    ELSE 0 
                END)
            `, 'slaBreached')
            .innerJoin('ticket.assignedTo', 'user')
            .where('ticket.createdAt BETWEEN :startDate AND :endDate', {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
            })
            .andWhere('ticket.assignedToId IS NOT NULL')
            .groupBy('ticket.assignedToId')
            .addGroupBy('user.fullName')
            .orderBy('COUNT(ticket.id)', 'DESC')
            .getRawMany();

        // Get priority breakdown per agent (separate query for detailed breakdown)
        const priorityBreakdown = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select('ticket.assignedToId', 'agentId')
            .addSelect('ticket.priority', 'priority')
            .addSelect('COUNT(*)', 'count')
            .where('ticket.createdAt BETWEEN :startDate AND :endDate', {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
            })
            .andWhere('ticket.assignedToId IS NOT NULL')
            .groupBy('ticket.assignedToId')
            .addGroupBy('ticket.priority')
            .getRawMany();

        // Create priority map per agent
        const priorityMap = new Map<string, Record<string, number>>();
        for (const row of priorityBreakdown) {
            if (!priorityMap.has(row.agentId)) {
                priorityMap.set(row.agentId, {});
            }
            priorityMap.get(row.agentId)![row.priority] = parseInt(row.count);
        }

        // Get average first response time (requires messages relation)
        const responseTimeData = await this.getAverageResponseTimes(dateRange);

        // Transform raw results to AgentMetrics
        const metrics: AgentMetrics[] = rawMetrics.map(row => {
            const totalAssigned = parseInt(row.totalAssigned) || 0;
            const totalResolved = parseInt(row.totalResolved) || 0;
            const slaBreached = parseInt(row.slaBreached) || 0;

            const resolutionRate = totalAssigned > 0
                ? (totalResolved / totalAssigned) * 100
                : 0;

            const slaComplianceRate = totalAssigned > 0
                ? ((totalAssigned - slaBreached) / totalAssigned) * 100
                : 100;

            return {
                agentId: row.agentId,
                agentName: row.agentName || 'Unknown',
                totalAssigned,
                totalResolved,
                resolutionRate: Math.round(resolutionRate * 100) / 100,
                avgResponseTimeMinutes: responseTimeData.get(row.agentId) || 0,
                avgResolutionTimeMinutes: Math.round(parseFloat(row.avgResolutionTimeMinutes) || 0),
                ticketsByPriority: priorityMap.get(row.agentId) || {},
                slaComplianceRate: Math.round(slaComplianceRate * 100) / 100,
            };
        });

        this.logger.debug(`Generated performance report for ${metrics.length} agents`);

        return {
            reportType: 'AGENT_PERFORMANCE',
            data: metrics,
            generatedAt: new Date()
        };
    }

    /**
     * Calculate average first response time per agent
     * This still requires message data but is optimized with aggregation
     */
    private async getAverageResponseTimes(dateRange: DateRange): Promise<Map<string, number>> {
        const responseMap = new Map<string, number>();

        try {
            // Query for first response times using window function approach
            const responseData = await this.ticketRepo
                .createQueryBuilder('ticket')
                .select('ticket.assignedToId', 'agentId')
                .addSelect(`
                    AVG(
                        EXTRACT(EPOCH FROM (
                            (SELECT MIN(m.createdAt) 
                             FROM message m 
                             WHERE m.ticketId = ticket.id 
                               AND m.senderId = ticket.assignedToId
                               AND m.isSystemMessage = false
                            ) - ticket.createdAt
                        )) / 60
                    )
                `, 'avgResponseMinutes')
                .where('ticket.createdAt BETWEEN :startDate AND :endDate', {
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                })
                .andWhere('ticket.assignedToId IS NOT NULL')
                .groupBy('ticket.assignedToId')
                .getRawMany();

            for (const row of responseData) {
                if (row.avgResponseMinutes) {
                    responseMap.set(row.agentId, Math.round(parseFloat(row.avgResponseMinutes)));
                }
            }
        } catch (error) {
            // If subquery fails (e.g., message table structure), return empty map
            this.logger.warn('Could not calculate response times, using default values');
        }

        return responseMap;
    }
}
