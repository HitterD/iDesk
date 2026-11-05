import { describe, it, expect } from 'vitest';
import { getRoleHome, portalEquivalent } from '../roleHome';

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

    it('lands HC_ADMIN on the HC admin area', () => {
        expect(getRoleHome('HC_ADMIN')).toBe('/csi/admin/hc');
    });

    it('falls back to the client portal for unknown roles', () => {
        expect(getRoleHome(undefined)).toBe('/client/my-tickets');
        expect(getRoleHome('SOMETHING')).toBe('/client/my-tickets');
    });
});

describe('portalEquivalent', () => {
    const id = '23841455-c9a9-494c-952f-e68309dc9fca';

    it('opens a requester ticket link in the agent workspace for agents and managers', () => {
        expect(portalEquivalent(`/client/tickets/${id}`, 'AGENT_OPERATIONAL_SUPPORT')).toBe(`/tickets/${id}`);
        expect(portalEquivalent(`/client/tickets/${id}?tab=chat#m1`, 'MANAGER')).toBe(`/tickets/${id}?tab=chat#m1`);
    });

    it('opens an agent ticket link in the client portal for requesters', () => {
        expect(portalEquivalent(`/tickets/${id}`, 'USER')).toBe(`/client/tickets/${id}`);
    });

    it('leaves non-ticket pages and ticket list routes alone', () => {
        expect(portalEquivalent('/client/my-tickets', 'AGENT')).toBeNull();
        expect(portalEquivalent('/tickets/list', 'USER')).toBeNull();
        expect(portalEquivalent('/dashboard', 'USER')).toBeNull();
    });
});
