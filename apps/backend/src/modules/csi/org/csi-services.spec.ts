import * as fs from 'fs';
import * as path from 'path';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { UserRole } from '../../users/enums/user-role.enum';
import { CSI_SERVICES, ictServiceOfRole, serviceCodesOf, serviceNameOf } from './csi-services';

describe('CSI services per scope', () => {
    it('HC keeps HCC / HCD / HCS', () => {
        expect(serviceCodesOf(ServiceScope.HC)).toEqual(['HCC', 'HCD', 'HCS']);
        expect(serviceNameOf(ServiceScope.HC, 'HCD')).toBe('HC Development');
    });

    it('ICT services are the handling teams plus managers', () => {
        expect(serviceCodesOf(ServiceScope.ICT)).toEqual(['OPS', 'ORACLE', 'WEB', 'MOBILE', 'MGR']);
        expect(serviceNameOf(ServiceScope.ICT, 'ORACLE')).toBe('Oracle / K2');
        expect(CSI_SERVICES[ServiceScope.ICT].every((service) => service.name.length > 0)).toBe(true);
    });

    it('an ICT role maps to its team; other roles to none', () => {
        expect(ictServiceOfRole(UserRole.AGENT)).toBe('OPS');
        expect(ictServiceOfRole(UserRole.AGENT_ADMIN)).toBe('OPS');
        expect(ictServiceOfRole(UserRole.AGENT_OPERATIONAL_SUPPORT)).toBe('OPS');
        expect(ictServiceOfRole(UserRole.AGENT_ORACLE)).toBe('ORACLE');
        expect(ictServiceOfRole(UserRole.AGENT_WEB_DEV)).toBe('WEB');
        expect(ictServiceOfRole(UserRole.AGENT_MOBILE_DEV)).toBe('MOBILE');
        expect(ictServiceOfRole(UserRole.MANAGER)).toBe('MGR');
        expect(ictServiceOfRole(UserRole.USER)).toBeNull();
        expect(ictServiceOfRole(UserRole.HC_ADMIN)).toBeNull();
        expect(ictServiceOfRole(undefined)).toBeNull();
    });
});

describe('frontend copy of the services', () => {
    // apps/frontend/src/features/csi/lib/services.ts repeats the names for labels; they must not drift apart.
    const frontend = fs.readFileSync(path.resolve(__dirname, '../../../../../frontend/src/features/csi/lib/services.ts'), 'utf8');
    it.each([ServiceScope.HC, ServiceScope.ICT])('%s codes and names match', (scope) => {
        CSI_SERVICES[scope].forEach(({ code, name }) => expect(frontend).toContain(`${code}: '${name}'`));
    });
});
