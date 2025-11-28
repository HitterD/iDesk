import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { DateRange, ReportResult } from './agent-performance.report';

export interface VolumeDataPoint {
    date: string;
    created: number;
    resolved: number;
    pending: number;
}

export interface TicketVolumeData {
    daily: VolumeDataPoint[];
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
    byStatus: Record<string, number>;
    summary: {
        totalCreated: number;
        totalResolved: number;
        totalPending: number;
        avgPerDay: number;
        peakDay: string;
        peakCount: number;
    };
}

/**
 * Ticket Volume Report Generator
 * Generates volume statistics for tickets over a date range
 */
@Injectable()
export class TicketVolumeReport {
    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
    ) {}

    async generate(dateRange: DateRange): Promise<ReportResult<TicketVolumeData>> {
        // Fetch all tickets in date range
        const tickets = await this.ticketRepo.find({
            where: {
                createdAt: Between(dateRange.startDate, dateRange.endDate),
            },
            order: { createdAt: 'ASC' },
        });

        // Calculate daily volume
        const daily = this.calculateDailyVolume(tickets, dateRange);

        // Group by various fields
        const byPriority = this.groupBy(tickets, 'priority');
        const byCategory = this.groupBy(tickets, 'category');
        const bySource = this.groupBy(tickets, 'source');
        const byStatus = this.groupBy(tickets, 'status');

        // Calculate summary
        const totalCreated = tickets.length;
        const totalResolved = tickets.filter(t => t.status === 'RESOLVED').length;
        const totalPending = totalCreated - totalResolved;
        const avgPerDay = daily.length > 0 ? Math.round(totalCreated / daily.length) : 0;

        // Find peak day
        let peakDay = '';
        let peakCount = 0;
        for (const day of daily) {
            if (day.created > peakCount) {
                peakCount = day.created;
                peakDay = day.date;
            }
        }

        return {
            reportType: 'TICKET_VOLUME',
            data: {
                daily,
                byPriority,
                byCategory,
                bySource,
                byStatus,
                summary: {
                    totalCreated,
                    totalResolved,
                    totalPending,
                    avgPerDay,
                    peakDay,
                    peakCount,
                },
            },
            generatedAt: new Date(),
        };
    }

    /**
     * Calculate daily volume for the date range
     */
    private calculateDailyVolume(tickets: Ticket[], dateRange: DateRange): VolumeDataPoint[] {
        const daily: VolumeDataPoint[] = [];
        const dailyMap = new Map<string, { created: number; resolved: number; pending: number }>();

        // Initialize all days in range
        const currentDate = new Date(dateRange.startDate);
        while (currentDate <= dateRange.endDate) {
            const dateKey = currentDate.toISOString().split('T')[0];
            dailyMap.set(dateKey, { created: 0, resolved: 0, pending: 0 });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Count tickets per day
        for (const ticket of tickets) {
            const createdDate = new Date(ticket.createdAt).toISOString().split('T')[0];
            const day = dailyMap.get(createdDate);
            if (day) {
                day.created++;
                if (ticket.status === 'RESOLVED') {
                    day.resolved++;
                } else {
                    day.pending++;
                }
            }
        }

        // Convert to array
        for (const [date, counts] of dailyMap.entries()) {
            daily.push({
                date,
                created: counts.created,
                resolved: counts.resolved,
                pending: counts.pending,
            });
        }

        return daily.sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Group tickets by a field
     */
    private groupBy(tickets: Ticket[], field: keyof Ticket): Record<string, number> {
        return tickets.reduce((acc, ticket) => {
            const key = String(ticket[field] || 'Unknown');
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }
}
