import { useRef, type KeyboardEvent } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CSI_RATING_LABELS: Readonly<Record<number, string>> = {
    1: 'Sangat Tidak Puas',
    2: 'Tidak Puas',
    3: 'Cukup',
    4: 'Puas',
    5: 'Sangat Puas',
};
const STARS = [1, 2, 3, 4, 5] as const;

export interface StarRatingProps {
    value: number;
    onChange?: (value: number) => void;
    label: string;
    size?: 'sm' | 'lg';
}

function keyboardValue(key: string, value: number): number | undefined {
    const minimum = STARS[0];
    const maximum = STARS[STARS.length - 1];
    switch (key) {
        case 'ArrowRight':
        case 'ArrowUp': return Math.min(maximum, value + 1);
        case 'ArrowLeft':
        case 'ArrowDown': return Math.max(minimum, value - 1);
        case 'Home': return minimum;
        case 'End': return maximum;
        default: return undefined;
    }
}

export function StarRating({ value, onChange, label, size = 'lg' }: StarRatingProps) {
    const buttons = useRef<Array<HTMLButtonElement | null>>([]);
    const tabStop = STARS.some((star) => star === value) ? value : STARS[0];
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, star: number) => {
        const next = keyboardValue(event.key, star);
        if (next === undefined || !onChange) return;
        event.preventDefault();
        onChange(next);
        buttons.current[next - 1]?.focus();
    };
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-1" role={onChange ? 'radiogroup' : 'img'}
                aria-label={onChange ? label : `${value} dari 5 bintang`}>
                {STARS.map((star) => {
                    const icon = <Star aria-hidden="true" className={cn(size === 'lg' ? 'h-7 w-7' : 'h-4 w-4',
                        star <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600')} />;
                    return onChange ? (
                        <button key={star} type="button" role="radio" aria-checked={star === value}
                            ref={(element) => { buttons.current[star - 1] = element; }}
                            tabIndex={star === tabStop ? 0 : -1}
                            onKeyDown={(event) => handleKeyDown(event, star)}
                            aria-label={`${star} dari 5`} onClick={() => onChange(star)}
                            className={cn('inline-flex items-center justify-center rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                                size === 'lg' ? 'h-11 w-11' : 'h-6 w-6')}>
                            {icon}
                        </button>
                    ) : <span key={star}>{icon}</span>;
                })}
            </div>
            {CSI_RATING_LABELS[value] && <p className="text-xs text-slate-600 dark:text-slate-400">{CSI_RATING_LABELS[value]}</p>}
        </div>
    );
}
