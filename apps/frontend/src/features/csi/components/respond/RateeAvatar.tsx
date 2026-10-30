import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Existing ticket palette tokens (tint + ink pairs work in light and dark). Literal strings so Tailwind emits them. */
const INITIAL_TONES = [
    'bg-[hsl(var(--ticket-blue)/.14)] text-[hsl(var(--ticket-blue-ink))]',
    'bg-[hsl(var(--ticket-teal)/.14)] text-[hsl(var(--ticket-teal-ink))]',
    'bg-[hsl(var(--ticket-green)/.14)] text-[hsl(var(--ticket-green-ink))]',
    'bg-[hsl(var(--ticket-amber)/.14)] text-[hsl(var(--ticket-amber-ink))]',
    'bg-[hsl(var(--ticket-sky)/.14)] text-[hsl(var(--ticket-sky-ink))]',
    'bg-[hsl(var(--ticket-navy)/.14)] text-[hsl(var(--ticket-navy-ink))]',
] as const;

const SIZES = {
    sm: 'h-9 w-9 text-[13px]',
    lg: 'h-14 w-14 text-lg',
} as const;

/** Same rule as UserAvatar: relative upload paths are served by the API origin. */
export const imageUrl = (url: string) =>
    /^(https?:|blob:|data:)/.test(url) ? url : `${import.meta.env.VITE_API_URL || ''}${url}`;

/** Deterministic: the same name always gets the same tone. */
export function initialTone(name: string): string {
    const hash = [...name].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 0);
    return INITIAL_TONES[hash % INITIAL_TONES.length];
}

/** Photo with an initial fallback; decorative (`alt=""`) because the name is always printed next to it. */
export function RateeAvatar({ name, avatarUrl, size = 'lg' }: { name: string; avatarUrl: string | null; size?: keyof typeof SIZES }) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const showImage = Boolean(avatarUrl) && failedUrl !== avatarUrl;
    return (
        <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold', SIZES[size],
            !showImage && initialTone(name))}>
            {showImage && avatarUrl ? (
                <img src={imageUrl(avatarUrl)} alt="" loading="lazy" className="h-full w-full object-cover"
                    onError={() => setFailedUrl(avatarUrl)} />
            ) : (
                <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>
            )}
        </span>
    );
}
