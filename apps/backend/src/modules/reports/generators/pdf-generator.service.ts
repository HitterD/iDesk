import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AgentMetrics } from './agent-performance.report';
import { TicketVolumeData } from './ticket-volume.report';
import { generateExecutiveInsights } from '../utils/executive-insights.util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

export interface PDFReportOptions {
    title: string;
    subtitle?: string;
    dateRange?: { startDate: Date; endDate: Date };
    author?: string;
    siteName?: string;
    docNo?: string;
}

// ─── CORPORATE EXECUTIVE PALETTE ────────────────────────────
// Professional Navy & Slate palette for PT Santos Jaya Abadi / iDesk
const C = {
    // Brand
    brandNavy: '#1E3A8A',      // Blue-900 — Primary Brand
    brandNavyDark: '#0F172A',  // Slate-900 — Main Text & Headings
    brandBlue: '#2563EB',      // Blue-600 — Accent
    brandBlueLight: '#EFF6FF', // Blue-50 — Subtitle / Pill fill

    // Neutrals
    black: '#0F172A',          // Slate-900
    text: '#334155',           // Slate-700 — Body text
    textMuted: '#64748B',      // Slate-500 — Secondary text
    textFaint: '#94A3B8',      // Slate-400 — Captions & Metadata
    rule: '#E2E8F0',           // Slate-200 — Divider lines
    ruleStrong: '#CBD5E1',     // Slate-300 — Table headers border
    bgSubtle: '#F8FAFC',       // Slate-50 — Table alternate rows
    white: '#FFFFFF',

    // Headers & Banners
    headerBg: '#1E293B',       // Slate-800 — Table Header
    headerAccent: '#475569',   // Slate-600 — Divider inside header
    bannerBg: '#F1F5F9',       // Slate-100 — Section banner fill

    // Executive Card Colors
    cardBg: '#FFFFFF',
    cardBorder: '#CBD5E1',
    cardFill: '#F8FAFC',
    insightBg: '#F8FAFC',      // Slate-50 (Corporate Executive Box)
    insightBorder: '#CBD5E1',  // Slate-300
    insightDot: '#1E3A8A',     // Brand Navy

    // Semantic Status Colors
    positive: '#059669',       // Emerald-600
    positiveBg: '#DCFCE7',     // Emerald-100
    caution: '#D97706',        // Amber-600
    cautionBg: '#FEF3C7',      // Amber-100
    critical: '#DC2626',       // Red-600
    criticalBg: '#FEE2E2',     // Red-100
    neutral: '#2563EB',        // Blue-600
    neutralBg: '#DBEAFE',      // Blue-100
};

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * PDF Report Generator Service
 * Executive Summary Standard — PT Santos Jaya Abadi / iDesk
 */
@Injectable()
export class PDFGeneratorService {
    private readonly logger = new Logger(PDFGeneratorService.name);

    /**
     * Generate Monthly Summary PDF Report
     */
    async generateMonthlySummaryPDF(
        res: Response,
        stats: {
            month: number;
            year: number;
            totalTickets: number;
            resolvedTickets: number;
            openTickets: number;
            avgResolutionTimeHours: string | number;
        },
        options: PDFReportOptions,
    ): Promise<void> {
        const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=monthly-report-${stats.month}-${stats.year}.pdf`,
        );

        doc.pipe(res);

        const monthName = MONTH_NAMES[stats.month - 1] || `Bulan ${stats.month}`;
        const totalTickets = Number(stats.totalTickets) || 0;
        const resolvedTickets = Number(stats.resolvedTickets) || 0;
        const openTickets = Number(stats.openTickets) || Math.max(0, totalTickets - resolvedTickets);
        const parsedHours = parseFloat(String(stats.avgResolutionTimeHours));
        const avgHours = isNaN(parsedHours) ? 0 : parsedHours;
        const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0;

        // Draw Corporate Header
        this.drawCorporateHeader(doc, {
            ...options,
            title: 'Laporan Ringkasan Bulanan (Monthly Summary)',
            subtitle: `Periode: ${monthName} ${stats.year}`,
            siteName: options.siteName || 'Semua Site Operasional',
            docNo: options.docNo || `REP-MTH-${stats.year}${String(stats.month).padStart(2, '0')}`,
        });

        // Smart Executive Insights
        const insights = generateExecutiveInsights({
            periodLabel: `${monthName} ${stats.year}`,
            totalTickets,
            resolvedTickets,
            openTickets,
            resolutionRate,
            avgResolutionTimeHours: avgHours,
        });

        // Executive Summary Section (KPI Cards + Takeaways)
        this.drawExecutiveSectionHeader(doc, 'Executive Summary & Key Takeaways');
        const kpiY = doc.y + 6;
        this.drawEnhancedKpiGrid(doc, kpiY, [
            { label: 'TOTAL TIKET', value: totalTickets.toLocaleString('id-ID'), subtext: `${monthName} ${stats.year}` },
            { label: 'TIKET SELESAI', value: resolvedTickets.toLocaleString('id-ID'), subtext: `${resolutionRate.toFixed(1)}% Resolution Rate`, status: 'positive' },
            { label: 'TIKET TERBUKA', value: openTickets.toLocaleString('id-ID'), subtext: 'Dalam Antrean / Proses', status: openTickets > 0 ? 'caution' : 'positive' },
            { label: 'AVG RESOLUSI', value: `${avgHours.toFixed(1)} jam`, subtext: 'Waktu Rata-rata Resolusi' },
        ]);

        this.drawInsightBox(doc, insights);

        // Performance & Distribution
        this.drawSectionLabel(doc, 'Indikator Kinerja & Distribusi Tiket');
        this.drawProgressBar(doc, 36, doc.y + 4, 523, 'Tingkat Penyelesaian Tiket (Resolution Rate)', resolutionRate, 100);
        doc.y += 38;

        this.drawDistributionRow(doc, [
            { label: 'Tiket Selesai (Resolved)', value: resolvedTickets, total: totalTickets, color: C.positive },
            { label: 'Tiket Masih Terbuka (Open)', value: openTickets, total: totalTickets, color: C.caution },
        ]);

        // Summary Statistics Table
        this.drawSectionLabel(doc, 'Tabel Ringkasan Metrik Operasional');
        this.drawKeyValueTable(doc, [
            { metric: 'Periode Laporan', value: `${monthName} ${stats.year}` },
            { metric: 'Cakupan Unit / Site', value: options.siteName || 'Seluruh Site PT Santos Jaya Abadi' },
            { metric: 'Total Tiket Masuk', value: `${totalTickets.toLocaleString('id-ID')} tiket` },
            { metric: 'Total Tiket Terselesaikan', value: `${resolvedTickets.toLocaleString('id-ID')} tiket` },
            { metric: 'Tiket Dalam Pengerjaan / Antrean', value: `${openTickets.toLocaleString('id-ID')} tiket` },
            { metric: 'Rasio Penyelesaian (Resolution Rate)', value: `${resolutionRate.toFixed(2)}%` },
            { metric: 'Rata-rata Durasi Resolusi Tiket', value: `${avgHours.toFixed(2)} jam` },
            { metric: 'Status Efektivitas Helpdesk', value: resolutionRate >= 90 ? 'OPTIMAL (Sangat Baik)' : resolutionRate >= 75 ? 'STABIL (Baik)' : 'MEMERLUKAN MONITORING' },
        ]);

        // Approval Section
        this.drawSignOffSection(doc, options.author || 'IT Service Desk Specialist', 'IT Operations Manager');

        this.drawFooter(doc);
        doc.end();
    }

    /**
     * Generate Agent Performance PDF Report
     */
    async generateAgentPerformancePDF(
        res: Response,
        metrics: AgentMetrics[],
        options: PDFReportOptions,
    ): Promise<void> {
        const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=agent-performance-${Date.now()}.pdf`,
        );

