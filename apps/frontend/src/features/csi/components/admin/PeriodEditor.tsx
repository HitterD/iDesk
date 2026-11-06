import { useEffect, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCsiPeriod, useUpdateCsiPeriod } from '../../hooks/useCsi';
import { CSI_MODE_LABELS, CSI_TEXT_MAX, CSI_TITLE_MAX } from '../../lib/csiAdmin';
import {
    datesInvalid, formDirty, targetRespondentsInvalid, initialState, nextPeriodForm, sectionsInvalid, slaInvalid, teamLabelInvalid, toCreatePayload, toUpdatePayload,
    withCopyMode, withCopySource, type PeriodFormState,
} from '../../lib/periodForm';
import type { CsiPeriodDetail, CsiPeriodListItem, CsiRespondentMode, CsiScopeParam } from '../../types';
import { WIZARD_COPY } from '../wizard/wizardCopy';
import { FIELD_LABEL, LockedNote } from './AdminParts';
import { CopySourceField } from './CopySourceField';
import { OverlapNotice } from './OverlapNotice';
import { SectionFields } from './SectionFields';
import { SiteChips } from './SiteChips';
import { HcRaterModeField } from './hc/HcRaterModeField';

const MODE_OPTIONS = (Object.keys(CSI_MODE_LABELS) as CsiRespondentMode[]).map((value) => ({ value, label: CSI_MODE_LABELS[value] }));
const DATE_ERROR_ID = 'csi-period-date-error';

export interface PeriodEditorStatus { canSubmit: boolean; dirty: boolean; pending: boolean }

interface PeriodEditorProps {
    scope: CsiScopeParam;
    /** Omit to create a new period. */
    period?: CsiPeriodDetail;
    /** Copy sources (create only). */
    periods?: readonly CsiPeriodListItem[];
    /** Called after a save, or immediately when an existing period is submitted unchanged. */
    onSaved: (period: CsiPeriodDetail) => void;
    /** Create only: start as a copy of this period with its next dates ("Buat lagi"). */
    copyFrom?: string | null;
    /** The wizard footer submits this form (`requestSubmit`) and mirrors its state. */
    formRef?: Ref<HTMLFormElement>;
    onStatusChange?: (status: PeriodEditorStatus) => void;
}

/** Survey info form (wizard step 1). Actions live in the wizard footer. */
export function PeriodEditor({ scope, period, periods = [], copyFrom, onSaved, formRef, onStatusChange }: PeriodEditorProps) {
    // Backend freezes sites, mode and sections once answers exist; only texts, dates and the SLA target stay editable.
    const locked = !!period?.locked;
    const [form, setForm] = useState(() => (!period && copyFrom && periods.length ? nextPeriodForm(scope, periods, copyFrom) : initialState(scope, period)));
    const create = useCreateCsiPeriod(scope);
    const update = useUpdateCsiPeriod(scope);
    const pending = create.isPending || update.isPending;
    const set: SetField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    const dirty = formDirty(form, period);
    const canSubmit = form.siteIds.length > 0 && !!form.title.trim() && !!form.startDate && !!form.endDate && !datesInvalid(form)
        && !sectionsInvalid(form) && !slaInvalid(form) && !teamLabelInvalid(form) && !targetRespondentsInvalid(form) && !pending;

    useEffect(() => { onStatusChange?.({ canSubmit, dirty, pending }); }, [canSubmit, dirty, pending, onStatusChange]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;
        const options = { onSuccess: (saved: CsiPeriodDetail) => onSaved(saved) };
        if (!period) create.mutate(toCreatePayload(form), options);
        else if (dirty) update.mutate({ id: period.id, payload: toUpdatePayload(form, locked, period) }, options);
        else onSaved(period);
    };

    return (
        <form ref={formRef} onSubmit={submit} className="grid gap-4" aria-label={WIZARD_COPY.create}>
            {!period && (
                <CopySourceField form={form} periods={periods} onModeChange={(copying) => setForm((current) => withCopyMode(current, copying))}
                    onSourceChange={(id) => setForm((current) => withCopySource(current, periods, id))} />
            )}
            <SiteChips value={form.siteIds} onChange={(value) => set('siteIds', value)} saved={period?.sites} locked={locked} />
            <label className="grid gap-1.5">
                <span className={FIELD_LABEL}>Judul</span>
                <Input value={form.title} maxLength={CSI_TITLE_MAX} onChange={(event) => set('title', event.target.value)} required placeholder="Survei Kepuasan Layanan Q4" />
            </label>
            <label className="grid gap-1.5">
                <span className={FIELD_LABEL}>Kalimat pembuka</span>
                <Textarea value={form.intro} maxLength={CSI_TEXT_MAX} rows={3} onChange={(event) => set('intro', event.target.value)} />
            </label>
            <label className="grid gap-1.5">
                <span className={FIELD_LABEL}>Kalimat terima kasih</span>
                <Textarea value={form.thankYou} maxLength={CSI_TEXT_MAX} rows={2} onChange={(event) => set('thankYou', event.target.value)} />
            </label>
            <DateAndModeFields form={form} set={set} modeLocked={locked}
                overlap={<OverlapNotice scope={scope} siteIds={form.siteIds} startDate={form.startDate} endDate={form.endDate} excludeId={period?.id}
                    onUseDates={(range) => setForm((current) => ({ ...current, ...range }))} />} />
            <SectionFields form={form} set={set} locked={locked} />
            {scope === 'hc' && <HcRaterModeField form={form} set={set} locked={locked} />}
        </form>
    );
}

type SetField = <K extends keyof PeriodFormState>(key: K, value: PeriodFormState[K]) => void;

function DateAndModeFields({ form, set, modeLocked, overlap }: { form: PeriodFormState; set: SetField; modeLocked: boolean; overlap?: ReactNode }) {
    const invalidDates = datesInvalid(form);
    const missingDates = !form.startDate || !form.endDate;
    return (
        <>
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Tanggal mulai</span>
                    <Input type="date" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} required />
                </label>
                <label className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Tanggal selesai</span>
                    <Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(event) => set('endDate', event.target.value)}
                        required aria-invalid={invalidDates || undefined} aria-describedby={invalidDates ? DATE_ERROR_ID : undefined} />
                </label>
            </div>
            {invalidDates && <p id={DATE_ERROR_ID} role="alert" className="text-[12.5px] text-[hsl(var(--ticket-red-ink))]">Tanggal selesai tidak boleh sebelum tanggal mulai.</p>}
            {!invalidDates && overlap}
            {missingDates && form.copying && (
                <p role="status" className="text-[12.5px] font-medium text-[hsl(var(--ticket-amber-ink))]">{WIZARD_COPY.datesRequired}</p>
            )}
            <div className="grid gap-1.5">
                <span className={FIELD_LABEL}>Mode responden</span>
                <div className="flex flex-wrap items-center gap-3">
                    <SegmentedControl aria-label="Mode responden" className="dash-seg" options={MODE_OPTIONS} value={form.respondentMode}
                        onValueChange={(value) => set('respondentMode', value)} disabled={modeLocked} />
                    {modeLocked && <LockedNote />}
                </div>
            </div>
        </>
    );
}
