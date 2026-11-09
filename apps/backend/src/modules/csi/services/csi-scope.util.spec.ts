import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { assertHcScope } from './csi-scope.util';

describe('assertHcScope', () => {
    it('accepts HC and rejects ICT with a 400', () => {
        expect(assertHcScope(ServiceScope.HC)).toBe(ServiceScope.HC);
        expect(() => assertHcScope(ServiceScope.ICT)).toThrow(BadRequestException);
    });
});
