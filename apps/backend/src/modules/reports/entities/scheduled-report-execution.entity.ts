import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ScheduledReportConfig } from './scheduled-report-config.entity';

/**
 * Status of a scheduled report execution.
 * - SUCCESS: All recipients received the email successfully
 * - PARTIAL: Some recipients succeeded, some failed (or some recipients were invalid)
 * - FAILED: Entire execution failed (no emails sent, or critical error)
 */
export enum ExecutionStatus {
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

/**
 * ScheduledReportExecution
 *
 * Audit log record for every run of a scheduled report.
 * Created for every execution attempt, even on failure.
 *
 * This provides visibility into:
 * - When reports ran
 * - How many recipients were targeted vs actually emailed
 * - Success/failure status
 * - Error details when things go wrong
 */
@Entity('scheduled_report_executions')
@Index(['configId', 'executedAt'])
export class ScheduledReportExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  configId: string;

  @ManyToOne(() => ScheduledReportConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'configId' })
  config: ScheduledReportConfig;

  @Column({ type: 'timestamp' })
  executedAt: Date;

  @Column({ type: 'enum', enum: ExecutionStatus })
  status: ExecutionStatus;

  /**
   * Number of recipient user IDs that were in the config at execution time.
   * This is the "intended" audience before validation.
   */
  @Column({ type: 'int', default: 0 })
  recipientsCount: number;

  /**
   * Number of emails actually sent successfully.
   * May be less than recipientsCount due to:
   * - User no longer active
   * - User no longer at the correct site
   * - User role no longer matches targetAgentCategory (for performance reports)
   * - Email delivery failure
   */
  @Column({ type: 'int', default: 0 })
  emailsSent: number;

  /**
   * Error message if the execution failed or had issues.
   * For PARTIAL status, this may contain a summary of failures.
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  /**
   * Additional metadata for debugging/auditing.
   * Examples:
   * - { dateRange: {...}, generatorUsed: 'TicketVolumeReport', skippedRecipients: [...] }
   * - { validationErrors: [{userId, reason}, ...] }
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
