import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { EFormRequest } from './eform-request.entity';
import { User } from '../../users/entities/user.entity';

@Entity('eform_credentials')
export class EFormCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eformRequestId: string;

  @ManyToOne(() => EFormRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eformRequestId' })
  eformRequest: EFormRequest;

  @Column({ type: 'text' })
  encryptedUsername: string;

  @Column({ type: 'text' })
  encryptedPassword: string;

  @Column()
  iv: string;

  @Column()
  authTag: string;

  @Column()
  provisionedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'provisionedById' })
  provisionedBy: User;

  @CreateDateColumn()
  provisionedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  accessCreatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  accessExpiresAt: Date;
}
