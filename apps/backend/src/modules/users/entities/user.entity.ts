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
import { PermissionPreset } from '../../permissions/entities/permission-preset.entity';

@Entity('users')
@Index(['role'])
@Index(['isActive'])
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    /**
     * Set when a human deliberately chose this email — the user themself via
     * PATCH /users/me/email, or an admin via the Edit User modal. Automated
     * writers (HRIS sync, CSV import) must leave the address alone once this is
     * set, otherwise the nightly sync would silently revert the change.
     */
    @Column({ type: 'timestamp', nullable: true })
    emailOverriddenAt: Date | null;

    // Who performed the override (user id). Kept for audit trail only.
    @Column({ type: 'varchar', nullable: true })
    emailOverriddenBy: string | null;

    @Column({ type: 'varchar', nullable: true })
    password?: string;

    @Column()
    fullName: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.AGENT,
    })
    role: UserRole;

    @Column({ type: 'varchar', nullable: true })
    employeeId: string;

    @Column({ type: 'varchar', nullable: true })
    jobTitle: string;

    @Column({ type: 'varchar', nullable: true })
    phoneNumber: string;

    @Column({ type: 'varchar', nullable: true })
    departmentId: string;

    @Column({ type: 'varchar', nullable: true })
    avatarUrl: string;

    // Telegram Integration
    @Column({ type: 'bigint', nullable: true, unique: true })
    telegramId: string | null;

    @Column({ type: 'bigint', nullable: true })
    telegramChatId: string | null;

    @Column({ default: true })
    telegramNotifications: boolean;

    @Column({ default: true })
    isActive: boolean;

    // M2: Last activity timestamp for activity indicator
    @Column({ type: 'timestamp', nullable: true })
    lastActiveAt: Date;

    // Wajib ganti password saat login (default 123456 / first login / reset admin)
    @Column({ default: false })
    mustChangePassword: boolean;

    /**
     * Legacy refresh-token bcrypt hash. Superseded by the Redis refresh-session store
     * (`auth:refresh:*`); still written while `AUTH_REFRESH_SESSION_MODE` is `legacy` or
     * `dual`, and kept only until the cutover rollback window closes.
     *
     * @deprecated Removed by `RemoveLegacyRefreshTokenColumn` after cutover verification.
     */
    @Column({ type: 'varchar', nullable: true })
    hashedRefreshToken?: string | null;

    @ManyToOne(() => Department)
    @JoinColumn({ name: 'departmentId' })
    department: Department;

    // Site relation for multi-site isolation
    @Column({ type: 'varchar', nullable: true })
    siteId: string;

    @ManyToOne(() => Site, { nullable: true })
    @JoinColumn({ name: 'siteId' })
    site: Site;

    // Permission Preset tracking - which preset was last applied to this user.
    // Nullable: cleared when an admin removes the preset (user falls back to role defaults).
    @Column({ type: 'varchar', nullable: true })
    appliedPresetId: string | null;

    @Column({ type: 'varchar', nullable: true })
    appliedPresetName: string | null;

    @ManyToOne(() => PermissionPreset, { nullable: true })
    @JoinColumn({ name: 'appliedPresetId' })
    appliedPreset: PermissionPreset;

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

    // === Workload & Appraisal ===
    @Column({ type: 'int', default: 0 })
    appraisalPoints: number;
}
