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

    @Column({ type: 'date', nullable: true })
    validFrom: Date;

    @Column({ type: 'date', nullable: true })
    validUntil: Date;

    // Form signing workflow
    @Column({ nullable: true })
    formGeneratedAt: Date;

    @Column({ nullable: true })
    formDownloadedAt: Date;

    @Column({ nullable: true })
    signedFormUrl: string; // User upload signed form

    @Column({ nullable: true })
    signedFormUploadedAt: Date;

    // Verification
    @Column({ nullable: true })
    verifiedById: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'verifiedById' })
    verifiedBy: User;

    @Column({ nullable: true })
    verifiedAt: Date;

    @Column({ nullable: true, type: 'text' })
    verificationNotes: string;

    // Access creation
    @Column({ nullable: true })
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
