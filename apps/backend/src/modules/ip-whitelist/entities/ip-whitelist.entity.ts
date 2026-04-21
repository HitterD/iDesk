import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum IpWhitelistType {
    SINGLE = 'SINGLE',      // Single IP address (e.g., 192.168.1.100)
    RANGE = 'RANGE',        // IP range (e.g., 192.168.1.1-192.168.1.255)
    CIDR = 'CIDR',          // CIDR notation (e.g., 192.168.1.0/24)
}

export enum IpWhitelistScope {
    GLOBAL = 'GLOBAL',      // Applies to all users
    ADMIN_ONLY = 'ADMIN_ONLY', // Only apply to admin access
    API = 'API',            // Only for API access
}

@Entity('ip_whitelist')
export class IpWhitelist {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 100 })
    name: string; // Human-readable name (e.g., "Office Network", "VPN Range")

    @Column({ length: 255 })
    ipAddress: string; // Single IP, IP range, or CIDR

    @Column({
        type: 'enum',
        enum: IpWhitelistType,
        default: IpWhitelistType.SINGLE,
    })
    type: IpWhitelistType;

    @Column({
        type: 'enum',
        enum: IpWhitelistScope,
        default: IpWhitelistScope.GLOBAL,
    })
    scope: IpWhitelistScope;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: 0 })
    hitCount: number; // Track how many times this rule was matched

    @Column({ type: 'timestamp', nullable: true })
    lastHitAt: Date | null; // Last time this rule was matched

    @Column({ type: 'timestamp', nullable: true })
    expiresAt: Date | null; // Optional expiration date

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'createdById' })
    createdBy: User;

    @Column({ type: 'varchar', nullable: true })
    createdById: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
