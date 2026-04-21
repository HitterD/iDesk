import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Site } from '../../sites/entities/site.entity';

@Entity('agent_daily_workload')
@Unique(['agentId', 'siteId', 'workDate'])
@Index(['workDate'])
@Index(['agentId'])
export class AgentDailyWorkload {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    agentId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'agentId' })
    agent: User;

    @Column()
    siteId: string;

    @ManyToOne(() => Site)
    @JoinColumn({ name: 'siteId' })
    site: Site;

    @Column({ type: 'date' })
    workDate: Date;

    @Column({ default: 0 })
    totalPoints: number;

    @Column({ default: 0 })
    activeTickets: number;

    @Column({ default: 0 })
    resolvedTickets: number;

    @Column({ type: 'timestamp', nullable: true })
    lastAssignedAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
