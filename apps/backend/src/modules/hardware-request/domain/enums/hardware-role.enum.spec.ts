import { HardwareRole } from './hardware-role.enum';
import { pickRole } from '../../guards/hardware-role.guard';

/**
 * Services compare the acting role with the plain strings 'ICT_STAFF' / 'USER' (see InstallationScheduleService and
 * HardwareRequestCommandService.cancel), so the enum values must be exactly those strings at runtime.
 */
describe('HardwareRole', () => {
    it('keeps the literal values the services compare against', () => {
        expect(HardwareRole.ICT_STAFF).toBe('ICT_STAFF');
        expect(HardwareRole.USER).toBe('USER');
        expect(Object.keys(HardwareRole).sort()).toEqual(['ICT_STAFF', 'USER']);
    });

    it.each(['ADMIN', 'AGENT', 'AGENT_ADMIN', 'AGENT_OPERATIONAL_SUPPORT', 'MANAGER'])('maps %s to ICT_STAFF', (role) => {
        expect(pickRole({ role })).toBe('ICT_STAFF');
    });

    it('leaves a requester as USER', () => {
        expect(pickRole({ role: 'USER' })).toBe('USER');
    });
});
