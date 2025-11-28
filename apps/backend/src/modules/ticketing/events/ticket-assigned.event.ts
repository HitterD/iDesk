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
    ) { }
}
