import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchablePicker } from '@/components/ui/searchable-picker';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Textarea } from '@/components/ui/textarea';
import { useActiveSites } from '@/components/site/useActiveSites';
import { useCreateCsiPeriod, useUpdateCsiPeriod } from '../../hooks/useCsi';
import {
    CSI_DEFAULT_MODE, CSI_MODE_LABELS, CSI_TEXT_MAX, CSI_TITLE_MAX,
} from '../../lib/csiAdmin';
import { formatDateRange } from '../../lib/format';
import type { CsiPeriodDetail, CsiPeriodListItem, CsiRespondentMode, CsiScopeParam } from '../../types';
import { FIELD_LABEL, LockedNote, MUTED_TEXT } from './AdminParts';

const NO_COPY = '';
const MODE_OPTIONS = (Object.keys(CSI_MODE_LABELS) as CsiRespondentMode[]).map((value) => ({ value, label: CSI_MODE_LABELS[value] }));

interface PeriodFormState {
    siteId: string;
    title: string;
    intro: string;
    thankYou: string;
    startDate: string;
    endDate: string;
    respondentMode: CsiRespondentMode;
    copyFromPeriodId: string;
}

const initialState = (scope: CsiScopeParam, period?: CsiPeriodDetail): PeriodFormState => period ? {
    siteId: period.siteId, title: period.title, intro: period.intro, thankYou: period.thankYou,
    startDate: period.startDate, endDate: period.endDate, respondentMode: period.respondentMode, copyFromPeriodId: NO_COPY,
} : {
    siteId: '', title: '', intro: '', thankYou: '', startDate: '', endDate: '', respondentMode: CSI_DEFAULT_MODE[scope], copyFromPeriodId: NO_COPY,
};

/** ISO calendar dates compare correctly as strings. */
const datesInvalid = (form: PeriodFormState) => !!form.startDate && !!form.endDate && form.endDate < form.startDate;

interface PeriodEditorProps {
    scope: CsiScopeParam;
    /** Omit to create a new period. */
    period?: CsiPeriodDetail;
    /** Copy sources (create only). */
    periods?: readonly CsiPeriodListItem[];
    onSaved?: (period: CsiPeriodDetail) => void;
    onCancel?: () => void;
}

export function PeriodEditor({ scope, period, periods = [], onSaved, onCancel }: PeriodEditorProps) {
    const isEdit = !!period;
    // Backend rejects a mode change once answers exist; only texts and dates stay editable.
    const modeLocked = !!period?.locked;
    const [form, setForm] = useState(() => initialState(scope, period));
    const { data: sites = [] } = useActiveSites();
    const create = useCreateCsiPeriod(scope);
    const update = useUpdateCsiPeriod(scope);
    const pending = create.isPending || update.isPending;
    const set = <K extends keyof PeriodFormState>(key: K, value: PeriodFormState[K]) => setForm((current) => ({ ...current, [key]: value }));
    const invalidDates = datesInvalid(form);
    const canSubmit = !!form.siteId && !!form.title.trim() && !!form.startDate && !!form.endDate && !invalidDates && !pending;

    const copyFrom = (id: string) => {
        const source = periods.find((item) => item.id === id);
        setForm((current) => source ? {
            ...current, copyFromPeriodId: id, title: source.title, intro: source.intro, thankYou: source.thankYou, respondentMode: source.respondentMode,
        } : { ...current, copyFromPeriodId: NO_COPY });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;
        const fields = {
            title: form.title.trim(), intro: form.intro, thankYou: form.thankYou, startDate: form.startDate, endDate: form.endDate,
            ...(modeLocked ? {} : { respondentMode: form.respondentMode }),
        };
        const options = { onSuccess: (saved: CsiPeriodDetail) => onSaved?.(saved) };
        if (period) update.mutate({ id: period.id, payload: fields }, options);
        else create.mutate({ ...fields, siteId: form.siteId, ...(form.copyFromPeriodId ? { copyFromPeriodId: form.copyFromPeriodId } : {}) }, options);
    };

    const siteOptions = sites.map((site) => ({ value: site.id, label: `${site.code} · ${site.name}` }));
    const copyOptions = [{ value: NO_COPY, label: 'Tidak menyalin' },
        ...periods.map((item) => ({ value: item.id, label: item.title, description: `${item.site?.code ?? ''} · ${formatDateRange(item.startDate, item.endDate)}` }))];

    return (
        <form onSubmit={submit} className="grid gap-4" aria-label={isEdit ? 'Pengaturan periode' : 'Buat periode'}>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Site</span>
                    {isEdit
                        ? <p className="text-[14px] font-medium">{period.site ? `${period.site.code} · ${period.site.name}` : '—'} <span className={MUTED_TEXT}>(tidak dapat diubah)</span></p>
                        : <SearchablePicker label="Site" value={form.siteId} options={siteOptions} onValueChange={(value) => set('siteId', value)}
                            placeholder="Pilih site" searchPlaceholder="Cari site…" triggerClassName="min-h-9 w-full" />}
                </div>
                {!isEdit && periods.length > 0 && (
                    <div className="grid gap-1.5">
                        <span className={FIELD_LABEL}>Salin dari periode</span>
                        <SearchablePicker label="Salin dari periode" value={form.copyFromPeriodId} options={copyOptions} onValueChange={copyFrom}
                            searchPlaceholder="Cari periode…" triggerClassName="min-h-9 w-full" />
                        {form.copyFromPeriodId && <span className={MUTED_TEXT}>Teks, orang yang dinilai, dimensi, dan penilai ikut disalin.</span>}
                    </div>
                )}
            </div>
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
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Tanggal mulai</span>
                    <Input type="date" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} required />
                </label>
                <label className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Tanggal selesai</span>
                    <Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(event) => set('endDate', event.target.value)}
                        required aria-invalid={invalidDates || undefined} aria-describedby={invalidDates ? 'csi-period-date-error' : undefined} />
                </label>
            </div>
            {invalidDates && <p id="csi-period-date-error" role="alert" className="text-[12.5px] text-[hsl(var(--ticket-red-ink))]">Tanggal selesai tidak boleh sebelum tanggal mulai.</p>}
            <div className="grid gap-1.5">
                <span className={FIELD_LABEL}>Mode responden</span>
                <div className="flex flex-wrap items-center gap-3">
                    <SegmentedControl aria-label="Mode responden" className="dash-seg" options={MODE_OPTIONS} value={form.respondentMode}
                        onValueChange={(value) => set('respondentMode', value)} disabled={modeLocked} />
                    {modeLocked && <LockedNote />}
                </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
                {onCancel && <Button type="button" variant="soft" onClick={onCancel} disabled={pending}>Batal</Button>}
                {isEdit
                    ? <Button type="submit" variant="primary" loading={pending} disabled={!canSubmit}>Simpan pengaturan</Button>
                    : <button type="submit" className="idesk-cta ct-submit" disabled={!canSubmit} aria-busy={pending || undefined}>Buat Periode</button>}
            </div>
        </form>
    );
}
