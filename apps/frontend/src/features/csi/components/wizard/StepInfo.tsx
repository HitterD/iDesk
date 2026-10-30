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
}

export function StepInfo({ scope, period, formRef, onStatusChange, onSaved }: StepInfoProps) {
    // Copy sources are only needed (and fetched) while creating.
    const { data: periods = [] } = useCsiPeriods(scope);
    return (
        <AdminSection title={STEP_TITLES.info} description="Judul, teks pembuka, tanggal, dan siapa yang boleh mengisi.">
            <PeriodEditor key={period?.id ?? 'new'} scope={scope} period={period} periods={period ? [] : periods}
                formRef={formRef} onStatusChange={onStatusChange} onSaved={onSaved} />
        </AdminSection>
    );
}
