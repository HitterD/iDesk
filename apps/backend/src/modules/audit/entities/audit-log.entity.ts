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

    // === ACCESS REQUEST ===
    ACCESS_REQUEST_CREATE = 'ACCESS_REQUEST_CREATE',
    ACCESS_REQUEST_APPROVE = 'ACCESS_REQUEST_APPROVE',
    ACCESS_REQUEST_REJECT = 'ACCESS_REQUEST_REJECT',
    ACCESS_TYPE_UPDATE = 'ACCESS_TYPE_UPDATE',

    // === E-FORM ===
    EFORM_REQUEST_CREATE = 'EFORM_REQUEST_CREATE',
    EFORM_APPROVE_MANAGER1 = 'EFORM_APPROVE_MANAGER1',
    EFORM_APPROVE_MANAGER2 = 'EFORM_APPROVE_MANAGER2',
    EFORM_REJECT = 'EFORM_REJECT',

    // === ICT BUDGET / HARDWARE REQUEST ===
    ICT_BUDGET_CREATE = 'ICT_BUDGET_CREATE',
    ICT_BUDGET_APPROVE = 'ICT_BUDGET_APPROVE',
    ICT_BUDGET_CANCEL = 'ICT_BUDGET_CANCEL',

    // === VPN ACCESS ===
    VPN_ACCESS_CREATE = 'VPN_ACCESS_CREATE',
    VPN_ACCESS_UPDATE = 'VPN_ACCESS_UPDATE',
    VPN_ACCESS_DELETE = 'VPN_ACCESS_DELETE',

    // === LOST & FOUND ===
    LOST_ITEM_CREATE = 'LOST_ITEM_CREATE',
    LOST_ITEM_STATUS_UPDATE = 'LOST_ITEM_STATUS_UPDATE',

    // === CONTRACT RENEWAL ===
    CONTRACT_CREATE = 'CONTRACT_CREATE',
    CONTRACT_UPDATE = 'CONTRACT_UPDATE',
    CONTRACT_DELETE = 'CONTRACT_DELETE',

    // === AUTOMATION ===
    AUTOMATION_TOGGLE = 'AUTOMATION_TOGGLE',

    // === PERMISSIONS ===
    PERMISSION_UPDATE = 'PERMISSION_UPDATE',
    PERMISSION_PRESET_CREATE = 'PERMISSION_PRESET_CREATE',
    PERMISSION_PRESET_UPDATE = 'PERMISSION_PRESET_UPDATE',
    PERMISSION_PRESET_DELETE = 'PERMISSION_PRESET_DELETE',

    // === SITES ===
    SITE_CREATE = 'SITE_CREATE',
    SITE_UPDATE = 'SITE_UPDATE',
    SITE_DELETE = 'SITE_DELETE',

    // === SLA CONFIG / BUSINESS HOURS ===
    BUSINESS_HOURS_UPDATE = 'BUSINESS_HOURS_UPDATE',
    HOLIDAY_REMOVE = 'HOLIDAY_REMOVE',

    // === IP WHITELIST ===
    IP_WHITELIST_CREATE = 'IP_WHITELIST_CREATE',
    IP_WHITELIST_UPDATE = 'IP_WHITELIST_UPDATE',
    IP_WHITELIST_DELETE = 'IP_WHITELIST_DELETE',

    // === GOOGLE SYNC ===
    SYNC_CONFIG_CREATE = 'SYNC_CONFIG_CREATE',
    SYNC_CONFIG_UPDATE = 'SYNC_CONFIG_UPDATE',
    SYNC_CONFIG_DELETE = 'SYNC_CONFIG_DELETE',
    GOOGLE_SYNC_TRIGGER = 'GOOGLE_SYNC_TRIGGER',

    // === TICKET SUPPORT ===
    TICKET_TEMPLATE_CREATE = 'TICKET_TEMPLATE_CREATE',
    TICKET_TEMPLATE_UPDATE = 'TICKET_TEMPLATE_UPDATE',
    TICKET_TEMPLATE_DELETE = 'TICKET_TEMPLATE_DELETE',
    TICKET_ATTRIBUTE_CREATE = 'TICKET_ATTRIBUTE_CREATE',
    TICKET_ATTRIBUTE_DELETE = 'TICKET_ATTRIBUTE_DELETE',
    TIME_ENTRY_CREATE = 'TIME_ENTRY_CREATE',
    TIME_ENTRY_UPDATE = 'TIME_ENTRY_UPDATE',
    TIME_ENTRY_DELETE = 'TIME_ENTRY_DELETE',

    // === INSTALLATION ===
    INSTALLATION_SCHEDULE_CREATE = 'INSTALLATION_SCHEDULE_CREATE',

    // === WORKLOAD ===
    WORKLOAD_PRIORITY_UPDATE = 'WORKLOAD_PRIORITY_UPDATE',
    WORKLOAD_RECALCULATE = 'WORKLOAD_RECALCULATE',

    // === NOTIFICATIONS ===  
    NOTIFICATION_PREFS_UPDATE = 'NOTIFICATION_PREFS_UPDATE',
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

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
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
