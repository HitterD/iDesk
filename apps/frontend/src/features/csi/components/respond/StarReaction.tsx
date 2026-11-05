import { useRef, useState, type KeyboardEvent } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CSI_SCORE_MAX, CSI_SCORE_MIN } from '../../lib/csiForm';
import { STAR_EMOJI, STAR_LABELS, starTone, toneClasses } from '../../lib/csiTone';

const STARS = [1, 2, 3, 4, 5] as const;
/** Stars pop one after another, left to right. */
const POP_STAGGER_MS = 40;
const EMPTY_PROMPT = 'Pilih bintang';

interface StarReactionProps {
    value?: number;
    onChange: (n: number) => void;
    label: string;
}

function keyValue(key: string, star: number): number | undefined {
    switch (key) {
        case 'ArrowRight':
        case 'ArrowUp': return Math.min(CSI_SCORE_MAX, star + 1);
        case 'ArrowLeft':
        case 'ArrowDown': return Math.max(CSI_SCORE_MIN, star - 1);
        case 'Home': return CSI_SCORE_MIN;
        case 'End': return CSI_SCORE_MAX;
        default: return undefined;
    }
}

/** Emoji + word for the shown value; a hover preview is dimmed until it is clicked. */
function Reaction({ shown, preview, bounce }: { shown: number; preview: boolean; bounce: boolean }) {
    const tone = toneClasses(starTone(shown));
    return (
        <span className="inline-flex min-w-[140px] items-center gap-2">
            <span key={shown} aria-hidden="true" data-preview={preview || undefined}
                className={cn('grid h-[38px] w-[38px] place-items-center rounded-full text-[22px] leading-none transition-opacity duration-200',
                    shown ? tone.soft : 'outline-dashed outline-[1.5px] -outline-offset-[1.5px] outline-border',
                    preview && 'opacity-60', bounce && shown > 0 && 'csi-emo-pop')}>
                {STAR_EMOJI[shown]}
            </span>
            <span className={cn('text-[14px] font-semibold', shown ? tone.ink : 'text-muted-foreground')}>{STAR_LABELS[shown] || EMPTY_PROMPT}</span>
        </span>
    );
}

/**
 * Five stars with an emoji reaction: hover previews; a click or arrow key pops the stars in sequence with a ripple.
 * The csi-* animations are switched off by the prefers-reduced-motion block in index.css.
 */
export function StarReaction({ value, onChange, label }: StarReactionProps) {
    const buttons = useRef<Array<HTMLButtonElement | null>>([]);
    const [hover, setHover] = useState(0);
    const [pop, setPop] = useState({ count: 0, star: 0 });
    const current = value ?? 0;
    const shown = hover || current;
    const tabStop = current >= CSI_SCORE_MIN ? current : CSI_SCORE_MIN;
    const choose = (star: number) => {
        setPop((previous) => ({ count: previous.count + 1, star }));
        onChange(star);
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, star: number) => {
        const next = keyValue(event.key, star);
        if (next === undefined) return;
        event.preventDefault();
        // A pointer still resting on a star would otherwise keep showing its stale preview.
        setHover(0);
        choose(next);
        buttons.current[next - 1]?.focus();
    };
    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div role="radiogroup" aria-label={label} className="flex items-center gap-1.5 sm:gap-1" onMouseLeave={() => setHover(0)}>
                {STARS.map((star) => (
                    <button key={star} type="button" role="radio" aria-checked={star === current} aria-label={`${star} bintang`}
                        tabIndex={star === tabStop ? 0 : -1} ref={(element) => { buttons.current[star - 1] = element; }}
                        onMouseEnter={() => setHover(star)} onClick={() => choose(star)} onKeyDown={(event) => handleKeyDown(event, star)}
                        className={cn('relative grid h-11 w-11 place-items-center rounded-xl transition-transform duration-200 ease-[var(--ease-spring)] [@media(hover:hover)]:hover:scale-115',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--idesk-sapphire))]',
                            star <= shown ? 'text-[hsl(var(--ticket-amber))]' : 'text-muted-foreground/35')}>
                        <span key={pop.count} aria-hidden="true" style={{ animationDelay: `${(star - 1) * POP_STAGGER_MS}ms` }}
                            className={cn('grid place-items-center', pop.count > 0 && star <= current && 'csi-star-pop')}>
                            <Star className="h-7 w-7 fill-current" strokeWidth={1.5} />
                        </span>
                        {pop.count > 0 && pop.star === star && (
                            <span key={`ripple-${pop.count}`} aria-hidden="true" className="csi-ripple pointer-events-none absolute inset-1 rounded-full border-2 border-[hsl(var(--ticket-amber))]" />
                        )}
                    </button>
                ))}
            </div>
            <Reaction shown={shown} preview={hover > 0 && hover !== current} bounce={pop.count > 0 || hover > 0} />
        </div>
    );
}
