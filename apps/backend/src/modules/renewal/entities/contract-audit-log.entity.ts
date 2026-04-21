import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RenewalContract } from './renewal-contract.entity';

export enum ContractAuditAction {
    CREATED = 'CREATED',
    UPDATED = 'UPDATED',
    DELETED = 'DELETED',
    ACKNOWLEDGED = 'ACKNOWLEDGED',
    UNACKNOWLEDGED = 'UNACKNOWLEDGED',
    STATUS_CHANGED = 'STATUS_CHANGED',
    REMINDER_SENT = 'REMINDER_SENT',
    FILE_UPLOADED = 'FILE_UPLOADED',
}

@Entity('renewal_contract_audit_logs')
@Index('idx_audit_contract_id', ['contractId'])
@Index('idx_audit_created_at', ['createdAt'])
export class ContractAuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    contractId: string;

    @ManyToOne(() => RenewalContract, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'contractId' })
    contract: RenewalContract;

    @Column({
        type: 'enum',
        enum: ContractAuditAction,
    })
    action: ContractAuditAction;

    @Column({ type: 'varchar', nullable: true })
    performedById: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'performedById' })
    performedBy: User;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'jsonb', nullable: true })
    previousData: Record<string, any>;

    @Column({ type: 'jsonb', nullable: true })
    newData: Record<string, any>;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'varchar', nullable: true })
    ipAddress: string;

    @Column({ type: 'varchar', nullable: true })
    userAgent: string;
}
