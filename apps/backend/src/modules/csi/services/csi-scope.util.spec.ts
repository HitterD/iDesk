import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { assertHcScope, assertOrgCsiScope } from './csi-scope.util';

describe('assertHcScope / assertOrgCsiScope', () => {
    it('accepts HC and PROCUREMENT and rejects ICT with a 400', () => {
        expect(assertHcScope(ServiceScope.HC)).toBe(ServiceScope.HC);
        expect(assertHcScope(ServiceScope.PROCUREMENT)).toBe(ServiceScope.PROCUREMENT);
        expect(assertOrgCsiScope(ServiceScope.PROCUREMENT)).toBe(ServiceScope.PROCUREMENT);
        expect(() => assertHcScope(ServiceScope.ICT)).toThrow(BadRequestException);
    });
});
