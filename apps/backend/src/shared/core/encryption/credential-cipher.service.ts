import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * AES-256-GCM credential cipher used to encrypt sensitive fields (e.g. access
 * credentials) before they are persisted to the database. Backward compatible
 * with legacy plaintext rows: payloads that do not begin with the `v1:` marker
 * are returned unchanged.
 *
 * Format: `v1:<base64(iv)>:<base64(authTag)>:<base64(ciphertext)>`
 *   - iv:      12 random bytes (GCM standard)
 *   - authTag: 16 bytes (GCM authentication tag)
 *   - key:     32 bytes derived from `ENCRYPTION_KEY` via scrypt with a static salt
 *
 * The static salt is acceptable here because the secret is itself high-entropy;
 * scrypt still raises the cost of brute-force vs. raw key usage.
 */
@Injectable()
export class CredentialCipherService implements OnModuleInit {
    private readonly logger = new Logger(CredentialCipherService.name);
    private readonly algo = 'aes-256-gcm';
    private key!: Buffer;
    private static readonly SALT = 'idesk-static-salt-v1';
    private static readonly PREFIX = 'v1:';

    constructor(private readonly config: ConfigService) {}

    onModuleInit(): void {
        const secret = this.config.get<string>('ENCRYPTION_KEY');
        if (!secret) {
            throw new Error('CredentialCipherService requires ENCRYPTION_KEY');
        }
        this.key = scryptSync(secret, CredentialCipherService.SALT, 32);
        this.logger.log('CredentialCipherService initialized (AES-256-GCM)');
    }

    /**
     * Encrypts a plaintext credential. Empty input is returned as-is. Two
     * encryptions of the same value produce different ciphertexts (random IV).
     */
    encrypt(plaintext: string): string {
        if (plaintext == null || plaintext === '') return plaintext;
        const iv = randomBytes(12);
        const cipher = createCipheriv(this.algo, this.key, iv);
        const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return (
            CredentialCipherService.PREFIX +
            iv.toString('base64') +
            ':' +
            tag.toString('base64') +
            ':' +
            enc.toString('base64')
        );
    }

    /**
     * Decrypts a payload produced by `encrypt`. Legacy plaintext (no `v1:`
     * prefix) is returned unchanged so existing rows continue to work after
     * the migration.
     */
    decrypt(payload: string | null | undefined): string {
        if (payload == null || payload === '') return payload ?? '';
        if (!payload.startsWith(CredentialCipherService.PREFIX)) return payload;
        const [, ivB64, tagB64, encB64] = payload.split(':');
        if (!ivB64 || !tagB64 || !encB64) {
            throw new Error('Malformed encrypted payload');
        }
        const iv = Buffer.from(ivB64, 'base64');
        const tag = Buffer.from(tagB64, 'base64');
        const enc = Buffer.from(encB64, 'base64');
        const decipher = createDecipheriv(this.algo, this.key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    }

    /**
     * Detects whether a stored value is already encrypted. Used by migration
     * scripts and conditional decryption paths.
     */
    isEncrypted(value: string | null | undefined): boolean {
        return !!value && value.startsWith(CredentialCipherService.PREFIX);
    }
}
