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

/**
 * PDF Report Generator Service
 * Generates professional PDF reports for various report types
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
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=agent-performance-${Date.now()}.pdf`,
        );

        doc.pipe(res);

        // Header
        this.addHeader(doc, options);

        // Summary Section
        doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
        doc.moveDown(0.5);

        const totalAgents = metrics.length;
        const avgResolutionRate = metrics.length > 0
            ? metrics.reduce((sum, m) => sum + m.resolutionRate, 0) / metrics.length
            : 0;
        const avgSLACompliance = metrics.length > 0
            ? metrics.reduce((sum, m) => sum + m.slaComplianceRate, 0) / metrics.length
            : 0;

        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Agents: ${totalAgents}`);
        doc.text(`Average Resolution Rate: ${avgResolutionRate.toFixed(1)}%`);
        doc.text(`Average SLA Compliance: ${avgSLACompliance.toFixed(1)}%`);
        doc.moveDown();

        // Agent Details Table
        doc.fontSize(14).font('Helvetica-Bold').text('Agent Performance Details', { underline: true });
        doc.moveDown(0.5);

        // Table Header
        const tableTop = doc.y;
        const tableLeft = 50;
        const colWidths = [120, 60, 60, 70, 70, 70];

        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Agent Name', tableLeft, tableTop);
        doc.text('Assigned', tableLeft + colWidths[0], tableTop);
        doc.text('Resolved', tableLeft + colWidths[0] + colWidths[1], tableTop);
        doc.text('Res. Rate', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
        doc.text('Avg Resp.', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
        doc.text('SLA %', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop);

        // Draw header line
        doc.moveTo(tableLeft, tableTop + 15)
            .lineTo(tableLeft + 450, tableTop + 15)
            .stroke();

        // Table Rows
        let rowY = tableTop + 25;
        doc.font('Helvetica').fontSize(9);

        for (const agent of metrics) {
            if (rowY > 700) {
                doc.addPage();
                rowY = 50;
            }

            doc.text(agent.agentName.substring(0, 20), tableLeft, rowY);
            doc.text(String(agent.totalAssigned), tableLeft + colWidths[0], rowY);
            doc.text(String(agent.totalResolved), tableLeft + colWidths[0] + colWidths[1], rowY);
            doc.text(`${agent.resolutionRate.toFixed(1)}%`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2], rowY);
            doc.text(`${agent.avgResponseTimeMinutes}m`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowY);
            doc.text(`${agent.slaComplianceRate.toFixed(1)}%`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], rowY);

            rowY += 20;
        }

        // Footer
        this.addFooter(doc);

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
        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=ticket-volume-${Date.now()}.pdf`,
        );

        doc.pipe(res);

        // Header
        this.addHeader(doc, options);

        // Summary Section
        doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Tickets Created: ${volumeData.summary.totalCreated}`);
        doc.text(`Total Tickets Resolved: ${volumeData.summary.totalResolved}`);
        doc.text(`Total Pending: ${volumeData.summary.totalPending}`);
        doc.text(`Average Per Day: ${volumeData.summary.avgPerDay}`);
        doc.text(`Peak Day: ${volumeData.summary.peakDay} (${volumeData.summary.peakCount} tickets)`);
        doc.moveDown();

        // By Priority
        doc.fontSize(14).font('Helvetica-Bold').text('By Priority', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        for (const [priority, count] of Object.entries(volumeData.byPriority)) {
            doc.text(`${priority}: ${count}`);
        }
        doc.moveDown();

        // By Status
        doc.fontSize(14).font('Helvetica-Bold').text('By Status', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        for (const [status, count] of Object.entries(volumeData.byStatus)) {
            doc.text(`${status}: ${count}`);
        }
        doc.moveDown();

        // By Category
        if (Object.keys(volumeData.byCategory).length > 0) {
            doc.fontSize(14).font('Helvetica-Bold').text('By Category', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            for (const [category, count] of Object.entries(volumeData.byCategory)) {
                doc.text(`${category}: ${count}`);
            }
            doc.moveDown();
        }

        // Daily Volume Table
        if (volumeData.daily.length <= 31) {
            doc.addPage();
            doc.fontSize(14).font('Helvetica-Bold').text('Daily Volume', { underline: true });
            doc.moveDown(0.5);

            const tableTop = doc.y;
            const tableLeft = 50;

            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('Date', tableLeft, tableTop);
            doc.text('Created', tableLeft + 100, tableTop);
            doc.text('Resolved', tableLeft + 170, tableTop);
            doc.text('Pending', tableLeft + 240, tableTop);

            doc.moveTo(tableLeft, tableTop + 15)
                .lineTo(tableLeft + 300, tableTop + 15)
                .stroke();

            let rowY = tableTop + 25;
            doc.font('Helvetica').fontSize(9);

            for (const day of volumeData.daily) {
                if (rowY > 700) {
                    doc.addPage();
                    rowY = 50;
                }

                doc.text(day.date, tableLeft, rowY);
                doc.text(String(day.created), tableLeft + 100, rowY);
                doc.text(String(day.resolved), tableLeft + 170, rowY);
                doc.text(String(day.pending), tableLeft + 240, rowY);

                rowY += 15;
            }
        }

        // Footer
        this.addFooter(doc);

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
        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=monthly-summary-${stats.month}-${stats.year}.pdf`,
        );

        doc.pipe(res);

        // Header
        this.addHeader(doc, {
            ...options,
            title: `Monthly Report - ${stats.month}/${stats.year}`,
        });

        // Summary Box
        doc.fontSize(14).font('Helvetica-Bold').text('Monthly Statistics', { underline: true });
        doc.moveDown();

        const boxTop = doc.y;
        const boxLeft = 50;
        const boxWidth = 200;
        const boxHeight = 60;
        const spacing = 20;

        // Total Tickets Box
        this.drawStatBox(doc, boxLeft, boxTop, boxWidth, boxHeight, 'Total Tickets', stats.totalTickets);
        
        // Resolved Tickets Box
        this.drawStatBox(doc, boxLeft + boxWidth + spacing, boxTop, boxWidth, boxHeight, 'Resolved', stats.resolvedTickets);

        doc.y = boxTop + boxHeight + 20;

        // Open Tickets Box
        this.drawStatBox(doc, boxLeft, doc.y, boxWidth, boxHeight, 'Open Tickets', stats.openTickets);

        // Avg Resolution Time Box
        this.drawStatBox(doc, boxLeft + boxWidth + spacing, doc.y, boxWidth, boxHeight, 'Avg Resolution (hrs)', stats.avgResolutionTimeHours);

        doc.y += boxHeight + 40;

        // Resolution Rate
        const resolutionRate = stats.totalTickets > 0 
            ? ((stats.resolvedTickets / stats.totalTickets) * 100).toFixed(1)
            : '0';

        doc.fontSize(12).font('Helvetica-Bold').text('Performance Metrics');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Resolution Rate: ${resolutionRate}%`);
        doc.text(`Tickets Remaining: ${stats.openTickets}`);

        // Footer
        this.addFooter(doc);

        doc.end();
    }

    /**
     * Add report header
     */
    private addHeader(doc: any, options: PDFReportOptions): void {
        // Title
        doc.fontSize(20).font('Helvetica-Bold').text(options.title, { align: 'center' });

        if (options.subtitle) {
            doc.fontSize(12).font('Helvetica').text(options.subtitle, { align: 'center' });
        }

        if (options.dateRange) {
            const startStr = options.dateRange.startDate.toLocaleDateString();
            const endStr = options.dateRange.endDate.toLocaleDateString();
            doc.fontSize(10).text(`Report Period: ${startStr} - ${endStr}`, { align: 'center' });
        }

        doc.moveDown(0.5);
        doc.fontSize(9).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        
        // Separator line
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
    }

    /**
     * Add report footer
     */
    private addFooter(doc: any): void {
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);

            // Footer line
            doc.moveTo(50, 750).lineTo(550, 750).stroke();

            // Page number
            doc.fontSize(9).text(
                `Page ${i + 1} of ${pages.count}`,
                50,
                760,
                { align: 'center', width: 500 },
            );

            // Company info
            doc.text('iDesk Helpdesk System', 50, 760, { align: 'right', width: 500 });
        }
    }

    /**
     * Draw a statistics box
     */
    private drawStatBox(
        doc: any,
        x: number,
        y: number,
        width: number,
        height: number,
        label: string,
        value: string | number,
    ): void {
        // Box border
        doc.rect(x, y, width, height).stroke();

        // Label
        doc.fontSize(10).font('Helvetica').text(label, x + 10, y + 10);

        // Value
        doc.fontSize(20).font('Helvetica-Bold').text(String(value), x + 10, y + 30);
    }
}
