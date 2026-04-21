import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
    Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { FeatureDefinition } from './feature-definition.entity';

@Entity('user_feature_permissions')
@Unique(['userId', 'featureKey'])
@Index(['userId'])
@Index(['featureKey'])
export class UserFeaturePermission {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    featureKey: string; // e.g., 'ticketing.view'

    @Column({ default: false })
    canView: boolean;

    @Column({ default: false })
    canCreate: boolean;

    @Column({ default: false })
    canEdit: boolean;

    @Column({ default: false })
    canDelete: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
