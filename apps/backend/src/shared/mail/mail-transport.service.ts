import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MailerService, ISendMailOptions } from '@nestjs-modules/mailer';
import { MailConfigService } from './mail-config.service';
import { MailConfig } from './mail-config.types';
import { describeSenderDomainMismatch } from './sender-domain.util';

/** Name of the dynamically registered nodemailer transporter. */
const RUNTIME_TRANSPORTER = 'runtime';

export interface MailSendResult {
    success: boolean;
    messageId?: string;
    /** Present when the send did not happen or failed. */
    error?: string;
    /** True when email is switched off or unconfigured — not an error. */
    skipped?: boolean;
}

/**
 * Sends mail through a transporter built from the database-backed SMTP
 * configuration rather than the static one wired at bootstrap.
 *
 * Registering through `MailerService.addTransporter` (instead of calling
 * nodemailer directly) keeps the Handlebars compile hook attached, so
 * `template` + `context` keep working exactly as before. The transporter is
 * rebuilt lazily whenever {@link invalidate} is called, which is what makes a
 * settings change take effect without restarting the backend.
 */
@Injectable()
export class MailTransportService implements OnModuleInit {
    private readonly logger = new Logger(MailTransportService.name);
    private cachedConfig: MailConfig | null = null;

    constructor(
        private readonly mailerService: MailerService,
        private readonly mailConfigService: MailConfigService,
    ) {}

    async onModuleInit(): Promise<void> {
        try {
            await this.mailConfigService.seedFromEnvironmentIfMissing();
        } catch (error) {
            // A settings table that is not migrated yet must not block boot.
            this.logger.warn(
                `Could not seed SMTP configuration at startup: ${this.messageOf(error)}`,
            );
        }
    }

    /**
     * Drops the cached transporter so the next send rebuilds it from the
     * database. Called after the administrator saves new settings.
     */
    invalidate(): void {
        this.cachedConfig = null;
        this.logger.log('SMTP transport cache invalidated; next send rebuilds it');
    }

    /**
     * Sends one message. Returns a result object instead of throwing, because
     * every caller is a notification side effect that must not fail the
     * business operation that triggered it.
     */
    async send(options: ISendMailOptions): Promise<MailSendResult> {
        let config: MailConfig;
        try {
            config = await this.resolveTransport();
        } catch (error) {
            const message = this.messageOf(error);
            this.logger.error(`SMTP transport unavailable: ${message}`);
            return { success: false, error: message };
        }

        if (!config.enabled) {
            return { success: false, skipped: true, error: 'Email notification is disabled' };
        }
        if (!config.host) {
            return { success: false, skipped: true, error: 'SMTP host is not configured' };
        }

        try {
            // `from` is applied after the spread: an explicit `from: undefined`
            // on the caller's options would otherwise wipe out the configured
            // sender and leave the message without a From header.
            const info = await this.mailerService.sendMail({
                ...options,
                from: options.from ?? config.fromAddress,
                transporterName: RUNTIME_TRANSPORTER,
            });
            return { success: true, messageId: info?.messageId };
        } catch (error) {
            const message = this.messageOf(error);
            // A rejection of the From header reads as a plain auth failure, so
            // append the likely cause instead of leaving the admin guessing.
            const hint = /(550|553|5\.7\.\d)/.test(message)
                ? describeSenderDomainMismatch(
                      String(options.from ?? config.fromAddress ?? ''),
                      config.username,
                  )
                : null;
            const detail = hint ? `${message} - ${hint}` : message;
            // Recipients are logged; credentials and message bodies are not.
            this.logger.error(`Failed to send email to ${this.describeRecipient(options)}: ${detail}`);
            return { success: false, error: detail };
        }
    }

    /**
     * Opens an SMTP session against a candidate configuration and closes it
     * immediately. Used by the "test connection" action so the administrator
     * learns about a bad host or password before saving.
     */
    async verifyConfig(config: MailConfig): Promise<{ success: boolean; error?: string }> {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport(this.toTransportOptions(config));
        try {
            await transporter.verify();
            return { success: true };
        } catch (error) {
            return { success: false, error: this.messageOf(error) };
        } finally {
            transporter.close();
        }
    }

    /** Current effective configuration, rebuilding the transporter if stale. */
    private async resolveTransport(): Promise<MailConfig> {
        if (this.cachedConfig) {
            return this.cachedConfig;
        }

        const config = await this.mailConfigService.getConfig();
        this.mailerService.addTransporter(RUNTIME_TRANSPORTER, this.toTransportOptions(config));
        this.cachedConfig = config;

        this.logger.log(
            `SMTP transport ready (host=${config.host}, port=${config.port}, secure=${config.secure}, auth=${config.authRequired})`,
        );
        return config;
    }

    /** Maps the stored configuration onto nodemailer SMTP transport options. */
    private toTransportOptions(config: MailConfig): Record<string, unknown> {
        return {
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: config.authRequired
                ? { user: config.username, pass: config.password }
                : undefined,
            tls: config.allowSelfSignedCert ? { rejectUnauthorized: false } : undefined,
            connectionTimeout: 15_000,
            greetingTimeout: 15_000,
            socketTimeout: 30_000,
        };
    }

    private describeRecipient(options: ISendMailOptions): string {
        const to = options.to;
        if (typeof to === 'string') return to;
        if (Array.isArray(to)) return `${to.length} recipient(s)`;
        return 'unknown recipient';
    }

    private messageOf(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
