import { pickRole } from '../hardware-role.guard';
import { HardwareRole } from '../../domain/enums/hardware-role.enum';

describe('pickRole', () => {
    it.each([
        ['ADMIN'], ['MANAGER'], ['AGENT'], ['ICT_STAFF'], ['ICT_STAFF'],
        ['ICT_STAFF'], ['ICT_STAFF'], ['PROCUREMENT'], ['TECHNICIAN'],
        ['AGENT_OPERATIONAL_SUPPORT'], ['AGENT_ADMIN'],
    ])('maps %s -> ICT_STAFF', (r) => {
        expect(pickRole({ roles: [{ name: r }] } as any)).toBe(HardwareRole.ICT_STAFF);
        expect(pickRole({ role: r } as any)).toBe(HardwareRole.ICT_STAFF);
    });

    it('maps regular USER -> USER', () => {
        expect(pickRole({ roles: ['USER'] } as any)).toBe(HardwareRole.USER);
    });

    it('default unknown -> USER', () => {
        expect(pickRole({ roles: ['SOMETHING'] } as any)).toBe(HardwareRole.USER);
    });
});
