import type { CsiPeriod, CsiScopeParam } from '../types';

/** HC survey where HC decides who rates which PIC (the default; respondent picking is the opt-in alternative). */
export const isHcDecided = (scope: CsiScopeParam, period: Pick<CsiPeriod, 'respondentPicks' | 'respondentMode'>) =>
    scope === 'hc' && !period.respondentPicks && period.respondentMode === 'LISTED';
