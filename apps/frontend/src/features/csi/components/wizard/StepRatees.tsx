import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { RateeAssignment } from '../admin/RateeAssignment';
import { PicAssignment } from '../admin/hc/PicAssignment';

export function StepRatees({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange: (dirty: boolean) => void;
}) {
    // HC rates PICs from the HC PIC master (layanan / bagian), never user accounts: only PIC ratees reach the HC report
    // and the Penilai step, whether respondents pick their PICs or HC decides who rates whom.
    if (scope === 'hc') return <PicAssignment scope={scope} period={period} onDirtyChange={onDirtyChange} />;
    return <RateeAssignment scope={scope} period={period} onDirtyChange={onDirtyChange} />;
}
