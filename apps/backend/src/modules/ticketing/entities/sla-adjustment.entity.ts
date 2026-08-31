import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Ticket } from './ticket.entity';

export enum SlaAdjustmentType {
    EXTEND = 'EXTEND',
}

export enum SlaAdjustmentReasonCategory {
    WAITING_USER = 'WAITING_USER',
    WAITING_VENDOR = 'WAITING_VENDOR',
    WAITING_APPROVAL = 'WAITING_APPROVAL',
    TECHNICAL_COMPLEXITY = 'TECHNICAL_COMPLEXITY',
    EXTERNAL_DEPENDENCY = 'EXTERNAL_DEPENDENCY',
    OTHER = 'OTHER',
}

@Entity('sla_adjustments')
@Index(['ticketId'])
@Index(['ticketId', 'createdAt'])
export class SlaAdjustment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    ticketId: string;

    @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column({ type: 'varchar', default: SlaAdjustmentType.EXTEND })
    type: SlaAdjustmentType;

    @Column({ type: 'int' })
    minutes: number;

    @Column({ type: 'varchar' })
    reasonCategory: SlaAdjustmentReasonCategory;

    @Column({ type: 'varchar', length: 1000 })
    reasonText: string;

    @Column({ type: 'timestamp', nullable: true })
    previousTarget: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    newTarget: Date | null;

    @Column({ type: 'varchar', nullable: true })
    actorId: string | null;

    @Column({ type: 'varchar', nullable: true })
    approvedById: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
