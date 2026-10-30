import { AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toneClasses } from '../../../lib/csiTone';
import { formatPercent } from '../../../lib/format';
import type { CsiReportRatee } from '../../../types';
import { ADMIN_PANEL, MUTED_TEXT } from '../AdminParts';
import { kindLabel, ScoreBadge, SiteBadge, StarDistributionBar, SubjectPhoto, subjectExtremes } from './reportParts';

/** Pill shrinks to its cell and truncates its label (full text in `title`); a long question never widens the card. */
const PILL = 'inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium';

/** Ranked subject card (mockup `.rcard`): photo + rank medal, name, site, score badge, index, star bar, strongest/weakest pill. */
export function SubjectScoreCard({ ratee, rank, siteCode, onOpen }: {
    ratee: CsiReportRatee; rank: number; siteCode: string | null; onOpen: () => void;
}) {
    const { strongest, weakest } = subjectExtremes(ratee);
    const first = rank === 1;
    return (
        <button type="button" onClick={onOpen} aria-label={`Rincian ${ratee.displayName}`}
            className={cn(ADMIN_PANEL, 'flex min-w-0 gap-3 p-3.5 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--dash-shadow-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0')}>
            <span className="relative shrink-0">
                <SubjectPhoto name={ratee.displayName} photoUrl={ratee.photoUrl} siteCode={siteCode} className="h-[78px] w-16 rounded-xl" />
                <span aria-label={`Peringkat ${rank}`} className={cn('absolute -left-1.5 -top-1.5 grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-extrabold',
                    first ? cn(toneClasses('amber').fill, 'text-[hsl(var(--ticket-amber-ink))] ring-2 ring-[hsl(var(--idesk-surface))]')
                        : 'bg-[hsl(var(--idesk-surface))] text-[hsl(var(--idesk-text-secondary))] ring-[1.5px] ring-[hsl(var(--idesk-border))]')}>
                    {rank}
                </span>
            </span>
            <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-0.5">
                <span className="flex min-w-0 items-start gap-1.5">
                    <span className="line-clamp-2 min-w-0 flex-1 font-semibold leading-tight">{ratee.displayName}</span>
                    <SiteBadge code={siteCode} />
                </span>
                <span className={cn(MUTED_TEXT, 'text-[12px]')}>
                    {[kindLabel(ratee), ratee.jobTitle, `${ratee.respondentCount} penilai`].filter(Boolean).join(' · ')}
                </span>
                <span className="my-1.5 flex items-center gap-2">
                    <ScoreBadge average={ratee.average} />
                    <span className={cn(MUTED_TEXT, 'text-[12px]')}>{`indeks ${formatPercent(ratee.indexPct)}`}</span>
                </span>
                <StarDistributionBar counts={ratee.starDistribution} />
                {(strongest || weakest) && (
                    <span className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                        {strongest && <span title={strongest.name} className={cn(PILL, toneClasses('green').soft, toneClasses('green').ink)}>
                            <TrendingUp className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="min-w-0 max-w-full truncate">{strongest.label}</span>
                        </span>}
                        {weakest && <span title={weakest.name} className={cn(PILL, toneClasses('amber').soft, toneClasses('amber').ink)}>
                            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="min-w-0 max-w-full truncate">{weakest.label}</span>
                        </span>}
                    </span>
                )}
            </span>
        </button>
    );
}
