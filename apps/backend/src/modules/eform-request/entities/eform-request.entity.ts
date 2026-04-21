import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EFormApproval } from './eform-approval.entity';
import { EFormSignature } from './eform-signature.entity';

export enum EFormType {
  VPN = 'VPN',
  WEBSITE = 'WEBSITE',
  NETWORK = 'NETWORK',
}

export enum EFormStatus {
  DRAFT = 'DRAFT',
  PENDING_MANAGER_1 = 'PENDING_MANAGER_1',
  PENDING_MANAGER_2 = 'PENDING_MANAGER_2',
  PENDING_ICT = 'PENDING_ICT',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED'
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
  currentApproverId: string | null;

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
