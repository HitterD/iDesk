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
    applyFullBorders,
} from './utils/excel-styles.util';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class ReportsService {
    constructor(
        private readonly auditService: AuditService,
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

    async generateExcelReport(res: Response, month: number, year: number, userId?: string) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const tickets = await this.ticketRepo.find({
            where: {
                createdAt: Between(startDate, endDate),
            },
            relations: ['user', 'assignedTo'],
            order: { createdAt: 'DESC' }
        });

        const workbook = createStyledWorkbook();
        const stats = await this.getMonthlyStats(month, year);
        const resolutionRate = stats.totalTickets > 0
            ? ((stats.resolvedTickets / stats.totalTickets) * 100).toFixed(1)
            : '0';

        // ========== Sheet 1: Summary ==========
        const summarySheet = workbook.addWorksheet('Report Summary');

        // Title row — left aligned, no color
        summarySheet.mergeCells('A1:C1');
        const titleCell = summarySheet.getCell('A1');
        titleCell.value = `iDesk Monthly Report — ${MONTH_NAMES[month - 1]} ${year}`;
        Object.assign(titleCell, { style: EXCEL_STYLES.title });
        summarySheet.getRow(1).height = 28;

        // Generated date
        summarySheet.mergeCells('A2:C2');
        const dateCell = summarySheet.getCell('A2');
        dateCell.value = `Generated: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        Object.assign(dateCell, { style: EXCEL_STYLES.subtitle });

        // Section header
        summarySheet.getCell('A4').value = 'Summary Statistics';
        summarySheet.mergeCells('A4:C4');
        Object.assign(summarySheet.getCell('A4'), { style: EXCEL_STYLES.sectionHeader });
        summarySheet.getRow(4).height = 22;

        // Summary data
        const summaryData = [
            ['Metric', 'Value', 'Description'],
            ['Report Period', `${MONTH_NAMES[month - 1]} ${year}`, `${startDate.toLocaleDateString('id-ID')} — ${endDate.toLocaleDateString('id-ID')}`],
            ['Total Tickets', stats.totalTickets, 'Total tickets created in this period'],
            ['Resolved Tickets', stats.resolvedTickets, 'Successfully resolved tickets'],
            ['Open Tickets', stats.openTickets, 'Tickets still pending resolution'],
            ['Resolution Rate', `${resolutionRate}%`, 'Percentage of tickets resolved'],
            ['Avg Resolution Time', `${stats.avgResolutionTimeHours} hours`, 'Average time to resolve a ticket'],
        ];

        summaryData.forEach((row, idx) => {
            const rowNum = idx + 5;
            summarySheet.getRow(rowNum).values = row;
            summarySheet.getRow(rowNum).height = 20;

            if (idx === 0) {
                ['A', 'B', 'C'].forEach(col => {
                    Object.assign(summarySheet.getCell(`${col}${rowNum}`), { style: EXCEL_STYLES.header });
                });
            } else {
                ['A', 'B', 'C'].forEach(col => {
                    const cell = summarySheet.getCell(`${col}${rowNum}`);
                    Object.assign(cell, { style: col === 'A' ? EXCEL_STYLES.metricLabel : EXCEL_STYLES.cell });
                });
                if (idx % 2 === 0) {
                    ['A', 'B', 'C'].forEach(col => {
                        summarySheet.getCell(`${col}${rowNum}`).fill = {
                            type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow }
                        };
                    });
                }
            }
        });

        summarySheet.columns = [
            { width: 24 },
            { width: 20 },
            { width: 38 },
        ];
        applyFullBorders(summarySheet, 5, summaryData.length + 4, 3);

        // ========== Sheet 2: Ticket Data ==========
        const dataSheet = workbook.addWorksheet('Ticket Details');

        dataSheet.columns = [
            { header: 'Ticket Number', key: 'ticketNumber', width: 16 },
            { header: 'Title', key: 'title', width: 32 },
            { header: 'Status', key: 'status', width: 14 },
            { header: 'Priority', key: 'priority', width: 11 },
            { header: 'Category', key: 'category', width: 16 },
            { header: 'Created By', key: 'createdBy', width: 20 },
            { header: 'Assigned To', key: 'assignedTo', width: 20 },
            { header: 'Created Date', key: 'createdAt', width: 14 },
        ];
        applyHeaderStyle(dataSheet);

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

            applyRowStyle(row, idx);

            // Status coloring — uses desaturated semantic colors
            const statusCell = row.getCell(3);
            statusCell.font = { ...EXCEL_STYLES.cell.font!, bold: true, color: getStatusColor(ticket.status) };

            // Priority coloring
            const priorityCell = row.getCell(4);
            priorityCell.font = { ...EXCEL_STYLES.cell.font!, bold: true, color: getPriorityColor(ticket.priority) };
        });

        applyFullBorders(dataSheet, 1, tickets.length + 1, 8);

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
    async generateAgentPerformancePDF(res: Response, startDate: Date, endDate: Date, userId?: string) {
        const report = await this.agentPerformanceReport.generate({ startDate, endDate });
        await this.pdfGenerator.generateAgentPerformancePDF(res, report.data, {
            title: 'Agent Performance Report',
            dateRange: { startDate, endDate },
        });

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.REPORT_GENERATE,
                entityType: 'Report',
                entityId: 'AgentPerformance-PDF',
                description: `Generated Agent Performance PDF Report`,
            });
        }
    }

    /**
     * Generate PDF for Ticket Volume
     */
    async generateTicketVolumePDF(res: Response, startDate: Date, endDate: Date, userId?: string) {
        const report = await this.ticketVolumeReport.generate({ startDate, endDate });
        await this.pdfGenerator.generateTicketVolumePDF(res, report.data, {
            title: 'Ticket Volume Report',
            dateRange: { startDate, endDate },
        });
    }

    /**
     * Generate Monthly Summary PDF
     */
    async generateMonthlySummaryPDF(res: Response, month: number, year: number, userId?: string) {
        const stats = await this.getMonthlyStats(month, year);
        await this.pdfGenerator.generateMonthlySummaryPDF(res, stats, {
            title: `Monthly Summary Report`,
        });
    }

    /**
     * Generate comprehensive Excel report with custom date range
     */
    async generateCustomRangeExcel(res: Response, startDate: Date, endDate: Date, userId?: string) {
        const [volumeReport, performanceReport] = await Promise.all([
            this.ticketVolumeReport.generate({ startDate, endDate }),
            this.agentPerformanceReport.generate({ startDate, endDate }),
        ]);

        const workbook = createStyledWorkbook();

        // ========== Summary Sheet ==========
        const summarySheet = workbook.addWorksheet('Report Summary');

        // Title — left-aligned, no brand color
        summarySheet.mergeCells('A1:C1');
        const titleCell = summarySheet.getCell('A1');
        titleCell.value = `iDesk Custom Report`;
        Object.assign(titleCell, { style: EXCEL_STYLES.title });
        summarySheet.getRow(1).height = 28;

        // Date range
        summarySheet.mergeCells('A2:C2');
        const dateCell = summarySheet.getCell('A2');
        dateCell.value = `Period: ${startDate.toLocaleDateString('id-ID')} — ${endDate.toLocaleDateString('id-ID')}`;
        Object.assign(dateCell, { style: EXCEL_STYLES.subtitle });

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
                summarySheet.getRow(rowNum).height = 24;
                summarySheet.getRow(rowNum).eachCell(cell => Object.assign(cell, { style: EXCEL_STYLES.header }));
            } else {
                applyRowStyle(summarySheet.getRow(rowNum), idx);
                // Bold metric name
                summarySheet.getCell(`A${rowNum}`).font = EXCEL_STYLES.metricLabel.font!;
            }
        });

        summarySheet.columns = [{ width: 26 }, { width: 18 }, { width: 20 }];
        applyFullBorders(summarySheet, 4, summaryData.length + 3, 3);

        // ========== Agent Performance Sheet ==========
        const agentSheet = workbook.addWorksheet('Agent Performance');
        agentSheet.columns = [
            { header: 'Agent Name', key: 'agentName', width: 24 },
            { header: 'Assigned', key: 'totalAssigned', width: 11 },
            { header: 'Resolved', key: 'totalResolved', width: 11 },
            { header: 'Rate %', key: 'resolutionRate', width: 10 },
            { header: 'Avg Response (min)', key: 'avgResponseTimeMinutes', width: 17 },
            { header: 'Avg Resolution (min)', key: 'avgResolutionTimeMinutes', width: 19 },
            { header: 'SLA %', key: 'slaComplianceRate', width: 10 },
        ];
        applyHeaderStyle(agentSheet);

        performanceReport.data.forEach((agent, idx) => {
            const row = agentSheet.addRow(agent);
            applyRowStyle(row, idx);

            // Resolution Rate — desaturated conditional formatting
            const rateCell = row.getCell(4);
            if (agent.resolutionRate >= 80) {
                rateCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.positive } };
            } else if (agent.resolutionRate >= 50) {
                rateCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.caution } };
            } else {
                rateCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.critical } };
            }

            // SLA Compliance
            const slaCell = row.getCell(7);
            if (agent.slaComplianceRate >= 90) {
                slaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.positive } };
            } else if (agent.slaComplianceRate >= 70) {
                slaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.caution } };
            } else {
                slaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.critical } };
            }
        });

        applyFullBorders(agentSheet, 1, performanceReport.data.length + 1, 7);

        // ========== Daily Volume Sheet ==========
        const dailySheet = workbook.addWorksheet('Daily Volume');
        dailySheet.columns = [
            { header: 'Date', key: 'date', width: 14 },
            { header: 'Created', key: 'created', width: 11 },
            { header: 'Resolved', key: 'resolved', width: 11 },
            { header: 'Pending', key: 'pending', width: 11 },
        ];
        applyHeaderStyle(dailySheet);

        volumeReport.data.daily.forEach((day, idx) => {
            const row = dailySheet.addRow(day);
            applyRowStyle(row, idx);

            row.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: EXCEL_COLORS.neutral } };
            row.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: EXCEL_COLORS.positive } };
            row.getCell(4).font = { name: 'Calibri', size: 10, color: { argb: EXCEL_COLORS.caution } };
        });

        applyFullBorders(dailySheet, 1, volumeReport.data.daily.length + 1, 4);

        // ========== By Priority Sheet ==========
        const prioritySheet = workbook.addWorksheet('By Priority');
        prioritySheet.columns = [
            { header: 'Priority Level', key: 'priority', width: 18 },
            { header: 'Ticket Count', key: 'count', width: 14 },
        ];
        applyHeaderStyle(prioritySheet);

        let pIdx = 0;
        for (const [priority, count] of Object.entries(volumeReport.data.byPriority)) {
            const row = prioritySheet.addRow({ priority, count });
            applyRowStyle(row, pIdx++);
            row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: getPriorityColor(priority) };
        }

        applyFullBorders(prioritySheet, 1, Object.keys(volumeReport.data.byPriority).length + 1, 2);

        // ========== By Category Sheet ==========
        const categorySheet = workbook.addWorksheet('By Category');
        categorySheet.columns = [
            { header: 'Category', key: 'category', width: 24 },
            { header: 'Ticket Count', key: 'count', width: 14 },
            { header: 'Percentage', key: 'percentage', width: 11 },
        ];
        applyHeaderStyle(categorySheet);

        const totalCategoryTickets = Object.values(volumeReport.data.byCategory).reduce((a, b) => a + b, 0);
        let cIdx = 0;
        for (const [category, count] of Object.entries(volumeReport.data.byCategory)) {
            const percentage = totalCategoryTickets > 0 ? ((count / totalCategoryTickets) * 100).toFixed(1) : '0';
            const row = categorySheet.addRow({ category, count, percentage: `${percentage}%` });
            applyRowStyle(row, cIdx++);
        }

        applyFullBorders(categorySheet, 1, Object.keys(volumeReport.data.byCategory).length + 1, 3);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=custom-report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.xlsx`);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.REPORT_EXPORT,
                entityType: 'Report',
                entityId: `CustomRange-Excel`,
                description: `Exported Custom Range Excel Report`,
            });
        }

        await workbook.xlsx.write(res);
        res.end();
    }
}
