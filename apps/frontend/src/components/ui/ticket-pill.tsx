import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type TicketPillTone = 'neutral' | 'blue' | 'sky' | 'navy' | 'amber' | 'green' | 'red' | 'teal';
export interface TicketPillProps extends HTMLAttributes<HTMLSpanElement> {
    tone: TicketPillTone;
}

/** Shared ticket value tones: agent pickers and requester readonly pills. */
export const PRIORITY_TONES: Readonly<Record<string, TicketPillTone>> = {
    LOW: 'neutral', MEDIUM: 'blue', HIGH: 'amber', CRITICAL: 'red',
    HARDWARE_INSTALLATION: 'amber', ORACLE_REQUEST: 'blue',
};
/** Open (sky) and In Progress (navy) must read differently wherever status is shown. */
export const STATUS_TONES: Readonly<Record<string, TicketPillTone>> = {
    TODO: 'sky', IN_PROGRESS: 'navy', WAITING_VENDOR: 'amber', RESOLVED: 'green',
    CLOSED: 'neutral', CANCELLED: 'red',
};

/** Readonly value. Editable values use a picker trigger instead. */
export function TicketPill({ tone, className, children, ...spanProps }: TicketPillProps) {
    return <span {...spanProps} className={cn('ticket-pill', `ticket-tone-${tone}`, className)}>{children}</span>;
}
