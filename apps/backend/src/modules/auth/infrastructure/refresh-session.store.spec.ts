import { ServiceUnavailableException } from '@nestjs/common';
import { RefreshSessionStore } from './refresh-session.store';
import { RefreshSessionState } from '../application/refresh-session.types';

describe('RefreshSessionStore', () => {
    let store: RefreshSessionStore;
    let cache: {
        setSecurity: jest.Mock;
        evalSecurity: jest.Mock;
        deleteSecurityByPattern: jest.Mock;
        scanSecurity: jest.Mock;
        getSecurity: jest.Mock;
        deleteSecurity: jest.Mock;
    };

    beforeEach(() => {
        cache = {
            setSecurity: jest.fn(),
            evalSecurity: jest.fn(),
            deleteSecurityByPattern: jest.fn(),
            scanSecurity: jest.fn(),
            getSecurity: jest.fn(),
            deleteSecurity: jest.fn(),
        };
        store = new RefreshSessionStore(cache as any);
    });

    it('stores only a digest and typed session state', async () => {
        await store.create({
            token: 'raw-refresh-token',
            tokenId: 'token-1',
            familyId: 'family-1',
            userId: 'user-1',
            expiresAt: Date.now() + 60_000,
        });

        const [, state] = cache.setSecurity.mock.calls[0];
        expect(state.tokenDigest).not.toBe('raw-refresh-token');
        expect(JSON.stringify(state)).not.toContain('raw-refresh-token');
    });

    it.each([
        [['missing'], { status: 'missing' }],
        [['valid', JSON.stringify({ tokenId: 'token-1', familyId: 'family-1', userId: 'user-1', tokenDigest: 'digest', consumed: true })], { status: 'valid' }],
        [['reused', JSON.stringify({ tokenId: 'token-1', familyId: 'family-1', userId: 'user-1', tokenDigest: 'digest', consumed: true })], { status: 'reused' }],
    ])('maps atomic consume result %j', async (redisResult, expected) => {
        cache.evalSecurity.mockResolvedValue(redisResult);
        const result = await store.consume('family-1', 'token-1');
        expect(result.status).toBe(expected.status);
    });

    it('invalidates a family by namespace scan', async () => {
        await store.invalidateFamily('family-1');
        expect(cache.deleteSecurityByPattern).toHaveBeenCalledWith('auth:refresh:family-1:*');
    });

    it('invalidates all sessions belonging to user', async () => {
        const state: RefreshSessionState = {
            tokenId: 'token-1', familyId: 'family-1', userId: 'user-1', tokenDigest: 'digest', consumed: false, expiresAt: Date.now() + 1000,
        };
        cache.scanSecurity.mockResolvedValue(['auth:refresh:family-1:token-1']);
        cache.getSecurity.mockResolvedValue(state);

        await store.invalidateUserSessions('user-1');
        expect(cache.deleteSecurity).toHaveBeenCalledWith('auth:refresh:family-1:token-1');
    });

    describe('fails closed when the Redis security store is unavailable', () => {
        const unavailable = new Error('Redis security store unavailable');

        it.each([
            ['create', (s: RefreshSessionStore) => s.create({
                token: 't', tokenId: 'token-1', familyId: 'family-1', userId: 'user-1', expiresAt: Date.now() + 60_000,
            })],
            ['consume', (s: RefreshSessionStore) => s.consume('family-1', 'token-1')],
            ['invalidateFamily', (s: RefreshSessionStore) => s.invalidateFamily('family-1')],
            ['invalidateUserSessions', (s: RefreshSessionStore) => s.invalidateUserSessions('user-1')],
        ])('%s raises ServiceUnavailableException', async (_name, call) => {
            cache.setSecurity.mockRejectedValue(unavailable);
            cache.evalSecurity.mockRejectedValue(unavailable);
            cache.deleteSecurityByPattern.mockRejectedValue(unavailable);
            cache.scanSecurity.mockRejectedValue(unavailable);

            await expect(call(store)).rejects.toBeInstanceOf(ServiceUnavailableException);
        });

        it('does not leak the underlying failure in the response body', async () => {
            cache.evalSecurity.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:6379'));

            const error = await store.consume('family-1', 'token-1').catch((e) => e);
            expect(JSON.stringify((error as ServiceUnavailableException).getResponse()))
                .not.toContain('ECONNREFUSED');
        });
    });
});

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.clearAllMocks());

