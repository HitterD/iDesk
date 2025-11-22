import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TicketMessage } from './ticket-message.entity';

export enum TicketStatus {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    WAITING_VENDOR = 'WAITING_VENDOR',
    RESOLVED = 'RESOLVED',
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
export class Ticket {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column('text')
    description: string;

    @Column({
        type: 'enum',
        enum: TicketStatus,
        default: TicketStatus.TODO,
    })
    status: TicketStatus;

    @Column({
        type: 'enum',
        enum: TicketPriority,
        default: TicketPriority.MEDIUM,
    })
    priority: TicketPriority;

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
}
