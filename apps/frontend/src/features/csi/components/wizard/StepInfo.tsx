import type { Ref } from 'react';
import { useCsiPeriods } from '../../hooks/useCsi';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { AdminSection } from '../admin/AdminParts';
import { PeriodEditor, type PeriodEditorStatus } from '../admin/PeriodEditor';
import { STEP_TITLES } from './wizardCopy';

interface StepInfoProps {
    scope: CsiScopeParam;
    period: CsiPeriodDetail | undefined;
    formRef: Ref<HTMLFormElement>;
    onStatusChange: (status: PeriodEditorStatus) => void;
    onSaved: (period: CsiPeriodDetail) => void;
    copyFrom?: string | null;
}

export function StepInfo({ scope, period, formRef, onStatusChange, onSaved, copyFrom }: StepInfoProps) {
    // Copy sources are only needed (and fetched) while creating.
    const { data: periods = [], isLoading } = useCsiPeriods(scope);
    // "Buat lagi" pre-fills from the source: wait for the list so the form starts already copied.
    if (!period && copyFrom && isLoading) return <AdminSection title={STEP_TITLES.info}><div className="h-40 animate-pulse rounded-xl bg-[hsl(var(--muted)/.5)] motion-reduce:animate-none" aria-busy="true" /></AdminSection>;
    return (
        <AdminSection title={STEP_TITLES.info} description="Judul, teks pembuka, tanggal, dan siapa yang boleh mengisi.">
            <PeriodEditor key={period?.id ?? 'new'} scope={scope} period={period} periods={period ? [] : periods} copyFrom={copyFrom}
                formRef={formRef} onStatusChange={onStatusChange} onSaved={onSaved} />
        </AdminSection>
    );
}
