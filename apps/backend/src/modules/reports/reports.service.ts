import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { AgentPerformanceReport } from './generators/agent-performance.report';
import { TicketVolumeReport } from './generators/ticket-volume.report';
import { PDFGeneratorService } from './generators/pdf-generator.service';
import { CacheService } from '../../shared/core/cache';
import {
    EXCEL_COLORS,
    EXCEL_STYLES,
    MONTH_NAMES,
    createStyledWorkbook,
    drawCorporateExcelHeader,
    drawExecutiveKpiCards,
    drawExecutiveInsightsSection,
    applyHeaderStyle,
    applyRowStyle,
    setupFreezePanes,
    applyAutoFilter,
    autoFitColumns,
    getStatusColor,
    getPriorityColor,
    applyFullBorders,
} from './utils/excel-styles.util';
import { generateExecutiveInsights } from './utils/executive-insights.util';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

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
     *
     * @param month - Month number (1-12)
     * @param year - Year (e.g., 2026)
     * @param siteId - Optional site filter for site-scoped scheduled reports
     */
    async getMonthlyStats(month: number, year: number, siteId?: string) {
        const cacheKey = `reports:monthly:${year}-${month}:${siteId || 'all'}`;

        return this.cacheService.getOrSet(cacheKey, async () => {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);

            // Single optimized query with SQL aggregations
            const qb = this.ticketRepo
                .createQueryBuilder('ticket')
                .select('COUNT(*)', 'totalTickets')
                .addSelect(`SUM(CASE WHEN ticket.status = 'RESOLVED' THEN 1 ELSE 0 END)`, 'resolvedTickets')
                .addSelect(`SUM(CASE WHEN ticket.status != 'RESOLVED' THEN 1 ELSE 0 END)`, 'openTickets')
                .addSelect(`AVG(CASE WHEN ticket.status = 'RESOLVED' THEN EXTRACT(EPOCH FROM (ticket."updatedAt" - ticket."createdAt")) / 3600 ELSE NULL END)`, 'avgResolutionTimeHours')
                .where('ticket."createdAt" BETWEEN :startDate AND :endDate', { startDate, endDate });

            if (siteId) {
                qb.andWhere('ticket.siteId = :siteId', { siteId });
            }

            const stats = await qb.getRawOne();

            const parsedHours = parseFloat(stats?.avgResolutionTimeHours);
            const avgResHours = isNaN(parsedHours) ? 0 : parsedHours;

            return {
                month,
                year,
                totalTickets: parseInt(stats?.totalTickets) || 0,
                resolvedTickets: parseInt(stats?.resolvedTickets) || 0,
                openTickets: parseInt(stats?.openTickets) || 0,
                avgResolutionTimeHours: avgResHours.toFixed(2),
            };
        }, 300); // 5 minutes cache
    }

    /**
     * Generate Monthly Report Excel (Executive Dashboard + Ticket Details)
     */
    async generateExcelReport(res: Response, month: number, year: number, userId?: string, siteId?: string) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        const monthName = MONTH_NAMES[month - 1] || `Bulan ${month}`;

        const qb = this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .where('ticket.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
            .orderBy('ticket.createdAt', 'DESC');

        if (siteId) {
            qb.andWhere('ticket.siteId = :siteId', { siteId });
        }

        const tickets = await qb.getMany();
        const stats = await this.getMonthlyStats(month, year, siteId);
        const total = stats.totalTickets;
        const resolved = stats.resolvedTickets;
        const open = stats.openTickets;
        const resRate = total > 0 ? (resolved / total) * 100 : 0;
        const avgHours = parseFloat(String(stats.avgResolutionTimeHours)) || 0;

        // Breakdown stats
        const byPriority: Record<string, number> = {};
        const byCategory: Record<string, number> = {};
        const byStatus: Record<string, number> = {};

        tickets.forEach(t => {
            const p = t.priority || 'MEDIUM';
            const c = t.category || 'General';
            const s = t.status || 'OPEN';
            byPriority[p] = (byPriority[p] || 0) + 1;
            byCategory[c] = (byCategory[c] || 0) + 1;
            byStatus[s] = (byStatus[s] || 0) + 1;
        });

        const workbook = createStyledWorkbook();

        // ══════════════════════════════════════════════════════════
        // SHEET 1: EXECUTIVE DASHBOARD
        // ══════════════════════════════════════════════════════════
        const summarySheet = workbook.addWorksheet('Executive Dashboard');

        // 1. Corporate Header Banner
        let curRow = drawCorporateExcelHeader(
            summarySheet,
            `LAPORAN EKSEKUTIF BULANAN (MONTHLY REPORT) — ${monthName.toUpperCase()} ${year}`,
            `${monthName} ${year}`,
            siteId ? `Site Filtered (${siteId})` : 'PT Santos Jaya Abadi — All Sites',
            'F'
        );

        // 2. Executive KPI Cards
        curRow = drawExecutiveKpiCards(
            summarySheet,
            curRow,
            [
                { label: 'Total Tiket Masuk', value: total.toLocaleString('id-ID'), subtext: `${monthName} ${year}` },
                { label: 'Tiket Terselesaikan', value: resolved.toLocaleString('id-ID'), subtext: `${resRate.toFixed(1)}% Resolution Rate` },
                { label: 'Tiket Terbuka / Aktif', value: open.toLocaleString('id-ID'), subtext: 'Dalam Antrean / Proses' },
            ],
            [['A', 'B'], ['C', 'D'], ['E', 'F']]
        );

        // 3. Smart Executive Insights
        const insights = generateExecutiveInsights({
            periodLabel: `${monthName} ${year}`,
            totalTickets: total,
            resolvedTickets: resolved,
            openTickets: open,
            resolutionRate: resRate,
            avgResolutionTimeHours: avgHours,
            byPriority,
            byCategory,
            byStatus,
        });

        curRow = drawExecutiveInsightsSection(summarySheet, curRow, insights, 'F');

        // 4. Summary Matrix Table
        summarySheet.mergeCells(`A${curRow}:F${curRow}`);
        const matrixHeader = summarySheet.getCell(`A${curRow}`);
        matrixHeader.value = 'RINGKASAN METRIK OPERASIONAL';
        Object.assign(matrixHeader, { style: EXCEL_STYLES.sectionHeader });
        summarySheet.getRow(curRow).height = 22;
        curRow++;

        const summaryRows: Array<[string, string | number, string]> = [
            ['Periode Laporan', `${monthName} ${year}`, `${startDate.toLocaleDateString('id-ID')} s/d ${endDate.toLocaleDateString('id-ID')}`],
            ['Total Tiket Terdaftar', total, 'Jumlah seluruh tiket yang masuk pada periode ini'],
            ['Tiket Berhasil Diselesaikan', resolved, 'Tiket berstatus RESOLVED / CLOSED'],
            ['Tiket Masih Aktif / Terbuka', open, 'Tiket berstatus OPEN, IN_PROGRESS, atau WAITING_VENDOR'],
            ['Tingkat Penyelesaian (Resolution Rate)', `${resRate.toFixed(1)}%`, 'Persentase tiket terselesaikan dibanding total tiket'],
            ['Rata-rata Durasi Resolusi', `${avgHours.toFixed(2)} jam`, 'Rata-rata waktu dari tiket dibuat hingga selesai'],
        ];

        summarySheet.getRow(curRow).values = ['Parameter Metrik', 'Nilai Realisasi', 'Keterangan'];
        summarySheet.getRow(curRow).height = 22;
        ['A', 'B', 'C'].forEach(c => Object.assign(summarySheet.getCell(`${c}${curRow}`), { style: EXCEL_STYLES.header }));
        summarySheet.mergeCells(`C${curRow}:F${curRow}`);
        curRow++;

        summaryRows.forEach((r, idx) => {
            const rNum = curRow;
            summarySheet.getCell(`A${rNum}`).value = r[0];
            summarySheet.getCell(`B${rNum}`).value = r[1];
            summarySheet.getCell(`C${rNum}`).value = r[2];

            Object.assign(summarySheet.getCell(`A${rNum}`), { style: EXCEL_STYLES.metricLabel });
            Object.assign(summarySheet.getCell(`B${rNum}`), { style: EXCEL_STYLES.cellCenter });
            Object.assign(summarySheet.getCell(`C${rNum}`), { style: EXCEL_STYLES.cell });

            summarySheet.mergeCells(`C${rNum}:F${rNum}`);
            summarySheet.getRow(rNum).height = 20;

            if (idx % 2 === 0) {
                summarySheet.getCell(`A${rNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
                summarySheet.getCell(`B${rNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
                summarySheet.getCell(`C${rNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
            }
            curRow++;
        });

        summarySheet.columns = [
            { width: 28 },
            { width: 18 },
            { width: 22 },
            { width: 22 },
            { width: 22 },
            { width: 22 },
        ];

        // ══════════════════════════════════════════════════════════
        // SHEET 2: TICKET DETAILS (Full Data with Freeze & Auto-filter)
        // ══════════════════════════════════════════════════════════
        const dataSheet = workbook.addWorksheet('Detail Tiket');

        dataSheet.columns = [
            { header: 'No. Tiket', key: 'ticketNumber', width: 16 },
            { header: 'Judul Masalah / Permintaan', key: 'title', width: 34 },
            { header: 'Status', key: 'status', width: 16 },
            { header: 'Prioritas', key: 'priority', width: 14 },
            { header: 'Kategori', key: 'category', width: 20 },
            { header: 'Pemohon (Created By)', key: 'createdBy', width: 22 },
            { header: 'Teknisi (Assigned To)', key: 'assignedTo', width: 22 },
            { header: 'Tanggal Dibuat', key: 'createdAt', width: 16 },
            { header: 'Update Terakhir', key: 'updatedAt', width: 16 },
        ];

        applyHeaderStyle(dataSheet, 1);
        setupFreezePanes(dataSheet, 1);

        tickets.forEach((ticket, idx) => {
            const row = dataSheet.addRow({
                ticketNumber: ticket.ticketNumber || ticket.id.substring(0, 8),
                title: ticket.title,
                status: ticket.status,
                priority: ticket.priority,
                category: ticket.category || 'General',
                createdBy: ticket.user?.fullName || 'Unknown',
                assignedTo: ticket.assignedTo?.fullName || 'Unassigned',
                createdAt: ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('id-ID') : '—',
                updatedAt: ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleDateString('id-ID') : '—',
            });

            applyRowStyle(row, idx);

            // Status styling
            const statusCell = row.getCell(3);
            statusCell.font = { ...EXCEL_STYLES.cell.font!, bold: true, color: getStatusColor(ticket.status) };

            // Priority styling
            const priorityCell = row.getCell(4);
            priorityCell.font = { ...EXCEL_STYLES.cell.font!, bold: true, color: getPriorityColor(ticket.priority) };
        });

        if (tickets.length > 0) {
            applyAutoFilter(dataSheet, 'A', 1, 'I', tickets.length + 1);
            applyFullBorders(dataSheet, 1, tickets.length + 1, 9);
        }
        autoFitColumns(dataSheet, 14, 45);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=monthly-report-${month}-${year}.xlsx`);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.REPORT_EXPORT,
                entityType: 'Report',
                entityId: `Monthly-Excel-${month}-${year}`,
                description: `Exported Monthly Report Excel ${month}-${year}`,
            });
        }

        await workbook.xlsx.write(res);
        res.end();
    }

    async getAgentPerformance(startDate: Date, endDate: Date, siteId?: string, agentCategory?: 'REGULAR' | 'ORACLE' | 'DEV' | 'ALL') {
        return this.agentPerformanceReport.generate(
            { startDate, endDate },
            { siteId, agentCategory }
        );
    }

    /**
     * Get ticket volume report for a date range
     */
    async getTicketVolume(startDate: Date, endDate: Date, siteId?: string) {
        return this.ticketVolumeReport.generate({ startDate, endDate }, { siteId });
    }

    /**
     * Generate Agent Performance PDF
     */
    async generateAgentPerformancePDF(res: Response, startDate: Date, endDate: Date, userId?: string, siteId?: string, agentCategory?: 'REGULAR' | 'ORACLE' | 'DEV' | 'ALL') {
        const report = await this.agentPerformanceReport.generate({ startDate, endDate }, { siteId, agentCategory });
        const categoryLabel = agentCategory === 'ORACLE' ? 'Divisi Oracle Support' : agentCategory === 'DEV' ? 'Divisi Web & Mobile Dev' : agentCategory === 'REGULAR' ? 'Divisi Operational Support' : 'Semua Divisi Teknisi';

        await this.pdfGenerator.generateAgentPerformancePDF(res, report.data, {
            title: 'Laporan Kinerja Teknisi (Agent Performance)',
            dateRange: { startDate, endDate },
            siteName: `${siteId || 'Semua Site'} — ${categoryLabel}`,
        });

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.REPORT_GENERATE,
                entityType: 'Report',
                entityId: 'AgentPerformance-PDF',
                description: `Generated Agent Performance PDF Report (${categoryLabel})`,
            });
        }
    }

    /**
     * Generate PDF for Ticket Volume
     */
    async generateTicketVolumePDF(res: Response, startDate: Date, endDate: Date, userId?: string, siteId?: string) {
        const report = await this.ticketVolumeReport.generate({ startDate, endDate }, { siteId });
        await this.pdfGenerator.generateTicketVolumePDF(res, report.data, {
            title: 'Laporan Volume & Distribusi Tiket',
            dateRange: { startDate, endDate },
            siteName: siteId || 'Semua Site',
        });

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.REPORT_GENERATE,
                entityType: 'Report',
                entityId: 'TicketVolume-PDF',
                description: `Generated Ticket Volume PDF Report`,
            });
        }
    }

    /**
     * Generate Monthly Summary PDF
     */
    async generateMonthlySummaryPDF(res: Response, month: number, year: number, userId?: string, siteId?: string) {
        const stats = await this.getMonthlyStats(month, year, siteId);
        const monthName = MONTH_NAMES[month - 1] || `Bulan ${month}`;

        await this.pdfGenerator.generateMonthlySummaryPDF(res, stats, {
            title: 'Laporan Ringkasan Bulanan (Monthly Summary)',
            subtitle: `${monthName} ${year}`,
            siteName: siteId || 'Seluruh Site PT Santos Jaya Abadi',
        });

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.REPORT_GENERATE,
                entityType: 'Report',
                entityId: `Monthly-PDF-${month}-${year}`,
                description: `Generated Monthly Summary PDF Report ${month}-${year}`,
            });
        }
    }

    /**
     * Generate Custom Date Range Comprehensive Excel Report
     * Executive Dashboard + Multi-Sheet Breakdown
     */
    async generateCustomRangeExcel(res: Response, startDate: Date, endDate: Date, userId?: string) {
        const [performanceReport, volumeReport] = await Promise.all([
            this.agentPerformanceReport.generate({ startDate, endDate }),
            this.ticketVolumeReport.generate({ startDate, endDate }),
        ]);

        const workbook = createStyledWorkbook();
        const startStr = startDate.toLocaleDateString('id-ID');
        const endStr = endDate.toLocaleDateString('id-ID');
        const periodText = `${startStr} — ${endStr}`;

        const totalCreated = volumeReport.data.summary.totalCreated || 0;
        const totalResolved = volumeReport.data.summary.totalResolved || 0;
        const totalPending = volumeReport.data.summary.totalPending || 0;
        const avgPerDay = volumeReport.data.summary.avgPerDay || 0;
        const resRate = totalCreated > 0 ? (totalResolved / totalCreated) * 100 : 0;
        const totalAgents = performanceReport.data.length;
        const avgSLA = totalAgents > 0
            ? performanceReport.data.reduce((sum, a) => sum + (Number(a.slaComplianceRate) || 0), 0) / totalAgents
            : 0;

        const bestAgent = totalAgents > 0
            ? performanceReport.data.reduce((b, a) => (a.resolutionRate || 0) > (b.resolutionRate || 0) ? a : b, performanceReport.data[0])
            : undefined;

        // ══════════════════════════════════════════════════════════
        // SHEET 1: EXECUTIVE DASHBOARD
        // ══════════════════════════════════════════════════════════
        const dashSheet = workbook.addWorksheet('Executive Dashboard');

        let curRow = drawCorporateExcelHeader(
            dashSheet,
            'LAPORAN KOMPREHENSIF LAYANAN IT (COMPREHENSIVE REPORT)',
            periodText,
            'PT Santos Jaya Abadi — All Sites',
            'F'
        );

        curRow = drawExecutiveKpiCards(
            dashSheet,
            curRow,
            [
                { label: 'Total Tiket Masuk', value: totalCreated.toLocaleString('id-ID'), subtext: `Rata-rata: ${avgPerDay.toFixed(1)}/hari` },
                { label: 'Tiket Terselesaikan', value: totalResolved.toLocaleString('id-ID'), subtext: `${resRate.toFixed(1)}% Tingkat Resolusi` },
                { label: 'Kepatuhan SLA Rata-rata', value: `${avgSLA.toFixed(1)}%`, subtext: `${totalAgents} Teknisi Aktif` },
            ],
            [['A', 'B'], ['C', 'D'], ['E', 'F']]
        );

        const insights = generateExecutiveInsights({
            periodLabel: periodText,
            totalTickets: totalCreated,
            resolvedTickets: totalResolved,
            openTickets: totalPending,
            resolutionRate: resRate,
            slaComplianceRate: avgSLA,
            byPriority: volumeReport.data.byPriority,
            byCategory: volumeReport.data.byCategory,
            topPerformer: bestAgent ? { name: bestAgent.agentName, resolutionRate: bestAgent.resolutionRate, count: bestAgent.totalResolved } : undefined,
            agentCount: totalAgents,
        });

        curRow = drawExecutiveInsightsSection(dashSheet, curRow, insights, 'F');

        // Metric Summary Table
        dashSheet.mergeCells(`A${curRow}:F${curRow}`);
        const mHead = dashSheet.getCell(`A${curRow}`);
        mHead.value = 'IKHTISAR PARAMETER OPERASIONAL';
        Object.assign(mHead, { style: EXCEL_STYLES.sectionHeader });
        dashSheet.getRow(curRow).height = 22;
        curRow++;

        const dashRows: Array<[string, string | number, string]> = [
            ['Rentang Periode Laporan', periodText, 'Periode tanggal yang dievaluasi'],
            ['Total Tiket Masuk (Created)', totalCreated, 'Jumlah total tiket yang terbuat pada periode'],
            ['Total Tiket Selesai (Resolved)', totalResolved, 'Jumlah tiket yang berhasil diselesaikan'],
            ['Tiket Masih Pending / Berjalan', totalPending, 'Tiket aktif yang belum terselesaikan'],
            ['Rata-rata Tiket Per Hari', `${avgPerDay.toFixed(1)} tiket/hari`, 'Rata-rata volume harian'],
            ['Hari Puncak (Peak Volume)', `${volumeReport.data.summary.peakCount || 0} tiket (${volumeReport.data.summary.peakDay || '—'})`, 'Volume harian tertinggi tercatat'],
            ['Total Teknisi yang Dievaluasi', `${totalAgents} teknisi`, 'Jumlah teknisi dengan penugasan'],
            ['Rata-rata Kepatuhan SLA Tim', `${avgSLA.toFixed(1)}%`, 'Tingkat kepatuhan SLA rata-rata seluruh teknisi'],
        ];

        dashSheet.getRow(curRow).values = ['Parameter Metrik', 'Nilai Realisasi', 'Keterangan'];
        dashSheet.getRow(curRow).height = 22;
        ['A', 'B', 'C'].forEach(c => Object.assign(dashSheet.getCell(`${c}${curRow}`), { style: EXCEL_STYLES.header }));
        dashSheet.mergeCells(`C${curRow}:F${curRow}`);
        curRow++;

        dashRows.forEach((r, idx) => {
            const rNum = curRow;
            dashSheet.getCell(`A${rNum}`).value = r[0];
            dashSheet.getCell(`B${rNum}`).value = r[1];
            dashSheet.getCell(`C${rNum}`).value = r[2];

            Object.assign(dashSheet.getCell(`A${rNum}`), { style: EXCEL_STYLES.metricLabel });
            Object.assign(dashSheet.getCell(`B${rNum}`), { style: EXCEL_STYLES.cellCenter });
            Object.assign(dashSheet.getCell(`C${rNum}`), { style: EXCEL_STYLES.cell });

            dashSheet.mergeCells(`C${rNum}:F${rNum}`);
            dashSheet.getRow(rNum).height = 20;

            if (idx % 2 === 0) {
                dashSheet.getCell(`A${rNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
                dashSheet.getCell(`B${rNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
                dashSheet.getCell(`C${rNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
            }
            curRow++;
        });

        dashSheet.columns = [
            { width: 30 },
            { width: 22 },
            { width: 22 },
            { width: 22 },
            { width: 22 },
            { width: 22 },
        ];

        // ══════════════════════════════════════════════════════════
        // SHEET 2: AGENT PERFORMANCE
        // ══════════════════════════════════════════════════════════
        const agentSheet = workbook.addWorksheet('Kinerja Teknisi');
        agentSheet.columns = [
            { header: 'Nama Teknisi', key: 'agentName', width: 26 },
            { header: 'Ditugaskan', key: 'totalAssigned', width: 14 },
            { header: 'Diselesaikan', key: 'totalResolved', width: 14 },
            { header: 'Tingkat Resolusi (%)', key: 'resolutionRate', width: 20 },
            { header: 'Avg Respon (Menit)', key: 'avgResponseTimeMinutes', width: 20 },
            { header: 'Avg Resolusi (Menit)', key: 'avgResolutionTimeMinutes', width: 20 },
            { header: 'Kepatuhan SLA (%)', key: 'slaComplianceRate', width: 18 },
        ];

        applyHeaderStyle(agentSheet, 1);
        setupFreezePanes(agentSheet, 1);

        performanceReport.data.forEach((agent, idx) => {
            const row = agentSheet.addRow({
                agentName: agent.agentName,
                totalAssigned: agent.totalAssigned || 0,
                totalResolved: agent.totalResolved || 0,
                resolutionRate: `${(agent.resolutionRate || 0).toFixed(1)}%`,
                avgResponseTimeMinutes: `${agent.avgResponseTimeMinutes || 0} m`,
                avgResolutionTimeMinutes: `${agent.avgResolutionTimeMinutes || 0} m`,
                slaComplianceRate: `${(agent.slaComplianceRate || 0).toFixed(1)}%`,
            });

            applyRowStyle(row, idx);

            const slaCell = row.getCell(7);
            const slaVal = Number(agent.slaComplianceRate) || 0;
            if (slaVal >= 90) {
                slaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.positive } };
            } else if (slaVal >= 70) {
                slaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.caution } };
            } else {
                slaCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXCEL_COLORS.critical } };
            }
        });

        if (performanceReport.data.length > 0) {
            applyAutoFilter(agentSheet, 'A', 1, 'G', performanceReport.data.length + 1);
            applyFullBorders(agentSheet, 1, performanceReport.data.length + 1, 7);
        }
        autoFitColumns(agentSheet, 14, 35);

        // ══════════════════════════════════════════════════════════
        // SHEET 3: DAILY VOLUME
        // ══════════════════════════════════════════════════════════
        const dailySheet = workbook.addWorksheet('Volume Harian');
        dailySheet.columns = [
            { header: 'Tanggal', key: 'date', width: 16 },
            { header: 'Tiket Masuk', key: 'created', width: 15 },
            { header: 'Tiket Selesai', key: 'resolved', width: 15 },
            { header: 'Tiket Pending', key: 'pending', width: 15 },
        ];
        applyHeaderStyle(dailySheet, 1);
        setupFreezePanes(dailySheet, 1);

        volumeReport.data.daily.forEach((day, idx) => {
            const row = dailySheet.addRow(day);
            applyRowStyle(row, idx);

            row.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: EXCEL_COLORS.neutral } };
            row.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: EXCEL_COLORS.positive } };
            row.getCell(4).font = { name: 'Calibri', size: 10, color: { argb: EXCEL_COLORS.caution } };
        });

        if (volumeReport.data.daily.length > 0) {
            applyAutoFilter(dailySheet, 'A', 1, 'D', volumeReport.data.daily.length + 1);
            applyFullBorders(dailySheet, 1, volumeReport.data.daily.length + 1, 4);
        }
        autoFitColumns(dailySheet, 14, 25);

        // ══════════════════════════════════════════════════════════
        // SHEET 4: BY PRIORITY
        // ══════════════════════════════════════════════════════════
        const prioritySheet = workbook.addWorksheet('Distribusi Prioritas');
        prioritySheet.columns = [
            { header: 'Tingkat Prioritas', key: 'priority', width: 22 },
            { header: 'Jumlah Tiket', key: 'count', width: 16 },
            { header: 'Persentase (%)', key: 'percentage', width: 16 },
        ];
        applyHeaderStyle(prioritySheet, 1);
        setupFreezePanes(prioritySheet, 1);

        const totalPriTickets = Object.values(volumeReport.data.byPriority).reduce((a, b) => a + b, 0);
        let pIdx = 0;
        for (const [priority, count] of Object.entries(volumeReport.data.byPriority)) {
            const percentage = totalPriTickets > 0 ? ((count / totalPriTickets) * 100).toFixed(1) : '0';
            const row = prioritySheet.addRow({ priority, count, percentage: `${percentage}%` });
            applyRowStyle(row, pIdx++);
            row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: getPriorityColor(priority) };
        }

        const priKeysCount = Object.keys(volumeReport.data.byPriority).length;
        if (priKeysCount > 0) {
            applyAutoFilter(prioritySheet, 'A', 1, 'C', priKeysCount + 1);
            applyFullBorders(prioritySheet, 1, priKeysCount + 1, 3);
        }
        autoFitColumns(prioritySheet, 16, 28);

        // ══════════════════════════════════════════════════════════
        // SHEET 5: BY CATEGORY
        // ══════════════════════════════════════════════════════════
        const categorySheet = workbook.addWorksheet('Distribusi Kategori');
        categorySheet.columns = [
            { header: 'Nama Kategori', key: 'category', width: 26 },
            { header: 'Jumlah Tiket', key: 'count', width: 16 },
            { header: 'Persentase (%)', key: 'percentage', width: 16 },
        ];
        applyHeaderStyle(categorySheet, 1);
        setupFreezePanes(categorySheet, 1);

        const totalCategoryTickets = Object.values(volumeReport.data.byCategory).reduce((a, b) => a + b, 0);
        let cIdx = 0;
        for (const [category, count] of Object.entries(volumeReport.data.byCategory)) {
            const percentage = totalCategoryTickets > 0 ? ((count / totalCategoryTickets) * 100).toFixed(1) : '0';
            const row = categorySheet.addRow({ category, count, percentage: `${percentage}%` });
            applyRowStyle(row, cIdx++);
        }

        const catKeysCount = Object.keys(volumeReport.data.byCategory).length;
        if (catKeysCount > 0) {
            applyAutoFilter(categorySheet, 'A', 1, 'C', catKeysCount + 1);
            applyFullBorders(categorySheet, 1, catKeysCount + 1, 3);
        }
        autoFitColumns(categorySheet, 16, 32);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=custom-report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.xlsx`);

        if (userId) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.REPORT_EXPORT,
                entityType: 'Report',
                entityId: `CustomRange-Excel`,
                description: `Exported Custom Range Comprehensive Excel Report`,
            });
        }

        await workbook.xlsx.write(res);
        res.end();
    }
}
