import { useState, type CSSProperties, type RefObject } from 'react';
import { User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { siteTone, toneClasses } from '../../lib/csiTone';
import type { CsiFormRatee } from '../../types';
import { ScreenHeading } from './FlowChrome';
import { imageUrl } from './RateeAvatar';

const KIND_TEXT = { TEAM: 'Penilaian tim', PERSON: 'Penilaian individu' } as const;
/** Caption lines fade in one after another (ms). */
const CAPTION_DELAY = { kind: 0, name: 120, role: 180, tagline: 300 } as const;
const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

interface SubjectPhotoProps {
    ratee: CsiFormRatee;
    index: number;
    total: number;
    /** Element scrolled into view when the respondent moves to this subject. */
    scrollTarget?: RefObject<HTMLElement | null>;
}

export const kindText = (ratee: Pick<CsiFormRatee, 'kind' | 'siteCode'>) =>
    [KIND_TEXT[ratee.kind], ratee.siteCode].filter(Boolean).join(' · ');

/** Photo (slow Ken Burns zoom) or, without one, the site colour with a large initial. */
function Picture({ ratee }: { ratee: CsiFormRatee }) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const url = ratee.photoUrl ?? ratee.avatarUrl;
    const showImage = Boolean(url) && failedUrl !== url;
    return (
        <div key={ratee.periodRateeId} className="csi-photo-in absolute inset-0">
            {showImage && url ? (
                <img src={imageUrl(url)} alt="" className="csi-kenburns h-full w-full object-cover object-[center_25%]"
                    onError={() => setFailedUrl(url)} />
            ) : (
                <span aria-hidden="true" className={cn('grid h-full w-full place-items-center text-[clamp(72px,14cqi,160px)] font-bold text-white/90',
                    toneClasses(siteTone(ratee.siteCode)).fill)}>
                    {ratee.displayName.trim().charAt(0).toUpperCase() || '?'}
                </span>
            )}
        </div>
    );
}

/**
 * Stacked banner (photo above the form) by default. Only from `lg` (no mobile header / bottom nav) and with a
 * container of at least 780 px does it become the sticky left column; below that a sticky photo would hide its
 * caption under the fixed bottom nav.
 */
export const PHOTO_STACKED = 'relative aspect-[4/3.8] max-h-[64vh] w-full';
export const PHOTO_STICKY = cn('lg:@min-[780px]:sticky lg:@min-[780px]:top-[var(--csi-stick,64px)] lg:@min-[780px]:aspect-auto lg:@min-[780px]:max-h-[820px] lg:@min-[780px]:min-h-[480px]',
    'lg:@min-[780px]:h-[calc(100dvh-var(--csi-chrome,0px)-var(--csi-stick,64px)-16px)] lg:@min-[780px]:rounded-l-[22px]');

/** Left column of the respondent screen (see PHOTO_STACKED / PHOTO_STICKY). */
export function SubjectPhoto({ ratee, index, total, scrollTarget }: SubjectPhotoProps) {
    const KindIcon = ratee.kind === 'TEAM' ? Users : User;
    return (
        <div data-testid="csi-subject-photo" className={cn('overflow-hidden bg-[hsl(var(--idesk-chrome))]', PHOTO_STACKED, PHOTO_STICKY)}>
            <Picture key={ratee.periodRateeId} ratee={ratee} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(8_14_30/.25)_0,transparent_22%,transparent_46%,rgb(8_14_30/.9)_100%)]" />
            <span className="absolute left-4 top-4 z-[2] rounded-full bg-[rgb(8_14_30/.45)] px-[11px] py-[5px] text-[12px] font-bold tabular-nums text-white backdrop-blur-md">
                {index + 1} / {total}
            </span>
            <div key={ratee.periodRateeId} className="absolute inset-x-[clamp(16px,2.4cqi,32px)] bottom-[clamp(14px,2.2cqi,30px)] z-[2] text-white">
                <span style={delay(CAPTION_DELAY.kind)} className={cn('csi-cap-in mb-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.06em] text-white',
                    toneClasses(siteTone(ratee.siteCode)).fill)}>
                    <KindIcon className="h-[13px] w-[13px]" aria-hidden="true" />{kindText(ratee)}
                </span>
                <div style={delay(CAPTION_DELAY.name)} className="csi-cap-in">
                    <ScreenHeading id={`csi-ratee-${ratee.periodRateeId}`} scrollTarget={scrollTarget}
                        className="text-balance break-words text-[clamp(20px,2.4cqi,34px)] font-bold leading-[1.1] tracking-[-.02em] text-white">
                        {ratee.displayName}
                    </ScreenHeading>
                </div>
                {ratee.jobTitle && <p style={delay(CAPTION_DELAY.role)} className="csi-cap-in mt-1 font-medium text-white/80">{ratee.jobTitle}</p>}
                {ratee.tagline && (
                    <p style={delay(CAPTION_DELAY.tagline)} className="csi-cap-in mt-[clamp(10px,1.4cqi,18px)] max-w-[520px] text-pretty text-[clamp(13.5px,1.25cqi,17px)] italic leading-[1.4]">
                        <span aria-hidden="true" className="mb-2 block h-0.5 w-7 rounded-sm bg-[hsl(var(--idesk-cta))]" />
                        “{ratee.tagline}”
                    </p>
                )}
            </div>
        </div>
    );
}
