/**
 * Runtime SMTP configuration for outgoing notification email.
 *
 * The persisted shape lives in `system_settings` under {@link MAIL_CONFIG_KEY}.
 * `password` is stored encrypted (AES-256-GCM via CredentialCipherService) and
 * is never returned to API clients — see MailConfigService.getRedactedConfig.
 */
export interface MailConfig {
    /** Master switch. When false, no notification email leaves the system. */
    enabled: boolean;
    host: string;
    port: number;
    /** true = implicit TLS (port 465). false = plain/STARTTLS (port 587/25). */
    secure: boolean;
    /** false = relay without credentials (internal relays only). */
    authRequired: boolean;
    username: string;
    /** Encrypted at rest. Empty string means "not configured". */
    password: string;
    /** RFC 5322 From header, e.g. `iDesk Support <noreply@kapalapi.co.id>`. */
    fromAddress: string;
    /**
     * Skips TLS certificate verification. Defaults to false and must stay false
     * unless the relay uses a self-signed certificate — enabling it exposes the
     * SMTP session to man-in-the-middle attacks.
     */
    allowSelfSignedCert: boolean;
}

/** Config as exposed over HTTP: password replaced by a boolean presence flag. */
export type RedactedMailConfig = Omit<MailConfig, 'password'> & {
    passwordSet: boolean;
};

export const MAIL_CONFIG_KEY = 'mail.smtp';

/**
 * Defaults target the in-house mail server (mail.kapalapi.co.id, implicit TLS
 * on 465). They are only used when neither the database nor the environment
 * supplies a value, so a fresh install already points at the right relay.
 */
export const DEFAULT_MAIL_CONFIG: MailConfig = {
    enabled: false,
    host: 'mail.kapalapi.co.id',
    port: 465,
    secure: true,
    authRequired: true,
    username: '',
    password: '',
    fromAddress: 'iDesk Support <noreply@kapalapi.co.id>',
    allowSelfSignedCert: false,
};
