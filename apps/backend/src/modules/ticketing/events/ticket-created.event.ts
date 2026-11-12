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
        public readonly siteId?: string | null,
        public readonly ticketType?: string | null,
        /** Staff who filed it on the requester's behalf; they already know about it. */
        public readonly createdById?: string | null,
    ) { }
}

/**
 * Internal: emitted after `ticket.created` once auto-assign has run. The notification listener tells the
 * team about the new ticket only when nobody has it yet. Integrations keep listening to `ticket.created`.
 */
export const TICKET_ROUTED_EVENT = 'ticket.created.routed';

export interface TicketRoutedPayload {
    created: TicketCreatedEvent;
    assignedToId: string | null;
}
