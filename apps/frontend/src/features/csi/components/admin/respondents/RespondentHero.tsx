import { cn } from '@/lib/utils';
import { siteTone, toneClasses, toneColor } from '../../../lib/csiTone';
import { MUTED_TEXT } from '../AdminParts';
import { ScoreRing } from '../report/ScoreRing';
import { SiteBadge } from '../report/reportParts';
import type { Progress } from './respondentModel';

export interface SiteProgress { siteId: string; code: string | null; name: string | null; progress: Progress }

function TargetLine({ progress, targetPct, basisLabel }: { progress: Progress; targetPct: number; basisLabel: string }) {
    const fill = toneColor(progress.reached ? 'green' : 'amber');
    return (
        <div>
            <div role="img" aria-label={`${Math.round(progress.pct)}% terisi, target ${targetPct}%`}
                className="relative mb-1.5 mt-7 h-3.5 rounded-full bg-[hsl(var(--muted))]">
                <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress.pct}%`, background: fill }} />
                <span className="absolute -bottom-1.5 -top-1.5 w-0.5 bg-[hsl(var(--idesk-text))]" style={{ left: `${targetPct}%` }}>
                    <span className="absolute -top-[18px] right-0 whitespace-nowrap text-[11px] font-bold">{`Target ${targetPct}% · ${progress.target} orang`}</span>
                </span>
            </div>
            <div className={cn(MUTED_TEXT, 'flex text-[12px]')}><span>0</span><span className="ml-auto">{`${progress.total} ${basisLabel}`}</span></div>
        </div>
    );
}

function SiteCard({ site }: { site: SiteProgress }) {
    const tone = siteTone(site.code);
    const { done, total, target, pct, reached } = site.progress;
    return (
        <div aria-label={`Progres ${site.code ?? site.name ?? ''}`} className={cn('min-w-0 rounded-[14px] p-3 ring-1 ring-[hsl(var(--idesk-border))]', toneClasses(tone).soft)}>
            <div className="flex items-center gap-2">
                <SiteBadge code={site.code} />
                <b className="min-w-0 flex-1 truncate text-[13px]">{site.name}</b>
                <b className="text-[13px] tabular-nums">{`${done}/${total}`}</b>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <i className={cn('block h-full rounded-full', toneClasses(tone).fill)} style={{ width: `${pct}%` }} />
            </div>
            <p className={cn('mt-1.5 text-[12px]', reached ? toneClasses('green').ink : 'text-[hsl(var(--idesk-text-secondary))]')}>
                {reached ? 'Target tercapai' : `butuh ${Math.max(0, target - done)} lagi`}
            </p>
        </div>
    );
}

/** Ring "x/y sudah mengisi", how many answers are still needed, the target line and one card per site. */
export function RespondentHero({ progress, targetPct, basisLabel, sites }: {
    progress: Progress; targetPct: number; basisLabel: string; sites: readonly SiteProgress[];
}) {
    const missing = Math.max(0, progress.target - progress.done);
    return (
        <div className="grid items-center gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <span className="justify-self-center">
                <ScoreRing pct={progress.pct} tone={progress.reached ? 'green' : 'amber'}>
                    <span className="grid">
                        <b className="text-[22px] font-bold tabular-nums">{`${progress.done}/${progress.total}`}</b>
                        <span className={cn(MUTED_TEXT, 'text-[12px]')}>sudah mengisi</span>
                    </span>
                </ScoreRing>
            </span>
            <div className="min-w-0">
                <h3 className="text-[15px] font-semibold">
                    {progress.reached ? 'Target tercapai' : (
                        <>Butuh <span className={toneClasses('amber').ink}>{`${missing} jawaban lagi`}</span>{` untuk mencapai target ${targetPct}%`}</>
                    )}
                </h3>
                <TargetLine progress={progress} targetPct={targetPct} basisLabel={basisLabel} />
                {sites.length > 0 && (
                    <div className="mt-3.5 grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr))]">
                        {sites.map((site) => <SiteCard key={site.siteId} site={site} />)}
                    </div>
                )}
            </div>
        </div>
    );
}
