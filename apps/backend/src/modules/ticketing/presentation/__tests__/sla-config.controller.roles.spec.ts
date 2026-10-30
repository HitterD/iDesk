import { Reflector } from '@nestjs/core';
import { SlaConfigController } from '../sla-config.controller';
import { UserRole } from '../../../users/enums/user-role.enum';

const rolesFor = (handler: keyof SlaConfigController) =>
    new Reflector().getAllAndOverride<UserRole[]>('roles', [SlaConfigController.prototype[handler] as () => unknown, SlaConfigController]);

describe('SlaConfigController roles', () => {
    it('lets every staff role read SLA targets (ticket detail priority picker), not requesters', () => {
        const readers = rolesFor('findAll');
        expect(readers).toEqual(expect.arrayContaining([UserRole.AGENT, UserRole.AGENT_WEB_DEV, UserRole.MANAGER, UserRole.ADMIN]));
        expect(readers).not.toContain(UserRole.USER);
    });

    it.each(['update', 'create', 'reset', 'delete'] as const)('keeps %s ADMIN-only', (handler) => {
        expect(rolesFor(handler)).toEqual([UserRole.ADMIN]);
    });
});
