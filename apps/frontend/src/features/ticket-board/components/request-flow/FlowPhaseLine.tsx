import { isNonSlaTicket } from '../../utils/nonSlaTicket';

export interface FlowFields {
    requestKind?: 'HARDWARE' | 'EFORM' | null;
    ticketType?: string | null;
    isNonSla?: boolean;
    flowPhase?: string | null;
    flowPhaseLabel?: string | null;
    flowPhaseSince?: string | null;
    installScheduledAt?: string | null;
    /** @deprecated Hardware & E-Form tickets do not use SLA; kept on type for backward compatibility. */
    flowPaused?: boolean;
    /** The viewer is the one who must act next. */
    needsMyAction?: boolean;
}

/** The phase of a request ticket under its status with a quiet "Tanpa SLA" marker. Nothing for IT tickets. */
export function FlowPhaseLine({ ticket }: { ticket: FlowFields }) {
    const nonSla = isNonSlaTicket(ticket);
    if (!nonSla && !ticket.flowPhaseLabel) return null;
    if (!ticket.flowPhaseLabel) {
        return <span className="queue-nosla">Tanpa SLA</span>;
    }
    return (
        <span className="req-phase" data-flow-phase={ticket.flowPhase ?? undefined}>
            <span className="req-phase__label">{ticket.flowPhaseLabel}</span>
            <span className="queue-nosla">Tanpa SLA</span>
        </span>
    );
}
