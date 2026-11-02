import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { TicketMessage } from './ticket-message.entity';
import { User } from '../../users/entities/user.entity';

/** One emoji reaction of one person on one chat message; reacting again replaces it. */
@Entity('ticket_message_reactions')
@Unique('UQ_ticket_message_reactions_message_user', ['messageId', 'userId'])
@Index('IDX_ticket_message_reactions_message', ['messageId'])
export class TicketMessageReaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => TicketMessage, (message) => message.reactions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'messageId' })
    message: TicketMessage;

    @Column('uuid')
    messageId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column('uuid')
    userId: string;

    @Column({ type: 'varchar', length: 16 })
    emoji: string;

    @CreateDateColumn()
    createdAt: Date;
}
