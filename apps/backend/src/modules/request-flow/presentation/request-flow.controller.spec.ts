import { ROLES_KEY } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import { RequestFlowController } from './request-flow.controller';

describe('RequestFlowController roles', () => {
    const rolesOf = (method: keyof RequestFlowController) => Reflect.getMetadata(ROLES_KEY, RequestFlowController.prototype[method]) as UserRole[];

    it('install-done is limited to the request processor roles', () => {
        expect(rolesOf('installDone')).toEqual([...REQUEST_PROCESSOR_ROLES]);
        expect(rolesOf('installDone')).not.toContain(UserRole.USER);
        expect(rolesOf('installDone')).not.toContain(UserRole.MANAGER);
    });

    it.each(['fulfill', 'documentNumber'] as const)('%s is processor-only', (method) => {
        expect(rolesOf(method)).toEqual([...REQUEST_PROCESSOR_ROLES]);
    });

    it('confirm and credentials are open to every signed-in role; the service decides', () => {
        expect(rolesOf('confirm')).toEqual(Object.values(UserRole));
        expect(rolesOf('credentials')).toEqual(Object.values(UserRole));
    });

    it.each(['centerSchedule', 'centerAccess', 'centerSummary', 'centerRemind', 'centerRevoke'] as const)('%s is processor-only', (method) => {
        expect(rolesOf(method)).toEqual([...REQUEST_PROCESSOR_ROLES]);
    });

    it('reject is for IT only; cancel is open to every role and the service decides (requester or IT)', () => {
        expect(rolesOf('rejectByIt')).toEqual([...REQUEST_PROCESSOR_ROLES]);
        expect(rolesOf('cancel')).toEqual(Object.values(UserRole));
    });

    it('my-access is open to every signed-in role', () => {
        expect(rolesOf('myAccess')).toEqual(Object.values(UserRole));
    });

    it('approvals is open to every signed-in role; only the flow approvers get rows', () => {
        expect(rolesOf('approvals')).toEqual(Object.values(UserRole));
    });

    it('static routes are declared before the :ticketId routes so they are not swallowed by them', () => {
        const names = Object.getOwnPropertyNames(RequestFlowController.prototype);
        const path = (m: string) => Reflect.getMetadata('path', RequestFlowController.prototype[m as keyof RequestFlowController]) as string;
        const firstParam = names.findIndex((n) => String(path(n)).startsWith(':ticketId'));
        for (const m of ['approvals', 'myAccess', 'centerSchedule', 'centerAccess', 'centerSummary']) {
            expect(names.indexOf(m)).toBeLessThan(firstParam);
        }
    });

    it.each(['editItems', 'procure', 'arrivals', 'review'] as const)('%s stays processor-only too', (method) => {
        expect(rolesOf(method)).toEqual([...REQUEST_PROCESSOR_ROLES]);
    });
});
