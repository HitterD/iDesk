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

    it.each(['editItems', 'procure', 'arrivals', 'review'] as const)('%s stays processor-only too', (method) => {
        expect(rolesOf(method)).toEqual([...REQUEST_PROCESSOR_ROLES]);
    });
});
