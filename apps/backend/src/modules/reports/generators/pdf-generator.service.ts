import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AgentMetrics } from './agent-performance.report';
import { TicketVolumeData } from './ticket-volume.report';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

export interface PDFReportOptions {
    title: string;
    subtitle?: string;
    dateRange?: { startDate: Date; endDate: Date };
    author?: string;
}

// ─── INDUSTRIAL UTILITARIAN PALETTE ──────────────────────────
// Deliberately restrained. No saturated brand colors.
// Reads like a printed corporate document, not an app screenshot.
const C = {
    // Structural grays
    black: '#111827',          // Gray-900 — headings, emphasis
    text: '#374151',           // Gray-700 — body text
    textMuted: '#6B7280',      // Gray-500 — secondary text
    textFaint: '#9CA3AF',      // Gray-400 — captions, metadata
    rule: '#D1D5DB',           // Gray-300 — lines, borders
    bgSubtle: '#F3F4F6',       // Gray-100 — alt rows, card fills
    white: '#FFFFFF',

    // Header — dark neutral, not brand-colored
    headerBg: '#1F2937',       // Gray-800
    headerAccent: '#D1D5DB',   // Gray-300 — subtle rule inside header

    // Semantic — muted, print-friendly
    positive: '#059669',       // Emerald-600
    caution: '#D97706',        // Amber-600
    critical: '#DC2626',       // Red-600
    neutral: '#2563EB',        // Blue-600

    // Cards — no saturated fills; use border + icon approach
    cardBorder: '#D1D5DB',
    cardBg: '#F9FAFB',        // Gray-50
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * PDF Report Generator Service
 * Industrial Utilitarian design — muted, dense, professional
 */
@Injectable()
export class PDFGeneratorService {
    private readonly logger = new Logger(PDFGeneratorService.name);

    /**
     * Generate Agent Performance PDF Report
     */
    async generateAgentPerformancePDF(
        res: Response,
        metrics: AgentMetrics[],
        options: PDFReportOptions,
    ): Promise<void> {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=agent-performance-${Date.now()}.pdf`,
        );

        doc.pipe(res);

        this.drawHeader(doc, options);

        // Summary metrics — flat key-value row
        const totalAgents = metrics.length;
        const avgResolutionRate = metrics.length > 0
            ? metrics.reduce((sum, m) => sum + m.resolutionRate, 0) / metrics.length
            : 0;
        const avgSLA = metrics.length > 0
            ? metrics.reduce((sum, m) => sum + m.slaComplianceRate, 0) / metrics.length
            : 0;
        const bestAgent = metrics.length > 0
            ? metrics.reduce((best, m) => m.resolutionRate > best.resolutionRate ? m : best, metrics[0])
            : null;

        const metricsY = doc.y + 8;
        this.drawMetricStrip(doc, metricsY, [
            { label: 'AGENTS', value: String(totalAgents) },
            { label: 'AVG RESOLUTION', value: `${avgResolutionRate.toFixed(1)}%` },
            { label: 'AVG SLA', value: `${avgSLA.toFixed(1)}%` },
            { label: 'TOP PERFORMER', value: bestAgent?.agentName?.split(' ')[0] || '—' },
        ]);

        doc.y = metricsY + 52;

        // Agent table
        this.drawSectionLabel(doc, 'Agent Performance Details');
        this.drawAgentTable(doc, metrics);

        // Bar chart
        if (metrics.length > 0 && metrics.length <= 10) {
            doc.moveDown(1);
            this.drawSectionLabel(doc, 'Resolution Rate Comparison');
            this.drawBarChart(doc,
                metrics.map(m => ({ label: m.agentName.substring(0, 14), value: m.resolutionRate, max: 100 })),
            );
        }

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
        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=ticket-volume-${Date.now()}.pdf`,
        );

        doc.pipe(res);

        this.drawHeader(doc, options);

        // Metric strip
        const metricsY = doc.y + 8;
        this.drawMetricStrip(doc, metricsY, [
            { label: 'CREATED', value: String(volumeData.summary.totalCreated) },
            { label: 'RESOLVED', value: String(volumeData.summary.totalResolved) },
            { label: 'PENDING', value: String(volumeData.summary.totalPending) },
            { label: 'AVG / DAY', value: String(volumeData.summary.avgPerDay) },
        ]);

        doc.y = metricsY + 52;

        // Daily chart
        if (volumeData.daily.length > 0) {
            this.drawSectionLabel(doc, 'Daily Ticket Volume');
            this.drawDailyVolumeChart(doc, volumeData.daily);
        }

        // Breakdown columns
        doc.moveDown(1);
        const infoY = doc.y;
        this.drawKeyValueList(doc, 40, infoY, 'By Priority', volumeData.byPriority);
        this.drawKeyValueList(doc, 210, infoY, 'By Status', volumeData.byStatus);
        this.drawKeyValueList(doc, 380, infoY, 'By Category', volumeData.byCategory);

        this.drawFooter(doc);
        doc.end();
    }

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
        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=monthly-report-${stats.month}-${stats.year}.pdf`,
        );

        doc.pipe(res);

        this.drawHeader(doc, {
            ...options,
            title: `Monthly Summary Report`,
            subtitle: `${MONTH_NAMES[stats.month - 1]} ${stats.year}`,
        });

        const totalTickets = Number(stats.totalTickets) || 0;
        const resolvedTickets = Number(stats.resolvedTickets) || 0;
        const openTickets = Number(stats.openTickets) || 0;
        const avgHours = parseFloat(String(stats.avgResolutionTimeHours)) || 0;

        // Metric strip
        const metricsY = doc.y + 8;
        this.drawMetricStrip(doc, metricsY, [
            { label: 'TOTAL TICKETS', value: String(totalTickets) },
            { label: 'RESOLVED', value: String(resolvedTickets) },
            { label: 'OPEN', value: String(openTickets) },
            { label: 'AVG RESOLUTION', value: `${avgHours.toFixed(1)}h` },
        ]);

        doc.y = metricsY + 60;

        // Resolution rate bar
        const resolutionRate = totalTickets > 0 ? ((resolvedTickets / totalTickets) * 100) : 0;
        this.drawSectionLabel(doc, 'Performance Overview');
        this.drawProgressBar(doc, 40, doc.y + 5, 515, 'Resolution Rate', resolutionRate, 100);
        doc.y += 50;

        // Distribution
        this.drawSectionLabel(doc, 'Ticket Distribution');
        this.drawDistributionRow(doc, [
            { label: 'Resolved', value: resolvedTickets, total: totalTickets },
            { label: 'Open', value: openTickets, total: totalTickets },
        ]);

        // Summary table
        doc.y += 20;
        this.drawSectionLabel(doc, 'Summary Statistics');
        this.drawKeyValueTable(doc, [
            { metric: 'Report Period', value: `${MONTH_NAMES[stats.month - 1]} ${stats.year}` },
            { metric: 'Total Tickets Created', value: String(totalTickets) },
            { metric: 'Tickets Resolved', value: String(resolvedTickets) },
            { metric: 'Tickets Still Open', value: String(openTickets) },
            { metric: 'Resolution Rate', value: `${resolutionRate.toFixed(1)}%` },
            { metric: 'Average Resolution Time', value: `${avgHours.toFixed(2)} hours` },
        ]);

        this.drawFooter(doc);
        doc.end();
    }

    // ═══════════════════════════════════════════════════════════
    // PRIMITIVE DRAWING METHODS
    // ═══════════════════════════════════════════════════════════

    /**
     * Header — dark neutral bar, not brand-colored
     */
    private drawHeader(doc: any, options: PDFReportOptions): void {
        // Dark header band
        doc.rect(0, 0, 612, 72).fill(C.headerBg);

        // Thin accent rule at bottom of header
        doc.rect(0, 72, 612, 1).fill(C.rule);

        // Left: Company identity
        doc.fontSize(16).font('Helvetica-Bold').fillColor(C.white)
            .text('iDesk', 40, 22);
        doc.fontSize(8).font('Helvetica').fillColor(C.headerAccent)
            .text('ENTERPRISE HELPDESK', 40, 42);

        // Right: Report title
        doc.fontSize(13).font('Helvetica-Bold').fillColor(C.white)
            .text(options.title, 240, 22, { align: 'right', width: 310 });

        if (options.subtitle) {
            doc.fontSize(9).font('Helvetica').fillColor(C.headerAccent)
                .text(options.subtitle, 240, 40, { align: 'right', width: 310 });
        }

        // Date info — small, right-aligned
        if (options.dateRange) {
            const s = options.dateRange.startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            const e = options.dateRange.endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            doc.fontSize(8).fillColor(C.textFaint)
                .text(`Period: ${s} — ${e}`, 240, 54, { align: 'right', width: 310 });
        } else {
            doc.fontSize(8).fillColor(C.textFaint)
                .text(`Generated: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 240, 54, { align: 'right', width: 310 });
        }

        doc.fillColor(C.text);
        doc.y = 84;
    }

    /**
     * Metric strip — horizontal row of key figures, no colored fills
     */
    private drawMetricStrip(doc: any, y: number, items: { label: string; value: string }[]): void {
        const totalWidth = 515;
        const itemWidth = totalWidth / items.length;

        // Light background band
        doc.rect(40, y, totalWidth, 42).fill(C.cardBg);
        doc.rect(40, y, totalWidth, 42).strokeColor(C.rule).stroke();

        items.forEach((item, i) => {
            const x = 40 + (i * itemWidth);

            // Vertical divider (except first)
            if (i > 0) {
                doc.moveTo(x, y + 6).lineTo(x, y + 36).strokeColor(C.rule).stroke();
            }

            // Label — uppercase, tiny
            doc.fontSize(7).font('Helvetica').fillColor(C.textFaint)
                .text(item.label, x + 12, y + 8, { width: itemWidth - 24 });

            // Value — large
            doc.fontSize(16).font('Helvetica-Bold').fillColor(C.black)
                .text(item.value, x + 12, y + 20, { width: itemWidth - 24 });
        });

        doc.fillColor(C.text);
    }

    /**
     * Section label — thin rule with uppercase label
     */
    private drawSectionLabel(doc: any, title: string): void {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.black)
            .text(title.toUpperCase(), 40);
        doc.moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).lineWidth(0.5).strokeColor(C.rule).stroke();
        doc.moveDown(0.4);
        doc.fillColor(C.text);
    }

    /**
     * Agent performance table — clean grid, no colored header
     */
    private drawAgentTable(doc: any, metrics: AgentMetrics[]): void {
        const L = 40;
        const W = [120, 52, 52, 60, 80, 80, 71];
        const totalW = W.reduce((a, b) => a + b, 0);
        const headers = ['Agent', 'Assgn', 'Rslvd', 'Rate %', 'Avg Resp (m)', 'Avg Res (m)', 'SLA %'];

        // Header row — dark bg
        const headerY = doc.y;
        doc.rect(L, headerY, totalW, 20).fill(C.headerBg);
        let x = L;
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white);
        headers.forEach((h, i) => {
            doc.text(h, x + 4, headerY + 6, { width: W[i] - 8 });
            x += W[i];
        });

        // Header vertical separators
        x = L;
        W.forEach(w => {
            x += w;
            if (x < L + totalW) {
                doc.moveTo(x, headerY).lineTo(x, headerY + 20).lineWidth(0.3).strokeColor(C.headerAccent).stroke();
            }
        });

        doc.y = headerY + 20;

        // Data rows
        doc.font('Helvetica').fontSize(8);
        const displayed = metrics.slice(0, 15);
        displayed.forEach((agent, idx) => {
            const rowY = doc.y;
            if (idx % 2 === 0) {
                doc.rect(L, rowY, totalW, 16).fill(C.bgSubtle);
            }

            x = L;
            doc.fillColor(C.text);
            const vals = [
                agent.agentName.substring(0, 18),
                String(agent.totalAssigned),
                String(agent.totalResolved),
                `${agent.resolutionRate.toFixed(1)}%`,
                String(agent.avgResponseTimeMinutes),
                String(agent.avgResolutionTimeMinutes ?? '—'),
                `${agent.slaComplianceRate.toFixed(1)}%`,
            ];
            vals.forEach((v, i) => {
                doc.text(v, x + 4, rowY + 4, { width: W[i] - 8 });
                x += W[i];
            });

            // Row bottom line
            doc.moveTo(L, rowY + 16).lineTo(L + totalW, rowY + 16).lineWidth(0.3).strokeColor(C.rule).stroke();

            // Vertical separators
            x = L;
            W.forEach(w => {
                x += w;
                if (x < L + totalW) {
                    doc.moveTo(x, rowY).lineTo(x, rowY + 16).lineWidth(0.3).strokeColor(C.rule).stroke();
                }
            });

            doc.y = rowY + 16;
        });

        // Outer border
        const tableTop = headerY;
        const tableHeight = 20 + (displayed.length * 16);
        doc.rect(L, tableTop, totalW, tableHeight).lineWidth(0.5).strokeColor(C.rule).stroke();
    }

    /**
     * Horizontal bar chart — monochrome with value labels
     */
    private drawBarChart(doc: any, data: { label: string; value: number; max: number }[]): void {
        const barColor = C.text;         // Dark neutral bars
        const trackColor = C.bgSubtle;

        data.slice(0, 8).forEach((item) => {
            const barWidth = (item.value / item.max) * 340;

            doc.fontSize(8).font('Helvetica').fillColor(C.text)
                .text(item.label, 40, doc.y, { width: 95 });

            doc.rect(142, doc.y - 1, 340, 12).fill(trackColor);
            doc.rect(142, doc.y - 1, barWidth, 12).fill(barColor);

            doc.fontSize(7).fillColor(C.textMuted)
                .text(`${item.value.toFixed(1)}%`, 490, doc.y, { width: 50 });

            doc.y += 16;
        });
        doc.fillColor(C.text);
    }

    /**
     * Daily volume chart — paired bars
     */
    private drawDailyVolumeChart(doc: any, daily: { date: string; created: number; resolved: number }[]): void {
        const chartH = 75;
        const chartW = 515;
        const chartX = 40;
        const chartY = doc.y + 8;

        const maxVal = Math.max(...daily.map(d => Math.max(d.created, d.resolved)), 1);

        // Axes
        doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartH).lineWidth(0.5).strokeColor(C.rule).stroke();
        doc.moveTo(chartX, chartY + chartH).lineTo(chartX + chartW, chartY + chartH).stroke();

        const barW = Math.min(10, chartW / (daily.length * 2.5));
        const gap = barW * 0.4;

        daily.slice(-31).forEach((day, i) => {
            const x = chartX + 8 + (i * (barW * 2 + gap));
            const cH = (day.created / maxVal) * (chartH - 8);
            const rH = (day.resolved / maxVal) * (chartH - 8);

            doc.rect(x, chartY + chartH - cH, barW, cH).fill(C.text);
            doc.rect(x + barW, chartY + chartH - rH, barW, rH).fill(C.textMuted);
        });

        // Legend
        doc.y = chartY + chartH + 8;
        doc.rect(chartX + 200, doc.y, 8, 8).fill(C.text);
        doc.fontSize(7).fillColor(C.text).text('Created', chartX + 212, doc.y + 1);
        doc.rect(chartX + 270, doc.y, 8, 8).fill(C.textMuted);
        doc.text('Resolved', chartX + 282, doc.y + 1);

        doc.y += 16;
        doc.fillColor(C.text);
    }

    /**
     * Key-value list — compact section with bullet points
     */
    private drawKeyValueList(doc: any, x: number, y: number, title: string, data: Record<string, number>): void {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.black).text(title.toUpperCase(), x, y);
        doc.font('Helvetica').fontSize(8).fillColor(C.text);

        let itemY = y + 16;
        Object.entries(data).slice(0, 6).forEach(([key, value]) => {
            doc.fillColor(C.textMuted).text('—', x, itemY, { continued: true });
            doc.fillColor(C.text).text(` ${key}: `, { continued: true });
            doc.font('Helvetica-Bold').text(String(value));
            doc.font('Helvetica');
            itemY += 13;
        });
    }

    /**
     * Progress bar — flat, no rounded corners
     */
    private drawProgressBar(doc: any, x: number, y: number, width: number, label: string, value: number, max: number): void {
        doc.fontSize(9).font('Helvetica').fillColor(C.text).text(label, x, y);
        doc.fontSize(9).font('Helvetica-Bold').text(`${value.toFixed(1)}%`, x + width - 50, y, { width: 50, align: 'right' });

        // Track
        doc.rect(x, y + 16, width, 12).fill(C.bgSubtle);
        doc.rect(x, y + 16, width, 12).strokeColor(C.rule).stroke();

        // Fill — use dark neutral
        const fillWidth = (value / max) * width;
        doc.rect(x, y + 16, Math.max(fillWidth, 4), 12).fill(C.text);

        doc.fillColor(C.text);
    }

    /**
     * Distribution row — percentage bars with labels
     */
    private drawDistributionRow(doc: any, items: { label: string; value: number; total: number }[]): void {
        items.forEach((item) => {
            const pct = item.total > 0 ? ((item.value / item.total) * 100).toFixed(1) : '0';

            doc.fontSize(9).font('Helvetica').fillColor(C.text)
                .text(`${item.label}: ${item.value}`, 40, doc.y, { continued: true });
            doc.fillColor(C.textMuted).text(` (${pct}%)`);
        });

        doc.moveDown(0.3);
        doc.fillColor(C.text);
    }

    /**
     * Key-value summary table — clean grid
     */
    private drawKeyValueTable(doc: any, rows: { metric: string; value: string }[]): void {
        const L = 40;
        const W = 515;
        const dividerX = L + 260;

        // Header row for table
        const headerY = doc.y;
        doc.rect(L, headerY, W, 18).fill(C.headerBg);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white);
        doc.text('Metric', L + 8, headerY + 5, { width: 240 });
        doc.text('Value', dividerX + 8, headerY + 5, { width: 240 });
        doc.moveTo(dividerX, headerY).lineTo(dividerX, headerY + 18).lineWidth(0.3).strokeColor(C.headerAccent).stroke();
        doc.y = headerY + 18;

        rows.forEach((row, idx) => {
            const rowY = doc.y;
            if (idx % 2 === 0) {
                doc.rect(L, rowY, W, 18).fill(C.bgSubtle);
            }

            doc.fontSize(8).font('Helvetica').fillColor(C.text)
                .text(row.metric, L + 8, rowY + 5, { width: 245 });
            doc.font('Helvetica-Bold')
                .text(row.value, dividerX + 8, rowY + 5, { width: W - 268, align: 'right' });

            // Row border + vertical divider
            doc.moveTo(L, rowY + 18).lineTo(L + W, rowY + 18).lineWidth(0.3).strokeColor(C.rule).stroke();
            doc.moveTo(dividerX, rowY).lineTo(dividerX, rowY + 18).lineWidth(0.3).strokeColor(C.rule).stroke();

            doc.y = rowY + 18;
        });

        // Outer border
        doc.rect(L, headerY, W, 18 + rows.length * 18).lineWidth(0.5).strokeColor(C.rule).stroke();
        doc.fillColor(C.text);
    }

    /**
     * Draw a donut chart for distribution visualization
     */
    private drawDonutChart(
        doc: any,
        centerX: number,
        centerY: number,
        outerRadius: number,
        innerRadius: number,
        data: { label: string; value: number; color: string }[]
    ): void {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        if (total === 0) return;

        let startAngle = -Math.PI / 2;

        data.forEach(segment => {
            const sweepAngle = (segment.value / total) * Math.PI * 2;
            const endAngle = startAngle + sweepAngle;

            doc.save();
            doc.path(this.createArcPath(centerX, centerY, outerRadius, innerRadius, startAngle, endAngle))
                .fill(segment.color);
            doc.restore();

            startAngle = endAngle;
        });

        doc.fontSize(16).font('Helvetica-Bold').fillColor(C.black)
            .text(String(total), centerX - 25, centerY - 10, { width: 50, align: 'center' });
        doc.fontSize(7).font('Helvetica').fillColor(C.textMuted)
            .text('Total', centerX - 25, centerY + 8, { width: 50, align: 'center' });

        let legendY = centerY + outerRadius + 12;
        let legendX = centerX - (data.length * 50);
        data.forEach((segment, i) => {
            const x = legendX + (i * 100);
            doc.rect(x, legendY, 8, 8).fill(segment.color);
            const pct = total > 0 ? ((segment.value / total) * 100).toFixed(0) : '0';
            doc.fontSize(7).fillColor(C.text)
                .text(`${segment.label} (${pct}%)`, x + 12, legendY + 1);
        });

        doc.fillColor(C.text);
    }

    /**
     * Create SVG-like arc path for donut segments
     */
    private createArcPath(
        cx: number, cy: number,
        outerR: number, innerR: number,
        startAngle: number, endAngle: number
    ): string {
        const outerStartX = cx + outerR * Math.cos(startAngle);
        const outerStartY = cy + outerR * Math.sin(startAngle);
        const outerEndX = cx + outerR * Math.cos(endAngle);
        const outerEndY = cy + outerR * Math.sin(endAngle);

        const innerStartX = cx + innerR * Math.cos(endAngle);
        const innerStartY = cy + innerR * Math.sin(endAngle);
        const innerEndX = cx + innerR * Math.cos(startAngle);
        const innerEndY = cy + innerR * Math.sin(startAngle);

        const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

        return `
            M ${outerStartX} ${outerStartY}
            A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY}
            L ${innerStartX} ${innerStartY}
            A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${innerEndX} ${innerEndY}
            Z
        `;
    }

    /**
     * Draw enhanced metrics comparison grid
     */
    private drawMetricsGrid(doc: any, metrics: { label: string; value: string; change?: number }[], x: number, y: number): void {
        const cardWidth = 120;
        const cardHeight = 50;
        const gap = 8;

        metrics.forEach((metric, i) => {
            const cardX = x + (i % 4) * (cardWidth + gap);
            const cardY = y + Math.floor(i / 4) * (cardHeight + gap);

            doc.rect(cardX, cardY, cardWidth, cardHeight).fill(C.cardBg);
            doc.rect(cardX, cardY, cardWidth, cardHeight).strokeColor(C.rule).stroke();

            doc.fontSize(7).font('Helvetica').fillColor(C.textFaint)
                .text(metric.label.toUpperCase(), cardX + 8, cardY + 6, { width: cardWidth - 16 });

            doc.fontSize(15).font('Helvetica-Bold').fillColor(C.black)
                .text(metric.value, cardX + 8, cardY + 20, { width: cardWidth - 16 });

            if (metric.change !== undefined) {
                const isPositive = metric.change >= 0;
                const arrow = isPositive ? '↑' : '↓';
                const changeColor = isPositive ? C.positive : C.critical;
                doc.fontSize(8).fillColor(changeColor)
                    .text(`${arrow} ${Math.abs(metric.change).toFixed(1)}%`, cardX + 8, cardY + 38);
            }
        });

        doc.fillColor(C.text);
    }

    /**
     * Footer — minimal, functional
     */
    private drawFooter(doc: any): void {
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);

            doc.moveTo(40, 780).lineTo(555, 780).lineWidth(0.5).strokeColor(C.rule).stroke();

            doc.fontSize(7).fillColor(C.textFaint).font('Helvetica')
                .text('iDesk Enterprise Helpdesk  •  Confidential', 40, 786);
            doc.text(`Page ${i + 1} of ${pages.count}`, 250, 786, { align: 'center', width: 100 });
            doc.text(new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }), 400, 786, { align: 'right', width: 155 });
        }
    }
}
