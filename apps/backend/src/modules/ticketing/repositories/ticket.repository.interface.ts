import { Ticket } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';

/**
 * Ticket Repository Interface
 * Provides abstraction layer for database operations (4.1.3)
 * This enables easier testing and potential database swapping
 */
export interface ITicketRepository {
    /**
     * Find all tickets (role-based filtering)
     * @param userId - Current user's ID
     * @param role - User's role for access control
     */
    findAll(userId: string, role: UserRole): Promise<Ticket[]>;

    /**
     * Find ticket by ID
     * @param id - Ticket ID
     */
    findById(id: string): Promise<Ticket | null>;

    /**
     * Find ticket with all relations loaded
     * @param id - Ticket ID
     */
    findWithRelations(id: string): Promise<Ticket | null>;

    /**
     * Find overdue tickets (for SLA monitoring)
     */
    findOverdue(): Promise<Ticket[]>;

    /**
     * Save ticket (create or update)
     * @param ticket - Ticket entity to save
     */
    save(ticket: Ticket): Promise<Ticket>;

    /**
     * Create ticket instance without saving
     * @param data - Partial ticket data
     */
    create(data: Partial<Ticket>): Ticket;
}

export const TICKET_REPOSITORY = Symbol('ITicketRepository');
