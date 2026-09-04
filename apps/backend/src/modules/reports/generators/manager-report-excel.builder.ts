// apps/backend/src/modules/reports/generators/manager-report-excel.builder.ts
import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import {
    createStyledWorkbook,
    drawCorporateExcelHeader,
    drawExecutiveKpiCards,
    drawExecutiveInsightsSection,
    EXCEL_COLORS,
    EXCEL_STYLES,
    applyHeaderStyle,
    applyRowStyle,
    setupFreezePanes,
    applyAutoFilter,
    autoFitColumns,
    getStatusColor,
    applyFullBorders,
} from '../utils/excel-styles.util';
import { generateExecutiveInsights } from '../utils/executive-insights.util';

export type ManagerReportPayload = {
    period: string;
    generatedAt: Date;
    sites: string[];
    sections: string[];
    ticketStats?: {
        total: number;
        byPriority: Record<string, number>;
        byStatus: Record<string, number>;
        byCategory?: Record<string, number>;
        created: number;
        resolved: number;
    };
    agentPerformance?: Array<{
        agentName: string;
        siteCode: string;
        totalAssigned: number;
        resolved: number;
        avgResolutionHours: number;
        slaCompliance: number;
    }>;
    slaMetrics?: {
        totalTickets: number;
        onTime: number;
        breached: number;
        complianceRate: number;
        avgResponseTimeMinutes: number;
        avgResolutionTimeHours: number;
    };
    trends?: Array<{ date: string; created: number; resolved: number }>;
    criticalTickets?: Array<{
        ticketNumber: string | null;
        title: string;
        status: string;
        createdAt: Date;
        assignedToName: string | null;
    }>;
    summary?: {
        totalTickets: number;
        resolvedTickets: number;
        slaComplianceRate: number;
        siteCount: number;
        agentCount: number;
    };
    siteComparison?: Array<{
        siteCode: string;
        siteName: string;
        ticketStats: { total: number; created: number; resolved: number };
        slaMetrics: { complianceRate: number };
    }>;
};

const EMPTY_PERIOD_NOTE = 'Tidak ada data pada periode ini.';

