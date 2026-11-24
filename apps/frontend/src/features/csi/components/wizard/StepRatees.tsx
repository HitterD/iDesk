import { isOrgCsiScope } from '../../lib/csiAdmin';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { RateeAssignment } from '../admin/RateeAssignment';
import { PicAssignment } from '../admin/hc/PicAssignment';

export function StepRatees({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange: (dirty: boolean) => void;
}) {
    // HC/Procurement rates PICs from the PIC master (layanan / bagian), never user accounts: only PIC ratees reach the report
    // and the Penilai step, whether respondents pick their PICs or admin decides who rates whom.
    if (isOrgCsiScope(scope)) return <PicAssignment scope={scope} period={period} onDirtyChange={onDirtyChange} />;
    return <RateeAssignment scope={scope} period={period} onDirtyChange={onDirtyChange} />;
}
