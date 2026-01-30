import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AuditAction {
    // === AUTHENTICATION ===
    USER_LOGIN = 'USER_LOGIN',
    USER_LOGOUT = 'USER_LOGOUT',
    LOGIN_FAILED = 'LOGIN_FAILED',
    PASSWORD_CHANGE = 'PASSWORD_CHANGE',
    PASSWORD_RESET = 'PASSWORD_RESET',

    // === USER MANAGEMENT ===
    USER_CREATE = 'USER_CREATE',
    USER_UPDATE = 'USER_UPDATE',
    USER_DELETE = 'USER_DELETE',
    USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',
    USER_BULK_IMPORT = 'USER_BULK_IMPORT',
    USER_STATUS_TOGGLE = 'USER_STATUS_TOGGLE',

    // === TICKETS ===
    CREATE_TICKET = 'CREATE_TICKET',
    UPDATE_TICKET = 'UPDATE_TICKET',
    DELETE_TICKET = 'DELETE_TICKET',
    ASSIGN_TICKET = 'ASSIGN_TICKET',
    STATUS_CHANGE = 'STATUS_CHANGE',
    PRIORITY_CHANGE = 'PRIORITY_CHANGE',
    TICKET_REPLY = 'TICKET_REPLY',
    TICKET_MERGE = 'TICKET_MERGE',
    TICKET_CANCEL = 'TICKET_CANCEL',
    BULK_UPDATE = 'BULK_UPDATE',

    // === KNOWLEDGE BASE ===
    ARTICLE_CREATE = 'ARTICLE_CREATE',
    ARTICLE_UPDATE = 'ARTICLE_UPDATE',
    ARTICLE_DELETE = 'ARTICLE_DELETE',
    ARTICLE_PUBLISH = 'ARTICLE_PUBLISH',

    // === SETTINGS ===
    SETTINGS_CHANGE = 'SETTINGS_CHANGE',
    SLA_CONFIG_CHANGE = 'SLA_CONFIG_CHANGE',

    // === ZOOM BOOKING ===
    ZOOM_BOOKING_CREATE = 'ZOOM_BOOKING_CREATE',
    ZOOM_BOOKING_CANCEL = 'ZOOM_BOOKING_CANCEL',
    ZOOM_BOOKING_RESCHEDULE = 'ZOOM_BOOKING_RESCHEDULE',

    // === AUTOMATION ===
    AUTOMATION_CREATE = 'AUTOMATION_CREATE',
    AUTOMATION_UPDATE = 'AUTOMATION_UPDATE',
    AUTOMATION_DELETE = 'AUTOMATION_DELETE',

    // === REPORTS ===
    REPORT_GENERATE = 'REPORT_GENERATE',
    REPORT_EXPORT = 'REPORT_EXPORT',

    // === PAGE ACCESS CONTROL ===
    PAGE_ACCESS_DENIED = 'PAGE_ACCESS_DENIED',
    PAGE_ACCESS_LOCKOUT = 'PAGE_ACCESS_LOCKOUT',
}

export enum AuditSeverity {
    LOW = 'LOW',           // Informational events (login, view)
    MEDIUM = 'MEDIUM',     // Standard operations (create, update)
    HIGH = 'HIGH',         // Important changes (delete, role change)
    CRITICAL = 'CRITICAL', // Security events (failed login, password change)
}

@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['entityType', 'entityId'])
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'varchar', length: 50 })
    action: AuditAction;

    @Column({ type: 'varchar', length: 50 })
    entityType: string;

    @Column({ type: 'uuid', nullable: true })
    entityId: string;

    @Column({ type: 'jsonb', nullable: true })
    oldValue: Record<string, any>;

    @Column({ type: 'jsonb', nullable: true })
    newValue: Record<string, any>;

    @Column({ type: 'varchar', length: 50, nullable: true })
    ipAddress: string;

    @Column({ type: 'text', nullable: true })
    userAgent: string;

    @Column({
        type: 'varchar',
        length: 20,
        default: AuditSeverity.MEDIUM
    })
    severity: AuditSeverity;

    @Column({ type: 'text', nullable: true })
    description: string;

    @CreateDateColumn()
    createdAt: Date;
}