@Injectable()
export class ManagerReportExcelBuilder {
    /**
     * Bangun workbook eksekutif lalu stream ke response.
     */
    async buildAndStream(res: Response, report: ManagerReportPayload, filename?: string): Promise<void> {
        const workbook = createStyledWorkbook();
        const selected = new Set(report.sections);
        const sitesScope = report.sites && report.sites.length > 0 ? report.sites.join(', ') : 'Semua Site';

        // ══════════════════════════════════════════════════════════
        // SHEET 1: EXECUTIVE DASHBOARD / SUMMARY
        // ══════════════════════════════════════════════════════════
        if (selected.has('summary') && report.summary) {
            const s = report.summary;
            const sheet = workbook.addWorksheet('Executive Summary');

            let curRow = drawCorporateExcelHeader(
                sheet,
                'LAPORAN MANAJEMEN & KINERJA LAYANAN (EXECUTIVE REPORT)',
                report.period,
                `Site Scope: ${sitesScope}`,
                'F'
            );

            const resRate = s.totalTickets > 0 ? ((s.resolvedTickets / s.totalTickets) * 100).toFixed(1) : '0';

            curRow = drawExecutiveKpiCards(
                sheet,
                curRow,
                [
                    { label: 'Total Tiket', value: s.totalTickets.toLocaleString('id-ID'), subtext: `${s.siteCount} Site Terlingkup` },
                    { label: 'Tiket Selesai', value: s.resolvedTickets.toLocaleString('id-ID'), subtext: `${resRate}% Resolution Rate` },
                    { label: 'Kepatuhan SLA', value: `${s.slaComplianceRate}%`, subtext: `${s.agentCount} Teknisi Aktif` },
                ],
                [['A', 'B'], ['C', 'D'], ['E', 'F']]
            );

            const topAgent = report.agentPerformance && report.agentPerformance.length > 0
                ? report.agentPerformance.reduce((b, a) => (a.resolved > b.resolved ? a : b), report.agentPerformance[0])
                : undefined;

            const insights = generateExecutiveInsights({
                periodLabel: report.period,
                totalTickets: s.totalTickets,
                resolvedTickets: s.resolvedTickets,
                slaComplianceRate: s.slaComplianceRate,
                breachedTickets: report.slaMetrics?.breached,
                avgResolutionTimeHours: report.slaMetrics?.avgResolutionTimeHours,
                byPriority: report.ticketStats?.byPriority,
                byCategory: report.ticketStats?.byCategory,
                topPerformer: topAgent ? { name: topAgent.agentName, count: topAgent.resolved } : undefined,
                siteCount: s.siteCount,
                agentCount: s.agentCount,
            });

            curRow = drawExecutiveInsightsSection(sheet, curRow, insights, 'F');

            // Summary Metrics Table
            sheet.mergeCells(`A${curRow}:F${curRow}`);
            const mHead = sheet.getCell(`A${curRow}`);
            mHead.value = 'RINGKASAN PARAMETER MANAJEMEN';
            Object.assign(mHead, { style: EXCEL_STYLES.sectionHeader });
            sheet.getRow(curRow).height = 22;
            curRow++;

            const summaryTableRows: Array<[string, string | number, string]> = [
                ['Total Tiket Terdaftar', s.totalTickets, 'Jumlah seluruh tiket pada periode terpilih'],
                ['Tiket Selesai (Resolved)', s.resolvedTickets, 'Tiket yang berhasil diselesaikan teknisi'],
                ['Kepatuhan SLA (%)', `${s.slaComplianceRate}%`, 'Persentase penyelesaian tepat waktu'],
                ['Jumlah Lokasi / Site', s.siteCount, 'Cakupan lokasi operasional dalam laporan'],
                ['Jumlah Teknisi Dievaluasi', s.agentCount, 'Jumlah personil teknisi yang menangani tiket'],
            ];

            sheet.getRow(curRow).values = ['Parameter Metrik', 'Nilai Realisasi', 'Keterangan'];
            sheet.getRow(curRow).height = 22;
            ['A', 'B', 'C'].forEach(c => Object.assign(sheet.getCell(`${c}${curRow}`), { style: EXCEL_STYLES.header }));
            sheet.mergeCells(`C${curRow}:F${curRow}`);
            curRow++;

            summaryTableRows.forEach((r, idx) => {
                const rNum = curRow;
                sheet.getCell(`A${rNum}`).value = r[0];
                sheet.getCell(`B${rNum}`).value = r[1];
                sheet.getCell(`C${rNum}`).value = r[2];

                Object.assign(sheet.getCell(`A${rNum}`), { style: EXCEL_STYLES.metricLabel });
                Object.assign(sheet.getCell(`B${rNum}`), { style: EXCEL_STYLES.cellCenter });
                Object.assign(sheet.getCell(`C${rNum}`), { style: EXCEL_STYLES.cell });

                sheet.mergeCells(`C${rNum}:F${rNum}`);
                sheet.getRow(rNum).height = 20;

                if (idx % 2 === 0) {
                    sheet.getCell(`A${rNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
                    sheet.getCell(`B${rNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
                    sheet.getCell(`C${rNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
                }
                curRow++;
            });

            sheet.columns = [
                { width: 28 },
                { width: 18 },
                { width: 22 },
                { width: 22 },
                { width: 22 },
                { width: 22 },
            ];
        }

        // ══════════════════════════════════════════════════════════
        // SHEET: TICKET STATISTICS
        // ══════════════════════════════════════════════════════════
        if (selected.has('tickets')) {
            const ts = report.ticketStats;
            const sheet = workbook.addWorksheet('Ticket Statistics');
            this.titleBlock(sheet, 'Ticket Statistics', report);

            if (!ts || ts.total === 0) {
                sheet.addRow([EMPTY_PERIOD_NOTE]);
            } else {
                sheet.addRow(['Kategori / Parameter', 'Jumlah Tiket']).eachCell(c => Object.assign(c, { style: EXCEL_STYLES.header }));
                const headerRowNum = 4;
                setupFreezePanes(sheet, headerRowNum);

                const body: Array<[string, number]> = [
                    ['Tiket Masuk (Created)', ts.created ?? ts.total],
                    ['Tiket Selesai (Resolved)', ts.resolved],
                    ...Object.entries(ts.byPriority || {}).map(([k, v]) => [`Prioritas — ${k}`, v] as [string, number]),
                    ...Object.entries(ts.byStatus || {}).map(([k, v]) => [`Status — ${k}`, v] as [string, number]),
                    ...Object.entries(ts.byCategory ?? {}).map(([k, v]) => [`Kategori — ${k}`, v] as [string, number]),
                ];

                body.forEach(([k, v], idx) => {
                    const row = sheet.addRow([k, v]);
                    applyRowStyle(row, idx);
                });

                applyAutoFilter(sheet, 'A', headerRowNum, 'B', headerRowNum + body.length);
                applyFullBorders(sheet, headerRowNum, headerRowNum + body.length, 2);
            }
            autoFitColumns(sheet, 20, 36);
        }

        // ══════════════════════════════════════════════════════════
        // SHEET: SLA PERFORMANCE
        // ══════════════════════════════════════════════════════════
        if (selected.has('sla')) {
            const sl = report.slaMetrics;
            const sheet = workbook.addWorksheet('SLA Performance');
            this.titleBlock(sheet, 'SLA Performance', report);

            if (!sl) {
                sheet.addRow([EMPTY_PERIOD_NOTE]);
            } else {
                sheet.addRow(['Indikator SLA', 'Nilai Realisasi']).eachCell(c => Object.assign(c, { style: EXCEL_STYLES.header }));
                const headerRowNum = 4;
                setupFreezePanes(sheet, headerRowNum);

                const slaRows = [
                    ['Tiket Selesai yang Dievaluasi', sl.totalTickets],
                    ['Selesai Tepat Waktu (On-Time)', sl.onTime],
                    ['Melewati Batas SLA (Breached)', sl.breached],
                    ['Tingkat Kepatuhan SLA (%)', `${sl.complianceRate}%`],
                    ['Rata-rata Waktu Respon Awal (Menit)', `${sl.avgResponseTimeMinutes} menit`],
                    ['Rata-rata Waktu Resolusi (Jam)', `${sl.avgResolutionTimeHours} jam`],
                ];

                slaRows.forEach(([k, v], idx) => {
                    const row = sheet.addRow([k, v]);
                    applyRowStyle(row, idx);
                });

                applyAutoFilter(sheet, 'A', headerRowNum, 'B', headerRowNum + slaRows.length);
                applyFullBorders(sheet, headerRowNum, headerRowNum + slaRows.length, 2);
            }
            autoFitColumns(sheet, 22, 40);
        }

        // ══════════════════════════════════════════════════════════
        // SHEET: AGENT PERFORMANCE
        // ══════════════════════════════════════════════════════════
        if (selected.has('agents')) {
            const perf = report.agentPerformance ?? [];
            const sheet = workbook.addWorksheet('Agent Performance');
            this.titleBlock(sheet, 'Agent Performance', report);

            if (perf.length === 0) {
                sheet.addRow([EMPTY_PERIOD_NOTE]);
            } else {
                sheet.addRow(['Nama Teknisi', 'Site', 'Ditugaskan', 'Selesai', 'Avg Resolusi (Jam)', 'Kepatuhan SLA (%)'])
                    .eachCell(c => Object.assign(c, { style: EXCEL_STYLES.header }));
                const headerRowNum = 4;
                setupFreezePanes(sheet, headerRowNum);

                perf.forEach((a, idx) => {
                    const row = sheet.addRow([
                        a.agentName,
                        a.siteCode,
                        a.totalAssigned,
                        a.resolved,
                        a.avgResolutionHours,
                        `${a.slaCompliance}%`,
                    ]);
                    applyRowStyle(row, idx);
                });

                applyAutoFilter(sheet, 'A', headerRowNum, 'F', headerRowNum + perf.length);
                applyFullBorders(sheet, headerRowNum, headerRowNum + perf.length, 6);
            }
            autoFitColumns(sheet, 16, 32);
        }

        // ══════════════════════════════════════════════════════════
        // SHEET: TREND ANALYSIS
        // ══════════════════════════════════════════════════════════
        if (selected.has('trends')) {
            const trends = report.trends ?? [];
            const sheet = workbook.addWorksheet('Trend Analysis');
            this.titleBlock(sheet, 'Trend Analysis (Daily)', report);

            if (trends.length === 0) {
                sheet.addRow([EMPTY_PERIOD_NOTE]);
            } else {
                sheet.addRow(['Tanggal', 'Tiket Masuk (Created)', 'Tiket Selesai (Resolved)'])
                    .eachCell(c => Object.assign(c, { style: EXCEL_STYLES.header }));
                const headerRowNum = 4;
                setupFreezePanes(sheet, headerRowNum);

                trends.forEach((t, idx) => {
                    const row = sheet.addRow([t.date, t.created, t.resolved]);
                    applyRowStyle(row, idx);
                });

                applyAutoFilter(sheet, 'A', headerRowNum, 'C', headerRowNum + trends.length);
                applyFullBorders(sheet, headerRowNum, headerRowNum + trends.length, 3);
            }
            autoFitColumns(sheet, 16, 28);
        }

        // ══════════════════════════════════════════════════════════
        // SHEET: CRITICAL TICKETS
        // ══════════════════════════════════════════════════════════
        if (selected.has('critical')) {
            const crit = report.criticalTickets ?? [];
            const sheet = workbook.addWorksheet('Critical Tickets');
            this.titleBlock(sheet, 'Critical & High Priority Tickets', report);

            if (crit.length === 0) {
                sheet.addRow([EMPTY_PERIOD_NOTE]);
            } else {
                sheet.addRow(['No. Tiket', 'Judul Masalah', 'Status', 'Tanggal Dibuat', 'Teknisi'])
                    .eachCell(c => Object.assign(c, { style: EXCEL_STYLES.header }));
                const headerRowNum = 4;
                setupFreezePanes(sheet, headerRowNum);

                crit.forEach((t, idx) => {
                    const createdStr = t.createdAt instanceof Date
                        ? t.createdAt.toLocaleString('id-ID')
                        : String(t.createdAt || '—');

                    const row = sheet.addRow([
                        t.ticketNumber ?? '-',
                        t.title,
                        t.status,
                        createdStr,
                        t.assignedToName ?? 'Unassigned',
                    ]);
                    applyRowStyle(row, idx);

                    const statusCell = row.getCell(3);
                    statusCell.font = { ...EXCEL_STYLES.cell.font!, bold: true, color: getStatusColor(t.status) };
                });

                applyAutoFilter(sheet, 'A', headerRowNum, 'E', headerRowNum + crit.length);
                applyFullBorders(sheet, headerRowNum, headerRowNum + crit.length, 5);
            }
            autoFitColumns(sheet, 16, 40);
        }

        // ══════════════════════════════════════════════════════════
        // SHEET: SITE COMPARISON
        // ══════════════════════════════════════════════════════════
        if (selected.has('comparison') && report.siteComparison && report.siteComparison.length > 0) {
            const sites = report.siteComparison;
            const sheet = workbook.addWorksheet('Site Comparison');
            this.titleBlock(sheet, 'Perbandingan Kinerja Antar Site', report);

            sheet.addRow(['Kode Site', 'Nama Lokasi', 'Total Tiket', 'Tiket Selesai', 'Kepatuhan SLA (%)'])
                .eachCell(c => Object.assign(c, { style: EXCEL_STYLES.header }));
            const headerRowNum = 4;
            setupFreezePanes(sheet, headerRowNum);

            sites.forEach((s, idx) => {
                const row = sheet.addRow([
                    s.siteCode,
                    s.siteName || s.siteCode,
                    s.ticketStats?.total || 0,
                    s.ticketStats?.resolved || 0,
                    `${s.slaMetrics?.complianceRate || 0}%`,
                ]);
                applyRowStyle(row, idx);
            });

            applyAutoFilter(sheet, 'A', headerRowNum, 'E', headerRowNum + sites.length);
            applyFullBorders(sheet, headerRowNum, headerRowNum + sites.length, 5);
            autoFitColumns(sheet, 16, 32);
        }

        await workbook.xlsx.write(res);
    }

    /** Blok judul + periode di atas tiap sheet detail */
    private titleBlock(sheet: ExcelJS.Worksheet, title: string, report: ManagerReportPayload): void {
        sheet.mergeCells(1, 1, 1, 4);
        const titleCell = sheet.getCell(1, 1);
        titleCell.value = `PT SANTOS JAYA ABADI — iDesk ${title}`;
        Object.assign(titleCell, { style: EXCEL_STYLES.title });
        sheet.getRow(1).height = 24;

        sheet.mergeCells(2, 1, 2, 4);
        const periodCell = sheet.getCell(2, 1);
        periodCell.value = `Periode: ${report.period}   |   Sites: ${report.sites.join(', ') || 'Semua Site'}`;
        Object.assign(periodCell, { style: EXCEL_STYLES.subtitle });
        sheet.getRow(2).height = 18;

        sheet.getRow(3).height = 8;
    }
}
