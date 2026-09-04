import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ticket_reminders')
@Index(['ticketId'])
@Index(['isSent', 'remindAt'])
export class TicketReminder {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    ticketId: string;

    @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column({ type: 'timestamp' })
    remindAt: Date;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @Column({ type: 'boolean', default: false })
    isSent: boolean;

    @Column({ type: 'timestamp', nullable: true })
    sentAt: Date | null;

    @Column({ type: 'uuid' })
    createdById: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'createdById' })
    createdBy: User;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
