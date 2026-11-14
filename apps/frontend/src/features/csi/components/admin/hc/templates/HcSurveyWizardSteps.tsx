import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { CsiTemplate, CsiTemplateApplyReport } from '../../../../hcTypes';
import { MUTED_TEXT } from '../../AdminParts';
import { CSI_TEMPLATE_LOCATIONS, titleCase } from '../hcFormat';
import { templateRaterCounts } from './templateRaterCounts';

export const FIELD = 'h-9 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-3 text-[13px]';
export const WIZARD_STEPS = ['Nama & periode', 'Lokasi', 'Pratinjau', 'Buat'] as const;
const ALERT_RED = 'rounded-xl bg-[hsl(var(--ticket-red)/.12)] px-3 py-2 text-[13px] text-[hsl(var(--ticket-red-ink))]';
const NOTE_AMBER = 'rounded-xl bg-[hsl(var(--ticket-amber)/.14)] px-3 py-2 text-[13px] text-[hsl(var(--ticket-amber-ink))]';

export interface SurveyInfo { title: string; startDate: string; endDate: string }

/** Template ids in the fixed location order, so the request (and the preview cache key) is stable. */
export function selectedTemplateIds(templates: CsiTemplate[], locations: string[]) {
    return CSI_TEMPLATE_LOCATIONS.flatMap(({ code }) => locations.includes(code) ? templates.filter((row) => row.locationCode === code).map((row) => row.id) : []);
}

const TITLE_MIN = 3;
const TITLE_MAX = 150;
/** Mirrors the backend title limits so the create call does not fail at the last step. */
export const titleInvalid = (info: SurveyInfo) => info.title.trim().length < TITLE_MIN || info.title.trim().length > TITLE_MAX;

/** ISO dates compare correctly as strings; an empty end date is reported by the required check, not here. */
export const endBeforeStart = (info: SurveyInfo) => !!info.startDate && !!info.endDate && info.endDate < info.startDate;
export const infoComplete = (info: SurveyInfo) => !titleInvalid(info) && !!info.startDate && !!info.endDate && !endBeforeStart(info);

export function StepIndicator({ step }: { step: number }) {
    return (
        <ol aria-label="Langkah" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
            {WIZARD_STEPS.map((label, index) => (
                <li key={label} aria-current={index === step ? 'step' : undefined}
                    className={cn('flex items-center gap-1.5', index === step ? 'font-semibold' : MUTED_TEXT)}>
                    {index > 0 && <span aria-hidden="true">·</span>}
                    {`${index + 1} ${label}`}
                </li>
            ))}
        </ol>
    );
}

export function InfoStep({ info, onChange }: { info: SurveyInfo; onChange: (info: SurveyInfo) => void }) {
    return (
        <div className="grid gap-2">
            <input aria-label="Judul survei" className={FIELD} value={info.title} onChange={(event) => onChange({ ...info, title: event.target.value })} />
            <div className="grid grid-cols-2 gap-2">
                <input type="date" aria-label="Tanggal mulai" className={FIELD} value={info.startDate} onChange={(event) => onChange({ ...info, startDate: event.target.value })} />
                <input type="date" aria-label="Tanggal selesai" className={FIELD} value={info.endDate} onChange={(event) => onChange({ ...info, endDate: event.target.value })} />
            </div>
            {titleInvalid(info) && <p className="text-[12.5px] text-[hsl(var(--ticket-red-ink))]">{`Judul ${TITLE_MIN}–${TITLE_MAX} karakter.`}</p>}
            {endBeforeStart(info) && <p className="text-[12.5px] text-[hsl(var(--ticket-red-ink))]">Tanggal selesai harus sama atau setelah tanggal mulai.</p>}
        </div>
    );
}

