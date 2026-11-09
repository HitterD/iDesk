import { useState, type RefObject } from 'react';
import { BriefcaseBusiness, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { siteTone, toneClasses } from '../../lib/csiTone';
import type { CsiFormRatee } from '../../types';
import { ScreenHeading } from './FlowChrome';
import { imageUrl } from './RateeAvatar';

const KIND_TEXT = { TEAM: 'Penilaian tim', PERSON: 'Penilaian individu' } as const;

interface SubjectHeaderProps {
    ratee: CsiFormRatee;
    index: number;
    total: number;
    /** Element scrolled into view when the respondent moves to this subject. */
    scrollTarget?: RefObject<HTMLElement | null>;
}

export const kindText = (ratee: Pick<CsiFormRatee, 'kind' | 'siteCode'>) =>
    [KIND_TEXT[ratee.kind], ratee.siteCode].filter(Boolean).join(' · ');

/** Round photo, or the initial on the site colour (72 px on phones, 96 px from sm). */
function Avatar({ ratee }: { ratee: CsiFormRatee }) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const url = ratee.photoUrl ?? ratee.avatarUrl;
    const showImage = Boolean(url) && failedUrl !== url;
    return (
        <span data-avatar className={cn('csi-photo-in grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full text-[30px] font-bold text-white shadow-sm ring-4 ring-[hsl(var(--idesk-surface))] sm:h-24 sm:w-24 sm:text-[40px]',
            !showImage && toneClasses(siteTone(ratee.siteCode)).fill)}>
            {showImage && url ? (
                <img src={imageUrl(url)} alt="" className="h-full w-full object-cover object-[center_25%]" onError={() => setFailedUrl(url)} />
            ) : (
                <span aria-hidden="true">{ratee.displayName.trim().charAt(0).toUpperCase() || '?'}</span>
            )}
        </span>
    );
}

/**
 * Compact subject header above the questions: avatar, kind chip + counter, name, job title, the HC service function
 * (fungsi pelayanan) and the tagline. Kept small so the form, not the photo, leads the screen.
 */
export function SubjectHeader({ ratee, index, total, scrollTarget }: SubjectHeaderProps) {
    const KindIcon = ratee.kind === 'TEAM' ? Users : User;
    return (
        <header data-testid="csi-subject-header" key={ratee.periodRateeId}
            className="flex items-start gap-4 border-b border-[hsl(var(--border)/.7)] bg-[hsl(var(--muted)/.35)] p-4 sm:gap-5 sm:p-5">
            <Avatar ratee={ratee} />
            <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[.06em] text-white',
                        toneClasses(siteTone(ratee.siteCode)).fill)}>
                        <KindIcon className="h-3 w-3" aria-hidden="true" />{kindText(ratee)}
                    </span>
                    <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-[hsl(var(--idesk-text-secondary))]">
                        {index + 1} / {total}
                    </span>
                </div>
                <ScreenHeading id={`csi-ratee-${ratee.periodRateeId}`} scrollTarget={scrollTarget}
                    className="text-balance break-words text-[20px] font-bold leading-tight tracking-[-.01em] sm:text-[24px]">
                    {ratee.displayName}
                </ScreenHeading>
                {ratee.jobTitle && <p className="mt-0.5 text-[13.5px] font-medium text-[hsl(var(--idesk-text-secondary))]">{ratee.jobTitle}</p>}
                {ratee.serviceFunction && (
                    <p className="mt-2 inline-flex max-w-full items-start gap-1.5 rounded-lg bg-[hsl(var(--idesk-sapphire)/.09)] px-2.5 py-1 text-[13px] text-[hsl(var(--idesk-sapphire))]">
                        <BriefcaseBusiness className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 break-words">
                            <span className="font-medium opacity-80">Fungsi pelayanan: </span>
                            <span className="font-semibold">{ratee.serviceFunction}</span>
                        </span>
                    </p>
                )}
                {ratee.tagline && <p className="mt-2 text-pretty text-[13.5px] italic leading-snug text-[hsl(var(--idesk-text-secondary))]">“{ratee.tagline}”</p>}
            </div>
        </header>
    );
}
