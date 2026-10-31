import type { ReactNode } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreTone, scoreWord, toneClasses, type CsiTone } from '../../../lib/csiTone';
import { formatFixed2, formatPercent } from '../../../lib/format';
import type { CsiReport } from '../../../types';
import { ADMIN_PANEL, MUTED_TEXT } from '../AdminParts';
import { questionColumns, ratioPct, scorePct, strongestAndWeakest, type QuestionColumn } from './reportModel';
import { ScoreRing } from './ScoreRing';

const ICON = 'h-4 w-4';

function Trend({ average, previous }: { average: number | null; previous: number | null }) {
    if (average === null || previous === null) return null;
    const delta = average - previous;
    const up = delta >= 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
        <p className={cn('flex items-center gap-1 text-[12.5px] font-medium', toneClasses(up ? 'green' : 'red').ink)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />{`${up ? 'naik' : 'turun'} ${formatFixed2(Math.abs(delta))} dari periode lalu`}
        </p>
    );
}

function StatCard({ label, tone, icon, value, children }: { label: string; tone: CsiTone; icon: ReactNode; value: ReactNode; children: ReactNode }) {
    const classes = toneClasses(tone);
    return (
        <div role="group" aria-label={label} className={cn(ADMIN_PANEL, 'grid content-start gap-1 p-4')}>
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 text-[18px] font-bold leading-snug tracking-tight">{value}</div>
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl', classes.soft, classes.ink)}>{icon}</span>
            </div>
            <span className="text-[13px] font-semibold">{label}</span>
            {children}
        </div>
    );
}

function QuestionStat({ label, column, tone, icon }: { label: string; column: QuestionColumn | null; tone: CsiTone; icon: ReactNode }) {
    return (
        <StatCard label={label} tone={tone} icon={icon}
            value={<span title={column?.name} className="line-clamp-2 break-words text-[15px] font-semibold leading-snug">{column?.label ?? '—'}</span>}>
            <span className={cn(MUTED_TEXT, 'text-[12px]')}>{column ? `rata-rata ${formatFixed2(column.average)}` : 'Belum ada nilai'}</span>
        </StatCard>
    );
}

/** Report header: overall score ring + word + index + trend, responses vs target, strongest / weakest question. */
export function ReportHero({ report }: { report: CsiReport }) {
    const { average } = report.overall;
    const tone = scoreTone(average);
    const { sla } = report;
    const reached = sla.basis > 0 && sla.responses >= sla.target;
    const { strongest, weakest } = strongestAndWeakest(questionColumns(report.ratees));
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
            <div role="group" aria-label="Nilai keseluruhan" className={cn(ADMIN_PANEL, 'flex flex-wrap items-center gap-5 p-4 sm:col-span-2 xl:col-span-1')}>
                <ScoreRing pct={scorePct(average)} tone={tone}>
                    <span className="grid">
                        <b className="text-[28px] font-bold tabular-nums tracking-tight">{formatFixed2(average)}</b>
                        <span className={cn(MUTED_TEXT, 'text-[12px]')}>dari 5</span>
                    </span>
                </ScoreRing>
                <div className="grid min-w-0 gap-1.5">
                    <h3 className="text-[15px] font-semibold">Nilai keseluruhan</h3>
                    {average !== null && (
                        <span className={cn('w-fit rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold', toneClasses(tone).soft, toneClasses(tone).ink)}>{scoreWord(average)}</span>
                    )}
                    <span className={cn(MUTED_TEXT, 'text-[12.5px]')}>{`Indeks ${formatPercent(average === null ? null : scorePct(average))}`}</span>
                    <Trend average={average} previous={report.previousAverage} />
                </div>
            </div>
            <StatCard label="Jawaban masuk" tone={reached ? 'green' : 'amber'} icon={<Users className={ICON} aria-hidden="true" />}
                value={<span className="tabular-nums">{sla.responses}<span className={cn(MUTED_TEXT, 'font-medium')}>{` / ${sla.basis}`}</span></span>}>
                <span className={cn('text-[12px] font-medium', toneClasses(reached ? 'green' : 'amber').ink)}>
                    {`${ratioPct(sla.responses, sla.basis)}% dari basis · target ${sla.targetPct}%${reached ? ' tercapai' : ''}`}
                </span>
            </StatCard>
            <QuestionStat label="Paling kuat" column={strongest} tone="green" icon={<TrendingUp className={ICON} aria-hidden="true" />} />
            <QuestionStat label="Perlu perhatian" column={weakest} tone="amber" icon={<AlertTriangle className={ICON} aria-hidden="true" />} />
        </div>
    );
}
