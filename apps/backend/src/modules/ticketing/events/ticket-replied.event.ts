import { Ticket } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';

export class TicketRepliedEvent {
    constructor(
        public readonly ticketId: string,
        public readonly ticketNumber: string,
        public readonly ticketTitle: string,
        public readonly ticketStatus: string,
        public readonly ticketOwnerId: string,
        public readonly ticketOwnerEmail: string | undefined,
        public readonly ticketOwnerName: string,
        public readonly ticketAssignedToId: string | undefined,
        public readonly message: TicketMessage,
        public readonly senderId: string,
        public readonly senderName: string,
        public readonly senderRole: string,
        public readonly mentionedUserIds: string[],
    ) { }
}
