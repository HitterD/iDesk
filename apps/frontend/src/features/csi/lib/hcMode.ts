import type { CsiPeriod, CsiScopeParam } from '../types';

/** HC/Procurement survey where admin decides who rates which PIC (the default; respondent picking is opt-in). */
export const isHcDecided = (scope: CsiScopeParam, period: Pick<CsiPeriod, 'respondentPicks' | 'respondentMode'>) =>
    (scope === 'hc' || scope === 'procurement') && !period.respondentPicks && period.respondentMode === 'LISTED';
