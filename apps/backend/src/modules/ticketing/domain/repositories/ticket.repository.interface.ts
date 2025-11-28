import { Ticket } from '../../entities/ticket.entity';

export interface ITicketRepository {
    create(data: any): Promise<Ticket>;
    findActiveByUserId(userId: string): Promise<Ticket | null>;
    findById(id: string): Promise<Ticket | null>;
    update(id: string, data: any): Promise<Ticket>;
    addMessage(ticketId: string, message: any): Promise<any>;
}
