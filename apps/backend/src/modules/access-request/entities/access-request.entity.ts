import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { AccessType } from './access-type.entity';
import { User } from '../../users/entities/user.entity';

export enum AccessRequestStatus {
    FORM_PENDING = 'FORM_PENDING',
    FORM_DOWNLOADED = 'FORM_DOWNLOADED',
    FORM_UPLOADED = 'FORM_UPLOADED',
    VERIFIED = 'VERIFIED',
    ACCESS_CREATED = 'ACCESS_CREATED',
    REJECTED = 'REJECTED',
}

@Entity('access_requests')
export class AccessRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    ticketId: string;

    @ManyToOne(() => Ticket)
    @JoinColumn({ name: 'ticketId' })
    ticket: Ticket;

    @Column()
    accessTypeId: string;

    @ManyToOne(() => AccessType)
    @JoinColumn({ name: 'accessTypeId' })
    accessType: AccessType;

    // Request details
    @Column({ nullable: true, type: 'text' })
    requestedAccess: string; // Specific access details (SSID, URL, etc)

    @Column('text')
    purpose: string;

    @Column({ type: 'jsonb', nullable: true })
    customFormData: Record<string, any>; // Stores user answers to custom fields

    @Column({ type: 'date', nullable: true })
    validFrom: Date;

    @Column({ type: 'date', nullable: true })
    validUntil: Date;

    // Form signing workflow
    @Column({ type: 'timestamp', nullable: true })
    formGeneratedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    formDownloadedAt: Date;

    @Column({ nullable: true })
    signedFormUrl: string; // User upload signed form

    @Column({ type: 'timestamp', nullable: true })
    signedFormUploadedAt: Date;

    // Verification
    @Column({ type: 'varchar', nullable: true })
    verifiedById: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'verifiedById' })
    verifiedBy: User;

    @Column({ type: 'timestamp', nullable: true })
    verifiedAt: Date;

    @Column({ nullable: true, type: 'text' })
    verificationNotes: string;

    // Access creation
    @Column({ type: 'timestamp', nullable: true })
    accessCreatedAt: Date;

    @Column({ nullable: true, type: 'text' })
    accessCredentials: string; // Encrypted credentials if applicable

    @Column({
        type: 'enum',
        enum: AccessRequestStatus,
        default: AccessRequestStatus.FORM_PENDING,
    })
    status: AccessRequestStatus;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
