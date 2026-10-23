import React from 'react';
import { cn } from '@/lib/utils';
import { TicketPill } from './ticket-pill';

/** Label for tickets filed by another system through the integration API. */
const EXTERNAL_SOURCES: Record<string, string> = {
    IPOP: 'via iPop',
};

/** Small "via iPop" chip; renders nothing for tickets created in iDesk itself. */
export const ExternalSourceBadge: React.FC<{ source?: string | null; className?: string }> = ({ source, className }) => {
    const label = source ? EXTERNAL_SOURCES[source] : undefined;
    if (!label) return null;
    return (
        <TicketPill tone="blue"
            title="Tiket dibuat dari aplikasi iPop"
            className={cn(
                'text-[11px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap',
                className,
            )}
        >
            {label}
        </TicketPill>
    );
};
