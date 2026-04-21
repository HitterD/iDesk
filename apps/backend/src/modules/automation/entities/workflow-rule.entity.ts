import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WorkflowTrigger, WorkflowCondition, WorkflowAction } from '../types/workflow.types';

/**
 * WorkflowRule Entity
 * Stores automation rules with trigger → condition → action logic
 */
@Entity('workflow_rules')
@Index(['isActive', 'priority'])
@Index(['deletedAt'])
export class WorkflowRule {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'int', default: 100 })
    priority: number; // Lower number = higher priority

    @Column({ type: 'jsonb' })
    trigger: WorkflowTrigger;

    @Column({ type: 'jsonb', default: '[]' })
    conditions: WorkflowCondition[];

    @Column({ default: 'AND' })
    conditionLogic: 'AND' | 'OR';

    @Column({ type: 'jsonb' })
    actions: WorkflowAction[];

    @Column({ default: false })
    stopProcessing: boolean; // Stop other rules after this one matches

    @Column({ type: 'int', default: 0 })
    executionCount: number;

    @Column({ type: 'timestamp', nullable: true })
    lastExecutedAt: Date;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'createdById' })
    createdBy: User;

    @Column({ type: 'varchar', nullable: true })
    createdById: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Soft delete
    @Column({ type: 'timestamp', nullable: true })
    deletedAt: Date;
}
