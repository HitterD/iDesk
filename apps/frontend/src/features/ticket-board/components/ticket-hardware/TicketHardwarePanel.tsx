import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { SidebarCard } from '../ticket-detail/SidebarCard';
import { FLOW_LABEL, statusSentence, type TicketHardwareRequest } from './hardwareFlow';
import { HardwareProgress } from './HardwareProgress';
import { useTicketHardwareRequests } from './useTicketHardware';
import { useHardwareBasePath } from '@/features/hardware-request/hooks/useHardwareBasePath';
import './ticket-hardware.css';

/** Sidebar summary of the hardware requests raised from this ticket, each a link into Hardware Request. */
export const TicketHardwarePanel: React.FC<{ requests: TicketHardwareRequest[]; hardwareBasePath: string }> = ({ requests, hardwareBasePath }) => {
    if (requests.length === 0) return null;
    return (
        <div className="thw-panel">
            <ul>
                {requests.map((request) => (
                    <li key={request.id}>
                        <Link to={`${hardwareBasePath}/${request.id}`} className="thw-panel-row">
                            <span className="thw-panel-top">
                                <b>{request.requestNumber}</b>
                                <small>{FLOW_LABEL[request.requestType]}</small>
                                <ArrowUpRight aria-hidden="true" />
                            </span>
                            <span className="thw-panel-state">{statusSentence(request)}</span>
                            {request.status !== 'DRAFT' && <HardwareProgress request={request} compact />}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
};

/** The panel wired to the ticket's hardware requests; renders nothing for tickets without any. */
export const TicketHardwareSection: React.FC<{ ticketId: string }> = ({ ticketId }) => {
    const { data: requests = [] } = useTicketHardwareRequests(ticketId);
    return requests.length > 0 ? <LinkedRequests requests={requests} /> : null;
};

function LinkedRequests({ requests }: { requests: TicketHardwareRequest[] }) {
    const hardwareBasePath = useHardwareBasePath();
    return (
        <SidebarCard title="Hardware request">
            <TicketHardwarePanel requests={requests} hardwareBasePath={hardwareBasePath} />
        </SidebarCard>
    );
}
