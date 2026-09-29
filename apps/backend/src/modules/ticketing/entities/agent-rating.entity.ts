import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from '../../users/entities/user.entity';

/** A requester's rating of one agent who handled a closed ticket. */
@Entity('agent_ratings')
@Unique(['ticketId', 'agentId'])
@Index(['agentId', 'createdAt'])
export class AgentRating {
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

    @Column('uuid')
    raterId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'raterId' })
    rater: User;

    @Column({ type: 'smallint' })
    rating: number;

    @Column({ type: 'text', nullable: true })
    comment: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
