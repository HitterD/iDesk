import { Checkbox } from '@/components/ui/checkbox';
import { TicketPill } from '@/components/ui/ticket-pill';
import type { CsiTemplateImportReport, CsiTemplatePicResolution } from '../../../../hcTypes';
import { MUTED_TEXT } from '../../AdminParts';
import { titleCase } from '../hcFormat';

export type ImportChoices = Readonly<Record<string, CsiTemplatePicResolution>>;
export interface PruneState { prune: boolean; pruneConfirmed: boolean }

/** Longer problem lists start collapsed so the summary stays on screen. */
const PROBLEMS_OPEN_MAX = 5;
const FORMAT_LABELS: Record<CsiTemplateImportReport['format'], string> = {
    list: 'Format daftar (seperti Semarang)',
    matrix: 'Format matriks (centang per pelayanan)',
};
const FIELD = 'h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-2 text-[12.5px] disabled:opacity-50';
const NOTE = 'rounded-xl bg-[hsl(var(--muted)/.5)] px-3 py-2 text-[12.5px]';
const NOTE_AMBER = 'rounded-xl bg-[hsl(var(--ticket-amber)/.14)] px-3 py-2 text-[12.5px] text-[hsl(var(--ticket-amber-ink))]';

/** A rename only counts once a suggestion is picked; team/PIC need nothing more. */
export const isChoiceComplete = (choice: CsiTemplatePicResolution | undefined) =>
    !!choice && (choice.as !== 'rename' || !!choice.picName);

function Counts({ report, prune }: { report: CsiTemplateImportReport; prune: boolean }) {
    const counts = [
        [report.pics.added.length, (n: number) => `+${n} PIC baru`],
        [report.pics.changed.length, (n: number) => `~${n} PIC berubah`],
        [prune ? report.pics.removed.length : 0, (n: number) => `−${n} PIC dihapus`],
        [report.raters.added, (n: number) => `+${n} penilai`],
        [prune ? report.raters.removed : 0, (n: number) => `−${n} penilai`],
        [report.teams.added.length, (n: number) => `+${n} tim custom`],
    ] as const;
    return (
        <ul className="flex flex-wrap gap-1.5" aria-label="Perubahan">
            {counts.filter(([n]) => n > 0).map(([n, label]) => (
                <li key={label(n)} className="rounded-full bg-[hsl(var(--muted)/.6)] px-2.5 py-0.5 text-[12.5px] font-semibold">{label(n)}</li>
            ))}
        </ul>
    );
}

function Problems({ problems }: { problems: CsiTemplateImportReport['problems'] }) {
    if (!problems.length) return null;
    return (
        <details className={NOTE} open={problems.length <= PROBLEMS_OPEN_MAX}>
            <summary className="cursor-pointer font-semibold">{`${problems.length} baris bermasalah (dilewati)`}</summary>
            <ul className="mt-1 grid gap-0.5 text-muted-foreground">
                {problems.map((problem) => <li key={`${problem.row}-${problem.message}`}>{`Baris ${problem.row}: ${problem.message}`}</li>)}
            </ul>
        </details>
    );
}

