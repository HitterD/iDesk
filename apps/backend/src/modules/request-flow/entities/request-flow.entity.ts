import {
    Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne,
    PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { EFormRequest } from '../../eform-request/entities/eform-request.entity';
import { HardwareRequest } from '../../hardware-request/domain/entities/hardware-request.entity';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import type { ApprovalRoute } from '../domain/approval-route';
import type { HardwareSource, RequestKind } from '../domain/request-kind';

@Entity('request_flows')
@Index('IDX_request_flows_ticketId', ['ticketId'], { unique: true })
@Index('IDX_request_flows_managerId', ['managerId'])
@Index('IDX_request_flows_gmId', ['gmId'])
export class RequestFlow {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Column({ type: 'uuid' }) ticketId: string;
    @ManyToOne(() => Ticket, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ticketId' }) ticket: Ticket;

    @Column({ type: 'varchar', length: 16 }) kind: RequestKind;

    @Column({ type: 'uuid', nullable: true }) hardwareRequestId: string | null;
    @ManyToOne(() => HardwareRequest, { nullable: true })
    @JoinColumn({ name: 'hardwareRequestId' }) hardwareRequest: HardwareRequest | null;

    @Column({ type: 'uuid', nullable: true }) eformRequestId: string | null;
    @ManyToOne(() => EFormRequest, { nullable: true })
    @JoinColumn({ name: 'eformRequestId' }) eformRequest: EFormRequest | null;

    @Column({ type: 'varchar', length: 16, nullable: true }) route: ApprovalRoute | null;
    @Column({ type: 'uuid', nullable: true }) managerId: string | null;
    @Column({ type: 'uuid', nullable: true }) gmId: string | null;
    @Column({ type: 'varchar', length: 16, nullable: true }) hardwareSource: HardwareSource | null;
    @Column({ type: 'uuid', nullable: true }) reviewedById: string | null;
    @Column({ type: 'timestamptz', nullable: true }) reviewedAt: Date | null;
    @Column({ type: 'text', nullable: true }) returnedReason: string | null;
    @Column({ type: 'int', default: 0 }) rescheduleCount: number;
    @Column({ type: 'int', default: 1 }) documentVersion: number;
    @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
    @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
