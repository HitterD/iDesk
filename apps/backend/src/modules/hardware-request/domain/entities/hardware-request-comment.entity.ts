import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
    ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { HardwareRequest } from './hardware-request.entity';
import { User } from '../../../users/entities/user.entity';

@Entity('hardware_request_comments')
@Index(['requestId', 'createdAt'])
export class HardwareRequestComment {
    @PrimaryGeneratedColumn('uuid') id: string;

    @Column({ type: 'uuid' }) requestId: string;
    @ManyToOne(() => HardwareRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'requestId' }) request: HardwareRequest;

    @Column({ type: 'uuid' }) authorId: string;
    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'authorId' }) author: User;

    @Column({ type: 'text' }) body: string;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    attachments: Array<{ url: string; name: string; size: number; mimeType: string }>;

    @CreateDateColumn() createdAt: Date;

    @Column({ type: 'timestamptz', nullable: true }) editedAt: Date | null;
    @Column({ type: 'timestamptz', nullable: true }) deletedAt: Date | null;
}
