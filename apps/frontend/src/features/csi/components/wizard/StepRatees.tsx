import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { RateeAssignment } from '../admin/RateeAssignment';
import { PicAssignment } from '../admin/hc/PicAssignment';

export function StepRatees({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange: (dirty: boolean) => void;
}) {
    // HC per PIC: the PICs come from the HC PIC master (layanan / bagian), not from user accounts.
    if (period.respondentPicks) return <PicAssignment scope={scope} period={period} onDirtyChange={onDirtyChange} />;
    return <RateeAssignment scope={scope} period={period} onDirtyChange={onDirtyChange} />;
}
