import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../shared/core/utils/service-scope.util';
import { CSI_ADMIN_PAGE_KEY, CSI_COMMENT_MAX, CSI_RESET_REASON_MIN, CSI_SCORE_MAX, CSI_SCORE_MIN, CsiRespondentMode, parseCsiScope } from './csi.constants';

describe('CSI constants', () => {
    it('defines the survey limits and respondent modes', () => {
        expect([CSI_SCORE_MIN, CSI_SCORE_MAX, CSI_COMMENT_MAX, CSI_RESET_REASON_MIN]).toEqual([1, 5, 1000, 5]);
        expect(CsiRespondentMode).toEqual({ OPEN: 'OPEN', LISTED: 'LISTED' });
        expect(CSI_ADMIN_PAGE_KEY).toEqual({ ICT: 'csi_admin_ict', HC: 'csi_admin_hc' });
    });

    it.each([['ict', ServiceScope.ICT], ['hc', ServiceScope.HC]])('parses %s', (raw, scope) => {
        expect(parseCsiScope(raw)).toBe(scope);
    });

    it.each(['ICT', 'HC', '', 'unknown', ' ict'])('rejects invalid scope %s', raw => {
        expect(() => parseCsiScope(raw)).toThrow(BadRequestException);
    });
});
