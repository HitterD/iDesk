import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../modules/settings/settings.service';
import { CredentialCipherService } from '../core/encryption/credential-cipher.service';
import {
    DEFAULT_MAIL_CONFIG,
    MAIL_CONFIG_KEY,
    MailConfig,
    RedactedMailConfig,
} from './mail-config.types';

/**
 * Owns the persisted SMTP configuration: reads it from `system_settings`,
 * decrypts the password, and seeds the row from environment variables the
 * first time the application boots against an empty settings table.
 *
 * Precedence once seeded: database wins. The SMTP_* environment variables are
 * only an initial value, so an administrator editing the Settings UI is never
 * overridden by a stale .env on the next restart.
 */
@Injectable()
export class MailConfigService {
    private readonly logger = new Logger(MailConfigService.name);

    constructor(
        private readonly settingsService: SettingsService,
        private readonly cipher: CredentialCipherService,
        private readonly config: ConfigService,
    ) {}

    /**
     * Returns the effective configuration with the password decrypted.
     * For internal use by the transport layer only — never send this to a client.
     */
    async getConfig(): Promise<MailConfig> {
        const stored = await this.settingsService.getSetting<Partial<MailConfig>>(MAIL_CONFIG_KEY);

        if (!stored) {
            return this.buildFromEnvironment();
        }

        const merged: MailConfig = { ...DEFAULT_MAIL_CONFIG, ...stored };
        return { ...merged, password: this.safeDecrypt(merged.password) };
    }

    /** Config for API responses: the password is replaced by a presence flag. */
    async getRedactedConfig(): Promise<RedactedMailConfig> {
        const { password, ...rest } = await this.getConfig();
        return { ...rest, passwordSet: password !== '' };
    }

    /**
     * Persists a configuration patch. An omitted or empty `password` keeps the
     * stored one, so the UI can submit the form without ever holding the secret.
     * Returns the effective config (decrypted) for immediate transport rebuild.
     */
    async saveConfig(
        patch: Partial<MailConfig>,
        userId?: string,
    ): Promise<{ current: MailConfig; previous: MailConfig }> {
        const previous = await this.getConfig();

        const password =
            patch.password === undefined || patch.password === ''
                ? previous.password
                : patch.password;

        const current: MailConfig = {
            ...previous,
            ...patch,
            password,
        };

        await this.settingsService.setSetting(
            MAIL_CONFIG_KEY,
            { ...current, password: this.cipher.encrypt(current.password) },
            userId,
            'SMTP configuration for outgoing notification email',
        );

        return { current, previous };
    }

    /**
     * Seeds the settings row from SMTP_* environment variables. Called once at
     * boot; a row that already exists is left untouched.
     */
    async seedFromEnvironmentIfMissing(): Promise<boolean> {
        const stored = await this.settingsService.getSetting<Partial<MailConfig>>(MAIL_CONFIG_KEY);
        if (stored) {
            return false;
        }

        const seeded = this.buildFromEnvironment();
        await this.settingsService.setSetting(
            MAIL_CONFIG_KEY,
            { ...seeded, password: this.cipher.encrypt(seeded.password) },
            'system',
            'SMTP configuration for outgoing notification email (seeded from environment)',
        );

        this.logger.log(
            `Seeded SMTP configuration from environment (host=${seeded.host}, port=${seeded.port}, enabled=${seeded.enabled})`,
        );
        return true;
    }

    /**
     * Builds a config from SMTP_* environment variables, falling back to the
     * in-house relay defaults. Email stays disabled unless credentials exist,
     * so a fresh install never attempts to send through a placeholder host.
     */
    private buildFromEnvironment(): MailConfig {
        const host = this.config.get<string>('SMTP_HOST') || DEFAULT_MAIL_CONFIG.host;
        const port = Number(this.config.get<string>('SMTP_PORT')) || DEFAULT_MAIL_CONFIG.port;
        const username = this.config.get<string>('SMTP_USER') || '';
        const password = this.config.get<string>('SMTP_PASS') || '';
        const secureRaw = this.config.get<string>('SMTP_SECURE');

        return {
            ...DEFAULT_MAIL_CONFIG,
            host,
            port,
            // Implicit TLS is implied by port 465 when SMTP_SECURE is unset.
            secure: secureRaw === undefined ? port === 465 : secureRaw === 'true',
            username,
            password,
            fromAddress: this.config.get<string>('SMTP_FROM') || DEFAULT_MAIL_CONFIG.fromAddress,
            enabled: Boolean(host && username && password),
        };
    }

    /**
     * Decrypts a stored password, tolerating a payload that cannot be decrypted
     * (e.g. ENCRYPTION_KEY rotated). Sending then fails with an explicit
     * "not configured" error instead of crashing every notification path.
     */
    private safeDecrypt(stored: string): string {
        if (!stored) return '';
        try {
            return this.cipher.decrypt(stored);
        } catch {
            this.logger.error(
                'Stored SMTP password could not be decrypted; re-enter it in Settings. ' +
                    'This usually means ENCRYPTION_KEY changed.',
            );
            return '';
        }
    }
}
