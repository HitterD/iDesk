import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EFormApproval } from './eform-approval.entity';
import { EFormSignature } from './eform-signature.entity';

export enum EFormType {
  VPN = 'VPN',
  WEBSITE = 'WEBSITE',
  NETWORK = 'NETWORK',
  FLASHDISK = 'FLASHDISK',
  EMAIL = 'EMAIL',
  SYNOLOGY_NAS = 'SYNOLOGY_NAS',
}

export enum EFormStatus {
  DRAFT = 'DRAFT',
  PENDING_MANAGER = 'PENDING_MANAGER',
  /** Approved by the manager; IT collects the GM's wet signature on the printed form and uploads the signed PDF. */
  PENDING_GM = 'PENDING_GM',
  PENDING_ICT = 'PENDING_ICT',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  /** A proposal from a ticket that the requester declined or IT withdrew before it was signed. */
  CANCELLED = 'CANCELLED',
}

@Entity('eform_requests')
export class EFormRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: EFormType, default: EFormType.VPN })
  formType: EFormType;

  @Column({ type: 'enum', enum: EFormStatus, default: EFormStatus.DRAFT })
  status: EFormStatus;

  @Column()
  requesterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requesterId' })
  requester: User;

  @Column()
  requesterName: string;

  @Column({ type: 'varchar', nullable: true })
  requesterEmail: string;

  @Column({ type: 'varchar', nullable: true })
  requesterJobTitle: string;

  @Column({ type: 'varchar', nullable: true })
  requesterDepartment: string;

  @Column({ type: 'jsonb', nullable: true })
  formData: any;

  @Column({ type: 'text', nullable: true })
  requestedWebsites: string;

  @Column({ type: 'text', nullable: true })
  networkPurpose: string;

  @Column({ default: false })
  termsAccepted: boolean;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'varchar', nullable: true })
  siteId: string | null;

  @Column({ type: 'varchar', nullable: true })
  currentApproverId: string | null;

  /** Set when IT proposed this access from a ticket; the requester completes and signs the draft. */
  @Index('IDX_eform_requests_sourceTicketId')
  @Column({ type: 'uuid', nullable: true })
  sourceTicketId: string | null;

  @Column({ type: 'uuid', nullable: true })
  proposedById: string | null;

  /** Running number per form, e.g. F/ICT/04-W/0007; assigned on submit, editable by IT. */
  @Index('UQ_eform_requests_documentNumber', { unique: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  documentNumber: string | null;

  /** Stored name of the PDF signed by the GM (under uploads/eform-approvals, never served statically). */
  @Column({ type: 'varchar', nullable: true, select: false })
  gmApprovalFile: string | null;

  @Column({ type: 'varchar', nullable: true })
  gmApprovalFileName: string | null;

  @Column({ type: 'uuid', nullable: true })
  gmApprovalUploadedById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  gmApprovedAt: Date | null;

  /** Whether the GM must approve after the manager. Defaults per type on submit (VPN); ICT may switch it. */
  @Column({ type: 'boolean', default: false })
  requiresGm: boolean;

  /** The GM who approves in iDesk; picked by the requester or ICT. Without one, ICT uploads the paper-signed form. */
  @Column({ type: 'uuid', nullable: true })
  gmApproverId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'gmApproverId' })
  gmApprover: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'currentApproverId' })
  currentApprover: User;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => EFormApproval, (approval) => approval.eformRequest)
  approvals: EFormApproval[];

  @OneToMany(() => EFormSignature, (signature) => signature.eformRequest)
  signatures: EFormSignature[];
}
