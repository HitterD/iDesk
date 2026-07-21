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
