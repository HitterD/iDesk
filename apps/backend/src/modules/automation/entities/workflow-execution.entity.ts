import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { WorkflowRule } from './workflow-rule.entity';
import { TriggerType, ActionType } from '../types/workflow.types';

/**
 * WorkflowExecution Entity
 * Audit log for tracking workflow rule executions
 */
@Entity('workflow_executions')
export class WorkflowExecution {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => WorkflowRule, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'ruleId' })
    rule: WorkflowRule;

    @Index()
    @Column({ type: 'varchar', nullable: true })
    ruleId: string;

    @Column({ length: 255 })
    ruleName: string;

    @Index()
    @Column({ type: 'varchar', nullable: true })
    ticketId: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    ticketNumber: string;

    @Column({ type: 'enum', enum: TriggerType })
    triggerEvent: TriggerType;

    @Column()
    conditionsMet: boolean;

    @Column({ type: 'jsonb', default: '[]' })
    actionsExecuted: {
        type: ActionType;
        success: boolean;
        error?: string;
        result?: any;
    }[];

    @Column({ type: 'int', default: 0 })
    durationMs: number;

    @Column({ type: 'text', nullable: true })
    error: string;

    @Column({ type: 'varchar', nullable: true })
    triggeredById: string;

    @CreateDateColumn()
    @Index()
    executedAt: Date;
}
