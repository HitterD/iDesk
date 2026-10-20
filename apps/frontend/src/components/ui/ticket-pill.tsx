import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type TicketPillTone = 'neutral' | 'blue' | 'navy' | 'amber' | 'green' | 'red' | 'teal';
export interface TicketPillProps extends HTMLAttributes<HTMLSpanElement> {
    tone: TicketPillTone;
}

/** Readonly value. Editable values use a picker trigger instead. */
export function TicketPill({ tone, className, children, ...spanProps }: TicketPillProps) {
    return <span {...spanProps} className={cn('ticket-pill', `ticket-tone-${tone}`, className)}>{children}</span>;
}
