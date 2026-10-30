import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CSI_SCORE_GOOD, scoreTone, siteTone, starTone, toneClasses } from '../../../lib/csiTone';
import { formatFixed2 } from '../../../lib/format';
import type { CsiReportRatee } from '../../../types';
import { imageUrl } from '../../respond/RateeAvatar';
import { questionLabel } from './reportModel';

export type SiteCodeOf = (siteId: string | null) => string | null;

export function SiteBadge({ code }: { code: string | null }) {
    if (!code) return null;
    return <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white', toneClasses(siteTone(code)).fill)}>{code}</span>;
}

export function ScoreBadge({ average }: { average: number | null }) {
    const tone = toneClasses(scoreTone(average));
    return (
        <span className={cn('inline-flex items-baseline gap-1 rounded-[10px] px-2.5 py-0.5', tone.soft, tone.ink)}>
            <b className="text-[22px] font-bold tabular-nums tracking-tight">{formatFixed2(average)}</b>
            <span className="text-[12px]">/5</span>
        </span>
    );
}

/** One stacked bar of STAR/SCALE answers per star (1 → 5), coloured red → green. */
export function StarDistributionBar({ counts }: { counts: readonly number[] }) {
    const total = counts.reduce((sum, count) => sum + count, 0);
    const label = `Sebaran bintang: ${counts.map((count, index) => `${index + 1} bintang ${count}`).join(', ')}`;
    return (
        <span role="img" aria-label={label} title="Sebaran bintang" className="flex h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            {total > 0 && counts.map((count, index) => count > 0 && (
                <i key={index} className={cn('block h-full', toneClasses(starTone(index + 1)).fill)} style={{ width: `${(count / total) * 100}%` }} />
            ))}
        </span>
    );
}

/** Strongest and weakest scored question of one subject (weakest only shown below the "Sangat puas" threshold). */
export function subjectExtremes(ratee: CsiReportRatee) {
    const scored = ratee.questions.filter((question) => question.average !== null)
        .sort((a, b) => (b.average as number) - (a.average as number));
    const strongest = scored[0] ?? null;
    const weakest = scored.length > 1 ? scored[scored.length - 1] : null;
    return {
        strongest: strongest && { label: questionLabel(strongest), name: strongest.name },
        weakest: weakest && (weakest.average as number) < CSI_SCORE_GOOD ? { label: questionLabel(weakest), name: weakest.name } : null,
    };
}

/** Subject photo (cover) or its initial on the site colour; decorative. */
export function SubjectPhoto({ name, photoUrl, siteCode, className }: { name: string; photoUrl: string | null; siteCode: string | null; className?: string }) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const showImage = Boolean(photoUrl) && failedUrl !== photoUrl;
    return (
        <span className={cn('grid shrink-0 place-items-center overflow-hidden font-bold text-white', className,
            !showImage && toneClasses(siteTone(siteCode)).fill)}>
            {showImage && photoUrl ? (
                <img src={imageUrl(photoUrl)} alt="" loading="lazy" className="h-full w-full object-cover object-[center_25%]" onError={() => setFailedUrl(photoUrl)} />
            ) : (
                <span aria-hidden="true" className="text-[22px]">{name.trim().charAt(0).toUpperCase() || '?'}</span>
            )}
        </span>
    );
}

export const kindLabel = (ratee: Pick<CsiReportRatee, 'kind'>) => ratee.kind === 'TEAM' ? 'Tim' : 'Individu';
