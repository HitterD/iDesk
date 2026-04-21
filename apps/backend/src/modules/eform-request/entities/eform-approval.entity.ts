import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EFormRequest } from './eform-request.entity';
import { User } from '../../users/entities/user.entity';

@Entity('eform_approvals')
export class EFormApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eformRequestId: string;

  @ManyToOne(() => EFormRequest, (request) => request.approvals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eformRequestId' })
  eformRequest: EFormRequest;

  @Column()
  approverId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approverId' })
  approver: User;

  @Column()
  role: string; // REQUESTER | MANAGER_1 | MANAGER_2 | ICT_ADMIN

  @Column({ default: 'PENDING' })
  action: string; // PENDING | APPROVED | REJECTED

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'timestamp', nullable: true })
  actionAt: Date;

  @Column()
  sequence: number; // 1 = Requester, 2 = Manager 1, 3 = Manager 2, 4 = ICT
}
