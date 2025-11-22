import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';
// import { User } from '../../users/entities/user.entity';

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

    @ManyToOne(() => Ticket, (ticket) => ticket.messages)
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column()
    ticketId: string;

    // @ManyToOne(() => User)
    // @JoinColumn({ name: 'senderId' })
    // sender: User;

    @Column()
    senderId: string;
}
