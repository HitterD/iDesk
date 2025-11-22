import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

@Injectable()
export class ReportsService {
    constructor(
        @InjectRepository(Ticket)
        private ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private userRepo: Repository<User>,
    ) { }

    async getMonthlyStats(month: number, year: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const tickets = await this.ticketRepo.find({
            where: {
                createdAt: Between(startDate, endDate),
            },
            relations: ['user'],
        });

        const totalTickets = tickets.length;
        const resolvedTickets = tickets.filter(t => t.status === TicketStatus.RESOLVED).length;
        const openTickets = totalTickets - resolvedTickets;

        // Calculate Average Resolution Time (mock logic for now as we don't track resolvedAt explicitly yet, 
        // or we can use updatedAt if status is RESOLVED)
        let totalResolutionTime = 0;
        let resolvedCount = 0;
        tickets.forEach(t => {
            if (t.status === TicketStatus.RESOLVED) {
                const created = new Date(t.createdAt).getTime();
                const resolved = new Date(t.updatedAt).getTime(); // Approximation
                totalResolutionTime += (resolved - created);
                resolvedCount++;
            }
        });
        const avgResolutionTimeHours = resolvedCount > 0 ? (totalResolutionTime / resolvedCount / (1000 * 60 * 60)).toFixed(2) : 0;

        return {
            month,
            year,
            totalTickets,
            resolvedTickets,
            openTickets,
            avgResolutionTimeHours,
        };
    }

    async generateExcelReport(res: Response, month: number, year: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const tickets = await this.ticketRepo.find({
            where: {
                createdAt: Between(startDate, endDate),
            },
            relations: ['user'],
            order: { createdAt: 'DESC' }
        });

        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Summary
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Metric', key: 'metric', width: 30 },
            { header: 'Value', key: 'value', width: 20 },
        ];

        const stats = await this.getMonthlyStats(month, year);
        summarySheet.addRows([
            { metric: 'Report Period', value: `${month}/${year}` },
            { metric: 'Total Tickets', value: stats.totalTickets },
            { metric: 'Resolved Tickets', value: stats.resolvedTickets },
            { metric: 'Open Tickets', value: stats.openTickets },
            { metric: 'Avg Resolution Time (Hours)', value: stats.avgResolutionTimeHours },
        ]);

        // Sheet 2: Raw Data
        const dataSheet = workbook.addWorksheet('Ticket Data');
        dataSheet.columns = [
            { header: 'ID', key: 'id', width: 36 },
            { header: 'Title', key: 'title', width: 40 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Priority', key: 'priority', width: 15 },
            { header: 'Created By', key: 'createdBy', width: 25 },
            { header: 'Created At', key: 'createdAt', width: 20 },
        ];

        tickets.forEach(ticket => {
            dataSheet.addRow({
                id: ticket.id,
                title: ticket.title,
                status: ticket.status,
                priority: ticket.priority,
                createdBy: ticket.user ? ticket.user.fullName : 'Unknown',
                createdAt: ticket.createdAt.toISOString().split('T')[0],
            });
        });

        // Set Response Headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=report-${month}-${year}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    }
}
