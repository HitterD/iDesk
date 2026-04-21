import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { EFormRequest } from './eform-request.entity';
import { User } from '../../users/entities/user.entity';

@Entity('eform_signatures')
export class EFormSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eformRequestId: string;

  @ManyToOne(() => EFormRequest, (request) => request.signatures, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eformRequestId' })
  eformRequest: EFormRequest;

  @Column()
  signerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'signerId' })
  signer: User;

  @Column()
  signerName: string;

  @Column({ type: 'text' })
  signatureData: string; // Base64 PNG

  @Column()
  signerRole: string; // REQUESTER | MANAGER_1 | MANAGER_2 | ICT_ADMIN

  @CreateDateColumn()
  signedAt: Date;
}
