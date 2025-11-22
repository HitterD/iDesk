import { Ticket } from '@prisma/client'; // Using Prisma types for simplicity in this phase, ideally should be Domain Entity

export interface ITicketRepository {
    create(data: any): Promise<Ticket>;
    findActiveByUserId(userId: string): Promise<Ticket | null>;
    findById(id: string): Promise<Ticket | null>;
    update(id: string, data: any): Promise<Ticket>;
    addMessage(ticketId: string, message: any): Promise<any>;
}
