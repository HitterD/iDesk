import { useCallback, useEffect, useState } from 'react';
import { useCsiRaters } from '../../hooks/useCsi';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { PeriodRaters } from '../admin/PeriodRaters';
import { AddRatersPanel } from '../admin/raters/AddRatersPanel';
import { PairsPanel } from './StepPairs';
import { WIZARD_COPY } from './wizardCopy';

/** LISTED only: tick who fills this survey (from the Daftar penilai), add missing people, then choose who rates whom. */
export function StepRaters({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange: (dirty: boolean) => void;
}) {
    const { data: raters = [] } = useCsiRaters(scope);
    // Two editors on this step (raters ticked, pair matrix): navigation waits while either has unsaved changes.
    const [dirty, setDirty] = useState({ raters: false, pairs: false });
    const ratersDirty = useCallback((value: boolean) => setDirty((current) => ({ ...current, raters: value })), []);
    const pairsDirty = useCallback((value: boolean) => setDirty((current) => ({ ...current, pairs: value })), []);
    useEffect(() => { onDirtyChange(dirty.raters || dirty.pairs); }, [dirty, onDirtyChange]);
    const registered = new Set(raters.map((rater) => rater.userId));
    return (
        <div className="grid gap-5">
            <PeriodRaters scope={scope} period={period} onDirtyChange={ratersDirty} />
            <details className="group rounded-[18px] bg-[hsl(var(--idesk-surface))] shadow-[var(--dash-shadow-1)]">
                <summary className="cursor-pointer list-none px-5 py-4 text-[14px] font-semibold sm:px-6">
                    <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden="true">›</span>
                    Tambah orang ke Daftar penilai
                    <span className="ml-2 text-[12.5px] font-normal text-[hsl(var(--idesk-text-secondary))]">{WIZARD_COPY.ratersNote}</span>
                </summary>
                <div className="px-5 pb-5 sm:px-6"><AddRatersPanel scope={scope} registered={registered} /></div>
            </details>
            {period.raters.length > 0 && <PairsPanel scope={scope} period={period} onDirtyChange={pairsDirty} />}
        </div>
    );
}
