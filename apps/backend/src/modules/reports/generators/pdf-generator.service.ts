import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AgentMetrics } from './agent-performance.report';
import { TicketVolumeData } from './ticket-volume.report';
import { generateExecutiveInsights } from '../utils/executive-insights.util';
import {
    BarRow,
    Cell,
    INK,
    PAGE,
    ReportCanvas,
    categoryRows,
    fmtDateShort,
    fmtHours,
    fmtInt,
    fmtMinutes,
    fmtPct,
    fmtPeriod,
    priorityRows,
    statusLabel,
    statusRows,
    toneForRate,
} from './report-pdf-canvas';

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

export interface ManagerReportPdfData {
    period: string;
    sites: string[];
    team?: string;
    sections: string[];
    ticketStats?: { total: number; byPriority: Record<string, number>; byStatus: Record<string, number>; byCategory?: Record<string, number>; created: number; resolved: number };
    agentPerformance?: Array<{ agentName: string; siteCode: string; totalAssigned: number; resolved: number; avgResolutionHours: number; slaCompliance: number }>;
    slaMetrics?: { totalTickets: number; onTime: number; breached: number; complianceRate: number; avgResponseTimeMinutes: number; avgResolutionTimeHours: number };
    trends?: Array<{ date: string; created: number; resolved: number }>;
    criticalTickets?: Array<{ id?: string; ticketNumber: string | null; title: string; status: string; createdAt: Date; assignedToName: string | null }>;
    summary?: { totalTickets: number; resolvedTickets: number; slaComplianceRate: number; siteCount: number; agentCount: number };
    siteComparison?: Array<{ siteCode: string; siteName: string; ticketStats: { total: number; created: number; resolved: number }; slaMetrics: { complianceRate: number } }>;
}

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const rateCell = (rate: number, good = 90, warn = 75): Cell => {
    const tone = toneForRate(rate, good, warn);
    return { text: fmtPct(rate), bold: true, color: tone === 'good' ? INK.green : tone === 'warn' ? INK.amber : INK.red };
};
/** "Rm Bagastyo Anggoro" -> "Rm Bagastyo": a short honorific alone would not identify anyone. */
const shortName = (name?: string) => {
    const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '-';
    return words[0].replace(/\./g, '').length <= 3 && words[1] ? `${words[0]} ${words[1]}` : words[0];
};
const shortDocId = () => Date.now().toString().slice(-6);

/**
 * Executive report PDFs (PT Santos Jaya Abadi / iDesk). Each report reads top-down the way a manager scans it:
 * the four numbers that matter, the main points in plain sentences, then visual breakdowns and detail tables.
 * Drawing primitives live in report-pdf-canvas.ts.
 */
@Injectable()
export class PDFGeneratorService {
    private readonly logger = new Logger(PDFGeneratorService.name);

