import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';

@Entity('ticket_surveys')
export class TicketSurvey {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    rating: number; // 1-5

    @Column('text', { nullable: true })
    comment: string;

    @Column({ unique: true })
    token: string;

    @Column({ default: false })
    isSubmitted: boolean;

    @Column()
    ticketId: string;

    @OneToOne(() => Ticket)
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
