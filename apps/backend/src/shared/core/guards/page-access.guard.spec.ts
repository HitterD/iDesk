import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { AuditService } from '../../../modules/audit/audit.service';
import { PermissionPreset } from '../../../modules/permissions/entities/permission-preset.entity';
import { User } from '../../../modules/users/entities/user.entity';
import { UserRole } from '../../../modules/users/enums/user-role.enum';
import { CacheService } from '../cache/cache.service';
import { PageAccessGuard } from './page-access.guard';

const USER_ID = 'user-1';

describe('PageAccessGuard shared resolution regression', () => {
    const reflector = { getAllAndOverride: jest.fn() };
    const userRepo = { findOne: jest.fn() };
    const presetRepo = { findOne: jest.fn() };
    const cache = {
        getOrSet: jest.fn(async (_key, factory) => factory()),
        getAsync: jest.fn(), setAsync: jest.fn(), delAsync: jest.fn(),
    };
    const audit = { logAsync: jest.fn() };
    let guard: PageAccessGuard;
    const context = (user = { userId: USER_ID }) => ({
        getHandler: () => ({}), getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        reflector.getAllAndOverride.mockReturnValue('dashboard');
        userRepo.findOne.mockResolvedValue({ id: USER_ID, role: UserRole.USER });
        presetRepo.findOne.mockResolvedValue(null);
        cache.getAsync.mockResolvedValue(undefined);
        guard = new PageAccessGuard(
            reflector as unknown as Reflector,
            userRepo as unknown as Repository<User>,
            presetRepo as unknown as Repository<PermissionPreset>,
            cache as unknown as CacheService, new ConfigService(), audit as unknown as AuditService,
        );
    });

    it('keeps undecorated routes unrestricted', async () => {
        reflector.getAllAndOverride.mockReturnValue(undefined);
        await expect(guard.canActivate(context())).resolves.toBe(true);
        expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('keeps ADMIN bypass even for an empty applied preset', async () => {
        reflector.getAllAndOverride.mockReturnValue('csi_admin_hc');
        userRepo.findOne.mockResolvedValue({ id: USER_ID, role: UserRole.ADMIN, appliedPresetId: 'preset-1' });
        presetRepo.findOne.mockResolvedValue({ pageAccess: {} });
        await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it('uses role defaults and the unchanged cache contract', async () => {
        await expect(guard.canActivate(context())).resolves.toBe(true);
        expect(cache.getOrSet).toHaveBeenCalledWith(`pageAccess:${USER_ID}`, expect.any(Function), 300);
        expect(userRepo.findOne).toHaveBeenCalledWith({
            where: { id: USER_ID }, select: ['id', 'role', 'appliedPresetId'],
        });
    });

    it('does not merge defaults into an empty preset and retains denial auditing', async () => {
        userRepo.findOne.mockResolvedValue({ id: USER_ID, role: UserRole.USER, appliedPresetId: 'preset-1' });
        presetRepo.findOne.mockResolvedValue({ pageAccess: {} });
        await expect(guard.canActivate(context())).rejects.toThrow("Access denied: 'dashboard' permission required");
        expect(audit.logAsync).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID, entityId: 'dashboard' }));
        expect(cache.setAsync).toHaveBeenCalledWith(`accessDenials:${USER_ID}`, 1, 300);
    });

    it.each([null, { pageAccess: null }])('falls back when preset is %j', async (preset) => {
        userRepo.findOne.mockResolvedValue({ id: USER_ID, role: UserRole.USER, appliedPresetId: 'preset-1' });
        presetRepo.findOne.mockResolvedValue(preset);
        await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it.each(['any', 'all'])('keeps %s page checks', async (type) => {
        reflector.getAllAndOverride.mockReturnValue({ type, pages: ['dashboard', 'tickets'] });
        await expect(guard.canActivate(context())).resolves.toBe(true);
        reflector.getAllAndOverride.mockReturnValue({ type, pages: ['csi_admin_hc', 'csi_admin_ict'] });
        await expect(guard.canActivate(context())).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('keeps missing user rejection', async () => {
        userRepo.findOne.mockResolvedValue(null);
        await expect(guard.canActivate(context())).rejects.toThrow('User not found');
    });

    it('keeps lockout behavior on single page denial', async () => {
        reflector.getAllAndOverride.mockReturnValue('csi_admin_hc');
        cache.getAsync.mockResolvedValue(true);
        await expect(guard.canActivate(context())).rejects.toThrow('Account temporarily locked');
        expect(audit.logAsync).not.toHaveBeenCalled();
    });
});
