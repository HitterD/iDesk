import { ForbiddenException } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { UserRole } from '../users/enums/user-role.enum';

describe('PermissionsService role presets', () => {
    const presetRepo = {
        findOne: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    };
    const service = new PermissionsService(
        {} as never,
        {} as never,
        presetRepo as never,
        {} as never,
        { delAsync: jest.fn() } as never,
        { notifyPresetChange: jest.fn() } as never,
    );

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it.each([
        [UserRole.USER, 'User'],
        [UserRole.AGENT, 'Agent'],
        [UserRole.AGENT_ADMIN, 'Agent'],
        [UserRole.AGENT_OPERATIONAL_SUPPORT, 'Agent Operational Support'],
        [UserRole.AGENT_ORACLE, 'Agent Oracle'],
        [UserRole.MANAGER, 'Manager'],
        [UserRole.ADMIN, 'Admin'],
    ])('resolves %s default preset', async (role, name) => {
        presetRepo.findOne.mockResolvedValue({ id: `${name}-preset` });

        await expect((service as any).resolveDefaultPresetId(role)).resolves.toBe(`${name}-preset`);
        expect(presetRepo.findOne).toHaveBeenCalledWith({
            where: { name, isSystem: true, isActive: true },
            select: ['id'],
        });
    });

    it('throws ForbiddenException for system preset deletion', async () => {
        presetRepo.findOne.mockResolvedValue({ id: 'system-preset', isSystem: true });

        await expect(service.deletePreset('system-preset')).rejects.toBeInstanceOf(ForbiddenException);
    });
});

describe('PermissionsService cache invalidation', () => {
    const user = { id: 'u-1', appliedPresetId: 'p-1', appliedPresetName: 'Agent' };
    const userRepo = { findOne: jest.fn(), save: jest.fn(), find: jest.fn() };
    const permissionRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn((x) => x), delete: jest.fn() };
    const cache = { delAsync: jest.fn().mockResolvedValue(undefined), delByPattern: jest.fn().mockResolvedValue(undefined) };
    const service = new PermissionsService(
        {} as never,
        permissionRepo as never,
        {} as never,
        userRepo as never,
        cache as never,
        { notifyPresetChange: jest.fn() } as never,
    );

    beforeEach(() => {
        jest.clearAllMocks();
        userRepo.findOne.mockResolvedValue({ ...user });
    });

    // The permission guard caches `perm:<user>:<feature>:<action>` for 60s; a revoke must flush it.
    it('flushes per-feature permission cache when a preset is removed', async () => {
        await service.removePresetFromUser('u-1');

        expect(cache.delByPattern).toHaveBeenCalledWith('perm:u-1:*');
        expect(cache.delAsync).toHaveBeenCalledWith('pageAccess:u-1');
    });

    it('flushes per-feature permission cache after a manual permission update', async () => {
        permissionRepo.findOne.mockResolvedValue(null);

        await service.updateUserPermissions('u-1', [{ featureKey: 'tickets', canView: false } as never]);

        expect(cache.delByPattern).toHaveBeenCalledWith('perm:u-1:*');
    });
});

describe('PermissionsService page definitions after the request unification', () => {
    const service = new PermissionsService({} as never, {} as never, {} as never, {} as never, { delAsync: jest.fn() } as never, { notifyPresetChange: jest.fn() } as never);
    const keys = (role: 'USER' | 'AGENT' | 'MANAGER' | 'ADMIN') => service.getAvailablePagesForRole(role).map((page) => page.key);

    it('requesters and managers no longer have the Hardware Requests / E-Form Access pages: those are tickets now', () => {
        for (const role of ['USER', 'MANAGER'] as const) {
            expect(keys(role)).not.toContain('hardware_requests');
            expect(keys(role)).not.toContain('eform_access');
            expect(keys(role)).not.toContain('devices_access');
        }
    });

    it('IT staff (AGENT, ADMIN) get the one Perangkat & Akses page instead of the two', () => {
        for (const role of ['AGENT', 'ADMIN'] as const) {
            expect(keys(role)).toContain('devices_access');
            expect(keys(role)).not.toContain('hardware_requests');
            expect(keys(role)).not.toContain('eform_access');
        }
        expect(service.getAvailablePagesForRole('AGENT').find((page) => page.key === 'devices_access')).toMatchObject({ route: '/devices-access' });
    });
});
