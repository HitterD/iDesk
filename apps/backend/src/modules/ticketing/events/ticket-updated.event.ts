import { Ticket } from '../entities/ticket.entity';

export class TicketUpdatedEvent {
    constructor(
        public readonly ticketId: string,
        public readonly ticketNumber: string,
        public readonly userId: string, // User who performed the update
        public readonly changes: string[],
        public readonly ticket: Ticket, // Full ticket object for context
    ) { }
}
