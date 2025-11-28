import { Ticket } from '../entities/ticket.entity';

export class TicketCancelledEvent {
    constructor(
        public readonly ticketId: string,
        public readonly ticketNumber: string,
        public readonly ticketTitle: string,
        public readonly userId: string, // User who cancelled
        public readonly userFullName: string,
        public readonly userRole: string,
        public readonly reason: string | undefined,
        public readonly ticketOwnerId: string,
        public readonly ticketAssignedToId: string | undefined,
    ) { }
}