    private open(res: Response, filename?: string): { doc: any; canvas: ReportCanvas } {
        const doc = new PDFDocument({ margin: PAGE.margin, size: 'A4', bufferPages: true, info: { Producer: 'iDesk', Creator: 'iDesk IT Helpdesk' } });
        if (filename) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        }
        doc.pipe(res);
        return { doc, canvas: new ReportCanvas(doc, this.logger) };
    }

    private close(doc: any, canvas: ReportCanvas): void {
        canvas.finish();
        doc.end();
    }

    async generateMonthlySummaryPDF(
        res: Response,
        stats: { month: number; year: number; totalTickets: number; resolvedTickets: number; openTickets: number; avgResolutionTimeHours: string | number },
        options: PDFReportOptions,
    ): Promise<void> {
        const { doc, canvas } = this.open(res, `monthly-report-${stats.month}-${stats.year}.pdf`);
        const monthName = MONTH_NAMES[stats.month - 1] || `Bulan ${stats.month}`;
        const total = Number(stats.totalTickets) || 0;
        const resolved = Number(stats.resolvedTickets) || 0;
        const open = Number(stats.openTickets) || Math.max(0, total - resolved);
        const avgHours = Number.parseFloat(String(stats.avgResolutionTimeHours)) || 0;
        const rate = total > 0 ? (resolved / total) * 100 : 0;

        canvas.header({
            title: 'Laporan Ringkasan Bulanan',
            period: `${monthName} ${stats.year}`,
            scope: options.siteName || 'Seluruh site PT Santos Jaya Abadi',
            docNo: options.docNo || `REP-MTH-${stats.year}${String(stats.month).padStart(2, '0')}`,
        });
        canvas.kpis([
            { label: 'Total tiket', value: fmtInt(total), note: `${monthName} ${stats.year}` },
            { label: 'Selesai', value: fmtInt(resolved), note: `${fmtPct(rate)} dari total`, tone: toneForRate(rate) },
            { label: 'Masih terbuka', value: fmtInt(open), note: open > 0 ? 'Perlu ditindaklanjuti' : 'Tidak ada antrean', tone: open > 0 ? 'warn' : 'good' },
            { label: 'Rata-rata penyelesaian', value: fmtHours(avgHours), note: 'per tiket' },
        ]);
        canvas.highlights(generateExecutiveInsights({
            periodLabel: `${monthName} ${stats.year}`, totalTickets: total, resolvedTickets: resolved, openTickets: open,
            resolutionRate: rate, avgResolutionTimeHours: avgHours,
        }));

        canvas.section('Komposisi tiket');
        canvas.barGroups([{ title: 'Status akhir bulan', rows: [
            { label: 'Selesai', value: resolved, color: INK.green },
            { label: 'Masih terbuka', value: open, color: INK.amber },
        ] }]);

        canvas.section('Ringkasan metrik');
        canvas.table(
            [{ header: 'Metrik', width: 3 }, { header: 'Nilai', width: 2, align: 'right' }],
            [
                [{ text: 'Periode laporan' }, { text: `${monthName} ${stats.year}`, bold: true }],
                [{ text: 'Tiket masuk' }, { text: `${fmtInt(total)} tiket`, bold: true }],
                [{ text: 'Tiket selesai' }, { text: `${fmtInt(resolved)} tiket`, bold: true }],
                [{ text: 'Tiket masih terbuka' }, { text: `${fmtInt(open)} tiket`, bold: true }],
                [{ text: 'Tingkat penyelesaian' }, rateCell(rate)],
                [{ text: 'Rata-rata waktu penyelesaian' }, { text: fmtHours(avgHours), bold: true }],
                [{ text: 'Penilaian' }, {
                    text: rate >= 90 ? 'Sangat baik' : rate >= 75 ? 'Baik, stabil' : 'Perlu perhatian', bold: true,
                    color: rate >= 90 ? INK.green : rate >= 75 ? INK.brand : INK.red,
                }],
            ],
        );

        canvas.signOff(options.author || 'IT Service Desk', 'IT Operations Manager');
        this.close(doc, canvas);
    }

    async generateAgentPerformancePDF(res: Response, metrics: AgentMetrics[], options: PDFReportOptions): Promise<void> {
        const { doc, canvas } = this.open(res, `agent-performance-${Date.now()}.pdf`);
        const agents = [...metrics].sort((a, b) => (Number(b.totalResolved) || 0) - (Number(a.totalResolved) || 0));
        const assigned = agents.reduce((sum, m) => sum + (Number(m.totalAssigned) || 0), 0);
        const resolved = agents.reduce((sum, m) => sum + (Number(m.totalResolved) || 0), 0);
        const avg = (pick: (m: AgentMetrics) => number) => (agents.length ? agents.reduce((s, m) => s + (Number(pick(m)) || 0), 0) / agents.length : 0);
        const avgRate = avg((m) => m.resolutionRate);
        const avgSla = avg((m) => m.slaComplianceRate);
        const best = agents.reduce<AgentMetrics | null>((top, m) => (!top || (m.resolutionRate || 0) > (top.resolutionRate || 0) ? m : top), null);

        canvas.header({
            title: 'Laporan Kinerja Teknisi',
            period: fmtPeriod(options.dateRange),
            scope: options.siteName || 'Semua site',
            docNo: options.docNo || `REP-AGT-${shortDocId()}`,
        });
        canvas.kpis([
            { label: 'Teknisi dievaluasi', value: fmtInt(agents.length), note: `${fmtInt(assigned)} tiket ditugaskan` },
            { label: 'Rata-rata penyelesaian', value: fmtPct(avgRate), note: `${fmtInt(resolved)} tiket selesai`, tone: toneForRate(avgRate) },
            { label: 'Kepatuhan SLA', value: fmtPct(avgSla), note: avgSla >= 90 ? 'Sesuai target' : 'Di bawah target 90%', tone: toneForRate(avgSla) },
            { label: 'Kinerja terbaik', value: shortName(best?.agentName), note: best ? `${fmtPct(best.resolutionRate || 0)} selesai` : undefined },
        ]);
        canvas.highlights(generateExecutiveInsights({
            totalTickets: assigned, resolvedTickets: resolved, resolutionRate: avgRate, slaComplianceRate: avgSla, agentCount: agents.length,
            topPerformer: best ? { name: best.agentName, resolutionRate: best.resolutionRate, count: best.totalResolved } : undefined,
        }));

        canvas.section('Kinerja per teknisi', 'Urut dari tiket selesai terbanyak. Respon = waktu respon awal, Durasi = rata-rata waktu penyelesaian.');
        canvas.table(
            [
                { header: 'Teknisi', width: 3.2 }, { header: 'Tugas', width: 0.9, align: 'right' }, { header: 'Selesai', width: 0.95, align: 'right' },
                { header: '% Selesai', width: 1.1, align: 'right' }, { header: 'Respon', width: 1, align: 'right' },
                { header: 'Durasi', width: 1, align: 'right' }, { header: 'SLA', width: 0.9, align: 'right' },
            ],
            agents.map((m) => [
                { text: m.agentName, bold: true },
                { text: fmtInt(m.totalAssigned) },
                { text: fmtInt(m.totalResolved) },
                rateCell(Number(m.resolutionRate) || 0),
                { text: fmtMinutes(m.avgResponseTimeMinutes) },
                { text: fmtMinutes(m.avgResolutionTimeMinutes) },
                rateCell(Number(m.slaComplianceRate) || 0),
            ]),
        );

        canvas.signOff(options.author || 'IT Service Lead', 'Head of ICT');
        this.close(doc, canvas);
    }

    async generateTicketVolumePDF(res: Response, volumeData: TicketVolumeData, options: PDFReportOptions): Promise<void> {
        const { doc, canvas } = this.open(res, `ticket-volume-${Date.now()}.pdf`);
        const { summary } = volumeData;
        const created = Number(summary.totalCreated) || 0;
        const resolved = Number(summary.totalResolved) || 0;
        const pending = Number(summary.totalPending) || 0;
        const rate = created > 0 ? (resolved / created) * 100 : 0;

        canvas.header({
            title: 'Laporan Volume & Distribusi Tiket',
            period: fmtPeriod(options.dateRange),
            scope: options.siteName || 'Semua site',
            docNo: options.docNo || `REP-VOL-${shortDocId()}`,
        });
        canvas.kpis([
            { label: 'Tiket masuk', value: fmtInt(created), note: 'Selama periode' },
            { label: 'Terselesaikan', value: fmtInt(resolved), note: `${fmtPct(rate)} dari masuk`, tone: toneForRate(rate) },
            { label: 'Masih berjalan', value: fmtInt(pending), note: pending > 0 ? 'Perlu dipantau' : 'Tidak ada antrean', tone: pending > 0 ? 'warn' : 'good' },
            { label: 'Rata-rata per hari', value: (Number(summary.avgPerDay) || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 }),
                note: summary.peakCount ? `Puncak ${fmtInt(summary.peakCount)} tiket (${summary.peakDay})` : undefined },
        ]);
        canvas.highlights(generateExecutiveInsights({
            totalTickets: created, resolvedTickets: resolved, openTickets: pending, resolutionRate: rate,
            byPriority: volumeData.byPriority, byCategory: volumeData.byCategory,
        }));

        if (volumeData.daily?.length) {
            canvas.section('Tren harian', 'Tiket masuk dibanding tiket selesai per hari.');
            canvas.dailyChart(volumeData.daily);
        }
        canvas.section('Distribusi tiket');
        canvas.barGroups([
            { title: 'Kategori', rows: categoryRows(volumeData.byCategory) },
            { title: 'Prioritas', rows: priorityRows(volumeData.byPriority) },
            { title: 'Status', rows: statusRows(volumeData.byStatus) },
        ]);

        canvas.signOff(options.author || 'IT Service Lead', 'IT Operations Manager');
        this.close(doc, canvas);
    }

    /** Headers are set by the caller (manager export decides the file name). */
    async generateManagerReportPDF(res: Response, report: ManagerReportPdfData, options: PDFReportOptions): Promise<void> {
        const { doc, canvas } = this.open(res);
        const summary = report.summary || {
            totalTickets: report.ticketStats?.total || 0,
            resolvedTickets: report.ticketStats?.resolved || 0,
            slaComplianceRate: report.slaMetrics?.complianceRate || 0,
            siteCount: report.sites?.length || 1,
            agentCount: report.agentPerformance?.length || 0,
        };
        const rate = summary.totalTickets > 0 ? (summary.resolvedTickets / summary.totalTickets) * 100 : 0;
        const sla = Number(summary.slaComplianceRate) || 0;
        const agents = [...(report.agentPerformance ?? [])].sort((a, b) => (b.resolved || 0) - (a.resolved || 0));
        const sites = report.sites?.length ? report.sites.join(', ') : 'Seluruh site';

        canvas.header({
            title: 'Laporan Manajemen Layanan IT',
            period: fmtPeriod(report.period),
            scope: report.team ? `${sites} — ${report.team}` : sites,
            docNo: options.docNo || `REP-MGR-${shortDocId()}`,
        });
        canvas.kpis([
            { label: 'Total tiket', value: fmtInt(summary.totalTickets), note: `${fmtInt(summary.siteCount)} site` },
            { label: 'Terselesaikan', value: fmtInt(summary.resolvedTickets), note: `${fmtPct(rate)} dari total`, tone: toneForRate(rate) },
            { label: 'Kepatuhan SLA', value: fmtPct(sla), note: sla >= 90 ? 'Sesuai target' : 'Di bawah target 90%', tone: toneForRate(sla) },
            { label: 'Tim', value: `${fmtInt(summary.agentCount)} teknisi`, note: `di ${fmtInt(summary.siteCount)} site` },
        ]);
        canvas.highlights(generateExecutiveInsights({
            periodLabel: report.period, totalTickets: summary.totalTickets, resolvedTickets: summary.resolvedTickets, resolutionRate: rate,
            slaComplianceRate: sla, breachedTickets: report.slaMetrics?.breached, avgResolutionTimeHours: report.slaMetrics?.avgResolutionTimeHours,
            byPriority: report.ticketStats?.byPriority, byCategory: report.ticketStats?.byCategory,
            topPerformer: agents[0] ? { name: agents[0].agentName, count: agents[0].resolved } : undefined,
            siteCount: summary.siteCount, agentCount: summary.agentCount,
        }));

        if (report.trends?.length) {
            canvas.section('Tren harian', 'Tiket masuk dibanding tiket selesai per hari.');
            canvas.dailyChart(report.trends);
        }
        if (report.ticketStats) {
            const groups: { title: string; rows: BarRow[] }[] = [
                { title: 'Prioritas', rows: priorityRows(report.ticketStats.byPriority) },
                { title: 'Status', rows: statusRows(report.ticketStats.byStatus) },
            ];
            if (report.ticketStats.byCategory && Object.keys(report.ticketStats.byCategory).length) {
                groups.unshift({ title: 'Kategori', rows: categoryRows(report.ticketStats.byCategory) });
            }
            canvas.section('Distribusi tiket');
            canvas.barGroups(groups);
        }
        if (report.slaMetrics) {
            const m = report.slaMetrics;
            const compliance = Number(m.complianceRate) || 0;
            canvas.section('Kinerja SLA', 'Dihitung dari tiket yang selesai pada periode ini.');
            canvas.miniStats([
                { label: 'Kepatuhan SLA', value: fmtPct(compliance), tone: toneForRate(compliance) },
                { label: 'Selesai tepat waktu', value: `${fmtInt(m.onTime)} tiket`, tone: 'good' },
                { label: 'Melewati SLA', value: `${fmtInt(m.breached)} tiket`, tone: m.breached > 0 ? 'bad' : 'good' },
                { label: 'Tiket dievaluasi', value: `${fmtInt(m.totalTickets)} tiket` },
                { label: 'Rata-rata respon awal', value: fmtMinutes(m.avgResponseTimeMinutes) },
                { label: 'Rata-rata penyelesaian', value: fmtHours(m.avgResolutionTimeHours) },
            ]);
        }
        if (agents.length) {
            canvas.section('Kinerja teknisi', 'Diurutkan dari tiket selesai terbanyak.');
            canvas.table(
                [
                    { header: 'Teknisi', width: 2.8 }, { header: 'Site', width: 0.8 }, { header: 'Ditugaskan', width: 1.1, align: 'right' },
                    { header: 'Selesai', width: 1, align: 'right' }, { header: 'Rata-rata selesai', width: 1.5, align: 'right' }, { header: 'SLA', width: 1, align: 'right' },
                ],
                agents.map((a) => [
                    { text: a.agentName, bold: true }, { text: a.siteCode || '-' }, { text: fmtInt(a.totalAssigned) }, { text: fmtInt(a.resolved) },
                    { text: fmtHours(a.avgResolutionHours) }, rateCell(Number(a.slaCompliance) || 0),
                ]),
            );
        }
        if (report.siteComparison?.length) {
            canvas.section('Perbandingan site');
            canvas.table(
                [
                    { header: 'Site', width: 0.8 }, { header: 'Lokasi', width: 2.2 }, { header: 'Tiket', width: 1, align: 'right' },
                    { header: 'Selesai', width: 1, align: 'right' }, { header: 'Penyelesaian', width: 1.3, align: 'right' }, { header: 'SLA', width: 1, align: 'right' },
                ],
                report.siteComparison.map((s) => {
                    const total = s.ticketStats?.total || 0;
                    const done = s.ticketStats?.resolved || 0;
                    return [
                        { text: s.siteCode, bold: true }, { text: s.siteName || s.siteCode }, { text: fmtInt(total) }, { text: fmtInt(done) },
                        rateCell(total > 0 ? (done / total) * 100 : 0), rateCell(Number(s.slaMetrics?.complianceRate) || 0),
                    ];
                }),
            );
        }
        if (report.criticalTickets?.length) {
            canvas.section('Tiket prioritas tinggi', 'Tiket Blocker dan Urgent pada periode ini.');
            canvas.table(
                [
                    { header: 'No. tiket', width: 1.6 }, { header: 'Judul', width: 3.2 }, { header: 'Status', width: 1.3 },
                    { header: 'Masuk', width: 1 }, { header: 'PIC', width: 1.8 },
                ],
                report.criticalTickets.slice(0, 25).map((t) => [
                    { text: t.ticketNumber || '-', bold: true }, { text: t.title }, { text: statusLabel(t.status) },
                    { text: t.createdAt ? fmtDateShort(new Date(t.createdAt)) : '-' },
                    { text: t.assignedToName || 'Belum ditugaskan', color: t.assignedToName ? undefined : INK.amber },
                ]),
            );
        }

        canvas.signOff(options.author || 'IT Service Desk', 'IT Manager / Department Head');
        this.close(doc, canvas);
    }
}
