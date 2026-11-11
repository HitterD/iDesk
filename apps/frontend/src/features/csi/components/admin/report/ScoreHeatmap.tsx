import { cn } from '@/lib/utils';
import { questionTone, scoreTone, toneClasses, type CsiScoreBands } from '../../../lib/csiTone';
import { formatFixed2, formatScore } from '../../../lib/format';
import type { CsiReportRatee } from '../../../types';
import { questionColumns, questionKey } from './reportModel';
import { SiteBadge, SubjectPhoto, type SiteCodeOf } from './reportParts';

const HEAD = 'whitespace-nowrap px-1.5 py-1 text-left text-[11.5px] font-semibold text-[hsl(var(--idesk-text-secondary))]';
const CELL = 'rounded-lg px-1 py-2 text-center text-[12px] font-semibold tabular-nums';

function HeatCell({ value, digits, bands }: { value: number | null; digits: 1 | 2; bands: CsiScoreBands }) {
    const tone = toneClasses(scoreTone(value, bands));
    return <td className={cn(CELL, tone.soft, value !== null && tone.ink)}>{digits === 2 ? formatFixed2(value) : formatScore(value)}</td>;
}

/** "Perbandingan": subject × question averages, header = short label (full text in `title`). */
export function ScoreHeatmap({ ratees, siteCodeOf, bands }: { ratees: readonly CsiReportRatee[]; siteCodeOf: SiteCodeOf; bands: CsiScoreBands }) {
    const columns = questionColumns(ratees);
    return (
        <div className="overflow-x-auto">
            <table aria-label="Perbandingan nilai per pertanyaan" className="w-full min-w-[600px] border-separate border-spacing-1">
                <thead>
                    <tr>
                        <th scope="col" className={HEAD}><span className="sr-only">Subjek</span></th>
                        {columns.map((column) => (
                            <th key={column.key} scope="col" title={column.name} className={HEAD}>
                                <span className={cn('inline-flex items-center gap-1.5', toneClasses(questionTone(column.index)).ink)}>
                                    <span className={cn('h-2 w-2 rounded-full', toneClasses(questionTone(column.index)).fill)} aria-hidden="true" />
                                    {column.label}
                                </span>
                            </th>
                        ))}
                        <th scope="col" className={HEAD}>Rata-rata</th>
                    </tr>
                </thead>
                <tbody>
                    {ratees.map((ratee) => {
                        const byKey = new Map(ratee.questions.map((question) => [questionKey(question), question.average]));
                        const siteCode = siteCodeOf(ratee.siteId);
                        return (
                            <tr key={ratee.periodRateeId}>
                                <th scope="row" className="whitespace-nowrap px-1.5 text-left text-[13px] font-medium">
                                    <span className="flex items-center gap-2">
                                        <SubjectPhoto name={ratee.displayName} photoUrl={ratee.photoUrl} siteCode={siteCode} className="h-6 w-6 rounded-full [&_span]:text-[11px]" />
                                        <span className="max-w-[180px] truncate">{ratee.displayName}</span>
                                        <SiteBadge code={siteCode} />
                                    </span>
                                </th>
                                {columns.map((column) => <HeatCell key={column.key} value={byKey.get(column.key) ?? null} digits={1} bands={bands} />)}
                                <HeatCell value={ratee.average} digits={2} bands={bands} />
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
