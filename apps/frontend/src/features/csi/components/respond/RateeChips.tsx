import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CsiOpenForm } from '../../types';
import { RESPOND_COPY } from './respondCopy';

type Ratee = CsiOpenForm['ratees'][number];

interface RateeChipsProps {
    ratees: Ratee[];
    current: number;
    isComplete: (ratee: Ratee) => boolean;
    onSelect: (index: number) => void;
}

/** Horizontally scrollable person chips: jump anywhere, tick when every star is given. */
export function RateeChips({ ratees, current, isComplete, onSelect }: RateeChipsProps) {
    return (
        <nav aria-label={RESPOND_COPY.chipsLabel} className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-hide">
            <ol className="flex w-max gap-2">
                {ratees.map((ratee, index) => {
                    const active = index === current;
                    const complete = isComplete(ratee);
                    return (
                        <li key={ratee.periodRateeId}>
                            <button type="button" onClick={() => onSelect(index)} aria-current={active ? 'step' : undefined}
                                className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-150',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--idesk-sapphire))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                    active
                                        ? 'bg-[hsl(var(--idesk-sapphire))] text-white'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground')}>
                                {complete && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                <span className="max-w-[10rem] truncate">{ratee.displayName}</span>
                                {complete && <span className="sr-only">{`, ${RESPOND_COPY.chipComplete}`}</span>}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
