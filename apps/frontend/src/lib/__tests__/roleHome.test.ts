import { describe, it, expect } from 'vitest';
import { getRoleHome } from '../roleHome';

describe('getRoleHome', () => {
    it('lands every agent role on their personal dashboard', () => {
        ['AGENT', 'AGENT_ADMIN', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV']
            .forEach((role) => expect(getRoleHome(role)).toBe('/dashboard/me'));
    });

    it('does not send AGENT_ADMIN to the client portal', () => {
        expect(getRoleHome('AGENT_ADMIN')).not.toBe('/client/my-tickets');
    });

    it('never sends developer agents to the team dashboard they cannot open', () => {
        ['AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV']
            .forEach((role) => expect(getRoleHome(role)).not.toBe('/dashboard'));
    });

    it('keeps ADMIN, MANAGER and USER homes', () => {
        expect(getRoleHome('ADMIN')).toBe('/dashboard');
        expect(getRoleHome('MANAGER')).toBe('/manager/dashboard');
        expect(getRoleHome('USER')).toBe('/client/my-tickets');
    });

    it('falls back to the client portal for unknown roles', () => {
        expect(getRoleHome(undefined)).toBe('/client/my-tickets');
        expect(getRoleHome('SOMETHING')).toBe('/client/my-tickets');
    });
});
