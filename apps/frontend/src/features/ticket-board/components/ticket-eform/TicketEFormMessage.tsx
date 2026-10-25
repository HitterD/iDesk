import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { getTypeConfig } from '@/features/request-center/components/eform/eform-vocabulary';
import { useEformBasePath } from '@/features/request-center/hooks/useEformBasePath';
import { SidebarCard } from '../ticket-detail/SidebarCard';
import type { LinkedTicketMove } from '../ticket-detail/ActivityEvent';
import { EFormProgress, EFormRequestCard, type EFormPhaseEvent } from './EFormRequestCard';
import { statusSentence, type TicketEFormRequest } from './eformFlow';
import { useTicketEFormRequests } from './useTicketEForm';

interface TicketEFormMessageProps {
    ticketId: string;
    event: EFormPhaseEvent;
    actorName?: string | null;
    reason?: string | null;
    createdAt: string;
    isRequester: boolean;
    ticketMove?: LinkedTicketMove;
}

/** A chat system message about a linked e-form request, joined with the request's live state. */
export const TicketEFormMessage: React.FC<TicketEFormMessageProps> = ({ ticketId, event, ...rest }) => {
    const { data: requests } = useTicketEFormRequests(ticketId);
    const eformBasePath = useEformBasePath();
    return (
        <EFormRequestCard {...rest} ticketId={ticketId} event={event} eformBasePath={eformBasePath}
            request={requests?.find((request) => request.id === event.id)} />
    );
};

/** Sidebar summary of the e-form requests raised from this ticket; renders nothing for tickets without any. */
export const TicketEFormSection: React.FC<{ ticketId: string }> = ({ ticketId }) => {
    const { data: requests = [] } = useTicketEFormRequests(ticketId);
    const shown = requests.filter((request) => request.status !== 'CANCELLED');
    return shown.length > 0 ? <LinkedEForms requests={shown} /> : null;
};

function LinkedEForms({ requests: shown }: { requests: TicketEFormRequest[] }) {
    const eformBasePath = useEformBasePath();
    return (
        <SidebarCard title="Akses E-Form">
            <div className="thw-panel">
                <ul>
                    {shown.map((request) => (
                        <li key={request.id}>
                            <Link to={`${eformBasePath}/${request.id}`} className="thw-panel-row">
                                <span className="thw-panel-top">
                                    <b>{request.code}</b>
                                    <small>{getTypeConfig(request.formType).label}</small>
                                    <ArrowUpRight aria-hidden="true" />
                                </span>
                                <span className="thw-panel-state">{statusSentence(request)}</span>
                                {request.status !== 'DRAFT' && <EFormProgress request={request} compact />}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </SidebarCard>
    );
}

const PROPOSABLE_TEAMS = new Set([undefined, null, '', 'OPS_SUPPORT']);
const FINISHED = new Set(['RESOLVED', 'CLOSED', 'CANCELLED']);
/** Same roles as the backend's EFORM_PROPOSER_ROLES. */
const PROPOSER_ROLES = new Set(['ADMIN', 'AGENT_ADMIN', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT']);

/** IT can propose e-form access from an open IT support ticket. */
export const canProposeEForm = (ticket: { handlingTeam?: string | null; status: string }, isAgentView: boolean, role?: string) =>
    isAgentView && Boolean(role && PROPOSER_ROLES.has(role)) && PROPOSABLE_TEAMS.has(ticket.handlingTeam ?? undefined) && !FINISHED.has(ticket.status);
