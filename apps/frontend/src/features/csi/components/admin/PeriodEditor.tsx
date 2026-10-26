import { useEffect, useState, type FormEvent, type Ref } from 'react';
import { Input } from '@/components/ui/input';
import { SearchablePicker } from '@/components/ui/searchable-picker';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Textarea } from '@/components/ui/textarea';
import { useActiveSites } from '@/components/site/useActiveSites';
import { useCreateCsiPeriod, useUpdateCsiPeriod } from '../../hooks/useCsi';
import { CSI_MODE_LABELS, CSI_TEXT_MAX, CSI_TITLE_MAX } from '../../lib/csiAdmin';
import {
    datesInvalid, formDirty, initialState, toCreatePayload, toUpdatePayload, withCopyMode, withCopySource, type PeriodFormState,
} from '../../lib/periodForm';
import { formatSiteCodes } from '../../lib/format';
import type { CsiPeriodDetail, CsiPeriodListItem, CsiRespondentMode, CsiScopeParam } from '../../types';
import { WIZARD_COPY } from '../wizard/wizardCopy';
import { FIELD_LABEL, LockedNote, MUTED_TEXT } from './AdminParts';
import { CopySourceField } from './CopySourceField';

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
    /** The wizard footer submits this form (`requestSubmit`) and mirrors its state. */
    formRef?: Ref<HTMLFormElement>;
    onStatusChange?: (status: PeriodEditorStatus) => void;
}

/** Survey info form (wizard step 1). Actions live in the wizard footer. */
export function PeriodEditor({ scope, period, periods = [], onSaved, formRef, onStatusChange }: PeriodEditorProps) {
    // Backend rejects a mode change once answers exist; only texts and dates stay editable.
    const modeLocked = !!period?.locked;
    const [form, setForm] = useState(() => initialState(scope, period));
    const create = useCreateCsiPeriod(scope);
    const update = useUpdateCsiPeriod(scope);
    const pending = create.isPending || update.isPending;
    const set: SetField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    const dirty = formDirty(form, period);
    const canSubmit = !!form.siteId && !!form.title.trim() && !!form.startDate && !!form.endDate && !datesInvalid(form) && !pending;

    useEffect(() => { onStatusChange?.({ canSubmit, dirty, pending }); }, [canSubmit, dirty, pending, onStatusChange]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;
        const options = { onSuccess: (saved: CsiPeriodDetail) => onSaved(saved) };
        if (!period) create.mutate(toCreatePayload(form), options);
        else if (dirty) update.mutate({ id: period.id, payload: toUpdatePayload(form, modeLocked) }, options);
        else onSaved(period);
    };

    return (
        <form ref={formRef} onSubmit={submit} className="grid gap-4" aria-label={WIZARD_COPY.create}>
            {!period && (
                <CopySourceField form={form} periods={periods} onModeChange={(copying) => setForm((current) => withCopyMode(current, copying))}
                    onSourceChange={(id) => setForm((current) => withCopySource(current, periods, id))} />
            )}
            <SiteField period={period} value={form.siteId} onChange={(value) => set('siteId', value)} />
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
            <DateAndModeFields form={form} set={set} modeLocked={modeLocked} />
        </form>
    );
}

function SiteField({ period, value, onChange }: { period?: CsiPeriodDetail; value: string; onChange: (value: string) => void }) {
    const { data: sites = [] } = useActiveSites();
    const options = sites.map((site) => ({ value: site.id, label: `${site.code} · ${site.name}` }));
    return (
        <div className="grid gap-1.5">
            <span className={FIELD_LABEL}>Site</span>
            {period
                ? <p className="text-[14px] font-medium">{formatSiteCodes(period.sites)} <span className={MUTED_TEXT}>(tidak dapat diubah)</span></p>
                : <SearchablePicker label="Site" value={value} options={options} onValueChange={onChange}
                    placeholder="Pilih site" searchPlaceholder="Cari site…" triggerClassName="min-h-9 w-full sm:max-w-sm" />}
        </div>
    );
}

type SetField =<K extends keyof PeriodFormState>(key: K, value: PeriodFormState[K]) => void;

function DateAndModeFields({ form, set, modeLocked }: { form: PeriodFormState; set: SetField; modeLocked: boolean }) {
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
