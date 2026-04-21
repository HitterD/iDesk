import { Ticket } from '../entities/ticket.entity';

export class TicketCreatedEvent {
    constructor(
        public readonly ticketId: string,
        public readonly ticketNumber: string,
        public readonly title: string,
        public readonly priority: string,
        public readonly category: string,
        public readonly status: string,
        public readonly userId: string,
        public readonly userFullName: string,
        public readonly userEmail: string | undefined,
        public readonly createdAt: Date,
    ) { }
}
