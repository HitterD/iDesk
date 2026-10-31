import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { starTone, toneClasses } from '../../lib/csiTone';
import type { CsiOption } from '../../types';

interface ChoiceListProps {
    label: string;
    options: CsiOption[];
    /** Selected option index; undefined = nothing chosen yet. */
    value: number | undefined;
    onChange: (index: number) => void;
    /** SCALE: compact pills, the chosen one coloured red→green by its points (points stay hidden). */
    variant?: 'cards' | 'pills';
}

/** Index reached by an arrow/Home/End key, wrapping around; undefined for other keys. */
function targetIndex(key: string, index: number, count: number): number | undefined {
    switch (key) {
        case 'ArrowDown':
        case 'ArrowRight': return (index + 1) % count;
        case 'ArrowUp':
        case 'ArrowLeft': return (index - 1 + count) % count;
        case 'Home': return 0;
        case 'End': return count - 1;
        default: return undefined;
    }
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--idesk-sapphire))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function pillClass(option: CsiOption, selected: boolean) {
    const tone = toneClasses(starTone(option.points));
    return cn('min-h-10 rounded-full px-3.5 py-2 text-left text-[13px] font-medium transition-[background-color,color,box-shadow,transform] duration-200', FOCUS_RING,
        selected ? cn(tone.fill, '-translate-y-px text-white shadow-sm') : 'bg-card text-foreground ring-1 ring-border hover:ring-foreground/30');
}

function cardClass(selected: boolean) {
    return cn('flex min-h-12 w-full items-center gap-3.5 rounded-xl border px-4 py-3 text-left text-[15px] transition-colors duration-150', FOCUS_RING,
        selected
            ? 'border-[hsl(var(--idesk-sapphire))] bg-[hsl(var(--idesk-sapphire)/.08)] ring-1 ring-[hsl(var(--idesk-sapphire))]'
            : 'border-border bg-card hover:bg-muted/50');
}

function CardContent({ option, selected }: { option: CsiOption; selected: boolean }) {
    return (
        <>
            <span aria-hidden="true" className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2',
                selected ? 'border-[hsl(var(--idesk-sapphire))]' : 'border-muted-foreground/50')}>
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--idesk-sapphire))]" />}
            </span>
            <span className="min-w-0 flex-1 break-words text-foreground">{option.label}</span>
        </>
    );
}

/** Radio cards (CHOICE) or pills (SCALE). Only labels are shown: SCALE points are never revealed to the respondent. */
export function ChoiceList({ label, options, value, onChange, variant = 'cards' }: ChoiceListProps) {
    const pills = variant === 'pills';
    const buttons = useRef<Array<HTMLButtonElement | null>>([]);
    const tabStop = value !== undefined && value < options.length ? value : 0;
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const next = targetIndex(event.key, index, options.length);
        if (next === undefined) return;
        event.preventDefault();
        onChange(next);
        buttons.current[next]?.focus();
    };
    return (
        <div role="radiogroup" aria-label={label} className={pills ? 'flex flex-wrap gap-1.5' : 'space-y-2.5'}>
            {options.map((option, index) => {
                const selected = index === value;
                return (
                    <button key={index} type="button" role="radio" aria-checked={selected} tabIndex={index === tabStop ? 0 : -1}
                        ref={(element) => { buttons.current[index] = element; }}
                        onClick={() => onChange(index)} onKeyDown={(event) => handleKeyDown(event, index)}
                        className={pills ? pillClass(option, selected) : cardClass(selected)}>
                        {pills ? <span className="break-words">{option.label}</span> : <CardContent option={option} selected={selected} />}
                    </button>
                );
            })}
        </div>
    );
}
