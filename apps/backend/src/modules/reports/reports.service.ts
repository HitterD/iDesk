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
import { CacheService } from '../../shared/core/cache';
import {
    EXCEL_STYLES,
    EXCEL_COLORS,
    MONTH_NAMES,
    createStyledWorkbook,
    applyHeaderStyle,
    applyRowStyle,
    getStatusColor,
    getPriorityColor,
} from './utils/excel-styles.util';

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
        private readonly cacheService: CacheService,
    ) { }

    /**
     * OPTIMIZED: Get monthly stats using SQL aggregations with caching
     * Cache TTL: 5 minutes for monthly stats
     */
    async getMonthlyStats(month: number, year: number) {
        const cacheKey = `reports:monthly:${year}-${month}`;

        return this.cacheService.getOrSet(cacheKey, async () => {
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
        }, 300); // 5 minutes cache
    }

    async generateExcelReport(res: Response, month: number, year: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const tickets = await this.ticketRepo.find({
            where: {
                createdAt: Between(startDate, endDate),
            },
            relations: ['user', 'assignedTo'],
            order: { createdAt: 'DESC' }
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'iDesk Helpdesk';
        workbook.created = new Date();

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        // Common styles
        const headerStyle: Partial<ExcelJS.Style> = {
            font: { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            },
        };

        const cellStyle: Partial<ExcelJS.Style> = {
            font: { name: 'Calibri', size: 12 },
            alignment: { vertical: 'middle' },
            border: {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            },
        };

        const stats = await this.getMonthlyStats(month, year);
        const resolutionRate = stats.totalTickets > 0
            ? ((stats.resolvedTickets / stats.totalTickets) * 100).toFixed(1)
            : '0';

        // ========== Sheet 1: Summary ==========
        const summarySheet = workbook.addWorksheet('Report Summary');

        // Title
        summarySheet.mergeCells('A1:D1');
        const titleCell = summarySheet.getCell('A1');
        titleCell.value = `iDesk Monthly Report - ${monthNames[month - 1]} ${year}`;
        titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF4F46E5' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        summarySheet.getRow(1).height = 30;

        // Generated date
        summarySheet.mergeCells('A2:D2');
        const dateCell = summarySheet.getCell('A2');
        dateCell.value = `Generated: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        dateCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B7280' } };
        dateCell.alignment = { horizontal: 'center' };

        // Summary section header
        summarySheet.getCell('A4').value = 'Summary Statistics';
        summarySheet.getCell('A4').font = { name: 'Calibri', size: 14, bold: true };
        summarySheet.mergeCells('A4:D4');

        // Summary data
        const summaryData = [
            ['Metric', 'Value', 'Description', ''],
            ['Report Period', `${monthNames[month - 1]} ${year}`, `${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`, ''],
            ['Total Tickets', stats.totalTickets, 'Total tickets created in this period', ''],
            ['Resolved Tickets', stats.resolvedTickets, 'Successfully resolved tickets', ''],
            ['Open Tickets', stats.openTickets, 'Tickets still pending resolution', ''],
            ['Resolution Rate', `${resolutionRate}%`, 'Percentage of tickets resolved', ''],
            ['Avg Resolution Time', `${stats.avgResolutionTimeHours} hours`, 'Average time to resolve a ticket', ''],
        ];

        summaryData.forEach((row, idx) => {
            const rowNum = idx + 5;
            summarySheet.getRow(rowNum).values = row;
            summarySheet.getRow(rowNum).height = 22;

            if (idx === 0) {
                // Header row
                ['A', 'B', 'C'].forEach(col => {
                    const cell = summarySheet.getCell(`${col}${rowNum}`);
                    Object.assign(cell, { style: headerStyle });
                });
            } else {
                // Data rows
                ['A', 'B', 'C'].forEach(col => {
                    const cell = summarySheet.getCell(`${col}${rowNum}`);
                    Object.assign(cell, { style: cellStyle });
                    if (col === 'A') {
                        cell.font = { name: 'Calibri', size: 12, bold: true };
                    }
                });

                // Alternate row coloring
                if (idx % 2 === 0) {
                    ['A', 'B', 'C'].forEach(col => {
                        summarySheet.getCell(`${col}${rowNum}`).fill = {
                            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' }
                        };
                    });
                }
            }
        });

        summarySheet.columns = [
            { width: 25 },
            { width: 20 },
            { width: 40 },
            { width: 5 },
        ];

        // ========== Sheet 2: Ticket Data ==========
        const dataSheet = workbook.addWorksheet('Ticket Details');

        dataSheet.columns = [
            { header: 'Ticket Number', key: 'ticketNumber', width: 18 },
            { header: 'Title', key: 'title', width: 35 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Priority', key: 'priority', width: 12 },
            { header: 'Category', key: 'category', width: 18 },
            { header: 'Created By', key: 'createdBy', width: 22 },
            { header: 'Assigned To', key: 'assignedTo', width: 22 },
            { header: 'Created Date', key: 'createdAt', width: 16 },
        ];

        // Style header row
        const headerRow = dataSheet.getRow(1);
        headerRow.height = 25;
        headerRow.eachCell((cell) => {
            Object.assign(cell, { style: headerStyle });
        });

        // Add data rows
        tickets.forEach((ticket, idx) => {
            const row = dataSheet.addRow({
                ticketNumber: ticket.ticketNumber || ticket.id.substring(0, 8),
                title: ticket.title,
                status: ticket.status,
                priority: ticket.priority,
                category: ticket.category || 'General',
                createdBy: ticket.user?.fullName || 'Unknown',
                assignedTo: ticket.assignedTo?.fullName || 'Unassigned',
                createdAt: ticket.createdAt.toLocaleDateString('id-ID'),
            });

            row.height = 20;
            row.eachCell((cell) => {
                Object.assign(cell, { style: cellStyle });
            });

            // Alternate row coloring
            if (idx % 2 === 0) {
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                });
            }

            // Status coloring
            const statusCell = row.getCell(3);
            switch (ticket.status) {
                case TicketStatus.RESOLVED:
                    statusCell.font = { name: 'Calibri', size: 12, color: { argb: 'FF10B981' } };
                    break;
                case TicketStatus.IN_PROGRESS:
                    statusCell.font = { name: 'Calibri', size: 12, color: { argb: 'FF3B82F6' } };
                    break;
                case TicketStatus.CANCELLED:
                    statusCell.font = { name: 'Calibri', size: 12, color: { argb: 'FF6B7280' } };
                    break;
                default:
                    statusCell.font = { name: 'Calibri', size: 12, color: { argb: 'FFF59E0B' } };
            }

            // Priority coloring
            const priorityCell = row.getCell(4);
            switch (ticket.priority) {
                case 'URGENT':
                    priorityCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFEF4444' } };
                    break;
                case 'HIGH':
                    priorityCell.font = { name: 'Calibri', size: 12, color: { argb: 'FFF59E0B' } };
                    break;
            }
        });

        // Set Response Headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=monthly-report-${month}-${year}.xlsx`);

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
        workbook.creator = 'iDesk Helpdesk';
        workbook.created = new Date();

        // Common styles
        const headerStyle: Partial<ExcelJS.Style> = {
            font: { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            },
        };

        const cellStyle: Partial<ExcelJS.Style> = {
            font: { name: 'Calibri', size: 12 },
            alignment: { vertical: 'middle' },
            border: {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            },
        };

        const applyHeaderStyle = (sheet: ExcelJS.Worksheet) => {
            const row = sheet.getRow(1);
            row.height = 25;
            row.eachCell(cell => Object.assign(cell, { style: headerStyle }));
        };

        const applyRowStyle = (row: ExcelJS.Row, idx: number) => {
            row.height = 20;
            row.eachCell(cell => {
                Object.assign(cell, { style: cellStyle });
                if (idx % 2 === 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                }
            });
        };

        // ========== Summary Sheet ==========
        const summarySheet = workbook.addWorksheet('Report Summary');

        // Title
        summarySheet.mergeCells('A1:C1');
        const titleCell = summarySheet.getCell('A1');
        titleCell.value = `iDesk Custom Report`;
        titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF4F46E5' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        summarySheet.getRow(1).height = 30;

        // Date range
        summarySheet.mergeCells('A2:C2');
        const dateCell = summarySheet.getCell('A2');
        dateCell.value = `Period: ${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`;
        dateCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF6B7280' } };
        dateCell.alignment = { horizontal: 'center' };

        // Summary data
        const summaryData = [
            ['Metric', 'Value', 'Notes'],
            ['Total Tickets Created', volumeReport.data.summary.totalCreated, ''],
            ['Total Tickets Resolved', volumeReport.data.summary.totalResolved, ''],
            ['Total Pending', volumeReport.data.summary.totalPending, ''],
            ['Average Per Day', volumeReport.data.summary.avgPerDay, ''],
            ['Peak Day', volumeReport.data.summary.peakDay, `${volumeReport.data.summary.peakCount} tickets`],
        ];

        summaryData.forEach((row, idx) => {
            const rowNum = idx + 4;
            summarySheet.getRow(rowNum).values = row;
            if (idx === 0) {
                applyHeaderStyle(summarySheet);
                summarySheet.getRow(rowNum).eachCell(cell => Object.assign(cell, { style: headerStyle }));
            } else {
                applyRowStyle(summarySheet.getRow(rowNum), idx);
            }
        });

        summarySheet.columns = [{ width: 28 }, { width: 20 }, { width: 20 }];

        // ========== Agent Performance Sheet ==========
        const agentSheet = workbook.addWorksheet('Agent Performance');
        agentSheet.columns = [
            { header: 'Agent Name', key: 'agentName', width: 25 },
            { header: 'Assigned', key: 'totalAssigned', width: 12 },
            { header: 'Resolved', key: 'totalResolved', width: 12 },
            { header: 'Rate %', key: 'resolutionRate', width: 12 },
            { header: 'Avg Response (min)', key: 'avgResponseTimeMinutes', width: 18 },
            { header: 'Avg Resolution (min)', key: 'avgResolutionTimeMinutes', width: 20 },
            { header: 'SLA %', key: 'slaComplianceRate', width: 12 },
        ];
        applyHeaderStyle(agentSheet);

        performanceReport.data.forEach((agent, idx) => {
            const row = agentSheet.addRow(agent);
            applyRowStyle(row, idx);

            // Resolution Rate conditional formatting (column D)
            const rateCell = row.getCell(4);
            if (agent.resolutionRate >= 80) {
                rateCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF10B981' } };
            } else if (agent.resolutionRate >= 50) {
                rateCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFF59E0B' } };
            } else {
                rateCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFEF4444' } };
            }

            // SLA Compliance conditional formatting (column G)
            const slaCell = row.getCell(7);
            if (agent.slaComplianceRate >= 90) {
                slaCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF10B981' } };
            } else if (agent.slaComplianceRate >= 70) {
                slaCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFF59E0B' } };
            } else {
                slaCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFEF4444' } };
            }
        });

        // ========== Daily Volume Sheet ==========
        const dailySheet = workbook.addWorksheet('Daily Volume');
        dailySheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Created', key: 'created', width: 12 },
            { header: 'Resolved', key: 'resolved', width: 12 },
            { header: 'Pending', key: 'pending', width: 12 },
        ];
        applyHeaderStyle(dailySheet);

        volumeReport.data.daily.forEach((day, idx) => {
            const row = dailySheet.addRow(day);
            applyRowStyle(row, idx);

            // Created column (blue)
            row.getCell(2).font = { name: 'Calibri', size: 12, color: { argb: 'FF3B82F6' } };
            // Resolved column (green)
            row.getCell(3).font = { name: 'Calibri', size: 12, color: { argb: 'FF10B981' } };
            // Pending column (orange)
            row.getCell(4).font = { name: 'Calibri', size: 12, color: { argb: 'FFF59E0B' } };
        });

        // ========== By Priority Sheet ==========
        const prioritySheet = workbook.addWorksheet('By Priority');
        prioritySheet.columns = [
            { header: 'Priority Level', key: 'priority', width: 20 },
            { header: 'Ticket Count', key: 'count', width: 15 },
        ];
        applyHeaderStyle(prioritySheet);

        const priorityColors: Record<string, string> = {
            'CRITICAL': 'FFEF4444',
            'URGENT': 'FFEF4444',
            'HIGH': 'FFF59E0B',
            'MEDIUM': 'FF3B82F6',
            'LOW': 'FF10B981',
        };

        let pIdx = 0;
        for (const [priority, count] of Object.entries(volumeReport.data.byPriority)) {
            const row = prioritySheet.addRow({ priority, count });
            applyRowStyle(row, pIdx++);

            // Color priority name
            const colorCode = priorityColors[priority.toUpperCase()] || 'FF6B7280';
            row.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: colorCode } };
        }

        // ========== By Category Sheet ==========
        const categorySheet = workbook.addWorksheet('By Category');
        categorySheet.columns = [
            { header: 'Category', key: 'category', width: 25 },
            { header: 'Ticket Count', key: 'count', width: 15 },
            { header: 'Percentage', key: 'percentage', width: 12 },
        ];
        applyHeaderStyle(categorySheet);

        const totalCategoryTickets = Object.values(volumeReport.data.byCategory).reduce((a, b) => a + b, 0);
        let cIdx = 0;
        for (const [category, count] of Object.entries(volumeReport.data.byCategory)) {
            const percentage = totalCategoryTickets > 0 ? ((count / totalCategoryTickets) * 100).toFixed(1) : '0';
            const row = categorySheet.addRow({ category, count, percentage: `${percentage}%` });
            applyRowStyle(row, cIdx++);
        }

        // Set Response Headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=custom-report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    }
}
