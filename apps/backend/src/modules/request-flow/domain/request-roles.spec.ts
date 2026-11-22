import { UserRole } from '../../users/enums/user-role.enum';
import { REQUEST_DOCUMENT_VIEWER_ROLES, REQUEST_PROCESSOR_ROLES } from './request-roles';

describe('request roles', () => {
    it('processors are ADMIN, AGENT_ADMIN, AGENT_OPERATIONAL_SUPPORT and AGENT', () => {
        expect([...REQUEST_PROCESSOR_ROLES].sort()).toEqual(
            [UserRole.ADMIN, UserRole.AGENT_ADMIN, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT].sort(),
        );
    });

    it('document viewers add only MANAGER; other agents are excluded', () => {
        expect(REQUEST_DOCUMENT_VIEWER_ROLES).toEqual([...REQUEST_PROCESSOR_ROLES, UserRole.MANAGER]);
        expect(REQUEST_DOCUMENT_VIEWER_ROLES).not.toContain(UserRole.AGENT_ORACLE);
        expect(REQUEST_DOCUMENT_VIEWER_ROLES).not.toContain(UserRole.USER);
    });
});