/** One row per fixed location; rater counts are unique people so "perlu dicek" matches the template issue list. */
export function LocationStep({ templates, selected, onToggle }: {
    templates: CsiTemplate[]; selected: string[]; onToggle: (locationCode: string, checked: boolean) => void;
}) {
    return (
        <div role="group" aria-label="Lokasi" className="grid gap-2">
            {CSI_TEMPLATE_LOCATIONS.map(({ code, name, hint }) => {
                const template = templates.find((row) => row.locationCode === code);
                const counts = template ? templateRaterCounts([template]) : null;
                const id = `hc-wizard-location-${code}`;
                return (
                    <div key={code} className={cn('flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-3 py-2', !template && 'opacity-60')}>
                        <Checkbox id={id} disabled={!template} checked={selected.includes(code)} onCheckedChange={(state) => onToggle(code, state === true)} />
                        <label htmlFor={id} className="min-w-0 flex-1 text-[13.5px] font-semibold">
                            {name} <span className={cn(MUTED_TEXT, 'text-[12px] font-normal')}>{`(${hint})`}</span>
                        </label>
                        <span className={cn(MUTED_TEXT, 'text-[12.5px]')}>
                            {template && counts ? `${template.summary.pics} PIC · ${counts.total} penilai · ${counts.issues} perlu dicek` : 'belum ada template'}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export function NameList({ title, names }: { title: string; names: string[] }) {
    if (!names.length) return null;
    return (
        <details className="rounded-xl bg-[hsl(var(--muted)/.5)] px-3 py-2 text-[12.5px]" open={names.length <= 6}>
            <summary className="cursor-pointer font-semibold">{`${title} (${names.length})`}</summary>
            <p className="mt-1 text-muted-foreground">{names.map(titleCase).join(', ')}</p>
        </details>
    );
}

/** PICs / teams without any applied rater yet: listed as skipped from the survey until raters are added. */
export const WITHOUT_RATERS_TITLE = 'PIC/tim belum punya penilai (tidak dimasukkan)';
export function WithoutRatersNote({ names }: { names: string[] }) {
    if (!names.length) return null;
    return (
        <details className={NOTE_AMBER} open={names.length <= 6}>
            <summary className="cursor-pointer font-semibold">{`${WITHOUT_RATERS_TITLE} (${names.length})`}</summary>
            <p className="mt-1">{names.map(titleCase).join(', ')}</p>
        </details>
    );
}

/** The per-category lists of what the apply leaves out (shared with the sync dialog). */
export function SkippedLists({ report }: { report: CsiTemplateApplyReport }) {
    return (
        <>
            <NameList title="PIC tidak dimasukkan" names={report.picsUnmatched} />
            <NameList title="Penilai belum punya akun (masuk saat Sinkronkan berikutnya)" names={report.ratersNoAccount} />
            <NameList title="Penilai dengan nama ganda (perbaiki di template)" names={report.ratersAmbiguous} />
        </>
    );
}

export function UnconfirmedNote({ count }: { count: number }) {
    if (count <= 0) return null;
    return <p className={NOTE_AMBER}>{`${count} penilai belum dikonfirmasi — tetap ikut survei; konfirmasi di Template penugasan bila perlu.`}</p>;
}

/** Non-blocking: raters whose account belongs to another site are added but never see the survey. */
export function OutsideSitesNote({ names }: { names: string[] }) {
    if (!names.length) return null;
    return (
        <details className={NOTE_AMBER}>
            <summary className="cursor-pointer font-semibold">{`${names.length} penilai berada di site lain dan tidak akan melihat survei ini`}</summary>
            <p className="mt-1">{names.map(titleCase).join(', ')}</p>
        </details>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl bg-[hsl(var(--muted)/.45)] px-3 py-2">
            <p className={cn(MUTED_TEXT, 'text-[12px]')}>{label}</p>
            <p className="text-[18px] font-bold tabular-nums">{value}</p>
        </div>
    );
}

export function PreviewStep({ report, loading, failed }: { report: CsiTemplateApplyReport | undefined; loading: boolean; failed: boolean }) {
    if (loading) return <div aria-busy="true" className="h-28 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />;
    if (failed || !report) return <p role="alert" className={ALERT_RED}>Gagal memuat pratinjau.</p>;
    const skipped = report.picsUnmatched.length + report.ratersNoAccount.length + report.ratersAmbiguous.length;
    return (
        <div className="grid gap-2">
            {report.blockedReason && <p role="alert" className={ALERT_RED}>{report.blockedReason}</p>}
            <div className="grid grid-cols-3 gap-2">
                <Stat label="PIC/tim ditambahkan" value={report.picsAdded + report.teamsAdded} />
                <Stat label="Penilai unik" value={report.ratersAdded} />
                <Stat label="Pasangan" value={report.pairsAdded} />
            </div>
            <UnconfirmedNote count={report.ratersUnconfirmed} />
            <OutsideSitesNote names={report.ratersOutsideSites} />
            <WithoutRatersNote names={report.picsWithoutRaters} />
            {skipped > 0 && (
                <details className="grid gap-1.5" open>
                    <summary className="cursor-pointer text-[13px] font-semibold">{`Dilewati (${skipped})`}</summary>
                    <div className="mt-1.5 grid gap-1.5"><SkippedLists report={report} /></div>
                </details>
            )}
        </div>
    );
}
