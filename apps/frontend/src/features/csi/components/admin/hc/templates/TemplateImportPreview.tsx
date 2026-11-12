import { TicketPill } from '@/components/ui/ticket-pill';
import type { CsiTemplateImportReport, CsiTemplatePicResolution } from '../../../../hcTypes';
import { MUTED_TEXT } from '../../AdminParts';
import { titleCase } from '../hcFormat';

export type ImportChoices = Readonly<Record<string, CsiTemplatePicResolution>>;

/** Longer problem lists start collapsed so the summary stays on screen. */
const PROBLEMS_OPEN_MAX = 5;
const FORMAT_LABELS: Record<CsiTemplateImportReport['format'], string> = {
    list: 'Format daftar (seperti Semarang)',
    matrix: 'Format matriks (centang per pelayanan)',
};
const FIELD = 'h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-2 text-[12.5px] disabled:opacity-50';
const NOTE = 'rounded-xl bg-[hsl(var(--muted)/.5)] px-3 py-2 text-[12.5px]';
const NOTE_AMBER = 'rounded-xl bg-[hsl(var(--ticket-amber)/.14)] px-3 py-2 text-[12.5px] text-[hsl(var(--ticket-amber-ink))]';
/** Same rule as the backend: a skipped row would silently drop those people from the template. */
const REPLACE_BLOCKED = 'Perbaiki dulu baris bermasalah sebelum mengganti template';

/** A rename only counts once a suggestion is picked; team/PIC need nothing more. */
export const isChoiceComplete = (choice: CsiTemplatePicResolution | undefined) =>
    !!choice && (choice.as !== 'rename' || !!choice.picName);

/** "Template Semarang akan diganti: 2 PIC / 3 penilai lama → …", the one sentence that says what Save does. */
export function replaceSummary(report: CsiTemplateImportReport, locationName: string): string {
    const { before, after } = report;
    return `Template ${locationName} akan diganti: ${before.pics} PIC / ${before.raters} penilai lama → ${after.pics} PIC / ${after.raters} penilai baru. `
        + `${report.keptConfirmations} konfirmasi & ${report.keptPins} pilihan akun dipertahankan.`;
}

/** Names behind a count, collapsed so a long template does not push the decisions off-screen. */
function NameList({ names, label }: { names: string[]; label: string }) {
    if (!names.length) return null;
    return (
        <details className={NOTE}>
            <summary className="cursor-pointer font-semibold">{`${names.length} ${label}`}</summary>
            <p className="mt-1 text-muted-foreground">{names.map(titleCase).join(', ')}</p>
        </details>
    );
}

/** Raters that leave PICs/teams which stay, grouped per PIC; collapsed like the other name lists. */
function RatersRemoved({ groups }: { groups: CsiTemplateImportReport['ratersRemoved'] }) {
    const total = groups.reduce((sum, group) => sum + group.raters.length, 0);
    if (!total) return null;
    return (
        <details className={NOTE}>
            <summary className="cursor-pointer font-semibold">{`Penilai tidak ada lagi (${total})`}</summary>
            <ul className="mt-1 grid gap-0.5 text-muted-foreground">
                {groups.map((group) => <li key={group.picName}>{`${titleCase(group.picName)}: ${group.raters.map(titleCase).join(', ')}`}</li>)}
            </ul>
        </details>
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

/**
 * Dry-run result: what the file is, how the template is replaced, rows skipped and names to decide. `unresolved` is
 * the file's decision list (first preview); `report.unresolved` is what the counts still leave out.
 */
export function TemplateImportPreview({ report, unresolved, locationName, choices, onChoose }: {
    report: CsiTemplateImportReport; unresolved: CsiTemplateImportReport['unresolved']; locationName: string;
    choices: ImportChoices; onChoose: (name: string, choice: CsiTemplatePicResolution) => void;
}) {
    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13.5px] font-semibold">{FORMAT_LABELS[report.format]}</p>
                {report.services.map((code) => <TicketPill key={code} tone="blue">{code}</TicketPill>)}
            </div>
            <div className={NOTE_AMBER}>
                <p>{replaceSummary(report, locationName)}</p>
                {report.unresolved.length > 0 && <p className="mt-1 font-semibold">{`Angka belum termasuk ${report.unresolved.length} nama yang belum ditentukan.`}</p>}
            </div>
            <NameList names={report.pics.added} label="PIC baru" />
            <NameList names={report.pics.removed} label="PIC tidak ada lagi" />
            <RatersRemoved groups={report.ratersRemoved} />
            <NameList names={report.teamsAdded} label="tim custom baru" />
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
            {unresolved.length > 0 && (
                <section aria-label="Nama belum dikenali" className="grid gap-2">
                    <p className={MUTED_TEXT}>Nama berikut tidak ditemukan sebagai PIC maupun tim. Tentukan masing-masing:</p>
                    <ul className="grid gap-2">
                        {unresolved.map((item) => (
                            <UnresolvedRow key={item.name} item={item} choice={choices[item.name]} onChoose={(choice) => onChoose(item.name, choice)} />
                        ))}
                    </ul>
                </section>
            )}
            {report.problems.length > 0 && (
                <p role="alert" className="rounded-xl bg-[hsl(var(--ticket-amber)/.14)] px-3 py-2 text-[13px] text-[hsl(var(--ticket-amber-ink))]">
                    {REPLACE_BLOCKED}
                </p>
            )}
        </div>
    );
}
