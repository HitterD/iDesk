import { Ticket } from '../entities/ticket.entity';

/** Why a ticket became CLOSED, for partners that tell the PIC (see the iPop webhook `closedReason`). */
export type TicketClosedReason = 'auto_unconfirmed' | 'confirmed' | 'manual';

export class TicketUpdatedEvent {
    constructor(
        public readonly ticketId: string,
        public readonly ticketNumber: string,
        public readonly userId: string, // User who performed the update ('system' for the scheduler)
        public readonly changes: string[],
        public readonly ticket: Ticket, // Full ticket object for context
        /** Set when this update closed the ticket through the resolution flow. */
        public readonly closedReason?: TicketClosedReason,
        /** The requester's comment when this update reopened (disputed) a resolved ticket. */
        public readonly reason?: string,
    ) { }
}
