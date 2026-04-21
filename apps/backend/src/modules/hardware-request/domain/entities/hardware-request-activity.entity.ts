// apps/backend/src/modules/hardware-request/domain/entities/hardware-request-activity.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { HardwareRequest } from './hardware-request.entity';
import { User } from '../../../users/entities/user.entity';
import { ActivityAction } from '../enums/activity-action.enum';
import { RequestStatus } from '../enums/request-status.enum';

@Entity('hardware_request_activities')
@Index(['requestId', 'createdAt'])
export class HardwareRequestActivity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    requestId: string;

    @ManyToOne(() => HardwareRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'requestId' })
    request: HardwareRequest;

    @Column({ type: 'uuid' })
    actorId: string;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'actorId' })
    actor: User;

    @Column({ type: 'enum', enum: ActivityAction })
    action: ActivityAction;

    @Column({ type: 'enum', enum: RequestStatus, nullable: true })
    fromStatus: RequestStatus | null;

    @Column({ type: 'enum', enum: RequestStatus, nullable: true })
    toStatus: RequestStatus | null;

    @Column({ type: 'jsonb', default: () => "'{}'" })
    metadata: Record<string, unknown>;

    @CreateDateColumn()
    createdAt: Date;
}
