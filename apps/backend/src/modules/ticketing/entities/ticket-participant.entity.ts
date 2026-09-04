import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ticket_participants')
@Unique(['ticketId', 'userId'])
@Index(['ticketId'])
@Index(['userId'])
export class TicketParticipant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    ticketId: string;

    @ManyToOne(() => Ticket, (ticket) => ticket.participants, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'varchar', nullable: true })
    invitedById: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'invitedById' })
    invitedBy: User | null;

    @Column({ default: 'PARTICIPANT' })
    role: string; // 'PARTICIPANT' | 'OBSERVER'

    @CreateDateColumn()
    joinedAt: Date;
}
