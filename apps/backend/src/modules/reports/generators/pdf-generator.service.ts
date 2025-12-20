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

// Soft color palette
const COLORS = {
    primary: '#4F46E5',      // Indigo
    primaryLight: '#E0E7FF', // Light indigo
    success: '#10B981',      // Green
    successLight: '#D1FAE5', // Light green
    warning: '#F59E0B',      // Amber
    warningLight: '#FEF3C7', // Light amber
    danger: '#EF4444',       // Red
    dangerLight: '#FEE2E2',  // Light red
    info: '#3B82F6',         // Blue
    infoLight: '#DBEAFE',    // Light blue
    gray: '#6B7280',
    grayLight: '#F3F4F6',
    text: '#1F2937',
    textLight: '#6B7280',
    white: '#FFFFFF',
    border: '#E5E7EB',
};

/**
 * PDF Report Generator Service
 * Generates professional PDF reports with charts and styling
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

        // Header with branding
        this.addProfessionalHeader(doc, options);

        // Summary Cards Row
        const totalAgents = metrics.length;
        const avgResolutionRate = metrics.length > 0
            ? metrics.reduce((sum, m) => sum + m.resolutionRate, 0) / metrics.length
            : 0;
        const avgSLACompliance = metrics.length > 0
            ? metrics.reduce((sum, m) => sum + m.slaComplianceRate, 0) / metrics.length
            : 0;
        const bestAgent = metrics.length > 0
            ? metrics.reduce((best, m) => m.resolutionRate > best.resolutionRate ? m : best, metrics[0])
            : null;

        const cardY = doc.y + 10;
        this.drawColoredCard(doc, 40, cardY, 125, 65, 'Total Agents', String(totalAgents), COLORS.primary, COLORS.primaryLight);
        this.drawColoredCard(doc, 175, cardY, 125, 65, 'Avg Resolution', `${avgResolutionRate.toFixed(1)}%`, COLORS.success, COLORS.successLight);
        this.drawColoredCard(doc, 310, cardY, 125, 65, 'Avg SLA', `${avgSLACompliance.toFixed(1)}%`, COLORS.info, COLORS.infoLight);
        this.drawColoredCard(doc, 445, cardY, 110, 65, 'Top Performer', bestAgent?.agentName?.split(' ')[0] || 'N/A', COLORS.warning, COLORS.warningLight);

        doc.y = cardY + 85;

        // Agent Performance Table
        this.drawSectionTitle(doc, 'Agent Performance Details');
        this.drawAgentTable(doc, metrics);

        // Performance Bar Chart (ASCII-style using boxes)
        if (metrics.length > 0 && metrics.length <= 10) {
            doc.moveDown(1);
            this.drawSectionTitle(doc, 'Resolution Rate Comparison');
            this.drawHorizontalBarChart(doc,
                metrics.map(m => ({ label: m.agentName.substring(0, 12), value: m.resolutionRate, max: 100 })),
                COLORS.success
            );
        }

        this.addModernFooter(doc);
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

        this.addProfessionalHeader(doc, options);

        // Summary Cards
        const cardY = doc.y + 10;
        this.drawColoredCard(doc, 40, cardY, 125, 60, 'Created', String(volumeData.summary.totalCreated), COLORS.primary, COLORS.primaryLight);
        this.drawColoredCard(doc, 175, cardY, 125, 60, 'Resolved', String(volumeData.summary.totalResolved), COLORS.success, COLORS.successLight);
        this.drawColoredCard(doc, 310, cardY, 125, 60, 'Pending', String(volumeData.summary.totalPending), COLORS.warning, COLORS.warningLight);
        this.drawColoredCard(doc, 445, cardY, 110, 60, 'Avg/Day', String(volumeData.summary.avgPerDay), COLORS.info, COLORS.infoLight);

        doc.y = cardY + 80;

        // Daily Volume Chart
        if (volumeData.daily.length > 0) {
            this.drawSectionTitle(doc, 'Daily Ticket Volume');
            this.drawDailyVolumeChart(doc, volumeData.daily);
        }

        // By Priority (compact)
        doc.moveDown(1);
        const infoY = doc.y;
        this.drawCompactSection(doc, 40, infoY, 'By Priority', volumeData.byPriority, COLORS.danger);
        this.drawCompactSection(doc, 200, infoY, 'By Status', volumeData.byStatus, COLORS.info);
        this.drawCompactSection(doc, 360, infoY, 'By Category', volumeData.byCategory, COLORS.success);

        this.addModernFooter(doc);
        doc.end();
    }

    /**
     * Generate Monthly Summary PDF Report - ENHANCED with Charts
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

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=monthly-report-${stats.month}-${stats.year}.pdf`,
        );

        doc.pipe(res);

        // Professional Header
        this.addProfessionalHeader(doc, {
            ...options,
            title: `Monthly Summary Report`,
            subtitle: `${monthNames[stats.month - 1]} ${stats.year}`,
        });

        // Ensure all values are numbers with defaults
        const totalTickets = Number(stats.totalTickets) || 0;
        const resolvedTickets = Number(stats.resolvedTickets) || 0;
        const openTickets = Number(stats.openTickets) || 0;
        const avgHours = parseFloat(String(stats.avgResolutionTimeHours)) || 0;

        // Key Metrics Cards
        const cardY = doc.y + 15;
        this.drawColoredCard(doc, 40, cardY, 125, 75, 'Total Tickets', String(totalTickets), COLORS.primary, COLORS.primaryLight);
        this.drawColoredCard(doc, 175, cardY, 125, 75, 'Resolved', String(resolvedTickets), COLORS.success, COLORS.successLight);
        this.drawColoredCard(doc, 310, cardY, 125, 75, 'Open', String(openTickets), COLORS.warning, COLORS.warningLight);
        this.drawColoredCard(doc, 445, cardY, 110, 75, 'Avg Resolution', `${avgHours.toFixed(1)}h`, COLORS.info, COLORS.infoLight);

        doc.y = cardY + 95;

        // Performance Overview Section
        this.drawSectionTitle(doc, 'Performance Overview');

        const resolutionRate = totalTickets > 0
            ? ((resolvedTickets / totalTickets) * 100)
            : 0;

        // Resolution Rate Progress Bar
        this.drawProgressBar(doc, 40, doc.y + 5, 515, 'Resolution Rate', resolutionRate, 100, COLORS.success);
        doc.y += 50;

        // Ticket Distribution (simple visual)
        this.drawSectionTitle(doc, 'Ticket Distribution');
        this.drawPieChartLegend(doc, {
            'Resolved': { value: resolvedTickets, color: COLORS.success },
            'Open': { value: openTickets, color: COLORS.warning },
        });

        // Summary Table
        doc.y += 20;
        this.drawSectionTitle(doc, 'Summary Statistics');
        this.drawSummaryTable(doc, [
            { metric: 'Report Period', value: `${monthNames[stats.month - 1]} ${stats.year}` },
            { metric: 'Total Tickets Created', value: String(totalTickets) },
            { metric: 'Tickets Resolved', value: String(resolvedTickets) },
            { metric: 'Tickets Still Open', value: String(openTickets) },
            { metric: 'Resolution Rate', value: `${resolutionRate.toFixed(1)}%` },
            { metric: 'Average Resolution Time', value: `${avgHours.toFixed(2)} hours` },
        ]);

        this.addModernFooter(doc);
        doc.end();
    }

    // ===========================================
    // HELPER METHODS
    // ===========================================

    private addProfessionalHeader(doc: any, options: PDFReportOptions): void {
        // Header background
        doc.rect(0, 0, 612, 100).fill(COLORS.primary);

        // Company logo/name
        doc.fontSize(24).font('Helvetica-Bold').fillColor(COLORS.white)
            .text('iDesk', 40, 25);
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.white)
            .text('Enterprise Helpdesk', 40, 52);

        // Report Title
        doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.white)
            .text(options.title, 200, 30, { align: 'right', width: 350 });

        if (options.subtitle) {
            doc.fontSize(11).font('Helvetica').fillColor(COLORS.white)
                .text(options.subtitle, 200, 52, { align: 'right', width: 350 });
        }

        // Date range or generated date
        if (options.dateRange) {
            const startStr = options.dateRange.startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            const endStr = options.dateRange.endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            doc.fontSize(9).fillColor(COLORS.white)
                .text(`Period: ${startStr} - ${endStr}`, 200, 70, { align: 'right', width: 350 });
        } else {
            doc.fontSize(9).fillColor(COLORS.white)
                .text(`Generated: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 200, 70, { align: 'right', width: 350 });
        }

        doc.fillColor(COLORS.text);
        doc.y = 115;
    }

    private drawColoredCard(doc: any, x: number, y: number, width: number, height: number, label: string, value: string, accentColor: string, bgColor: string): void {
        // Card background
        doc.roundedRect(x, y, width, height, 8).fill(bgColor);

        // Accent bar
        doc.rect(x, y, 4, height).fill(accentColor);

        // Label
        doc.fontSize(9).font('Helvetica').fillColor(COLORS.textLight)
            .text(label, x + 12, y + 12, { width: width - 20 });

        // Value
        doc.fontSize(18).font('Helvetica-Bold').fillColor(COLORS.text)
            .text(value, x + 12, y + 28, { width: width - 20 });

        doc.fillColor(COLORS.text);
    }

    private drawSectionTitle(doc: any, title: string): void {
        doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.primary)
            .text(title, 40);
        doc.moveTo(40, doc.y + 3).lineTo(555, doc.y + 3).strokeColor(COLORS.border).stroke();
        doc.moveDown(0.5);
        doc.fillColor(COLORS.text);
    }

    private drawAgentTable(doc: any, metrics: AgentMetrics[]): void {
        const tableLeft = 40;
        const colWidths = [110, 55, 55, 70, 80, 80];
        const headers = ['Agent', 'Assigned', 'Resolved', 'Rate %', 'Avg Resp (m)', 'SLA %'];

        // Header row
        let x = tableLeft;
        doc.rect(tableLeft, doc.y, 510, 22).fill(COLORS.grayLight);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.text);
        headers.forEach((header, i) => {
            doc.text(header, x + 5, doc.y + 6, { width: colWidths[i] - 10 });
            x += colWidths[i];
        });
        doc.y += 22;

        // Data rows
        doc.font('Helvetica').fontSize(9);
        metrics.slice(0, 15).forEach((agent, idx) => {
            const rowY = doc.y;
            if (idx % 2 === 0) {
                doc.rect(tableLeft, rowY, 510, 18).fill('#FAFAFA');
            }

            x = tableLeft;
            doc.fillColor(COLORS.text);
            doc.text(agent.agentName.substring(0, 15), x + 5, rowY + 4, { width: colWidths[0] - 10 });
            x += colWidths[0];
            doc.text(String(agent.totalAssigned), x + 5, rowY + 4, { width: colWidths[1] - 10 });
            x += colWidths[1];
            doc.text(String(agent.totalResolved), x + 5, rowY + 4, { width: colWidths[2] - 10 });
            x += colWidths[2];
            doc.text(`${agent.resolutionRate.toFixed(1)}%`, x + 5, rowY + 4, { width: colWidths[3] - 10 });
            x += colWidths[3];
            doc.text(String(agent.avgResponseTimeMinutes), x + 5, rowY + 4, { width: colWidths[4] - 10 });
            x += colWidths[4];
            doc.text(`${agent.slaComplianceRate.toFixed(1)}%`, x + 5, rowY + 4, { width: colWidths[5] - 10 });

            doc.y = rowY + 18;
        });

        // Table border
        doc.rect(tableLeft, doc.y - (metrics.slice(0, 15).length * 18) - 22, 510, (metrics.slice(0, 15).length * 18) + 22)
            .strokeColor(COLORS.border).stroke();
    }

    private drawHorizontalBarChart(doc: any, data: { label: string; value: number; max: number }[], color: string): void {
        data.slice(0, 8).forEach((item) => {
            const barWidth = (item.value / item.max) * 350;

            // Label
            doc.fontSize(9).font('Helvetica').fillColor(COLORS.text)
                .text(item.label, 40, doc.y, { width: 90 });

            // Bar background
            doc.rect(140, doc.y - 2, 350, 14).fill(COLORS.grayLight);

            // Bar fill
            doc.rect(140, doc.y - 2, barWidth, 14).fill(color);

            // Value
            doc.fontSize(8).fillColor(COLORS.text)
                .text(`${item.value.toFixed(1)}%`, 500, doc.y, { width: 50 });

            doc.y += 18;
        });
        doc.fillColor(COLORS.text);
    }

    private drawDailyVolumeChart(doc: any, daily: { date: string; created: number; resolved: number }[]): void {
        const chartHeight = 80;
        const chartWidth = 515;
        const chartX = 40;
        const chartY = doc.y + 10;

        // Find max value for scaling
        const maxValue = Math.max(...daily.map(d => Math.max(d.created, d.resolved)), 1);

        // Draw axis
        doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartHeight).strokeColor(COLORS.border).stroke();
        doc.moveTo(chartX, chartY + chartHeight).lineTo(chartX + chartWidth, chartY + chartHeight).stroke();

        // Draw bars for each day (max 31 days)
        const barWidth = Math.min(12, chartWidth / (daily.length * 2.5));
        const gap = barWidth * 0.5;

        daily.slice(-31).forEach((day, i) => {
            const x = chartX + 10 + (i * (barWidth * 2 + gap));
            const createdHeight = (day.created / maxValue) * (chartHeight - 10);
            const resolvedHeight = (day.resolved / maxValue) * (chartHeight - 10);

            // Created bar (blue)
            doc.rect(x, chartY + chartHeight - createdHeight, barWidth, createdHeight).fill(COLORS.info);

            // Resolved bar (green)
            doc.rect(x + barWidth, chartY + chartHeight - resolvedHeight, barWidth, resolvedHeight).fill(COLORS.success);
        });

        // Legend
        doc.y = chartY + chartHeight + 10;
        doc.rect(chartX + 200, doc.y, 10, 10).fill(COLORS.info);
        doc.fontSize(8).fillColor(COLORS.text).text('Created', chartX + 215, doc.y + 1);
        doc.rect(chartX + 270, doc.y, 10, 10).fill(COLORS.success);
        doc.text('Resolved', chartX + 285, doc.y + 1);

        doc.y += 20;
        doc.fillColor(COLORS.text);
    }

    private drawCompactSection(doc: any, x: number, y: number, title: string, data: Record<string, number>, color: string): void {
        doc.fontSize(10).font('Helvetica-Bold').fillColor(color).text(title, x, y);
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);

        let itemY = y + 18;
        Object.entries(data).slice(0, 6).forEach(([key, value]) => {
            doc.text(`• ${key}: ${value}`, x, itemY);
            itemY += 14;
        });
    }

    private drawProgressBar(doc: any, x: number, y: number, width: number, label: string, value: number, max: number, color: string): void {
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(label, x, y);
        doc.fontSize(10).font('Helvetica-Bold').text(`${value.toFixed(1)}%`, x + width - 50, y, { width: 50, align: 'right' });

        // Background
        doc.roundedRect(x, y + 18, width, 16, 4).fill(COLORS.grayLight);

        // Fill
        const fillWidth = (value / max) * width;
        doc.roundedRect(x, y + 18, Math.max(fillWidth, 8), 16, 4).fill(color);

        doc.fillColor(COLORS.text);
    }

    private drawPieChartLegend(doc: any, data: Record<string, { value: number; color: string }>): void {
        const total = Object.values(data).reduce((sum, d) => sum + d.value, 0);

        let x = 40;
        Object.entries(data).forEach(([label, { value, color }]) => {
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';

            doc.rect(x, doc.y, 16, 16).fill(color);
            doc.fontSize(10).fillColor(COLORS.text).font('Helvetica')
                .text(`${label}: ${value} (${percentage}%)`, x + 22, doc.y + 2);

            x += 150;
        });

        doc.moveDown();
        doc.fillColor(COLORS.text);
    }

    private drawSummaryTable(doc: any, rows: { metric: string; value: string }[]): void {
        const tableLeft = 40;
        const tableWidth = 515;

        rows.forEach((row, idx) => {
            const rowY = doc.y;
            if (idx % 2 === 0) {
                doc.rect(tableLeft, rowY, tableWidth, 20).fill(COLORS.grayLight);
            }

            doc.fontSize(9).font('Helvetica').fillColor(COLORS.text)
                .text(row.metric, tableLeft + 10, rowY + 5, { width: 250 });
            doc.font('Helvetica-Bold')
                .text(row.value, tableLeft + 270, rowY + 5, { width: 235, align: 'right' });

            doc.y = rowY + 20;
        });

        doc.rect(tableLeft, doc.y - (rows.length * 20), tableWidth, rows.length * 20)
            .strokeColor(COLORS.border).stroke();
        doc.fillColor(COLORS.text);
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

        let startAngle = -Math.PI / 2; // Start from top

        // Draw segments
        data.forEach(segment => {
            const sweepAngle = (segment.value / total) * Math.PI * 2;
            const endAngle = startAngle + sweepAngle;

            // Draw arc segment using path
            doc.save();
            doc.path(this.createArcPath(centerX, centerY, outerRadius, innerRadius, startAngle, endAngle))
                .fill(segment.color);
            doc.restore();

            startAngle = endAngle;
        });

        // Center text (total)
        doc.fontSize(18).font('Helvetica-Bold').fillColor(COLORS.text)
            .text(String(total), centerX - 25, centerY - 12, { width: 50, align: 'center' });
        doc.fontSize(7).font('Helvetica').fillColor(COLORS.textLight)
            .text('Total', centerX - 25, centerY + 8, { width: 50, align: 'center' });

        // Legend below chart
        let legendY = centerY + outerRadius + 15;
        let legendX = centerX - (data.length * 50);
        data.forEach((segment, i) => {
            const x = legendX + (i * 100);
            doc.rect(x, legendY, 10, 10).fill(segment.color);
            const pct = total > 0 ? ((segment.value / total) * 100).toFixed(0) : '0';
            doc.fontSize(8).fillColor(COLORS.text)
                .text(`${segment.label} (${pct}%)`, x + 14, legendY + 1);
        });

        doc.fillColor(COLORS.text);
    }

    /**
     * Create SVG-like arc path for donut segments
     */
    private createArcPath(
        cx: number, cy: number,
        outerR: number, innerR: number,
        startAngle: number, endAngle: number
    ): string {
        // Outer arc
        const outerStartX = cx + outerR * Math.cos(startAngle);
        const outerStartY = cy + outerR * Math.sin(startAngle);
        const outerEndX = cx + outerR * Math.cos(endAngle);
        const outerEndY = cy + outerR * Math.sin(endAngle);

        // Inner arc
        const innerStartX = cx + innerR * Math.cos(endAngle);
        const innerStartY = cy + innerR * Math.sin(endAngle);
        const innerEndX = cx + innerR * Math.cos(startAngle);
        const innerEndY = cy + innerR * Math.sin(startAngle);

        const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

        // SVG arc command: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
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
        const cardHeight = 55;
        const gap = 10;

        metrics.forEach((metric, i) => {
            const cardX = x + (i % 4) * (cardWidth + gap);
            const cardY = y + Math.floor(i / 4) * (cardHeight + gap);

            // Card background
            doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 6).fill(COLORS.grayLight);

            // Label
            doc.fontSize(8).font('Helvetica').fillColor(COLORS.textLight)
                .text(metric.label, cardX + 8, cardY + 8, { width: cardWidth - 16 });

            // Value
            doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.text)
                .text(metric.value, cardX + 8, cardY + 22, { width: cardWidth - 16 });

            // Change indicator
            if (metric.change !== undefined) {
                const isPositive = metric.change >= 0;
                const arrow = isPositive ? '↑' : '↓';
                const changeColor = isPositive ? COLORS.success : COLORS.danger;
                doc.fontSize(9).fillColor(changeColor)
                    .text(`${arrow} ${Math.abs(metric.change).toFixed(1)}%`, cardX + 8, cardY + 40);
            }
        });

        doc.fillColor(COLORS.text);
    }

    private addModernFooter(doc: any): void {
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);

            // Footer line
            doc.moveTo(40, 780).lineTo(555, 780).strokeColor(COLORS.border).stroke();

            // Left: Company
            doc.fontSize(8).fillColor(COLORS.textLight).font('Helvetica')
                .text('iDesk Enterprise Helpdesk • Confidential', 40, 788);

            // Center: Page number
            doc.text(`Page ${i + 1} of ${pages.count}`, 250, 788, { align: 'center', width: 100 });

            // Right: Generated date
            doc.text(`Generated: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`, 400, 788, { align: 'right', width: 155 });
        }
    }
}
