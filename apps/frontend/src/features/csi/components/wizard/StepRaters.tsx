import { useCsiRaters } from '../../hooks/useCsi';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { AdminSection } from '../admin/AdminParts';
import { PeriodRaters } from '../admin/PeriodRaters';
import { AddRatersPanel } from '../admin/raters/AddRatersPanel';
import { WIZARD_COPY } from './wizardCopy';

/** LISTED only: register missing raters (same ways as Pengaturan; they join the scope list), then tick who fills this survey. */
export function StepRaters({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange: (dirty: boolean) => void;
}) {
    const { data: raters = [] } = useCsiRaters(scope);
    const registered = new Set(raters.map((rater) => rater.userId));
    return (
        <div className="grid gap-5">
            <AdminSection title="Tambah penilai terdaftar" description={WIZARD_COPY.ratersNote}>
                <AddRatersPanel scope={scope} registered={registered} />
            </AdminSection>
            <PeriodRaters scope={scope} period={period} onDirtyChange={onDirtyChange} />
        </div>
    );
}
