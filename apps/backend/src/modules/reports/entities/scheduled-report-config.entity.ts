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
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Report types supported by the scheduled reports system.
 */
export enum ReportType {
  MONTHLY_SUMMARY = 'MONTHLY_SUMMARY',
  AGENT_PERFORMANCE = 'AGENT_PERFORMANCE',
  TICKET_VOLUME = 'TICKET_VOLUME',
}

/**
 * Schedule frequency for a scheduled report config.
 */
export enum ScheduleType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

/**
 * Target agent category for AGENT_PERFORMANCE reports.
 * Allows explicit separation of regular agents vs AGENT_ORACLE.
 */
export enum TargetAgentCategory {
  ALL = 'ALL',
  REGULAR = 'REGULAR',
  ORACLE = 'ORACLE',
}

/**
 * ScheduledReportConfig
 *
 * Stores user-defined scheduled report configurations.
 * Each config is strictly bound to one site and sends to agents at that site only.
 */
@Entity('scheduled_report_configs')
@Index(['siteId', 'isActive'])
@Index(['schedule', 'isActive'])
export class ScheduledReportConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: ReportType })
  reportType: ReportType;

  @Column({ type: 'enum', enum: ScheduleType })
  schedule: ScheduleType;

  /**
   * Custom send time in HH:mm format (24-hour).
   * Combined with schedule to build the actual cron expression at runtime.
   */
  @Column({ type: 'varchar', length: 5, default: '07:00' })
  sendTime: string; // "HH:mm"

  @Column('uuid')
  siteId: string;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'siteId' })
  site: Site;

  /**
   * List of user IDs (agents) who should receive the report.
   * Stored as simple-array for simplicity.
   * Validation at runtime ensures:
   * - All users belong to the same site
   * - All users are active agents (any AGENT* role)
   * - For AGENT_PERFORMANCE with targetAgentCategory, roles match the category
   */
  @Column({ type: 'simple-array' })
  recipientUserIds: string[];

  /**
   * For AGENT_PERFORMANCE reports: which category of agents to include.
   * - REGULAR: AGENT, AGENT_ADMIN, AGENT_OPERATIONAL_SUPPORT
   * - ORACLE: only AGENT_ORACLE
   * - ALL or null: all agents (not recommended for performance reports)
   *
   * For other report types, this can be null.
   */
  @Column({
    type: 'enum',
    enum: TargetAgentCategory,
    nullable: true,
  })
  targetAgentCategory: TargetAgentCategory | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastRunAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