        doc.pipe(res);

        // Corporate Header
        this.drawCorporateHeader(doc, {
            ...options,
            title: 'Laporan Kinerja Teknisi (Agent Performance)',
            subtitle: this.formatDateRangeSubtitle(options.dateRange),
            siteName: options.siteName || 'Semua Site',
            docNo: options.docNo || `REP-AGT-${Date.now().toString().slice(-6)}`,
        });

        // Summary Calculations
        const totalAgents = metrics.length;
        const totalAssignedAll = metrics.reduce((sum, m) => sum + (Number(m.totalAssigned) || 0), 0);
        const totalResolvedAll = metrics.reduce((sum, m) => sum + (Number(m.totalResolved) || 0), 0);
        const avgResolutionRate = metrics.length > 0
            ? metrics.reduce((sum, m) => sum + (Number(m.resolutionRate) || 0), 0) / metrics.length
            : 0;
        const avgSLA = metrics.length > 0
            ? metrics.reduce((sum, m) => sum + (Number(m.slaComplianceRate) || 0), 0) / metrics.length
            : 0;
        const bestAgent = metrics.length > 0
            ? metrics.reduce((best, m) => (m.resolutionRate || 0) > (best.resolutionRate || 0) ? m : best, metrics[0])
            : null;

        const insights = generateExecutiveInsights({
            totalTickets: totalAssignedAll,
            resolvedTickets: totalResolvedAll,
            resolutionRate: avgResolutionRate,
            slaComplianceRate: avgSLA,
            agentCount: totalAgents,
            topPerformer: bestAgent ? { name: bestAgent.agentName, resolutionRate: bestAgent.resolutionRate, count: bestAgent.totalResolved } : undefined,
        });

        // Executive Summary Section
        this.drawExecutiveSectionHeader(doc, 'Executive Summary & Evaluasi Kinerja Teknisi');
        const kpiY = doc.y + 6;
        this.drawEnhancedKpiGrid(doc, kpiY, [
            { label: 'TOTAL TEKNISI', value: String(totalAgents), subtext: 'Teknisi Aktif Dievaluasi' },
            { label: 'AVG RESOLUSI', value: `${avgResolutionRate.toFixed(1)}%`, subtext: `${totalResolvedAll}/${totalAssignedAll} Tiket Selesai`, status: 'positive' },
            { label: 'KEPATUHAN SLA', value: `${avgSLA.toFixed(1)}%`, subtext: 'Rata-rata Kepatuhan SLA', status: avgSLA >= 90 ? 'positive' : 'caution' },
            { label: 'TOP PERFORMER', value: bestAgent?.agentName?.split(' ')[0] || '—', subtext: `${bestAgent?.resolutionRate?.toFixed(1) || 0}% Selesai` },
        ]);

        this.drawInsightBox(doc, insights);

        // Agent Details Table
        this.drawSectionLabel(doc, 'Rincian Metrik Evaluasi Performa Setiap Teknisi');
        this.drawAgentTable(doc, metrics);

        // Sign-off
        if (doc.y > 675) {
            doc.addPage();
            doc.y = 36;
        }
        this.drawSignOffSection(doc, options.author || 'IT Service Lead', 'Head of ICT / Manager');

