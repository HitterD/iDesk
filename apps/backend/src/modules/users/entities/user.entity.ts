import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    OneToOne,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { TicketMessage } from '../../ticketing/entities/ticket-message.entity';
import { CustomerSession } from './customer-session.entity';
import { Department } from './department.entity';
import { UserRole } from '../enums/user-role.enum';
import { Site } from '../../sites/entities/site.entity';

@Entity('users')
@Index(['role'])
@Index(['isActive'])
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column({ nullable: true })
    password?: string;

    @Column()
    fullName: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.AGENT,
    })
    role: UserRole;

    @Column({ nullable: true })
    employeeId: string;

    @Column({ nullable: true })
    jobTitle: string;

    @Column({ nullable: true })
    phoneNumber: string;

    @Column({ nullable: true })
    departmentId: string;

    @Column({ nullable: true })
    avatarUrl: string;

    // Telegram Integration
    @Column({ type: 'bigint', nullable: true, unique: true })
    telegramId: string;

    @Column({ type: 'bigint', nullable: true })
    telegramChatId: string;

    @Column({ default: true })
    telegramNotifications: boolean;

    @Column({ default: true })
    isActive: boolean;

    // M2: Last activity timestamp for activity indicator
    @Column({ type: 'timestamp', nullable: true })
    lastActiveAt: Date;

    @ManyToOne(() => Department)
    @JoinColumn({ name: 'departmentId' })
    department: Department;

    // Site relation for multi-site isolation
    @Column({ nullable: true })
    siteId: string;

    @ManyToOne(() => Site, { nullable: true })
    @JoinColumn({ name: 'siteId' })
    site: Site;

    // @OneToMany(() => Ticket, (ticket) => ticket.user)
    // tickets: Ticket[];

    // @OneToMany(() => TicketMessage, (message) => message.sender)
    // messages: TicketMessage[];

    // @OneToOne(() => CustomerSession, (session) => session.user)
    // customerSession: CustomerSession;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
