import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * VPN access status
 */
export enum VpnStatus {
    ACTIVE = 'ACTIVE',
    EXPIRED = 'EXPIRED',
    REVOKED = 'REVOKED',
    PENDING = 'PENDING',
}

/**
 * VPN connection type
 */
export enum VpnType {
    SITE_TO_SITE = 'SITE_TO_SITE',
    CLIENT = 'CLIENT',
    SSL = 'SSL',
}

/**
 * Entity for tracking VPN access records (WatchGuard monitoring)
 * This is for record-keeping only, not integrated with actual VPN system
 */
@Entity('vpn_access')
@Index(['validUntil', 'status'])
@Index(['username'])
export class VpnAccess {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    username: string; // VPN/AD username

    @Column()
    fullName: string; // Display name

    @Column({ nullable: true })
    email: string;

    @Column({ nullable: true })
    department: string;

    @Column({ nullable: true })
    site: string; // Site code (SPJ, BSD, etc.)

    @Column({
        type: 'enum',
        enum: VpnType,
        default: VpnType.CLIENT,
    })
    vpnType: VpnType;

    @Column({ nullable: true })
    vpnProfile: string; // WatchGuard profile name

    @Column({ type: 'date' })
    validFrom: Date;

    @Column({ type: 'date' })
    validUntil: Date;

    @Column({
        type: 'enum',
        enum: VpnStatus,
        default: VpnStatus.ACTIVE,
    })
    status: VpnStatus;

    @Column({ nullable: true })
    purpose: string; // Reason for VPN access

    @Column({ nullable: true })
    requestedById: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'requestedById' })
    requestedBy: User;

    @Column({ nullable: true })
    approvedById: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'approvedById' })
    approvedBy: User;

    // Reminder configuration
    @Column('simple-array', { default: '60,30,7,1' })
    reminderDays: string; // Days before expiry to send reminders

    @Column({ type: 'timestamp', nullable: true })
    lastReminderSent: Date;

    @Column({ default: false })
    isAcknowledged: boolean;

    @Column({ nullable: true })
    acknowledgedById: string;

    @Column({ type: 'timestamp', nullable: true })
    acknowledgedAt: Date;

    @Column({ nullable: true })
    notes: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Computed helper to check if expired
    isExpired(): boolean {
        return new Date() > new Date(this.validUntil);
    }

    // Get reminder days as array
    getReminderDaysArray(): number[] {
        if (!this.reminderDays) return [60, 30, 7, 1];
        return this.reminderDays.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
    }
}
