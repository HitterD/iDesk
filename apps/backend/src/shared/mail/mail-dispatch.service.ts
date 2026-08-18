import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ISendMailOptions } from '@nestjs-modules/mailer';
import { MailSendResult, MailTransportService } from './mail-transport.service';

/**
 * Single entry point for every outgoing email in the application.
 *
 * Delivery is hybrid: when Redis is up the message is handed to the `emails`
 * Bull queue (retries with exponential backoff, survives a restart); when it is
 * not, the message is sent inline so notifications still work on a Redis-less
 * deployment. Callers never learn which path was taken and never see a throw —
 * email is a side effect of a business action and must not fail it.
 */
@Injectable()
export class MailDispatchService {
    private readonly logger = new Logger(MailDispatchService.name);
    private readonly queueEnabled: boolean;

    constructor(
        private readonly transport: MailTransportService,
        @Optional()
        @InjectQueue('emails')
        private readonly emailQueue?: Queue,
    ) {
        this.queueEnabled = !!this.emailQueue;
        this.logger.log(
            this.queueEnabled
                ? 'Email dispatch using Bull queue (asynchronous with retry)'
                : 'Bull queue unavailable - email dispatch is synchronous',
        );
    }

    /**
     * Queues or sends a message. Resolves to `{ queued: true }` when the job was
     * accepted by the queue — delivery has not happened yet at that point.
     */
    async send(options: ISendMailOptions): Promise<MailSendResult & { queued?: boolean }> {
        if (this.queueEnabled) {
            try {
                await this.emailQueue!.add('send-email', options, {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 5_000 },
                    removeOnComplete: 100,
                    removeOnFail: 50,
                });
                return { success: true, queued: true };
            } catch (error) {
                // Redis went away mid-flight; fall through to a direct send
                // rather than dropping the notification.
                this.logger.warn(
                    `Could not enqueue email, sending synchronously: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
        }

        return this.transport.send(options);
    }

    /** Bypasses the queue. Used by the Settings "send test email" action. */
    async sendNow(options: ISendMailOptions): Promise<MailSendResult> {
        return this.transport.send(options);
    }
}
