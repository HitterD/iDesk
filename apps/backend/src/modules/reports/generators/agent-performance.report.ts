import { Injectable } from '@nestjs/common';
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

@Injectable()
export class AgentPerformanceReport {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
    ) { }

    async generate(dateRange: DateRange): Promise<ReportResult<AgentMetrics[]>> {
        const agents = await this.userRepo.find({
            where: [
                { role: 'AGENT' as any },
                { role: 'ADMIN' as any }
            ],
        });

        const metrics: AgentMetrics[] = [];

        for (const agent of agents) {
            const tickets = await this.ticketRepo.find({
                where: {
                    assignedToId: agent.id,
                    createdAt: Between(dateRange.startDate, dateRange.endDate),
                },
                relations: ['messages'],
            });

            const totalAssigned = tickets.length;
            const resolved = tickets.filter(t => t.status === 'RESOLVED');
            const resolutionRate = totalAssigned > 0 ? (resolved.length / totalAssigned) * 100 : 0;

            // Calculate avg first response time
            let totalResponseTime = 0;
            let responseCount = 0;

            for (const ticket of tickets) {
                const firstReply = ticket.messages
                    ?.filter(m => m.senderId === agent.id && !m.isSystemMessage)
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

                if (firstReply) {
                    const responseTime = (new Date(firstReply.createdAt).getTime() - new Date(ticket.createdAt).getTime()) / 60000;
                    totalResponseTime += responseTime;
                    responseCount++;
                }
            }

            // SLA compliance
            const slaBreached = tickets.filter(t => t.slaTarget && new Date(t.updatedAt) > new Date(t.slaTarget)).length;
            const slaComplianceRate = totalAssigned > 0 ? ((totalAssigned - slaBreached) / totalAssigned) * 100 : 100;

            metrics.push({
                agentId: agent.id,
                agentName: agent.fullName,
                totalAssigned,
                totalResolved: resolved.length,
                resolutionRate: Math.round(resolutionRate * 100) / 100,
                avgResponseTimeMinutes: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0,
                avgResolutionTimeMinutes: this.calculateAvgResolutionTime(resolved),
                ticketsByPriority: this.groupByField(tickets, 'priority'),
                slaComplianceRate: Math.round(slaComplianceRate * 100) / 100,
            });
        }

        return {
            reportType: 'AGENT_PERFORMANCE',
            data: metrics,
            generatedAt: new Date()
        };
    }

    private calculateAvgResolutionTime(tickets: Ticket[]): number {
        if (tickets.length === 0) return 0;

        const totalTime = tickets.reduce((acc, ticket) => {
            const created = new Date(ticket.createdAt).getTime();
            const resolved = new Date(ticket.updatedAt).getTime(); // Assuming updatedAt is resolution time for resolved tickets
            return acc + (resolved - created);
        }, 0);

        return Math.round((totalTime / tickets.length) / 60000); // Minutes
    }

    private groupByField(tickets: Ticket[], field: keyof Ticket): Record<string, number> {
        return tickets.reduce((acc, ticket) => {
            const key = String(ticket[field]);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }
}
