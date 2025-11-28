import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ticket_messages')
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

    @Column({ default: 'WEB' })
    source: string; // 'WEB' | 'TELEGRAM' | 'EMAIL'

    @ManyToOne(() => Ticket, (ticket) => ticket.messages)
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column()
    ticketId: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'senderId' })
    sender: User;

    @Column({ nullable: true })
    senderId: string;
}
