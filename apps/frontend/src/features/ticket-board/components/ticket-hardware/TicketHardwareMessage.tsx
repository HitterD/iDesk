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

const PROPOSABLE_TEAMS = new Set([undefined, null, '', 'OPS_SUPPORT']);
const FINISHED = new Set(['RESOLVED', 'CLOSED', 'CANCELLED']);

/** ICT can propose hardware from an open IT support ticket. */
export const canProposeHardware = (ticket: { handlingTeam?: string | null; status: string }, isAgentView: boolean) =>
    isAgentView && PROPOSABLE_TEAMS.has(ticket.handlingTeam ?? undefined) && !FINISHED.has(ticket.status);
