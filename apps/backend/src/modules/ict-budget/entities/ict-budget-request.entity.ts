import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { User } from '../../users/entities/user.entity';

export enum IctBudgetRequestType {
    PURCHASE = 'PURCHASE',
    RENEWAL = 'RENEWAL',
    LICENSE = 'LICENSE',
}

export enum IctBudgetRealizationStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    PURCHASING = 'PURCHASING',
    REALIZED = 'REALIZED',
}

export enum IctBudgetUrgency {
    NORMAL = 'NORMAL',
    URGENT = 'URGENT',
}

@Entity('ict_budget_requests')
export class IctBudgetRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    ticketId: string;

    @ManyToOne(() => Ticket)
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    // Request Type
    @Column({
        type: 'enum',
        enum: IctBudgetRequestType,
        default: IctBudgetRequestType.PURCHASE,
    })
    requestType: IctBudgetRequestType;

    @Column()
    budgetCategory: string; // PC, Laptop, License, Network Equipment, dll

    @Column()
    itemName: string;

    @Column({ nullable: true })
    vendor: string;

    // Financials
    @Column('decimal', { precision: 15, scale: 2 })
    estimatedAmount: number;

    @Column({ default: 1 })
    quantity: number;

    @Column({ nullable: true })
    renewalPeriodMonths: number; // For renewal: how many months

    @Column({ nullable: true, type: 'date' })
    currentExpiryDate: Date; // For renewal: current expiry date

    // Request details
    @Column('text')
    justification: string;

    @Column({
        type: 'enum',
        enum: IctBudgetUrgency,
        default: IctBudgetUrgency.NORMAL,
    })
    urgencyLevel: IctBudgetUrgency;

    // Approval workflow
    @Column({ nullable: true })
    superiorId: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'superiorId' })
    superior: User;

    @Column({ nullable: true })
    superiorApprovedAt: Date;

    @Column({ nullable: true, type: 'text' })
    superiorNotes: string;

    // Realization
    @Column({
        type: 'enum',
        enum: IctBudgetRealizationStatus,
        default: IctBudgetRealizationStatus.PENDING,
    })
    realizationStatus: IctBudgetRealizationStatus;

    @Column({ nullable: true })
    realizedById: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'realizedById' })
    realizedBy: User;

    @Column({ nullable: true })
    realizedAt: Date;

    @Column({ nullable: true, type: 'text' })
    realizationNotes: string;

    @Column({ nullable: true })
    purchaseOrderNumber: string;

    @Column({ nullable: true })
    invoiceNumber: string;

    // Hardware installation link
    @Column({ default: false })
    requiresInstallation: boolean;

    @Column({ nullable: true })
    linkedHwTicketId: string;

    @ManyToOne(() => Ticket, { nullable: true })
    @JoinColumn({ name: 'linkedHwTicketId' })
    linkedHwTicket: Ticket;

    @CreateDateColumn()
    createdAt: Date;
}
