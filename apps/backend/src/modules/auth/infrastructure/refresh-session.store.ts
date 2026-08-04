import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';
import { CacheService } from '../../../shared/core/cache/cache.service';
import {
    RefreshConsumeResult,
    RefreshSessionInput,
    RefreshSessionState,
} from '../application/refresh-session.types';

const REFRESH_NAMESPACE = 'auth:refresh';
const CONSUME_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then return { 'missing' } end
local session = cjson.decode(value)
if session.consumed == true then return { 'reused', value } end
session.consumed = true
session.consumedAt = tonumber(ARGV[1])
redis.call('SET', KEYS[1], cjson.encode(session), 'KEEPTTL')
return { 'valid', cjson.encode(session) }
`;

@Injectable()
export class RefreshSessionStore {
    constructor(private readonly cacheService: CacheService) {}

    async create(input: RefreshSessionInput): Promise<void> {
        const ttlSeconds = Math.max(1, Math.ceil((input.expiresAt - Date.now()) / 1000));
        const state: RefreshSessionState = {
            tokenId: input.tokenId,
            familyId: input.familyId,
            userId: input.userId,
            parentId: input.parentId,
            tokenDigest: this.digest(input.token),
            consumed: false,
            expiresAt: input.expiresAt,
        };
        await this.cacheService.setSecurity(this.key(input.familyId, input.tokenId), state, ttlSeconds);
    }

    async consume(familyId: string, tokenId: string): Promise<RefreshConsumeResult> {
        try {
            const result = await this.cacheService.evalSecurity(
                CONSUME_SCRIPT,
                [this.key(familyId, tokenId)],
                [String(Date.now())],
            );
            const [status, rawState] = result as [string, string?];
            if (status === 'missing') return { status: 'missing' };

            const session = JSON.parse(rawState || '{}') as RefreshSessionState;
            return status === 'reused'
                ? { status: 'reused', session }
                : { status: 'valid', session };
        } catch (error) {
            throw new ServiceUnavailableException('Refresh session store unavailable', { cause: error });
        }
    }

    async invalidateFamily(familyId: string): Promise<void> {
        await this.cacheService.deleteSecurityByPattern(`${REFRESH_NAMESPACE}:${familyId}:*`);
    }

    async invalidateUserSessions(userId: string): Promise<void> {
        const keys = await this.cacheService.scanSecurity(`${REFRESH_NAMESPACE}:*`);
        for (const key of keys) {
            const state = await this.cacheService.getSecurity<RefreshSessionState>(key);
            if (state?.userId === userId) await this.cacheService.deleteSecurity(key);
        }
    }

    private key(familyId: string, tokenId: string): string {
        return `${REFRESH_NAMESPACE}:${familyId}:${tokenId}`;
    }

    private digest(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }
}
