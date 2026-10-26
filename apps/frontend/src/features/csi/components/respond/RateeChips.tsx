import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CsiOpenForm } from '../../types';
import { RESPOND_COPY } from './respondCopy';

type Ratee = CsiOpenForm['ratees'][number];

interface RateeChipsProps {
    ratees: Ratee[];
    current: number;
    isComplete: (ratee: Ratee, index: number) => boolean;
    teamLabel: string;
    onSelect: (index: number) => void;
}

/** Wrapping chips with full names: jump anywhere, tick when every required question is answered. */
export function RateeChips({ ratees, current, isComplete, onSelect, teamLabel }: RateeChipsProps) {
    return (
        <nav aria-label={RESPOND_COPY.chipsLabel}>
            <ol className="flex flex-wrap gap-2">
                {ratees.map((ratee, index) => {
                    const active = index === current;
                    const complete = isComplete(ratee, index);
                    return (
                        <li key={ratee.periodRateeId}>
                            <button type="button" onClick={() => onSelect(index)} aria-current={active ? 'step' : undefined}
                                className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-2xl px-3.5 py-1.5 text-left text-[13px] font-medium transition-colors duration-150',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--idesk-sapphire))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                    active
                                        ? 'bg-[hsl(var(--idesk-sapphire))] text-white'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground')}>
                                {complete && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                <span className="break-words">{ratee.kind === 'TEAM' ? teamLabel : ratee.displayName}</span>
                                {complete && <span className="sr-only">{`, ${RESPOND_COPY.chipComplete}`}</span>}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
