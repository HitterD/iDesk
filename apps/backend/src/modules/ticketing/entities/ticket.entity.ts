import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TicketMessage } from './ticket-message.entity';

export enum TicketStatus {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    WAITING_VENDOR = 'WAITING_VENDOR',
    RESOLVED = 'RESOLVED',
    CANCELLED = 'CANCELLED',
}

export enum TicketPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

export enum TicketSource {
    TELEGRAM = 'TELEGRAM',
    WEB = 'WEB',
    EMAIL = 'EMAIL',
}

@Entity('tickets')
@Index(['status', 'priority']) // Composite index for filtering
@Index(['createdAt']) // Index for date-based queries
@Index(['userId']) // Index for user's tickets lookup
@Index(['assignedToId']) // Index for agent's assigned tickets
@Index(['status', 'slaTarget']) // Index for SLA breach queries
@Index(['priority']) // Index for priority filtering
export class Ticket {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, nullable: true })
    ticketNumber: string;

    @Column()
    title: string;

    @Column('text')
    description: string;

    @Column({ default: 'GENERAL' })
    category: string;

    @Column({ nullable: true })
    device: string;

    @Column({ nullable: true })
    software: string;

    @Column({
        type: 'enum',
        enum: TicketStatus,
        default: TicketStatus.TODO,
    })
    status: TicketStatus;

    @Column({
        default: 'MEDIUM',
    })
    priority: string;

    @Column({
        type: 'enum',
        enum: TicketSource,
        default: TicketSource.WEB,
    })
    source: TicketSource;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ nullable: true })
    userId: string;

    @OneToMany(() => TicketMessage, (message) => message.ticket)
    messages: TicketMessage[];

    @Column({ default: false })
    isOverdue: boolean;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'assignedToId' })
    assignedTo: User;

    @Column({ nullable: true })
    assignedToId: string;

    @Column({ type: 'int', default: 0 })
    totalPausedMinutes: number;

    @Column({ nullable: true })
    lastPausedAt: Date;

    @Column({ nullable: true })
    slaTarget: Date;
}
