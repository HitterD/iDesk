import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { scoreBandsPreview, toneClasses } from '../../lib/csiTone';
import {
    SCORE_BAND_MAX, SCORE_BAND_MIN, SCORE_BAND_STEP, SLA_TARGET_MAX, SLA_TARGET_MIN, TEAM_LABEL_MAX, scoreBandsError, scoreBandsValue,
    sectionsInvalid, slaInvalid, type PeriodFormState,
} from '../../lib/periodForm';
import { SECTION_COPY } from '../wizard/wizardCopy';
import { FIELD_LABEL, LockedNote, MUTED_TEXT } from './AdminParts';

type SetField = <K extends keyof PeriodFormState>(key: K, value: PeriodFormState[K]) => void;
const SECTIONS_ERROR_ID = 'csi-sections-error';
const BANDS_ERROR_ID = 'csi-bands-error';
const ERROR_TEXT = 'text-[12.5px] text-[hsl(var(--ticket-red-ink))]';

function SectionSwitch({ label, hint, checked, disabled, describedBy, onChange }: {
    label: string; hint: string; checked: boolean; disabled: boolean; describedBy?: string; onChange: (value: boolean) => void;
}) {
    return (
        <label className="flex items-start gap-3 rounded-2xl bg-[hsl(var(--muted)/.45)] px-4 py-3">
            <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} aria-describedby={describedBy} className="mt-0.5" />
            <span className="grid gap-0.5">
                <span className="text-[14px] font-medium">{label}</span>
                <span className={MUTED_TEXT}>{hint}</span>
            </span>
        </label>
    );
}

function BandInput({ label, value, invalid, onChange }: { label: string; value: string; invalid: boolean; onChange: (value: string) => void }) {
    return (
        <label className="grid gap-1.5">
            <span className={FIELD_LABEL}>{label}</span>
            <Input type="number" inputMode="decimal" min={SCORE_BAND_MIN} max={SCORE_BAND_MAX} step={SCORE_BAND_STEP} className="w-28"
                value={value} aria-label={label} aria-invalid={invalid || undefined} aria-describedby={invalid ? BANDS_ERROR_ID : undefined}
                onChange={(event) => onChange(event.target.value)} />
        </label>
    );
}

/** Score colour bands of the survey: two inputs, a live red / orange / green preview and the first validation problem. */
function ScoreBandFields({ form, set }: { form: PeriodFormState; set: SetField }) {
    const error = scoreBandsError(form);
    return (
        <div className="grid gap-2 sm:col-span-2">
            <div className="flex flex-wrap items-end gap-4">
                <BandInput label={SECTION_COPY.fairMin} value={form.scoreFairMin} invalid={!!error} onChange={(value) => set('scoreFairMin', value)} />
                <BandInput label={SECTION_COPY.goodMin} value={form.scoreGoodMin} invalid={!!error} onChange={(value) => set('scoreGoodMin', value)} />
            </div>
            {error ? <p id={BANDS_ERROR_ID} role="alert" className={ERROR_TEXT}>{error}</p> : (
                <p aria-label={SECTION_COPY.bandsPreview} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
                    {scoreBandsPreview(scoreBandsValue(form)).map((band, index) => (
                        <span key={band.tone} className="inline-flex items-center gap-1.5">
                            {index > 0 && <span aria-hidden="true" className={MUTED_TEXT}>·</span>}
                            <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', toneClasses(band.tone).fill)} />
                            <span className={toneClasses(band.tone).ink}>{band.label}</span>
                        </span>
                    ))}
                </p>
            )}
        </div>
    );
}

/** "Bagian penilaian" switches, the team label, the participation target and the score colour bands. Frozen fields are disabled when `locked`. */
export function SectionFields({ form, set, locked }: { form: PeriodFormState; set: SetField; locked: boolean }) {
    const none = sectionsInvalid(form);
    const slaBad = slaInvalid(form);
    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
                <span className={FIELD_LABEL}>{SECTION_COPY.title}</span>
                {locked && <LockedNote />}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <SectionSwitch label={SECTION_COPY.team} hint={SECTION_COPY.teamHint} checked={form.teamEnabled} disabled={locked}
                    describedBy={none ? SECTIONS_ERROR_ID : undefined} onChange={(value) => set('teamEnabled', value)} />
                <SectionSwitch label={SECTION_COPY.individual} hint={SECTION_COPY.individualHint} checked={form.individualEnabled} disabled={locked}
                    describedBy={none ? SECTIONS_ERROR_ID : undefined} onChange={(value) => set('individualEnabled', value)} />
            </div>
            {none && <p id={SECTIONS_ERROR_ID} role="alert" className={ERROR_TEXT}>{SECTION_COPY.noneError}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
                {form.teamEnabled && (
                    <label className="grid gap-1.5">
                        <span className={FIELD_LABEL}>{SECTION_COPY.teamLabel}</span>
                        <Input value={form.teamLabel} maxLength={TEAM_LABEL_MAX} disabled={locked} required
                            onChange={(event) => set('teamLabel', event.target.value)} />
                    </label>
                )}
                <label className="grid gap-1.5">
                    <span className={FIELD_LABEL}>{SECTION_COPY.sla}</span>
                    <span className="flex items-center gap-2">
                        <Input type="number" inputMode="numeric" min={SLA_TARGET_MIN} max={SLA_TARGET_MAX} step={1} className="w-28"
                            value={form.slaTargetPct} aria-label={SECTION_COPY.sla} aria-invalid={slaBad || undefined} onChange={(event) => set('slaTargetPct', event.target.value)} />
                        <span aria-hidden="true" className={MUTED_TEXT}>%</span>
                    </span>
                    {slaBad && <span role="alert" className={ERROR_TEXT}>{SECTION_COPY.slaError}</span>}
                </label>
                <ScoreBandFields form={form} set={set} />
            </div>
        </div>
    );
}
