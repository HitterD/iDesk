import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { CacheService } from '../../../shared/core/cache/cache.service';
import { PageAccess } from '../../../shared/core/types/page-access.types';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { PermissionPreset } from '../../permissions/entities/permission-preset.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { CsiAdminGuard, CsiWriterOnly } from './csi-admin.guard';

const USER_ID = 'user-1';
const PRESET_ID = 'preset-1';
type CachedAccess = { user: User; pageAccess: PageAccess } | null;

describe('CsiAdminGuard', () => {
    const userRepo = { findOne: jest.fn() };
    const presetRepo = { findOne: jest.fn() };
    const ownerRepo = { count: jest.fn() };
    const entries = new Map<string, CachedAccess>();
    const cache = {
        getOrSet: jest.fn(async (key: string, factory: () => Promise<CachedAccess>) => {
            if (!entries.has(key)) entries.set(key, await factory());
            return entries.get(key);
        }),
    };
    let guard: CsiAdminGuard;

    beforeEach(() => {
        jest.clearAllMocks();
        entries.clear();
        userRepo.findOne.mockResolvedValue({ id: USER_ID, role: UserRole.ADMIN });
        presetRepo.findOne.mockResolvedValue(null);
        guard = new CsiAdminGuard(
            userRepo as unknown as Repository<User>,
            presetRepo as unknown as Repository<PermissionPreset>,
            cache as unknown as CacheService,
            new ConfigService({ PAGE_ACCESS_CACHE_TTL: '123' }),
            ownerRepo as never,
        );
        ownerRepo.count.mockResolvedValue(0);
    });

    function context(scope: string, user: { userId?: string; role?: UserRole } = { userId: USER_ID }, method = 'GET', handler: () => void = () => undefined) {
        const request = { params: { scope }, user, method, csiScope: undefined as ServiceScope | undefined, csiReadOnly: undefined as boolean | undefined };
        const executionContext = { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler } as unknown as ExecutionContext;
        return { request, executionContext };
    }

    function withPreset(role: UserRole, pageAccess: PageAccess) {
        userRepo.findOne.mockResolvedValue({ id: USER_ID, role, appliedPresetId: PRESET_ID });
        presetRepo.findOne.mockResolvedValue({ id: PRESET_ID, pageAccess });
    }

    it('allows MANAGER with csi_admin_hc for hc and attaches normalized scope', async () => {
        withPreset(UserRole.MANAGER, { csi_admin_hc: true });
        const { request, executionContext } = context('hc');
        await expect(guard.canActivate(executionContext)).resolves.toBe(true);
        expect(request.csiScope).toBe(ServiceScope.HC);
    });

    it('allows ADMIN for hc without any page key (System Administrator always opens Admin HC)', async () => {
        const { request, executionContext } = context('hc');
        await expect(guard.canActivate(executionContext)).resolves.toBe(true);
        expect(request.csiScope).toBe(ServiceScope.HC);
    });

    it('HC_ADMIN administers HC only, never ICT (whatever its preset says)', async () => {
        withPreset(UserRole.HC_ADMIN, { csi_admin_ict: true });
        await expect(guard.canActivate(context('hc').executionContext)).resolves.toBe(true);
        await expect(guard.canActivate(context('ict').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('MANAGER without the key reads ICT (GET) read-only, but never HC', async () => {
        withPreset(UserRole.MANAGER, {});
        const { request, executionContext } = context('ict');
        await expect(guard.canActivate(executionContext)).resolves.toBe(true);
        expect(request.csiReadOnly).toBe(true);
        await expect(guard.canActivate(context('hc').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('MANAGER with the key writes normally (not read-only)', async () => {
        withPreset(UserRole.MANAGER, { csi_admin_ict: true });
        const { request, executionContext } = context('ict', { userId: USER_ID }, 'DELETE');
        await expect(guard.canActivate(executionContext)).resolves.toBe(true);
        expect(request.csiReadOnly).toBe(false);
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('read-only viewer is refused %s', async (method) => {
        withPreset(UserRole.MANAGER, {});
        await expect(guard.canActivate(context('ict', { userId: USER_ID }, method).executionContext)).rejects.toThrow('Hanya lihat');
    });

    it('read-only viewer is refused on a @CsiWriterOnly GET (rater names / raw data)', async () => {
        withPreset(UserRole.MANAGER, {});
        class Probe { @CsiWriterOnly() sensitive() { return 1; } }
        const handler = Probe.prototype.sensitive;
        await expect(guard.canActivate(context('ict', { userId: USER_ID }, 'GET', handler).executionContext)).rejects.toThrow('Hanya lihat');
    });

    it('a @CsiWriterOnly GET still works for a writer', async () => {
        class Probe { @CsiWriterOnly() sensitive() { return 1; } }
        await expect(guard.canActivate(context('hc', { userId: USER_ID }, 'GET', Probe.prototype.sensitive).executionContext)).resolves.toBe(true);
    });

    it('a service report owner of any role reads the scope read-only', async () => {
        withPreset(UserRole.USER, {});
        ownerRepo.count.mockResolvedValue(1);
        const { request, executionContext } = context('ict');
        await expect(guard.canActivate(executionContext)).resolves.toBe(true);
        expect(request.csiReadOnly).toBe(true);
        expect(ownerRepo.count).toHaveBeenCalledWith({ where: { scope: ServiceScope.ICT, userId: USER_ID } });
    });

    it('an ICT owner never reads HC, and an HC owner never reads ICT', async () => {
        withPreset(UserRole.USER, {});
        ownerRepo.count.mockImplementation(async ({ where }: any) => (where.scope === ServiceScope.ICT ? 1 : 0));
        await expect(guard.canActivate(context('ict').executionContext)).resolves.toBe(true);
        await expect(guard.canActivate(context('hc').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
        ownerRepo.count.mockImplementation(async ({ where }: any) => (where.scope === ServiceScope.HC ? 1 : 0));
        await expect(guard.canActivate(context('hc').executionContext)).resolves.toBe(true);
        await expect(guard.canActivate(context('ict').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('a non-owner USER stays denied', async () => {
        withPreset(UserRole.USER, {});
        await expect(guard.canActivate(context('ict').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('HC_ADMIN never reads ICT through the role (only as an owner)', async () => {
        withPreset(UserRole.HC_ADMIN, {});
        await expect(guard.canActivate(context('ict').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows ADMIN default for ict', async () => {
        const { request, executionContext } = context('ict');
        await expect(guard.canActivate(executionContext)).resolves.toBe(true);
        expect(request.csiScope).toBe(ServiceScope.ICT);
    });

    it.each([UserRole.USER, UserRole.AGENT])('denies %s with csi_admin_ict in preset (not an owner)', async (role) => {
        withPreset(role, { csi_admin_ict: true });
        await expect(guard.canActivate(context('ict').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(['ga', 'ICT', ''])('returns 400 for scope %j', async (scope) => {
        await expect(guard.canActivate(context(scope).executionContext)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('denies missing userId', async () => {
        await expect(guard.canActivate(context('ict', {}).executionContext)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies a user missing from the database', async () => {
        userRepo.findOne.mockResolvedValue(null);
        await expect(guard.canActivate(context('ict').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('uses database role rather than JWT role', async () => {
        withPreset(UserRole.USER, { csi_admin_ict: true });
        await expect(guard.canActivate(context('ict', { userId: USER_ID, role: UserRole.ADMIN }).executionContext))
            .rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each([{}, { csi_admin_ict: false }, { csi_admin_ict: 'true' }])(
        'does not merge ADMIN defaults into preset %j', async (pageAccess) => {
            withPreset(UserRole.ADMIN, pageAccess as PageAccess);
            await expect(guard.canActivate(context('ict', { userId: USER_ID }, 'POST').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
        },
    );

    it('does not grant HC writes from an ICT-only preset', async () => {
        withPreset(UserRole.MANAGER, { csi_admin_ict: true });
        await expect(guard.canActivate(context('hc', { userId: USER_ID }, 'PUT').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('falls back to ADMIN defaults when applied preset is missing', async () => {
        userRepo.findOne.mockResolvedValue({ id: USER_ID, role: UserRole.ADMIN, appliedPresetId: PRESET_ID });
        await expect(guard.canActivate(context('ict').executionContext)).resolves.toBe(true);
    });

    it('reuses the shared key and payload, and reloads after invalidation', async () => {
        entries.set(`pageAccess:${USER_ID}`, {
            user: { id: USER_ID, role: UserRole.MANAGER } as User,
            pageAccess: { csi_admin_hc: true },
        });
        await expect(guard.canActivate(context('hc').executionContext)).resolves.toBe(true);
        expect(userRepo.findOne).not.toHaveBeenCalled();
        entries.delete(`pageAccess:${USER_ID}`);
        userRepo.findOne.mockResolvedValue({ id: USER_ID, role: UserRole.MANAGER });
        await expect(guard.canActivate(context('hc', { userId: USER_ID }, 'POST').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
        expect(cache.getOrSet).toHaveBeenLastCalledWith(`pageAccess:${USER_ID}`, expect.any(Function), 123);
        expect(userRepo.findOne).toHaveBeenCalledWith({
            where: { id: USER_ID }, select: ['id', 'role', 'appliedPresetId', 'isActive'],
        });
    });

    it('denies a deactivated user even if their role/preset would otherwise allow', async () => {
        userRepo.findOne.mockResolvedValue({ id: USER_ID, role: UserRole.ADMIN, isActive: false });
        await expect(guard.canActivate(context('hc').executionContext)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('propagates lookup failures without granting access', async () => {
        const error = new Error('database unavailable');
        userRepo.findOne.mockRejectedValueOnce(error);
        await expect(guard.canActivate(context('ict').executionContext)).rejects.toBe(error);
    });
});
