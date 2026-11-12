import { Ticket } from '../entities/ticket.entity';

export class TicketAssignedEvent {
    constructor(
        public readonly ticketId: string,
        public readonly ticketNumber: string,
        public readonly assigneeId: string,
        public readonly assigneeName: string,
        public readonly assigneeEmail: string | undefined,
        public readonly assignerName: string,
        public readonly ticketTitle: string,
        public readonly ticketStatus: string,
        public readonly ticketOwnerEmail?: string,
        public readonly ticketOwnerName?: string,
        /** Who made the assignment; equal to assigneeId on self-assign (takeover/auto-assign by status). */
        public readonly assignerId?: string,
        /** Assigned by a status change (takeover); that change already emailed the requester. */
        public readonly viaStatusChange?: boolean,
    ) { }
}
