import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ticket_messages')
@Index(['ticketId'])
@Index(['ticketId', 'createdAt'])
export class TicketMessage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('text')
    content: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column('simple-json', { nullable: true })
    attachments: string[];

    @Column({ default: false })
    isSystemMessage: boolean;

    // Internal notes are only visible to agents/admins, not customers
    @Column({ default: false })
    isInternal: boolean;

    @Column({ default: 'WEB' })
    source: string; // 'WEB' | 'TELEGRAM' | 'EMAIL'

    @ManyToOne(() => Ticket, (ticket) => ticket.messages)
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column()
    ticketId: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'senderId' })
    sender: User;

    @Column({ type: 'varchar', nullable: true })
    senderId: string;
}
