import { describe, expect, it } from 'vitest';
import { ROLE_ORDER } from '@/features/admin/components/agent-management/agent-types';
import { groupRolesByScope, scopeOfRole } from '../service-scope';

describe('service scope (frontend mirror)', () => {
    it('maps every agent role and MANAGER to ICT', () => {
        for (const role of ['AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ADMIN', 'AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV', 'MANAGER']) {
            expect(scopeOfRole(role)).toBe('ICT');
        }
    });

    it('leaves ADMIN (cross-scope), USER and unknown roles without a scope', () => {
        expect(scopeOfRole('ADMIN')).toBeNull();
        expect(scopeOfRole('USER')).toBeNull();
        expect(scopeOfRole('SOMETHING_NEW')).toBeNull();
        expect(scopeOfRole(undefined)).toBeNull();
    });

    it('groups the agent-management role list as ADMIN, then all ICT roles, then USER', () => {
        const groups = groupRolesByScope([...ROLE_ORDER].reverse());
        expect(groups.map(g => g.scope)).toEqual([null, 'ICT', null]);
        expect(groups[0].roles).toEqual(['ADMIN']);
        expect(groups[1].roles).toHaveLength(7);
        expect(groups[2].roles).toEqual(['USER']);
    });
});
