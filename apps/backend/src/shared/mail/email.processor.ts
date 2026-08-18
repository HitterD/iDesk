import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { MailTransportService } from './mail-transport.service';
import { buildAppUrl } from './app-url.util';

export interface EmailJobData {
    to: string | string[];
    subject: string;
    template: string;
    context: Record<string, any>;
    attachments?: Array<{
        filename: string;
        path?: string;
        content?: Buffer;
    }>;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
}

export interface BulkEmailJobData {
    recipients: Array<{
        email: string;
        context: Record<string, any>;
    }>;
    subject: string;
    template: string;
    baseContext?: Record<string, any>;
}

@Processor('emails')
export class EmailProcessor {
    private readonly logger = new Logger(EmailProcessor.name);

    constructor(private readonly mailTransport: MailTransportService) {}

    @Process('send-email')
    async handleSendEmail(job: Job<EmailJobData>) {
        const { to, subject, template, context, attachments, cc, bcc, replyTo } = job.data;
        
        this.logger.debug(`Processing email job ${job.id} to ${Array.isArray(to) ? to.join(', ') : to}`);

        const result = await this.mailTransport.send({ to, subject, template, context, attachments, cc, bcc, replyTo });
        if (result.skipped) {
            this.logger.warn(`Email skipped (disabled/unconfigured): ${result.error}`);
            return { success: true, skipped: true, to, subject };
        }
        if (!result.success) {
            this.logger.error(`Failed to send email: ${result.error}`);
            throw new Error(result.error);
        }
        this.logger.log(`Email sent successfully to ${Array.isArray(to) ? to.join(', ') : to}`);
        return { success: true, to, subject };
    }

    @Process('send-bulk-email')
    async handleSendBulkEmail(job: Job<BulkEmailJobData>) {
        const { recipients, subject, template, baseContext } = job.data;
        
        this.logger.debug(`Processing bulk email job ${job.id} for ${recipients.length} recipients`);

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[],
        };

        for (const recipient of recipients) {
            try {
                await this.mailTransport.send({
                    to: recipient.email,
                    subject,
                    template,
                    context: { ...baseContext, ...recipient.context },
                });
                results.success++;
            } catch (error: any) {
                results.failed++;
                results.errors.push(`${recipient.email}: ${error.message}`);
                this.logger.error(`Failed to send email to ${recipient.email}: ${error.message}`);
            }

            // Small delay between emails to avoid rate limiting
            await this.delay(100);
        }

        this.logger.log(`Bulk email completed: ${results.success} sent, ${results.failed} failed`);
        return results;
    }

    @Process('send-ticket-notification')
    async handleTicketNotification(job: Job<{
        type: 'created' | 'assigned' | 'updated' | 'resolved' | 'comment';
        ticketId: string;
        ticketNumber: string;
        title: string;
        recipientEmail: string;
        recipientName: string;
        additionalContext?: Record<string, any>;
    }>) {
        const { type, ticketId, ticketNumber, title, recipientEmail, recipientName, additionalContext } = job.data;
        
        const templateMap = {
            created: 'ticket-created',
            assigned: 'ticket-assigned',
            updated: 'ticket-updated',
            resolved: 'ticket-resolved',
            comment: 'ticket-comment',
        };

        const subjectMap = {
            created: `New Ticket #${ticketNumber}: ${title}`,
            assigned: `Ticket #${ticketNumber} Assigned to You`,
            updated: `Ticket #${ticketNumber} Updated`,
            resolved: `Ticket #${ticketNumber} Resolved`,
            comment: `New Comment on Ticket #${ticketNumber}`,
        };

        try {
            await this.mailTransport.send({
                to: recipientEmail,
                subject: subjectMap[type],
                template: templateMap[type],
                context: {
                    recipientName,
                    ticketId,
                    ticketNumber,
                    title,
                    ticketUrl: buildAppUrl(`/tickets/${ticketId}`),
                    ...additionalContext,
                },
            });

            return { success: true, type, ticketNumber };
        } catch (error: any) {
            this.logger.error(`Failed to send ticket notification: ${error.message}`);
            throw error;
        }
    }

    @Process('send-contract-reminder')
    async handleContractReminder(job: Job<{
        contractId: string;
        contractNumber: string;
        companyName: string;
        expiryDate: string;
        daysUntilExpiry: number;
        recipientEmail: string;
        recipientName: string;
    }>) {
        const { contractNumber, companyName, expiryDate, daysUntilExpiry, recipientEmail, recipientName, contractId } = job.data;

        try {
            await this.mailTransport.send({
                to: recipientEmail,
                subject: `Contract Renewal Reminder: ${companyName} expires in ${daysUntilExpiry} days`,
                template: 'contract-reminder',
                context: {
                    recipientName,
                    contractNumber,
                    companyName,
                    expiryDate,
                    daysUntilExpiry,
                    contractUrl: buildAppUrl(`/renewals/${contractId}`),
                },
            });

            return { success: true, contractNumber, daysUntilExpiry };
        } catch (error: any) {
            this.logger.error(`Failed to send contract reminder: ${error.message}`);
            throw error;
        }
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(
            `Email job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
            error.stack,
        );
    }

    @OnQueueCompleted()
    onCompleted(job: Job, result: any) {
        this.logger.debug(`Email job ${job.id} completed: ${JSON.stringify(result)}`);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
