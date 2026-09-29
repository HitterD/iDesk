import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Every agent that was ever assigned to a ticket. The requester rates each of them
 * after close, so the history must survive reassignments.
 *
 * Rows are written by the "trg_tickets_record_assignment" DB trigger (migration
 * 1792800000000) on every change of tickets.assignedToId, because assignment happens
 * in many code paths, several of them raw repository updates.
 */
@Entity('ticket_assignments')
@Unique(['ticketId', 'agentId'])
@Index(['agentId'])
export class TicketAssignment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    ticketId: string;

    @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column('uuid')
    agentId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'agentId' })
    agent: User;

    @CreateDateColumn()
    firstAssignedAt: Date;
}
