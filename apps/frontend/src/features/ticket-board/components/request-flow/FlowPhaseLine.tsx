import { Pause } from 'lucide-react';

export interface FlowFields {
    requestKind?: 'HARDWARE' | 'EFORM' | null;
    flowPhase?: string | null;
    flowPhaseLabel?: string | null;
    /** The SLA clock is on hold while IT waits on someone else. */
    flowPaused?: boolean;
    /** The viewer is the one who must act next. */
    needsMyAction?: boolean;
}

/** The phase of a request ticket under its status, with the SLA pause and "your turn" markers. Nothing for IT tickets. */
export function FlowPhaseLine({ ticket }: { ticket: FlowFields }) {
    if (!ticket.requestKind || !ticket.flowPhaseLabel) return null;
    return (
        <span className="req-phase" data-flow-phase={ticket.flowPhase ?? undefined}>
            <span className="req-phase__label">{ticket.flowPhaseLabel}</span>
            {ticket.flowPaused && <span className="req-phase__pause" title="SLA dijeda"><Pause aria-hidden="true" />Dijeda</span>}
        </span>
    );
}
