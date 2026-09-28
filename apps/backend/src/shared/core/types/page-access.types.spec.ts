import { getRoleDefaultPageAccess, isValidPageKey } from './page-access.types';

const ADMIN_ONLY_PAGES = ['agents', 'automation', 'audit_logs', 'system_health', 'data_wipe', 'settings'];

describe('getRoleDefaultPageAccess', () => {
    it.each(['AGENT', 'AGENT_ADMIN', 'AGENT_OPERATIONAL_SUPPORT', 'MANAGER', 'USER'])(
        'never grants admin-only pages to %s',
        (role) => {
            const access = getRoleDefaultPageAccess(role);
            ADMIN_ONLY_PAGES.forEach((page) => expect(access[page as keyof typeof access]).toBeUndefined());
        },
    );

    it('gives USER the standard pages without zoom_calendar', () => {
        const access = getRoleDefaultPageAccess('USER');
        expect(access.tickets).toBe(true);
        expect(access.eform_access).toBe(true);
        expect(access.zoom_calendar).toBeUndefined();
    });

    it('limits developer agents to their request queues', () => {
        expect(Object.keys(getRoleDefaultPageAccess('AGENT_ORACLE')).sort()).toEqual(
            ['mobile_dev_tickets', 'notifications', 'oracle_k2_tickets', 'web_dev_tickets'],
        );
    });

    it('grants workloads to MANAGER and everything to ADMIN', () => {
        expect(getRoleDefaultPageAccess('MANAGER').workloads).toBe(true);
        expect(getRoleDefaultPageAccess('ADMIN').settings).toBe(true);
    });

    it('falls back to USER access for unknown or missing roles', () => {
        expect(getRoleDefaultPageAccess('SOMETHING')).toEqual(getRoleDefaultPageAccess('USER'));
        expect(getRoleDefaultPageAccess(null)).toEqual(getRoleDefaultPageAccess('USER'));
    });

    it('no longer recognises the removed lost_items page', () => {
        expect(isValidPageKey('lost_items')).toBe(false);
    });
});
