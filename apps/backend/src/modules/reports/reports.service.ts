import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { AgentPerformanceReport, DateRange } from './generators/agent-performance.report';
import { TicketVolumeReport } from './generators/ticket-volume.report';
import { PDFGeneratorService } from './generators/pdf-generator.service';

@Injectable()
export class ReportsService {
    constructor(
        @InjectRepository(Ticket)
        private ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private userRepo: Repository<User>,
        private readonly agentPerformanceReport: AgentPerformanceReport,
        private readonly ticketVolumeReport: TicketVolumeReport,
        private readonly pdfGenerator: PDFGeneratorService,
    ) { }

    /**
     * OPTIMIZED: Get monthly stats using SQL aggregations
     */
    async getMonthlyStats(month: number, year: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // Single optimized query with SQL aggregations
        const stats = await this.ticketRepo
            .createQueryBuilder('ticket')
            .select('COUNT(*)', 'totalTickets')
            .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' THEN 1 ELSE 0 END)`, 'resolvedTickets')
            .addSelect(`SUM(CASE WHEN ticket.status != 'RESOLVED' THEN 1 ELSE 0 END)`, 'openTickets')
            .addSelect(`AVG(CASE WHEN ticket.status = 'RESOLVED' THEN EXTRACT(EPOCH FROM (ticket."updatedAt" - ticket."createdAt")) / 3600 ELSE NULL END)`, 'avgResolutionTimeHours')
            .where('ticket."createdAt" BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getRawOne();

        return {
            month,
            year,
            totalTickets: parseInt(stats.totalTickets) || 0,
            resolvedTickets: parseInt(stats.resolvedTickets) || 0,
            openTickets: parseInt(stats.openTickets) || 0,
            avgResolutionTimeHours: parseFloat(stats.avgResolutionTimeHours)?.toFixed(2) || 0,
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
    async getAgentPerformance(startDate: Date, endDate: Date) {
        return this.agentPerformanceReport.generate({ startDate, endDate });
    }

    /**
     * Get ticket volume report for a date range
     */
    async getTicketVolume(startDate: Date, endDate: Date) {
        return this.ticketVolumeReport.generate({ startDate, endDate });
    }

    /**
     * Generate Agent Performance PDF
     */
    async generateAgentPerformancePDF(res: Response, startDate: Date, endDate: Date) {
        const report = await this.agentPerformanceReport.generate({ startDate, endDate });
        await this.pdfGenerator.generateAgentPerformancePDF(res, report.data, {
            title: 'Agent Performance Report',
            dateRange: { startDate, endDate },
        });
    }

    /**
     * Generate Ticket Volume PDF
     */
    async generateTicketVolumePDF(res: Response, startDate: Date, endDate: Date) {
        const report = await this.ticketVolumeReport.generate({ startDate, endDate });
        await this.pdfGenerator.generateTicketVolumePDF(res, report.data, {
            title: 'Ticket Volume Report',
            dateRange: { startDate, endDate },
        });
    }

    /**
     * Generate Monthly Summary PDF
     */
    async generateMonthlySummaryPDF(res: Response, month: number, year: number) {
        const stats = await this.getMonthlyStats(month, year);
        await this.pdfGenerator.generateMonthlySummaryPDF(res, stats, {
            title: `Monthly Summary Report`,
        });
    }

    /**
     * Generate comprehensive Excel report with custom date range
     */
    async generateCustomRangeExcel(res: Response, startDate: Date, endDate: Date) {
        const [volumeReport, performanceReport] = await Promise.all([
            this.ticketVolumeReport.generate({ startDate, endDate }),
            this.agentPerformanceReport.generate({ startDate, endDate }),
        ]);

        const workbook = new ExcelJS.Workbook();

        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Metric', key: 'metric', width: 30 },
            { header: 'Value', key: 'value', width: 20 },
        ];
        summarySheet.addRows([
            { metric: 'Report Period', value: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}` },
            { metric: 'Generated At', value: new Date().toLocaleString() },
            { metric: '', value: '' },
            { metric: '--- Ticket Volume ---', value: '' },
            { metric: 'Total Created', value: volumeReport.data.summary.totalCreated },
            { metric: 'Total Resolved', value: volumeReport.data.summary.totalResolved },
            { metric: 'Total Pending', value: volumeReport.data.summary.totalPending },
            { metric: 'Average Per Day', value: volumeReport.data.summary.avgPerDay },
            { metric: 'Peak Day', value: `${volumeReport.data.summary.peakDay} (${volumeReport.data.summary.peakCount})` },
        ]);

        // Agent Performance Sheet
        const agentSheet = workbook.addWorksheet('Agent Performance');
        agentSheet.columns = [
            { header: 'Agent', key: 'agentName', width: 25 },
            { header: 'Assigned', key: 'totalAssigned', width: 12 },
            { header: 'Resolved', key: 'totalResolved', width: 12 },
            { header: 'Resolution Rate %', key: 'resolutionRate', width: 16 },
            { header: 'Avg Response (min)', key: 'avgResponseTimeMinutes', width: 18 },
            { header: 'Avg Resolution (min)', key: 'avgResolutionTimeMinutes', width: 20 },
            { header: 'SLA Compliance %', key: 'slaComplianceRate', width: 16 },
        ];
        performanceReport.data.forEach(agent => agentSheet.addRow(agent));

        // Style headers
        agentSheet.getRow(1).font = { bold: true };
        agentSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' },
        };

        // Daily Volume Sheet
        const dailySheet = workbook.addWorksheet('Daily Volume');
        dailySheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Created', key: 'created', width: 12 },
            { header: 'Resolved', key: 'resolved', width: 12 },
            { header: 'Pending', key: 'pending', width: 12 },
        ];
        volumeReport.data.daily.forEach(day => dailySheet.addRow(day));
        dailySheet.getRow(1).font = { bold: true };

        // By Priority Sheet
        const prioritySheet = workbook.addWorksheet('By Priority');
        prioritySheet.columns = [
            { header: 'Priority', key: 'priority', width: 20 },
            { header: 'Count', key: 'count', width: 15 },
        ];
        for (const [priority, count] of Object.entries(volumeReport.data.byPriority)) {
            prioritySheet.addRow({ priority, count });
        }
        prioritySheet.getRow(1).font = { bold: true };

        // By Category Sheet
        const categorySheet = workbook.addWorksheet('By Category');
        categorySheet.columns = [
            { header: 'Category', key: 'category', width: 25 },
            { header: 'Count', key: 'count', width: 15 },
        ];
        for (const [category, count] of Object.entries(volumeReport.data.byCategory)) {
            categorySheet.addRow({ category, count });
        }
        categorySheet.getRow(1).font = { bold: true };

        // Set Response Headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    }
}
