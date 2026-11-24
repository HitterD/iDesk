import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../shared/core/utils/service-scope.util';
import {
    CSI_ADMIN_PAGE_KEY, CSI_COMMENT_MAX, CSI_RESET_REASON_MIN, CSI_SCORE_MAX, CSI_SCORE_MIN,
    CsiRespondentMode, isOrgCsiScope, parseCsiScope,
} from './csi.constants';

describe('CSI constants', () => {
    it('defines the survey limits and respondent modes', () => {
        expect([CSI_SCORE_MIN, CSI_SCORE_MAX, CSI_COMMENT_MAX, CSI_RESET_REASON_MIN]).toEqual([1, 5, 1000, 5]);
        expect(CsiRespondentMode).toEqual({ OPEN: 'OPEN', LISTED: 'LISTED' });
        expect(CSI_ADMIN_PAGE_KEY).toEqual({ ICT: 'csi_admin_ict', HC: 'csi_admin_hc', PROCUREMENT: 'csi_admin_procurement' });
    });

    it.each([['ict', ServiceScope.ICT], ['hc', ServiceScope.HC], ['procurement', ServiceScope.PROCUREMENT]])('parses %s', (raw, scope) => {
        expect(parseCsiScope(raw)).toBe(scope);
    });

    it('treats HC and PROCUREMENT as org CSI scopes', () => {
        expect(isOrgCsiScope(ServiceScope.HC)).toBe(true);
        expect(isOrgCsiScope(ServiceScope.PROCUREMENT)).toBe(true);
        expect(isOrgCsiScope(ServiceScope.ICT)).toBe(false);
    });

    it.each(['ICT', 'HC', 'PROCUREMENT', '', 'unknown', ' ict'])('rejects invalid scope %s', raw => {
        expect(() => parseCsiScope(raw)).toThrow(BadRequestException);
    });
});