        this.drawFooter(doc);
        doc.end();
    }

    /**
     * Generate Ticket Volume PDF Report
     */
    async generateTicketVolumePDF(
        res: Response,
        volumeData: TicketVolumeData,
        options: PDFReportOptions,
    ): Promise<void> {
        const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=ticket-volume-${Date.now()}.pdf`,
        );

        doc.pipe(res);

        // Corporate Header
        this.drawCorporateHeader(doc, {
            ...options,
            title: 'Laporan Volume & Distribusi Tiket',
            subtitle: this.formatDateRangeSubtitle(options.dateRange),
            siteName: options.siteName || 'Semua Site',
            docNo: options.docNo || `REP-VOL-${Date.now().toString().slice(-6)}`,
        });

        const totalCreated = Number(volumeData.summary.totalCreated) || 0;
        const totalResolved = Number(volumeData.summary.totalResolved) || 0;
        const totalPending = Number(volumeData.summary.totalPending) || 0;
        const avgPerDay = Number(volumeData.summary.avgPerDay) || 0;
        const resolutionRate = totalCreated > 0 ? (totalResolved / totalCreated) * 100 : 0;

        const insights = generateExecutiveInsights({
            totalTickets: totalCreated,
            resolvedTickets: totalResolved,
            openTickets: totalPending,
            resolutionRate,
            byPriority: volumeData.byPriority,
            byCategory: volumeData.byCategory,
        });

        // Executive Summary Section
        this.drawExecutiveSectionHeader(doc, 'Executive Summary & Analisis Beban Kerja');
        const kpiY = doc.y + 6;
        this.drawEnhancedKpiGrid(doc, kpiY, [
            { label: 'TIKET MASUK', value: totalCreated.toLocaleString('id-ID'), subtext: 'Total Tiket Baru' },
            { label: 'TERSELESAIKAN', value: totalResolved.toLocaleString('id-ID'), subtext: `${resolutionRate.toFixed(1)}% Tingkat Resolusi`, status: 'positive' },
            { label: 'PENDING / AKTIF', value: totalPending.toLocaleString('id-ID'), subtext: 'Tiket Berjalan', status: totalPending > 0 ? 'caution' : 'positive' },
            { label: 'RATA-RATA / HARI', value: avgPerDay.toFixed(1), subtext: `Peak: ${volumeData.summary.peakCount || 0} (${volumeData.summary.peakDay || '—'})` },
        ]);

        this.drawInsightBox(doc, insights);

        // Daily Trend Chart
        if (volumeData.daily && volumeData.daily.length > 0) {
            this.drawSectionLabel(doc, 'Tren Volume Tiket Harian (Created vs Resolved)');
            this.drawDailyVolumeChart(doc, volumeData.daily);
        }

        // Breakdown Columns
        this.drawSectionLabel(doc, 'Distribusi Berdasarkan Kategori, Prioritas & Status');
        const infoY = doc.y;
        this.drawKeyValueList(doc, 36, infoY, 'Menurut Kategori', volumeData.byCategory);
        this.drawKeyValueList(doc, 215, infoY, 'Menurut Prioritas', volumeData.byPriority);
        this.drawKeyValueList(doc, 395, infoY, 'Menurut Status', volumeData.byStatus);

        // Sign-off
        doc.y = infoY + 84;
        if (doc.y > 675) {
            doc.addPage();
            doc.y = 36;
        }
        this.drawSignOffSection(doc, options.author || 'IT Service Lead', 'IT Operations Manager');

        this.drawFooter(doc);
        doc.end();
    }

    /**
     * Generate Comprehensive Manager Report PDF
     */
    async generateManagerReportPDF(
        res: Response,
        report: {
            period: string;
            sites: string[];
            sections: string[];
            ticketStats?: { total: number; byPriority: Record<string, number>; byStatus: Record<string, number>; byCategory?: Record<string, number>; created: number; resolved: number };
            agentPerformance?: Array<{ agentName: string; siteCode: string; totalAssigned: number; resolved: number; avgResolutionHours: number; slaCompliance: number }>;
            slaMetrics?: { totalTickets: number; onTime: number; breached: number; complianceRate: number; avgResponseTimeMinutes: number; avgResolutionTimeHours: number };
            trends?: Array<{ date: string; created: number; resolved: number }>;
            criticalTickets?: Array<{ id?: string; ticketNumber: string | null; title: string; status: string; createdAt: Date; assignedToName: string | null }>;
            summary?: { totalTickets: number; resolvedTickets: number; slaComplianceRate: number; siteCount: number; agentCount: number };
            siteComparison?: Array<{ siteCode: string; siteName: string; ticketStats: { total: number; created: number; resolved: number }; slaMetrics: { complianceRate: number } }>;
        },
        options: PDFReportOptions,
    ): Promise<void> {
        const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });
        doc.pipe(res);

        const scopeLabel = report.sites && report.sites.length > 0
            ? `Site: ${report.sites.join(', ')}`
            : 'Seluruh Site Operasional';

        // Corporate Header
        this.drawCorporateHeader(doc, {
            ...options,
            title: 'Laporan Manajemen & Evaluasi Layanan IT',
            subtitle: `Periode: ${report.period}`,
            siteName: scopeLabel,
            docNo: options.docNo || `REP-MGR-${Date.now().toString().slice(-6)}`,
        });

        // ── Executive Summary (KPI Cards + Smart Insights) ──────
        const summary = report.summary || {
            totalTickets: report.ticketStats?.total || 0,
            resolvedTickets: report.ticketStats?.resolved || 0,
            slaComplianceRate: report.slaMetrics?.complianceRate || 0,
            siteCount: report.sites?.length || 1,
            agentCount: report.agentPerformance?.length || 0,
        };

        const resRate = summary.totalTickets > 0 ? (summary.resolvedTickets / summary.totalTickets) * 100 : 0;
        const topAgent = report.agentPerformance && report.agentPerformance.length > 0
            ? report.agentPerformance.reduce((b, a) => (a.resolved > b.resolved ? a : b), report.agentPerformance[0])
            : undefined;

        const insights = generateExecutiveInsights({
            periodLabel: report.period,
            totalTickets: summary.totalTickets,
            resolvedTickets: summary.resolvedTickets,
            resolutionRate: resRate,
            slaComplianceRate: summary.slaComplianceRate,
            breachedTickets: report.slaMetrics?.breached,
            avgResolutionTimeHours: report.slaMetrics?.avgResolutionTimeHours,
            byPriority: report.ticketStats?.byPriority,
            byCategory: report.ticketStats?.byCategory,
            topPerformer: topAgent ? { name: topAgent.agentName, count: topAgent.resolved } : undefined,
            siteCount: summary.siteCount,
            agentCount: summary.agentCount,
        });

        this.drawExecutiveSectionHeader(doc, 'Executive Summary & Rekomendasi Manajemen');
        const kpiY = doc.y + 6;
        this.drawEnhancedKpiGrid(doc, kpiY, [
            { label: 'TOTAL TIKET', value: summary.totalTickets.toLocaleString('id-ID'), subtext: `${summary.siteCount} Site Terlingkup` },
            { label: 'TERSELESAIKAN', value: summary.resolvedTickets.toLocaleString('id-ID'), subtext: `${resRate.toFixed(1)}% Resolution Rate`, status: 'positive' },
            { label: 'KEPATUHAN SLA', value: `${summary.slaComplianceRate}%`, subtext: 'Target Standard SLA', status: summary.slaComplianceRate >= 90 ? 'positive' : 'caution' },
            { label: 'TEKNISI & SITE', value: `${summary.agentCount} Agt / ${summary.siteCount} Site`, subtext: 'Kapasitas Tim Aktif' },
        ]);

        this.drawInsightBox(doc, insights);

        // ── Ticket Statistics ───────────────────────────────────
        if (report.ticketStats) {
            if (doc.y > 620) doc.addPage();
            this.drawSectionLabel(doc, 'Statistik Volume & Distribusi Tiket');
            const ts = report.ticketStats;
            this.drawKeyValueTable(doc, [
                { metric: 'Total Tiket Terdaftar', value: `${ts.total.toLocaleString('id-ID')} tiket` },
                { metric: 'Tiket Selesai Pada Periode Ini', value: `${ts.resolved.toLocaleString('id-ID')} tiket` },
                ...Object.entries(ts.byPriority || {}).map(([k, v]) => ({ metric: `Prioritas — ${k}`, value: `${v} tiket` })),
                ...Object.entries(ts.byStatus || {}).map(([k, v]) => ({ metric: `Status — ${k}`, value: `${v} tiket` })),
            ]);
            doc.moveDown(0.8);
        }

        // ── SLA Performance ─────────────────────────────────────
        if (report.slaMetrics) {
            if (doc.y > 620) doc.addPage();
            this.drawSectionLabel(doc, 'Kinerja Service Level Agreement (SLA)');
            const sl = report.slaMetrics;
            const avgResp = Number(sl.avgResponseTimeMinutes) || 0;
            const avgResH = Number(sl.avgResolutionTimeHours) || 0;

            this.drawKeyValueTable(doc, [
                { metric: 'Tiket Selesai yang Dievaluasi', value: `${sl.totalTickets} tiket` },
                { metric: 'Penyelesaian Tepat Waktu (On-Time SLA)', value: `${sl.onTime} tiket` },
                { metric: 'Penyelesaian Terlambat (Breached SLA)', value: `${sl.breached} tiket` },
                { metric: 'Tingkat Kepatuhan SLA', value: `${sl.complianceRate}%` },
                { metric: 'Rata-rata Waktu Respon Awal', value: `${avgResp.toFixed(1)} menit` },
                { metric: 'Rata-rata Waktu Resolusi Keseluruhan', value: `${avgResH.toFixed(2)} jam` },
            ]);
            doc.moveDown(0.8);
        }

        // ── Agent Performance ────────────────────────────────────
        if (report.agentPerformance && report.agentPerformance.length > 0) {
            if (doc.y > 600) doc.addPage();
            this.drawSectionLabel(doc, 'Evaluasi Beban Kerja & Kinerja Teknisi');
            this.drawManagerAgentTable(doc, report.agentPerformance);
            doc.moveDown(0.8);
        }

        // ── Site Comparison ──────────────────────────────────────
        if (report.siteComparison && report.siteComparison.length > 0) {
            if (doc.y > 600) doc.addPage();
            this.drawSectionLabel(doc, 'Perbandingan Kinerja Antar Site Operasional');
            this.drawSiteComparisonTable(doc, report.siteComparison);
            doc.moveDown(0.8);
        }

        // ── Critical Tickets ─────────────────────────────────────
        if (report.criticalTickets && report.criticalTickets.length > 0) {
            if (doc.y > 600) doc.addPage();
            this.drawSectionLabel(doc, 'Daftar Tiket Kritis & Prioritas Tinggi');
            this.drawCriticalTicketsTable(doc, report.criticalTickets);
            doc.moveDown(0.8);
        }

        // Sign-off / Approval Block
        if (doc.y > 660) doc.addPage();
        this.drawSignOffSection(doc, options.author || 'IT Service Specialist', 'IT Manager / Department Head');

        this.drawFooter(doc);
        doc.end();
    }

    // ─────────────────────────────────────────────────────────────
    // DRAWING PRIMITIVES & CORPORATE COMPONENTS
    // ─────────────────────────────────────────────────────────────

    /**
     * Draw Formal Corporate Header with PT Santos Jaya Abadi Logo
     */
    private drawCorporateHeader(doc: any, options: PDFReportOptions): void {
        const startX = 36;
        const startY = 32;
        const pageWidth = 523; // 595 - 72
        const headerH = 74;

        const col1W = 120; // Logo & Company
        const col3W = 155; // Metadata Block
        const col2W = pageWidth - col1W - col3W; // Title Block (248)

        // Outer header box with navy accent top line
        doc.rect(startX, startY, pageWidth, headerH).fill(C.cardBg);
        doc.rect(startX, startY, pageWidth, headerH).lineWidth(0.8).strokeColor(C.cardBorder).stroke();
        doc.rect(startX, startY, pageWidth, 2.5).fill(C.brandNavy); // Top Brand Accent Strip

        // Vertical dividers
        doc.moveTo(startX + col1W, startY + 2.5).lineTo(startX + col1W, startY + headerH).lineWidth(0.5).strokeColor(C.rule).stroke();
        doc.moveTo(startX + col1W + col2W, startY + 2.5).lineTo(startX + col1W + col2W, startY + headerH).stroke();

        // ── Column 1: Logo & Company Name ──
        const logoPathCandidates = [
            path.join(__dirname, '../../assets/santos-logo.png'),
            path.join(process.cwd(), 'src/assets/santos-logo.png'),
            path.join(process.cwd(), 'apps/backend/src/assets/santos-logo.png'),
            path.join(process.cwd(), 'dist/assets/santos-logo.png'),
            path.resolve(__dirname, '../../../../../login picture/gb-putih.png'),
        ];

        let logoLoaded = false;
        for (const p of logoPathCandidates) {
            if (fs.existsSync(p)) {
                try {
                    doc.image(p, startX + (col1W - 38) / 2, startY + 7, { fit: [38, 28], align: 'center', valign: 'center' });
                    logoLoaded = true;
                    break;
                } catch {
                    // ignore
                }
            }
        }

        if (!logoLoaded) {
            const logoCenterX = startX + col1W / 2;
            doc.save();
            doc.fillColor('#DC2626').polygon([logoCenterX - 8, startY + 8], [logoCenterX, startY + 18], [logoCenterX - 8, startY + 28]).fill();
            doc.fillColor('#16A34A').polygon([logoCenterX + 8, startY + 8], [logoCenterX, startY + 18], [logoCenterX + 8, startY + 28]).fill();
            doc.restore();
        }

        doc.font('Helvetica-Bold').fontSize(6.5).fillColor(C.brandNavyDark)
            .text('PT SANTOS JAYA ABADI', startX + 4, startY + 44, { width: col1W - 8, align: 'center' });
        doc.font('Helvetica').fontSize(5.5).fillColor(C.textMuted)
            .text('iDesk Helpdesk System', startX + 4, startY + 56, { width: col1W - 8, align: 'center' });

        // ── Column 2: Document Title, Subtitle, Scope (Dynamic Height) ──
        const titleX = startX + col1W + 10;
        const titleW = col2W - 20;

        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.brandNavyDark);
        const titleText = options.title.toUpperCase();
        doc.text(titleText, titleX, startY + 8, { width: titleW, lineGap: 1.5 });
        const titleHeight = doc.heightOfString(titleText, { width: titleW, lineGap: 1.5 });

        let currentY = startY + 8 + titleHeight + 3;

        if (options.subtitle) {
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.brandBlue)
                .text(options.subtitle, titleX, currentY, { width: titleW, lineBreak: false });
            currentY += 12;
        }

        doc.font('Helvetica').fontSize(6.8).fillColor(C.textMuted)
            .text(`Scope: ${options.siteName || 'Semua Site'}`, titleX, currentY, { width: titleW, lineBreak: false });

        // ── Column 3: Metadata Box ──
        const metaX = startX + col1W + col2W + 8;
        const valX = metaX + 52;
        const metaW = col3W - 60;
        const rowH = 13.5;
        let mY = startY + 8;

        doc.font('Helvetica').fontSize(6.8).fillColor(C.textMuted);
        doc.text('No. Dokumen', metaX, mY);
        doc.font('Helvetica-Bold').fillColor(C.brandNavyDark).text(`: ${options.docNo || 'iDesk-RPT'}`, valX, mY, { width: metaW });

        mY += rowH;
        doc.font('Helvetica').fillColor(C.textMuted).text('Tgl Cetak', metaX, mY);
        const printDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        doc.font('Helvetica-Bold').fillColor(C.brandNavyDark).text(`: ${printDate}`, valX, mY, { width: metaW });

        mY += rowH;
        doc.font('Helvetica').fillColor(C.textMuted).text('Waktu', metaX, mY);
        const printTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        doc.font('Helvetica').fillColor(C.brandNavyDark).text(`: ${printTime} WIB`, valX, mY, { width: metaW });

        mY += rowH;
        doc.font('Helvetica').fillColor(C.textMuted).text('Sifat', metaX, mY);
        doc.font('Helvetica-Bold').fillColor(C.critical).text(': RAHASIA / INTERNAL', valX, mY, { width: metaW });

        doc.fillColor(C.text);
        doc.y = startY + headerH + 12;
    }

    /**
     * Draw Executive Section Banner Header
     */
    private drawExecutiveSectionHeader(doc: any, title: string): void {
        const x = 36;
        const w = 523;
        const y = doc.y;

        doc.rect(x, y, w, 20).fill(C.bannerBg);
        doc.rect(x, y, 3.5, 20).fill(C.brandNavy);
        doc.rect(x, y, w, 20).lineWidth(0.5).strokeColor(C.ruleStrong).stroke();

        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.brandNavyDark)
            .text(title.toUpperCase(), x + 10, y + 5.5);

        doc.y = y + 20;
        doc.fillColor(C.text);
    }

    /**
     * Section label — thin rule with bold uppercase label
     */
    private drawSectionLabel(doc: any, title: string): void {
        doc.moveDown(0.5);
        const y = doc.y;
        doc.fontSize(8.2).font('Helvetica-Bold').fillColor(C.brandNavyDark)
            .text(title.toUpperCase(), 36, y);
        doc.moveTo(36, doc.y + 2).lineTo(559, doc.y + 2).lineWidth(0.6).strokeColor(C.ruleStrong).stroke();
        doc.moveDown(0.3);
        doc.fillColor(C.text);
    }

    /**
     * Enhanced KPI Grid (4 Cards per row with border and colored subtext)
     */
    private drawEnhancedKpiGrid(
        doc: any,
        y: number,
        cards: Array<{ label: string; value: string; subtext?: string; status?: 'positive' | 'caution' | 'critical' }>
    ): void {
        const totalW = 523;
        const gap = 8;
        const cardW = (totalW - (gap * (cards.length - 1))) / cards.length;
        const cardH = 46;

        cards.forEach((card, i) => {
            const cx = 36 + i * (cardW + gap);

            // Card Container
            doc.rect(cx, y, cardW, cardH).fill(C.cardFill);
            doc.rect(cx, y, cardW, cardH).lineWidth(0.6).strokeColor(C.cardBorder).stroke();

            // Card Top Accent Border
            const accentColor = card.status === 'positive' ? C.positive : card.status === 'caution' ? C.caution : card.status === 'critical' ? C.critical : C.brandBlue;
            doc.rect(cx, y, cardW, 2.5).fill(accentColor);

            // Label
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor(C.textMuted)
                .text(card.label.toUpperCase(), cx + 8, y + 5.5, { width: cardW - 16, align: 'left' });

            // Value
            doc.fontSize(13.5).font('Helvetica-Bold').fillColor(C.brandNavyDark)
                .text(card.value, cx + 8, y + 15, { width: cardW - 16, align: 'left' });

            // Subtext
            if (card.subtext) {
                doc.fontSize(6.2).font('Helvetica').fillColor(card.status ? accentColor : C.textMuted)
                    .text(card.subtext, cx + 8, y + 31, { width: cardW - 16, align: 'left', lineBreak: false });
            }
        });

        doc.fillColor(C.text);
        doc.y = y + cardH + 8;
    }

    /**
     * Draw Insight Box containing smart automated takeaways with exact dynamic height calculation
     */
    private drawInsightBox(doc: any, insights: string[]): void {
        if (!insights || insights.length === 0) return;

        const x = 36;
        const w = 523;
        const padX = 18;
        const textX = x + padX;
        const textW = w - padX - 10;
        const padTop = 6;
        const padBottom = 6;
        const itemGap = 3.5;
        const fontSize = 7.5;
        const lineGap = 1.2;

        doc.font('Helvetica').fontSize(fontSize);

        // Precalculate dynamic heights for each insight item
        const itemHeights = insights.map((insight) =>
            doc.heightOfString(insight, { width: textW, lineGap })
        );

        const totalContentH = itemHeights.reduce((sum, h) => sum + h, 0) + (insights.length - 1) * itemGap;
        const boxH = Math.max(30, padTop + totalContentH + padBottom);
        const y = doc.y + 2;

        // Container Box (Corporate Slate-50 background, Slate-300 border)
        doc.rect(x, y, w, boxH).fill(C.cardFill);
        doc.rect(x, y, w, boxH).lineWidth(0.6).strokeColor(C.cardBorder).stroke();
        doc.rect(x, y, 3, boxH).fill(C.brandNavy); // Left Navy Brand accent bar

        // Render bullet points & text with exact calculated offsets
        let curY = y + padTop;
        insights.forEach((insight, idx) => {
            const h = itemHeights[idx];

            // Bullet dot vertically aligned with first line of text
            doc.circle(x + 10, curY + 4.5, 1.8).fill(C.brandNavy);

            // Insight text
            doc.font('Helvetica').fontSize(fontSize).fillColor(C.brandNavyDark)
                .text(insight, textX, curY, { width: textW, lineGap });

            curY += h + itemGap;
        });

        doc.y = y + boxH + 8;
        doc.fillColor(C.text);
    }

    /**
     * Agent performance table
     */
    private drawAgentTable(doc: any, metrics: AgentMetrics[]): void {
        const L = 36;
        const W = [125, 50, 50, 65, 75, 75, 83];
        const totalW = W.reduce((a, b) => a + b, 0);
        const headers = ['Nama Teknisi', 'Ditugaskan', 'Selesai', 'Tingkat %', 'Avg Respon', 'Avg Resolusi', 'SLA %'];

        // Header
        const headerY = doc.y;
        doc.rect(L, headerY, totalW, 19).fill(C.headerBg);
        let x = L;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.white);
        headers.forEach((h, i) => {
            doc.text(h, x + 4, headerY + 5.5, { width: W[i] - 8, align: i >= 1 ? 'center' : 'left' });
            x += W[i];
        });

        doc.y = headerY + 19;

        // Rows
        doc.font('Helvetica').fontSize(7.5);
        const displayed = metrics.slice(0, 20);
        displayed.forEach((agent, idx) => {
            const rowY = doc.y;
            if (idx % 2 === 0) {
                doc.rect(L, rowY, totalW, 16).fill(C.bgSubtle);
            }

            x = L;
            doc.fillColor(C.text);
            const resMin = Number(agent.avgResolutionTimeMinutes) || 0;
            const resHours = (resMin / 60).toFixed(1);

            const vals = [
                agent.agentName.substring(0, 22),
                String(agent.totalAssigned || 0),
                String(agent.totalResolved || 0),
                `${(agent.resolutionRate || 0).toFixed(1)}%`,
                `${agent.avgResponseTimeMinutes || 0} m`,
                `${resHours} h`,
                `${(agent.slaComplianceRate || 0).toFixed(1)}%`,
            ];

            vals.forEach((v, i) => {
                doc.text(v, x + 4, rowY + 4, { width: W[i] - 8, align: i >= 1 ? 'center' : 'left' });
                x += W[i];
            });

            // Row bottom line
            doc.moveTo(L, rowY + 16).lineTo(L + totalW, rowY + 16).lineWidth(0.3).strokeColor(C.rule).stroke();
            doc.y = rowY + 16;
        });

        // Outer border
        const tableHeight = 19 + (displayed.length * 16);
        doc.rect(L, headerY, totalW, tableHeight).lineWidth(0.5).strokeColor(C.ruleStrong).stroke();
    }

    /**
     * Manager Agent performance table
     */
    private drawManagerAgentTable(
        doc: any,
        perf: Array<{ agentName: string; siteCode: string; totalAssigned: number; resolved: number; avgResolutionHours: number; slaCompliance: number }>
    ): void {
        const L = 36;
        const W = [140, 60, 65, 65, 95, 98];
        const totalW = W.reduce((a, b) => a + b, 0);
        const headers = ['Nama Teknisi', 'Lokasi Site', 'Ditugaskan', 'Selesai', 'Avg Resolusi (Jam)', 'Kepatuhan SLA'];

        const headerY = doc.y;
        doc.rect(L, headerY, totalW, 19).fill(C.headerBg);
        let x = L;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.white);
        headers.forEach((h, i) => {
            doc.text(h, x + 4, headerY + 5.5, { width: W[i] - 8, align: i >= 2 ? 'center' : 'left' });
            x += W[i];
        });

        doc.y = headerY + 19;

        doc.font('Helvetica').fontSize(7.5);
        perf.slice(0, 20).forEach((a, idx) => {
            const rowY = doc.y;
            if (idx % 2 === 0) doc.rect(L, rowY, totalW, 16).fill(C.bgSubtle);

            x = L;
            doc.fillColor(C.text);
            const avgH = Number(a.avgResolutionHours) || 0;
            const sla = Number(a.slaCompliance) || 0;

            const vals = [
                a.agentName.substring(0, 24),
                a.siteCode || '—',
                String(a.totalAssigned || 0),
                String(a.resolved || 0),
                `${avgH.toFixed(1)} jam`,
                `${sla.toFixed(1)}%`,
            ];

            vals.forEach((v, i) => {
                doc.text(v, x + 4, rowY + 4, { width: W[i] - 8, align: i >= 2 ? 'center' : 'left' });
                x += W[i];
            });

            doc.moveTo(L, rowY + 16).lineTo(L + totalW, rowY + 16).lineWidth(0.3).strokeColor(C.rule).stroke();
            doc.y = rowY + 16;
        });

        doc.rect(L, headerY, totalW, 19 + perf.slice(0, 20).length * 16).lineWidth(0.5).strokeColor(C.ruleStrong).stroke();
    }

    /**
     * Site Comparison Table
     */
    private drawSiteComparisonTable(
        doc: any,
        sites: Array<{ siteCode: string; siteName: string; ticketStats: { total: number; created: number; resolved: number }; slaMetrics: { complianceRate: number } }>
    ): void {
        const L = 36;
        const W = [80, 160, 95, 95, 93];
        const totalW = W.reduce((a, b) => a + b, 0);
        const headers = ['Kode Site', 'Nama Lokasi / Unit', 'Total Tiket', 'Tiket Selesai', 'Kepatuhan SLA'];

        const headerY = doc.y;
        doc.rect(L, headerY, totalW, 19).fill(C.headerBg);
        let x = L;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.white);
        headers.forEach((h, i) => {
            doc.text(h, x + 4, headerY + 5.5, { width: W[i] - 8, align: i >= 2 ? 'center' : 'left' });
            x += W[i];
        });

        doc.y = headerY + 19;

        doc.font('Helvetica').fontSize(7.5);
        sites.forEach((s, idx) => {
            const rowY = doc.y;
            if (idx % 2 === 0) doc.rect(L, rowY, totalW, 16).fill(C.bgSubtle);

            x = L;
            doc.fillColor(C.text);
            const vals = [
                s.siteCode,
                s.siteName || s.siteCode,
                String(s.ticketStats?.total || 0),
                String(s.ticketStats?.resolved || 0),
                `${s.slaMetrics?.complianceRate || 0}%`,
            ];

            vals.forEach((v, i) => {
                doc.text(v, x + 4, rowY + 4, { width: W[i] - 8, align: i >= 2 ? 'center' : 'left' });
                x += W[i];
            });

            doc.moveTo(L, rowY + 16).lineTo(L + totalW, rowY + 16).lineWidth(0.3).strokeColor(C.rule).stroke();
            doc.y = rowY + 16;
        });

        doc.rect(L, headerY, totalW, 19 + sites.length * 16).lineWidth(0.5).strokeColor(C.ruleStrong).stroke();
    }

    /**
     * Critical Tickets Table
     */
    private drawCriticalTicketsTable(
        doc: any,
        tickets: Array<{ ticketNumber: string | null; title: string; status: string; createdAt: Date; assignedToName: string | null }>
    ): void {
        const L = 36;
        const W = [90, 200, 75, 78, 80];
        const totalW = W.reduce((a, b) => a + b, 0);
        const headers = ['No. Tiket', 'Judul Masalah / Insiden', 'Status', 'Tanggal Masuk', 'Teknisi'];

        const headerY = doc.y;
        doc.rect(L, headerY, totalW, 19).fill(C.headerBg);
        let x = L;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.white);
        headers.forEach((h, i) => {
            doc.text(h, x + 4, headerY + 5.5, { width: W[i] - 8, align: i === 2 ? 'center' : 'left' });
            x += W[i];
        });

        doc.y = headerY + 19;

        doc.font('Helvetica').fontSize(7);
        tickets.slice(0, 15).forEach((t, idx) => {
            const rowY = doc.y;
            if (idx % 2 === 0) doc.rect(L, rowY, totalW, 15).fill(C.bgSubtle);

            x = L;
            doc.fillColor(C.text);
            const createdStr = t.createdAt instanceof Date
                ? t.createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                : String(t.createdAt || '—');

            const vals = [
                t.ticketNumber || '—',
                t.title.substring(0, 36),
                t.status,
                createdStr,
                t.assignedToName || 'Unassigned',
            ];

            vals.forEach((v, i) => {
                doc.text(v, x + 4, rowY + 4, { width: W[i] - 8, align: i === 2 ? 'center' : 'left' });
                x += W[i];
            });

            doc.moveTo(L, rowY + 15).lineTo(L + totalW, rowY + 15).lineWidth(0.3).strokeColor(C.rule).stroke();
            doc.y = rowY + 15;
        });

        doc.rect(L, headerY, totalW, 19 + tickets.slice(0, 15).length * 15).lineWidth(0.5).strokeColor(C.ruleStrong).stroke();
    }

    /**
     * Key-value summary table
     */
    private drawKeyValueTable(doc: any, rows: { metric: string; value: string }[]): void {
        const L = 36;
        const W = 523;
        const dividerX = L + 270;

        const headerY = doc.y;
        doc.rect(L, headerY, W, 18).fill(C.headerBg);
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.white);
        doc.text('Indikator / Parameter Metrik', L + 8, headerY + 5, { width: 250 });
        doc.text('Nilai Realisasi', dividerX + 8, headerY + 5, { width: W - 280, align: 'right' });
        doc.y = headerY + 18;

        rows.forEach((row, idx) => {
            const rowY = doc.y;
            if (idx % 2 === 0) {
                doc.rect(L, rowY, W, 16.5).fill(C.bgSubtle);
            }

            doc.fontSize(7.5).font('Helvetica').fillColor(C.text)
                .text(row.metric, L + 8, rowY + 4.5, { width: 255 });
            doc.font('Helvetica-Bold')
                .text(row.value, dividerX + 8, rowY + 4.5, { width: W - 286, align: 'right' });

            doc.moveTo(L, rowY + 16.5).lineTo(L + W, rowY + 16.5).lineWidth(0.3).strokeColor(C.rule).stroke();
            doc.y = rowY + 16.5;
        });

        doc.rect(L, headerY, W, 18 + rows.length * 16.5).lineWidth(0.5).strokeColor(C.ruleStrong).stroke();
        doc.fillColor(C.text);
    }

    /**
     * Progress bar with flat container
     */
    private drawProgressBar(doc: any, x: number, y: number, width: number, label: string, value: number, max: number): void {
        const safeVal = isNaN(value) ? 0 : Math.min(Math.max(value, 0), max);
        doc.fontSize(8).font('Helvetica').fillColor(C.text).text(label, x, y);
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.brandNavyDark)
            .text(`${safeVal.toFixed(1)}%`, x + width - 60, y, { width: 60, align: 'right' });

        // Track
        doc.rect(x, y + 14, width, 9).fill(C.bannerBg);
        doc.rect(x, y + 14, width, 9).lineWidth(0.5).strokeColor(C.cardBorder).stroke();

        // Fill
        const fillWidth = (safeVal / max) * width;
        const barColor = safeVal >= 90 ? C.positive : safeVal >= 70 ? C.neutral : C.caution;
        if (fillWidth > 0) {
            doc.rect(x, y + 14, Math.max(fillWidth, 3), 9).fill(barColor);
        }

        doc.fillColor(C.text);
    }

    /**
     * Distribution row with colored pills
     */
    private drawDistributionRow(doc: any, items: { label: string; value: number; total: number; color?: string }[]): void {
        const y = doc.y;
        let curX = 36;

        items.forEach((item) => {
            const pct = item.total > 0 ? ((item.value / item.total) * 100).toFixed(1) : '0.0';
            doc.rect(curX, y, 9, 9).fill(item.color || C.neutral);
            doc.fontSize(7.8).font('Helvetica-Bold').fillColor(C.brandNavyDark)
                .text(` ${item.label}: `, curX + 14, y + 0.5, { continued: true });
            doc.font('Helvetica').fillColor(C.text)
                .text(`${item.value.toLocaleString('id-ID')} `, { continued: true });
            doc.fillColor(C.textMuted).text(`(${pct}%)`);

            curX += 250;
        });

        doc.moveDown(0.4);
        doc.fillColor(C.text);
    }

    /**
     * Daily Volume Chart
     */
    private drawDailyVolumeChart(doc: any, daily: { date: string; created: number; resolved: number }[]): void {
        const chartH = 68;
        const chartW = 523;
        const chartX = 36;
        const chartY = doc.y + 4;

        const maxVal = Math.max(...daily.map(d => Math.max(d.created || 0, d.resolved || 0)), 1);

        // Grid lines
        doc.rect(chartX, chartY, chartW, chartH).fill(C.bgSubtle);
        doc.rect(chartX, chartY, chartW, chartH).lineWidth(0.5).strokeColor(C.ruleStrong).stroke();

        const barW = Math.min(8.5, chartW / (daily.length * 2.5));
        const gap = barW * 0.4;

        daily.slice(-31).forEach((day, i) => {
            const x = chartX + 8 + (i * (barW * 2 + gap));
            const cH = Math.max(0, ((day.created || 0) / maxVal) * (chartH - 12));
            const rH = Math.max(0, ((day.resolved || 0) / maxVal) * (chartH - 12));

            doc.rect(x, chartY + chartH - cH - 2, barW, cH).fill(C.neutral);
            doc.rect(x + barW, chartY + chartH - rH - 2, barW, rH).fill(C.positive);
        });

        // Legend
        doc.y = chartY + chartH + 5;
        doc.rect(chartX + 165, doc.y, 7.5, 7.5).fill(C.neutral);
        doc.fontSize(7).fillColor(C.text).text('Tiket Masuk (Created)', chartX + 176, doc.y + 0.5);
        doc.rect(chartX + 285, doc.y, 7.5, 7.5).fill(C.positive);
        doc.text('Tiket Selesai (Resolved)', chartX + 296, doc.y + 0.5);

        doc.y += 12;
        doc.fillColor(C.text);
    }

    /**
     * Key-value list for breakdown categories
     */
    private drawKeyValueList(doc: any, x: number, y: number, title: string, data?: Record<string, number>): void {
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.brandNavyDark).text(title.toUpperCase(), x, y);
        doc.font('Helvetica').fontSize(7.5).fillColor(C.text);

        let itemY = y + 14;
        const entries = Object.entries(data || {}).slice(0, 6);
        if (entries.length === 0) {
            doc.fillColor(C.textMuted).text('— Tidak ada data', x, itemY);
            return;
        }

        entries.forEach(([key, value]) => {
            doc.fillColor(C.brandBlue).text('•', x, itemY, { continued: true });
            doc.fillColor(C.text).text(` ${key.replace('_', ' ')}: `, { continued: true });
            doc.font('Helvetica-Bold').fillColor(C.brandNavyDark).text(String(value));
            doc.font('Helvetica');
            itemY += 12;
        });
    }

    /**
     * Official Sign-off / Approval Block
     */
    private drawSignOffSection(doc: any, preparedBy: string, approvedBy: string): void {
        const startX = 36;
        const width = 523;
        const boxH = 62;
        // Anchor to bottom (y = 675) if there's enough space on page, avoiding empty white void
        const y = doc.y < 675 && doc.y > 400 ? 675 : doc.y + 10;

        // Container
        doc.rect(startX, y, width, boxH).fill(C.cardFill);
        doc.rect(startX, y, width, boxH).lineWidth(0.5).strokeColor(C.cardBorder).stroke();

        const halfW = width / 2;
        doc.moveTo(startX + halfW, y).lineTo(startX + halfW, y + boxH).lineWidth(0.5).strokeColor(C.rule).stroke();

        // Left: Disiapkan oleh
        const leftX = startX + 14;
        doc.fontSize(6.8).font('Helvetica-Bold').fillColor(C.textMuted).text('DISIAPKAN OLEH:', leftX, y + 6);
        doc.moveTo(leftX, y + 42).lineTo(leftX + 160, y + 42).lineWidth(0.5).strokeColor(C.ruleStrong).stroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.brandNavyDark).text(preparedBy, leftX, y + 45);
        doc.fontSize(6.5).font('Helvetica').fillColor(C.textMuted).text('IT Service Desk Operations', leftX, y + 53);

        // Right: Disetujui oleh
        const rightX = startX + halfW + 14;
        doc.fontSize(6.8).font('Helvetica-Bold').fillColor(C.textMuted).text('DIKETAHUI / DISETUJUI OLEH:', rightX, y + 6);
        doc.moveTo(rightX, y + 42).lineTo(rightX + 160, y + 42).lineWidth(0.5).strokeColor(C.ruleStrong).stroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.brandNavyDark).text(approvedBy, rightX, y + 45);
        doc.fontSize(6.5).font('Helvetica').fillColor(C.textMuted).text('Head of ICT / IT Management', rightX, y + 53);

        doc.y = y + boxH + 8;
        doc.fillColor(C.text);
    }

    /**
     * Footer — Page numbers & Confidential notice
     * Margin bottom is temporarily set to 0 during drawing to strictly prevent auto page-breaking.
     */
    private drawFooter(doc: any): void {
        const pages = doc.bufferedPageRange();
        const start = pages.start ?? 0;
        const count = pages.count ?? 1;

        for (let i = 0; i < count; i++) {
            doc.switchToPage(start + i);
            const savedBottom = doc.page.margins.bottom;
            doc.page.margins.bottom = 0;

            doc.moveTo(36, 788).lineTo(559, 788).lineWidth(0.5).strokeColor(C.rule).stroke();

            doc.fontSize(6.5).fillColor(C.textMuted).font('Helvetica')
                .text('PT Santos Jaya Abadi  •  iDesk Enterprise Helpdesk System  •  Dokumen Internal Rahasia', 36, 792, { lineBreak: false });

            doc.text(`Halaman ${i + 1} dari ${count}`, 230, 792, { align: 'center', width: 135, lineBreak: false });

            doc.text(
                new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
                410, 792, { align: 'right', width: 149, lineBreak: false }
            );

            doc.page.margins.bottom = savedBottom;
        }
    }

    private formatDateRangeSubtitle(dateRange?: { startDate: Date; endDate: Date }): string {
        if (!dateRange) return `Per Tanggal: ${new Date().toLocaleDateString('id-ID')}`;
        const s = dateRange.startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const e = dateRange.endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        return `Periode: ${s} — ${e}`;
    }
}
