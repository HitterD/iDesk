import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '../../users/entities/user.entity';
import { AgentPerformanceReport, DateRange } from './agent-performance.report';
import { TicketVolumeReport } from './ticket-volume.report';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

export interface ScheduledReportConfig {
    id: string;
    name: string;
    type: 'AGENT_PERFORMANCE' | 'TICKET_VOLUME' | 'MONTHLY_SUMMARY';
    schedule: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    recipients: string[];
    enabled: boolean;
}

/**
 * Scheduled Reports Service
 * Handles automatic report generation and distribution
 */
@Injectable()
export class ScheduledReportsService {
    private readonly logger = new Logger(ScheduledReportsService.name);
    private readonly reportsDir = path.join(process.cwd(), 'reports');

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly mailerService: MailerService,
        private readonly agentPerformanceReport: AgentPerformanceReport,
        private readonly ticketVolumeReport: TicketVolumeReport,
    ) {
        // Ensure reports directory exists
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    /**
     * Daily report - runs every day at 7:00 AM
     */
    @Cron(CronExpression.EVERY_DAY_AT_7AM)
    async generateDailyReport(): Promise<void> {
        this.logger.log('Generating daily report...');

        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const dateRange: DateRange = {
                startDate: yesterday,
                endDate: today,
            };

            // Generate ticket volume report for yesterday
            const volumeReport = await this.ticketVolumeReport.generate(dateRange);

            // Get admin users to send report to
            const admins = await this.userRepo.find({
                where: { role: 'ADMIN' as any },
            });

            if (admins.length === 0) {
                this.logger.warn('No admin users found to send daily report');
                return;
            }

            // Generate Excel file
            const filePath = await this.generateVolumeExcel(volumeReport.data, dateRange);

            // Send to all admins
            for (const admin of admins) {
                if (admin.email) {
                    await this.sendReportEmail(
                        admin.email,
                        `Daily Ticket Report - ${yesterday.toLocaleDateString()}`,
                        `Please find attached the daily ticket volume report for ${yesterday.toLocaleDateString()}.`,
                        filePath,
                    );
                }
            }

            // Clean up file
            fs.unlinkSync(filePath);

            this.logger.log('Daily report generated and sent successfully');
        } catch (error) {
            this.logger.error('Failed to generate daily report:', error);
        }
    }

    /**
     * Weekly report - runs every Monday at 8:00 AM
     */
    @Cron(CronExpression.EVERY_WEEK)
    async generateWeeklyReport(): Promise<void> {
        this.logger.log('Generating weekly report...');

        try {
            const endDate = new Date();
            endDate.setHours(0, 0, 0, 0);

            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 7);

            const dateRange: DateRange = { startDate, endDate };

            // Generate both reports
            const [volumeReport, performanceReport] = await Promise.all([
                this.ticketVolumeReport.generate(dateRange),
                this.agentPerformanceReport.generate(dateRange),
            ]);

            // Get admin users
            const admins = await this.userRepo.find({
                where: { role: 'ADMIN' as any },
            });

            if (admins.length === 0) {
                this.logger.warn('No admin users found to send weekly report');
                return;
            }

            // Generate combined Excel file
            const filePath = await this.generateCombinedExcel(
                volumeReport.data,
                performanceReport.data,
                dateRange,
            );

            // Send to all admins
            for (const admin of admins) {
                if (admin.email) {
                    await this.sendReportEmail(
                        admin.email,
                        `Weekly Report - ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
                        `Please find attached the weekly report including ticket volume and agent performance metrics.`,
                        filePath,
                    );
                }
            }

            // Clean up file
            fs.unlinkSync(filePath);

            this.logger.log('Weekly report generated and sent successfully');
        } catch (error) {
            this.logger.error('Failed to generate weekly report:', error);
        }
    }

    /**
     * Monthly report - runs on the 1st of every month at 9:00 AM
     */
    @Cron('0 9 1 * *')
    async generateMonthlyReport(): Promise<void> {
        this.logger.log('Generating monthly report...');

        try {
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

            const dateRange: DateRange = { startDate, endDate };

            // Generate both reports
            const [volumeReport, performanceReport] = await Promise.all([
                this.ticketVolumeReport.generate(dateRange),
                this.agentPerformanceReport.generate(dateRange),
            ]);

            // Get admin users
            const admins = await this.userRepo.find({
                where: { role: 'ADMIN' as any },
            });

            if (admins.length === 0) {
                this.logger.warn('No admin users found to send monthly report');
                return;
            }

            const monthName = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });

            // Generate combined Excel file
            const filePath = await this.generateCombinedExcel(
                volumeReport.data,
                performanceReport.data,
                dateRange,
            );

            // Send to all admins
            for (const admin of admins) {
                if (admin.email) {
                    await this.sendReportEmail(
                        admin.email,
                        `Monthly Report - ${monthName}`,
                        `Please find attached the monthly report for ${monthName} including ticket volume and agent performance metrics.`,
                        filePath,
                    );
                }
            }

            // Clean up file
            fs.unlinkSync(filePath);

            this.logger.log('Monthly report generated and sent successfully');
        } catch (error) {
            this.logger.error('Failed to generate monthly report:', error);
        }
    }

    /**
     * Generate ticket volume Excel report
     */
    private async generateVolumeExcel(data: any, dateRange: DateRange): Promise<string> {
        const workbook = new ExcelJS.Workbook();

        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Metric', key: 'metric', width: 30 },
            { header: 'Value', key: 'value', width: 20 },
        ];
        summarySheet.addRows([
            { metric: 'Report Period', value: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}` },
            { metric: 'Total Created', value: data.summary.totalCreated },
            { metric: 'Total Resolved', value: data.summary.totalResolved },
            { metric: 'Total Pending', value: data.summary.totalPending },
            { metric: 'Average Per Day', value: data.summary.avgPerDay },
            { metric: 'Peak Day', value: data.summary.peakDay },
            { metric: 'Peak Count', value: data.summary.peakCount },
        ]);

        // Daily Volume Sheet
        const dailySheet = workbook.addWorksheet('Daily Volume');
        dailySheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Created', key: 'created', width: 12 },
            { header: 'Resolved', key: 'resolved', width: 12 },
            { header: 'Pending', key: 'pending', width: 12 },
        ];
        data.daily.forEach((day: any) => dailySheet.addRow(day));

        // Save file
        const filePath = path.join(this.reportsDir, `ticket-volume-${Date.now()}.xlsx`);
        await workbook.xlsx.writeFile(filePath);
        return filePath;
    }

    /**
     * Generate combined Excel report
     */
    private async generateCombinedExcel(
        volumeData: any,
        performanceData: any[],
        dateRange: DateRange,
    ): Promise<string> {
        const workbook = new ExcelJS.Workbook();

        // Ticket Volume Summary
        const volumeSheet = workbook.addWorksheet('Ticket Volume');
        volumeSheet.columns = [
            { header: 'Metric', key: 'metric', width: 30 },
            { header: 'Value', key: 'value', width: 20 },
        ];
        volumeSheet.addRows([
            { metric: 'Report Period', value: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}` },
            { metric: 'Total Created', value: volumeData.summary.totalCreated },
            { metric: 'Total Resolved', value: volumeData.summary.totalResolved },
            { metric: 'Total Pending', value: volumeData.summary.totalPending },
            { metric: 'Average Per Day', value: volumeData.summary.avgPerDay },
        ]);

        // Agent Performance Sheet
        const agentSheet = workbook.addWorksheet('Agent Performance');
        agentSheet.columns = [
            { header: 'Agent', key: 'agentName', width: 25 },
            { header: 'Assigned', key: 'totalAssigned', width: 12 },
            { header: 'Resolved', key: 'totalResolved', width: 12 },
            { header: 'Resolution %', key: 'resolutionRate', width: 14 },
            { header: 'Avg Response (min)', key: 'avgResponseTimeMinutes', width: 18 },
            { header: 'SLA Compliance %', key: 'slaComplianceRate', width: 16 },
        ];
        performanceData.forEach(agent => agentSheet.addRow(agent));

        // Daily Volume Sheet
        const dailySheet = workbook.addWorksheet('Daily Volume');
        dailySheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Created', key: 'created', width: 12 },
            { header: 'Resolved', key: 'resolved', width: 12 },
            { header: 'Pending', key: 'pending', width: 12 },
        ];
        volumeData.daily.forEach((day: any) => dailySheet.addRow(day));

        // Save file
        const filePath = path.join(this.reportsDir, `combined-report-${Date.now()}.xlsx`);
        await workbook.xlsx.writeFile(filePath);
        return filePath;
    }

    /**
     * Send report via email
     */
    private async sendReportEmail(
        to: string,
        subject: string,
        text: string,
        attachmentPath: string,
    ): Promise<void> {
        try {
            await this.mailerService.sendMail({
                to,
                subject,
                text,
                attachments: [
                    {
                        filename: path.basename(attachmentPath),
                        path: attachmentPath,
                    },
                ],
            });
            this.logger.log(`Report email sent to ${to}`);
        } catch (error) {
            this.logger.error(`Failed to send report email to ${to}:`, error);
        }
    }
}
