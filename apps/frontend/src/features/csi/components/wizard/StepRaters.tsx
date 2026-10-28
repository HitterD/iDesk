import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAddCsiRaters, useCsiRaters } from '../../hooks/useCsi';
import type { DraftUser } from '../../lib/csiAdmin';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { AdminSection, UserMultiPicker } from '../admin/AdminParts';
import { PeriodRaters } from '../admin/PeriodRaters';
import { WIZARD_COPY } from './wizardCopy';

/** LISTED only: register missing raters, then tick who fills this survey. */
export function StepRaters({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange: (dirty: boolean) => void;
}) {
    const { data: raters = [] } = useCsiRaters(scope);
    const add = useAddCsiRaters(scope);
    const [picked, setPicked] = useState<DraftUser[]>([]);
    const registered = new Set(raters.map((rater) => rater.userId));

    return (
        <div className="grid gap-5">
            <AdminSection title="Tambah penilai terdaftar" description={WIZARD_COPY.ratersNote}>
                <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[240px] flex-1">
                        <UserMultiPicker scope={scope} label="Pilih penilai" selected={picked} onChange={setPicked} excludeIds={registered} />
                    </div>
                    <Button variant="soft" loading={add.isPending} disabled={!picked.length}
                        onClick={() => add.mutate({ userIds: picked.map((user) => user.id) }, { onSuccess: () => setPicked([]) })}>
                        {WIZARD_COPY.add}
                    </Button>
                </div>
            </AdminSection>
            <PeriodRaters scope={scope} period={period} onDirtyChange={onDirtyChange} />
        </div>
    );
}