function UnresolvedRow({ item, choice, onChoose }: {
    item: CsiTemplateImportReport['unresolved'][number]; choice?: CsiTemplatePicResolution; onChoose: (choice: CsiTemplatePicResolution) => void;
}) {
    const group = `resolve-${item.name}`;
    const option = (as: CsiTemplatePicResolution['as'], label: string) => (
        <label className="flex items-center gap-1.5">
            <input type="radio" name={group} checked={choice?.as === as}
                onChange={() => onChoose(as === 'rename' ? { as, picName: choice?.picName } : { as })} />{label}
        </label>
    );
    return (
        <li className="grid gap-1.5 rounded-xl border border-[hsl(var(--idesk-border))] px-3 py-2">
            <p className="text-[13px] font-semibold">{item.name}</p>
            <div role="radiogroup" aria-label={`Tentukan ${item.name}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
                {option('team', 'Tim baru')}
                {option('pic', 'PIC baru')}
                <span className="flex items-center gap-1.5">
                    {option('rename', 'Salah ketik →')}
                    <select aria-label={`Saran nama untuk ${item.name}`} className={FIELD} disabled={choice?.as !== 'rename'}
                        value={choice?.as === 'rename' ? choice.picName ?? '' : ''}
                        onChange={(event) => onChoose({ as: 'rename', picName: event.target.value || undefined })}>
                        <option value="">Pilih nama…</option>
                        {item.suggestions.map((name) => <option key={name} value={name}>{titleCase(name)}</option>)}
                    </select>
                </span>
            </div>
        </li>
    );
}

function PruneOptions({ services, value, onChange }: { services: string[]; value: PruneState; onChange: (next: PruneState) => void }) {
    return (
        <div className="grid gap-1.5 text-[13px]">
            <label className="flex items-center gap-2">
                <Checkbox checked={value.prune} aria-label={`Hapus yang tidak ada di Excel (layanan: ${services.join(', ')})`}
                    onCheckedChange={(checked) => onChange({ prune: checked === true, pruneConfirmed: checked === true && value.pruneConfirmed })} />
                {`Hapus yang tidak ada di Excel (layanan: ${services.join(', ')})`}
            </label>
            <label className="ml-6 flex items-center gap-2">
                <Checkbox checked={value.pruneConfirmed} disabled={!value.prune} aria-label="termasuk penilai yang sudah dikonfirmasi"
                    onCheckedChange={(checked) => onChange({ ...value, pruneConfirmed: checked === true })} />
                termasuk penilai yang sudah dikonfirmasi
            </label>
        </div>
    );
}

/** Dry-run result: what the file is, what would change, rows skipped, names to decide, and the prune switch. */
export function TemplateImportPreview({ report, choices, onChoose, prune, onPrune }: {
    report: CsiTemplateImportReport; choices: ImportChoices; onChoose: (name: string, choice: CsiTemplatePicResolution) => void;
    prune: PruneState; onPrune: (next: PruneState) => void;
}) {
    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13.5px] font-semibold">{FORMAT_LABELS[report.format]}</p>
                {report.services.map((code) => <TicketPill key={code} tone="blue">{code}</TicketPill>)}
            </div>
            <Counts report={report} prune={prune.prune} />
            {report.newMasterPics.length > 0 && (
                <details className={NOTE}>
                    <summary className="cursor-pointer font-semibold">{`${report.newMasterPics.length} PIC master baru akan dibuat`}</summary>
                    <p className="mt-1 text-muted-foreground">{report.newMasterPics.map(titleCase).join(', ')}</p>
                </details>
            )}
            {report.ambiguousMasters.length > 0 && (
                <details className={NOTE_AMBER} open>
                    <summary className="cursor-pointer font-semibold">{`PIC master ganda, pilih manual di PIC HC (${report.ambiguousMasters.length})`}</summary>
                    <p className="mt-1">{report.ambiguousMasters.map(titleCase).join(', ')}</p>
                </details>
            )}
            <Problems problems={report.problems} />
            {report.unresolved.length > 0 && (
                <section aria-label="Nama belum dikenali" className="grid gap-2">
                    <p className={MUTED_TEXT}>Nama berikut tidak ditemukan sebagai PIC maupun tim. Tentukan masing-masing:</p>
                    <ul className="grid gap-2">
                        {report.unresolved.map((item) => (
                            <UnresolvedRow key={item.name} item={item} choice={choices[item.name]} onChoose={(choice) => onChoose(item.name, choice)} />
                        ))}
                    </ul>
                </section>
            )}
            <PruneOptions services={report.services} value={prune} onChange={onPrune} />
            {prune.prune && report.problems.length > 0 && (
                <p role="alert" className="rounded-xl bg-[hsl(var(--ticket-amber)/.14)] px-3 py-2 text-[13px] text-[hsl(var(--ticket-amber-ink))]">
                    Perbaiki dulu baris bermasalah sebelum menghapus data
                </p>
            )}
        </div>
    );
}
