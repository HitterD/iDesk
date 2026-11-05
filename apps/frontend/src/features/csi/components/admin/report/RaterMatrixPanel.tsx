import { useState } from 'react';
import { Search, Users } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { useCsiRaterMatrix } from '../../../hooks/useCsi';
import { scoreTone, toneClasses } from '../../../lib/csiTone';
import { formatDateTime, formatFixed2 } from '../../../lib/format';
import type { CsiScopeParam } from '../../../types';
import { AdminSection, EmptyNote, MUTED_TEXT } from '../AdminParts';

const HEAD = 'sticky top-0 z-[1] bg-[hsl(var(--idesk-surface))] px-2.5 py-2 text-[11.5px] font-semibold text-[hsl(var(--idesk-text-secondary))]';
const CELL = 'px-2.5 py-2 text-[13px]';

function ScoreCell({ value }: { value: number | null }) {
    if (value === null) return <td className={cn(CELL, 'text-center text-[hsl(var(--idesk-text-secondary))]')} aria-label="tidak menilai">–</td>;
    const tone = toneClasses(scoreTone(value));
    return (
        <td className={cn(CELL, 'text-center')}>
            <span className={cn('inline-block min-w-[44px] rounded-lg px-2 py-0.5 font-semibold tabular-nums', tone.soft, tone.ink)}>{formatFixed2(value)}</span>
        </td>
    );
}

/** "Siapa menilai siapa": respondents × subjects with the average each respondent gave (admin only: names are shown). */
export function RaterMatrixPanel({ scope, periodId, siteId }: { scope: CsiScopeParam; periodId: string; siteId?: string }) {
    const { data, isLoading, isError, refetch } = useCsiRaterMatrix(scope, periodId, siteId);
    const [search, setSearch] = useState('');
    const term = search.trim().toLowerCase();
    const rows = (data?.rows ?? []).filter((row) => `${row.respondentName} ${row.departmentName}`.toLowerCase().includes(term));

    return (
        <AdminSection title="Siapa menilai siapa" description="Nilai rata-rata yang diberikan setiap penilai ke setiap subjek. Tanda – berarti tidak menilai subjek itu.">
            {isLoading && <div className="h-32 animate-pulse rounded-2xl bg-[hsl(var(--muted))] motion-reduce:animate-none" aria-busy="true" aria-label="Memuat matriks penilaian" />}
            {isError && <ErrorState compact message="Gagal memuat matriks penilaian." onRetry={() => refetch()} />}
            {data && !data.rows.length && <EmptyNote>Belum ada jawaban.</EmptyNote>}
            {data && data.rows.length > 0 && (
                <div className="grid gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex h-9 min-w-[min(260px,100%)] items-center gap-2 rounded-xl bg-[hsl(var(--muted)/.6)] px-3 focus-within:ring-2 focus-within:ring-ring">
                            <Search className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                            <input type="search" aria-label="Cari penilai" placeholder="Cari penilai atau departemen…" value={search}
                                onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" />
                        </label>
                        <span className={cn(MUTED_TEXT, 'inline-flex items-center gap-1.5 text-[12.5px]')}>
                            <Users className="h-3.5 w-3.5" aria-hidden="true" />{`${data.rows.length} penilai · ${data.subjects.length} subjek`}
                        </span>
                    </div>
                    <div className="max-h-[560px] overflow-auto rounded-2xl border border-[hsl(var(--idesk-border)/.7)] scrollbar-custom">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-[hsl(var(--idesk-border)/.7)]">
                                    <th scope="col" className={cn(HEAD, 'sticky left-0 z-[2] min-w-[200px] text-left')}>Penilai</th>
                                    {data.subjects.map((subject) => (
                                        <th key={subject.periodRateeId} scope="col" className={cn(HEAD, 'min-w-[96px] text-center')}>
                                            <span className="block">{subject.displayName}</span>
                                            <span className="block font-normal">{subject.kind === 'TEAM' ? 'Tim' : 'Individu'}</span>
                                        </th>
                                    ))}
                                    <th scope="col" className={cn(HEAD, 'text-center')}>Rata-rata</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.responseId} className="border-b border-[hsl(var(--idesk-border)/.45)] last:border-b-0">
                                        <th scope="row" className={cn(CELL, 'sticky left-0 bg-[hsl(var(--idesk-surface))] text-left font-normal')}>
                                            <span className="block font-semibold">{row.respondentName}</span>
                                            <span className={cn(MUTED_TEXT, 'block text-[11.5px]')}>{[row.departmentName, formatDateTime(row.submittedAt)].join(' · ')}</span>
                                        </th>
                                        {row.scores.map((value, index) => <ScoreCell key={data.subjects[index].periodRateeId} value={value} />)}
                                        <ScoreCell value={row.average} />
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-[hsl(var(--idesk-border))] bg-[hsl(var(--muted)/.4)]">
                                    <th scope="row" className={cn(CELL, 'sticky left-0 bg-[hsl(var(--muted))] text-left')}>Jumlah penilai · rata-rata</th>
                                    {data.totals.map((total, index) => (
                                        <td key={data.subjects[index].periodRateeId} className={cn(CELL, 'text-center tabular-nums')}>
                                            <span className="block font-semibold">{formatFixed2(total.average)}</span>
                                            <span className={cn(MUTED_TEXT, 'block text-[11.5px]')}>{`${total.raters} penilai`}</span>
                                        </td>
                                    ))}
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </AdminSection>
    );
}
