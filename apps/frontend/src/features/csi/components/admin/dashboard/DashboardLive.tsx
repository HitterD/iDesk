import { AlertTriangle, ArrowRight, CheckCircle2, LayoutGrid, Star, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreTone, siteTone, toneClasses } from '../../../lib/csiTone';
import { formatFixed2 } from '../../../lib/format';
import type { CsiDashboard, CsiDashboardActive, CsiScopeParam } from '../../../types';
import { AdminSection, EmptyNote, MUTED_TEXT } from '../AdminParts';
import { ScoreRing } from '../report/ScoreRing';
import { SiteBadge } from '../report/reportParts';
import { ratioPct } from '../report/reportModel';
import { StatCard } from '../StatCard';
import { CommentsPanel, PendingPanel } from './DashboardLists';
import { fillPct, isReached, liveSummary, remainingLabel, type LiveSummary } from './dashboardModel';

export const PILL = 'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[12px] font-semibold';
const STAT_SPAN = 'col-span-12 sm:col-span-6 xl:col-span-3';

function ScoreHint({ delta }: { delta: number | null }) {
    if (delta === null) return <>Belum ada pembanding</>;
    const up = delta >= 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
        <span className={cn('inline-flex items-center gap-1 font-medium', toneClasses(up ? 'green' : 'red').ink)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />{`${up ? 'naik' : 'turun'} ${formatFixed2(Math.abs(delta))} dari periode lalu`}
        </span>
    );
}

function LiveStats({ summary }: { summary: LiveSummary }) {
    const behind = summary.behind.length;
    return (
        <>
            <div className={STAT_SPAN}>
                <StatCard tone="navy" icon={LayoutGrid} label="Survei aktif" value={summary.surveys} hint={summary.siteCodes.join(' · ')} />
            </div>
            <div className={STAT_SPAN}>
                <StatCard tone="sky" icon={Users} label="Jawaban masuk"
                    value={<>{summary.responses}<span className={cn(MUTED_TEXT, 'font-medium')}>{` / ${summary.basis}`}</span></>}
                    hint={`${ratioPct(summary.responses, summary.basis)}% dari basis`} />
            </div>
            <div className={STAT_SPAN}>
                <StatCard tone={scoreTone(summary.average)} icon={Star} label="Skor rata-rata" value={formatFixed2(summary.average)}
                    hint={<ScoreHint delta={summary.delta} />} />
            </div>
            <div className={STAT_SPAN}>
                <StatCard tone={behind ? 'amber' : 'green'} icon={behind ? AlertTriangle : CheckCircle2} label="Belum capai target"
                    value={`${behind} site`} attention={behind > 0}
                    hint={behind ? summary.behind.map((row) => row.siteName ?? row.siteCode ?? '—').join(', ') : 'Semua site tercapai'} />
            </div>
        </>
    );
}

type OpenReport = (periodId: string, siteId: string | null) => void;

function SiteTargetCard({ row, today, onOpen }: { row: CsiDashboardActive; today: Date; onOpen?: OpenReport }) {
    const reached = isReached(row);
    const pct = fillPct(row);
    const status = toneClasses(reached ? 'green' : 'amber');
    const Tag = onOpen ? 'button' : 'div';
    return (
        <Tag {...(onOpen ? { type: 'button' as const, onClick: () => onOpen(row.periodId, row.siteId) } : { role: 'group' })}
            aria-label={onOpen ? `Lihat laporan ${row.siteCode ?? row.siteName ?? ''} — ${row.title}` : `Target ${row.siteCode ?? row.siteName ?? ''}`}
            className={cn('group flex min-w-0 items-center gap-3.5 rounded-[14px] p-3 text-left ring-1 ring-[hsl(var(--idesk-border))]', toneClasses(siteTone(row.siteCode)).soft,
                onOpen && 'transition-shadow hover:shadow-[var(--dash-shadow-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
            <ScoreRing pct={pct} tone={reached ? 'green' : 'amber'} size="sm">
                <b className="text-[13px] font-bold tabular-nums">{`${pct}%`}</b>
            </ScoreRing>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <SiteBadge code={row.siteCode} />
                    <b className="min-w-0 truncate text-[13.5px]">{row.siteName ?? row.title}</b>
                </div>
                <p className={cn(MUTED_TEXT, 'mt-1 text-[12px]')}>{`${row.responses}/${row.basis} penilai · target ${row.targetPct}%`}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
                    <span>Skor <b className="tabular-nums">{formatFixed2(row.average)}</b></span>
                    <span className={cn(PILL, status.soft, status.ink)}>{reached ? 'Tercapai' : remainingLabel(row.endDate, today)}</span>
                </div>
                {onOpen && (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[hsl(var(--idesk-sapphire))]">
                        Lihat detail penilaian<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                )}
            </div>
        </Tag>
    );
}

/** Tab "Periode aktif": stats, per-site target cards, most urgent pending raters and latest comments. */
export function DashboardLive({ scope, data, today, onOpenReport }: { scope: CsiScopeParam; data: CsiDashboard; today: Date; onOpenReport?: OpenReport }) {
    if (!data.active.length) return <EmptyNote>Belum ada survei aktif.</EmptyNote>;
    return (
        <div className="grid grid-cols-12 gap-3">
            <LiveStats summary={liveSummary(data)} />
            <AdminSection title="Target per site" description={onOpenReport ? 'Klik kartu untuk melihat siapa menilai siapa dan nilai per subjek.' : undefined} className="col-span-12">
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr))]">
                    {data.active.map((row) => <SiteTargetCard key={`${row.periodId}:${row.siteId}`} row={row} today={today} onOpen={onOpenReport} />)}
                </div>
            </AdminSection>
            <PendingPanel scope={scope} data={data} className="col-span-12 lg:col-span-6" />
            <CommentsPanel data={data} className="col-span-12 lg:col-span-6" />
        </div>
    );
}
