import React from 'react';
import { useHardwareBasePath } from '@/features/hardware-request/hooks/useHardwareBasePath';
import type { LinkedTicketMove } from '../ticket-detail/ActivityEvent';
import { HardwareRequestCard, type HardwarePhaseEvent } from './HardwareRequestCard';
import { useTicketHardwareRequests } from './useTicketHardware';

interface TicketHardwareMessageProps {
    ticketId: string;
    event: HardwarePhaseEvent;
    actorName?: string | null;
    reason?: string | null;
    createdAt: string;
    isRequester: boolean;
    ticketMove?: LinkedTicketMove;
}

/** A chat system message about a linked hardware request, joined with the request's live state. */
export const TicketHardwareMessage: React.FC<TicketHardwareMessageProps> = ({ ticketId, event, ...rest }) => {
    const { data: requests } = useTicketHardwareRequests(ticketId);
    const hardwareBasePath = useHardwareBasePath();
    return (
        <HardwareRequestCard {...rest} ticketId={ticketId} event={event} hardwareBasePath={hardwareBasePath}
            request={requests?.find((request) => request.id === event.id)} />
    );
};


