import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { CsiQuestionType } from '../../../types';
import { QUESTION_COPY, QUESTION_TYPE_LABELS, QUESTION_TYPE_ORDER } from './questionCopy';

/** Four type chips as a radio group; arrow keys move the selection like native radios. */
export function TypePicker({ value, onChange, disabled }: {
    value: CsiQuestionType; onChange: (type: CsiQuestionType) => void; disabled?: boolean;
}) {
    const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = QUESTION_TYPE_ORDER[(index + step + QUESTION_TYPE_ORDER.length) % QUESTION_TYPE_ORDER.length];
        onChange(next);
        (event.currentTarget.parentElement?.querySelector(`[data-type="${next}"]`) as HTMLElement | null)?.focus();
    };
    return (
        <div role="radiogroup" aria-label={QUESTION_COPY.typeGroup} className="flex flex-wrap gap-2">
            {QUESTION_TYPE_ORDER.map((type, index) => {
                const selected = type === value;
                return (
                    <button key={type} type="button" role="radio" aria-checked={selected} data-type={type} disabled={disabled}
                        tabIndex={selected ? 0 : -1} onClick={() => !selected && onChange(type)} onKeyDown={(event) => move(event, index)}
                        className={cn(
                            'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                            selected
                                ? 'bg-[hsl(var(--idesk-text))] text-[hsl(var(--idesk-surface))]'
                                : 'bg-[hsl(var(--muted))] text-[hsl(var(--idesk-text-secondary))] hover:text-[hsl(var(--idesk-text))]',
                        )}>
                        {QUESTION_TYPE_LABELS[type]}
                    </button>
                );
            })}
        </div>
    );
}
