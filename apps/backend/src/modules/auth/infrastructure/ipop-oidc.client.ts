import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify, JWTVerifyGetKey } from 'jose';

/** Claims iPop puts in its ID token (scope `openid profile email`). */
export interface IpopIdentity {
    sub: string;
    nik: string;
    name?: string;
    email?: string;
    department?: string;
    site?: string;
}

/** iPop answered, but refused the grant (wrong password, expired code, locked account…). */
export class IpopGrantRejectedError extends Error {
    constructor(readonly error: string, readonly description?: string) {
        super(description || error);
    }
}

/** iPop could not be reached or answered something that is not a valid OIDC response. */
export class IpopUnavailableError extends Error {}

interface ProviderMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri: string;
}

interface IpopOidcConfig {
    issuer: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

const METADATA_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const SCOPE = 'openid profile email';

const base64Url = (buf: Buffer) => buf.toString('base64url');

/** PKCE + state + nonce for one "Sign in with iPop" round trip. */
export function newAuthorizationSecrets() {
    const codeVerifier = base64Url(randomBytes(32));
    return {
        state: base64Url(randomBytes(16)),
        nonce: base64Url(randomBytes(16)),
        codeVerifier,
        codeChallenge: base64Url(createHash('sha256').update(codeVerifier).digest()),
    };
}

/**
 * OpenID Connect client for "Sign in with iPop" (iPop is the provider, iDesk the confidential client `idesk`).
 * Disabled unless IPOP_OIDC_ISSUER, IPOP_OIDC_CLIENT_SECRET and IPOP_OIDC_REDIRECT_URI are all set.
 */
@Injectable()
export class IpopOidcClient {
    private readonly logger = new Logger(IpopOidcClient.name);
    private metadata?: { value: ProviderMetadata; loadedAt: number };
    private jwks?: { uri: string; getKey: JWTVerifyGetKey };

    constructor(private readonly config: ConfigService) {}

    isEnabled(): boolean {
        return this.settings() !== null;
    }

    /** NIK + iPop password in iDesk's own form; on unless IPOP_OIDC_PASSWORD_LOGIN=false. */
    isPasswordLoginEnabled(): boolean {
        return this.isEnabled() && this.config.get<string>('IPOP_OIDC_PASSWORD_LOGIN')?.trim().toLowerCase() !== 'false';
    }

    async authorizationUrl(secrets: { state: string; nonce: string; codeChallenge: string }): Promise<string> {
        const cfg = this.requireSettings();
        const meta = await this.loadMetadata(cfg);
        const url = new URL(meta.authorization_endpoint);
        url.search = new URLSearchParams({
            client_id: cfg.clientId,
            response_type: 'code',
            scope: SCOPE,
            redirect_uri: cfg.redirectUri,
            state: secrets.state,
            nonce: secrets.nonce,
            code_challenge: secrets.codeChallenge,
            code_challenge_method: 'S256',
        }).toString();
        return url.toString();
    }

    async exchangeCode(code: string, codeVerifier: string, nonce: string): Promise<IpopIdentity> {
        const cfg = this.requireSettings();
        const idToken = await this.token(cfg, {
            grant_type: 'authorization_code',
            code,
            redirect_uri: cfg.redirectUri,
            code_verifier: codeVerifier,
        });
        return this.verifyIdToken(cfg, idToken, nonce);
    }

    /** The password never leaves this call: not stored, not logged, iPop tokens are dropped after the ID token check. */
    async passwordGrant(nik: string, password: string): Promise<IpopIdentity> {
        const cfg = this.requireSettings();
        const idToken = await this.token(cfg, { grant_type: 'password', username: nik, password, scope: SCOPE });
        return this.verifyIdToken(cfg, idToken);
    }

    private async token(cfg: IpopOidcConfig, params: Record<string, string>): Promise<string> {
        const meta = await this.loadMetadata(cfg);
        let res: Response;
        try {
            res = await fetch(meta.token_endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString('base64')}`,
                },
                body: new URLSearchParams(params).toString(),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        } catch (error) {
            throw new IpopUnavailableError(`iPop token endpoint unreachable: ${(error as Error).message}`);
        }
        const body = await res.json().catch(() => null) as Record<string, any> | null;
        if (res.status === 400 || res.status === 401 || res.status === 403) {
            throw new IpopGrantRejectedError(body?.error || 'invalid_grant', body?.error_description);
        }
        if (!res.ok || typeof body?.id_token !== 'string') {
            throw new IpopUnavailableError(`iPop token endpoint answered ${res.status}`);
        }
        return body.id_token;
    }

    private async verifyIdToken(cfg: IpopOidcConfig, idToken: string, nonce?: string): Promise<IpopIdentity> {
        const meta = await this.loadMetadata(cfg);
        if (this.jwks?.uri !== meta.jwks_uri) {
            this.jwks = { uri: meta.jwks_uri, getKey: createRemoteJWKSet(new URL(meta.jwks_uri)) };
        }
        let payload: Record<string, unknown>;
        try {
            ({ payload } = await jwtVerify(idToken, this.jwks.getKey, {
                issuer: meta.issuer,
                audience: cfg.clientId,
                algorithms: ['RS256'],
                clockTolerance: 60,
            }));
        } catch (error) {
            throw new IpopGrantRejectedError('invalid_id_token', (error as Error).message);
        }
        if (nonce !== undefined && payload.nonce !== nonce) {
            throw new IpopGrantRejectedError('invalid_id_token', 'nonce mismatch');
        }
        const nik = typeof payload.nik === 'string' ? payload.nik.trim() : '';
        if (!nik || typeof payload.sub !== 'string') {
            throw new IpopGrantRejectedError('invalid_id_token', 'ID token has no NIK');
        }
        const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
        return {
            sub: payload.sub,
            nik,
            name: text(payload.name),
            email: text(payload.email)?.toLowerCase(),
            department: text(payload.department),
            site: text(payload.site),
        };
    }

    private async loadMetadata(cfg: IpopOidcConfig): Promise<ProviderMetadata> {
        if (this.metadata && Date.now() - this.metadata.loadedAt < METADATA_TTL_MS) return this.metadata.value;
        const url = `${cfg.issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;
        let meta: Partial<ProviderMetadata> | null;
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
            meta = res.ok ? await res.json() as Partial<ProviderMetadata> : null;
        } catch (error) {
            this.logger.warn(`iPop discovery failed: ${(error as Error).message}`);
            meta = null;
        }
        if (!meta?.issuer || !meta.authorization_endpoint || !meta.token_endpoint || !meta.jwks_uri) {
            throw new IpopUnavailableError(`iPop discovery document unavailable at ${url}`);
        }
        this.metadata = { value: meta as ProviderMetadata, loadedAt: Date.now() };
        return this.metadata.value;
    }

    private settings(): IpopOidcConfig | null {
        const get = (key: string) => this.config.get<string>(key)?.trim() || '';
        const cfg = {
            issuer: get('IPOP_OIDC_ISSUER'),
            clientId: get('IPOP_OIDC_CLIENT_ID') || 'idesk',
            clientSecret: get('IPOP_OIDC_CLIENT_SECRET'),
            redirectUri: get('IPOP_OIDC_REDIRECT_URI'),
        };
        return cfg.issuer && cfg.clientSecret && cfg.redirectUri ? cfg : null;
    }

    private requireSettings(): IpopOidcConfig {
        const cfg = this.settings();
        if (!cfg) throw new IpopUnavailableError('Sign in with iPop is not configured');
        return cfg;
    }
}
