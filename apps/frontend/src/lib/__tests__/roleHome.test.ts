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

describe('portalEquivalent — notification and email links', () => {
    const id = '23841455-c9a9-494c-952f-e68309dc9fca';

    it('opens hardware, e-form, Zoom and CSI pages in each portal', () => {
        expect(portalEquivalent(`/hardware-requests/${id}`, 'USER')).toBe(`/client/hardware-requests/${id}`);
        expect(portalEquivalent(`/hardware-requests/${id}`, 'MANAGER')).toBe(`/manager/hardware-requests/${id}`);
        expect(portalEquivalent(`/hardware-requests/${id}`, 'AGENT')).toBe(`/hardware-requests/${id}`);
        expect(portalEquivalent(`/client/eform-access/${id}`, 'AGENT_OPERATIONAL_SUPPORT')).toBe(`/eform-access/${id}`);
        expect(portalEquivalent('/zoom-calendar?booking=b-1', 'USER')).toBe('/client/zoom-calendar?booking=b-1');
        expect(portalEquivalent('/csi/p1', 'MANAGER')).toBe('/manager/csi/p1');
    });

    it('maps old links that point at pages which do not exist', () => {
        expect(portalEquivalent('/vpn-access', 'AGENT')).toBe('/renewal?tab=vpn');
        expect(portalEquivalent('/vpn-access', 'MANAGER')).toBe('/manager/renewal?tab=vpn');
        expect(portalEquivalent(`/renewals/${id}`, 'ADMIN')).toBe('/renewal?tab=contracts');
        expect(portalEquivalent(`/eform/requests/${id}`, 'USER')).toBe(`/client/eform-access/${id}`);
        expect(portalEquivalent('/zoom', 'USER')).toBe('/client/zoom-calendar');
        expect(portalEquivalent('/zoom-booking/b-9', 'AGENT')).toBe('/zoom-calendar?booking=b-9');
    });

    it('keeps the query and hash of the link', () => {
        expect(portalEquivalent(`/tickets/${id}?nid=n1#m2`, 'USER')).toBe(`/client/tickets/${id}?nid=n1#m2`);
        expect(portalEquivalent('/vpn-access?nid=n1', 'AGENT')).toBe('/renewal?tab=vpn&nid=n1');
    });

    it('has no requester page for renewals', () => {
        expect(portalEquivalent('/renewal?tab=contracts', 'USER')).toBeNull();
    });
});
