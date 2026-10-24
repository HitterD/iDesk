import React from 'react';
import { cn } from '@/lib/utils';
import { TicketPill } from './ticket-pill';

/** Label for tickets filed by another system through the integration API. */
const EXTERNAL_SOURCES: Record<string, { label: string; title: string }> = {
    IPOP: { label: 'via iPop', title: 'Tiket dibuat dari aplikasi iPop' },
};

/** Which app filed the ticket: iPop, or a connected app (source API, app id in externalSource). */
export function externalSourceOf(source?: string | null, externalSource?: string | null): { label: string; title: string } | undefined {
    if (source === 'API' && externalSource) {
        return { label: `via ${externalSource}`, title: `Tiket dibuat dari aplikasi ${externalSource} lewat API` };
    }
    return source ? EXTERNAL_SOURCES[source] : undefined;
}

/** Small "via iPop" / "via EBBK" chip; renders nothing for tickets created in iDesk itself. */
export const ExternalSourceBadge: React.FC<{ source?: string | null; externalSource?: string | null; className?: string }> = ({ source, externalSource, className }) => {
    const origin = externalSourceOf(source, externalSource);
    if (!origin) return null;
    return (
        <TicketPill tone="blue"
            title={origin.title}
            className={cn(
                'text-[11px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap',
                className,
            )}
        >
            {origin.label}
        </TicketPill>
    );
};
