import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';

@Entity('csi_raters')
@Index('UQ_csi_raters_scope_user', ['scope', 'userId'], { unique: true })
export class CsiRater {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    scope: ServiceScope;

    @Column({ type: 'uuid' })
    userId: string;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'userId' })
    user: User;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
