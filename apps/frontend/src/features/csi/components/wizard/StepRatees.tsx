import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { RateeAssignment } from '../admin/RateeAssignment';

export function StepRatees({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange: (dirty: boolean) => void;
}) {
    return <RateeAssignment scope={scope} period={period} onDirtyChange={onDirtyChange} />;
}
