import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SpreadsheetSheet } from './spreadsheet-sheet.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Sync status options
 */
export enum SyncStatus {
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    PARTIAL = 'PARTIAL',      // Some records failed
    CONFLICT = 'CONFLICT',    // Conflicts detected and resolved
}

/**
 * Sync direction for the log entry
 */
export enum SyncLogDirection {
    PUSH = 'PUSH',    // iDesk -> Spreadsheet
    PULL = 'PULL',    // Spreadsheet -> iDesk
    BOTH = 'BOTH',    // Two-way sync
}

/**
 * Conflict detail structure
 */
export interface ConflictDetail {
    recordId: string;
    field: string;
    iDeskValue: unknown;
    sheetValue: unknown;
    resolvedTo: 'IDESK' | 'SHEET';
    resolvedAt: string;
}

/**
 * Audit log for all sync operations
 */
@Entity('sync_logs')
@Index(['sheetId', 'syncedAt'])
@Index(['status', 'syncedAt'])
export class SyncLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    sheetId: string;

    @ManyToOne(() => SpreadsheetSheet, sheet => sheet.syncLogs, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sheetId' })
    sheet: SpreadsheetSheet;

    @Column({ type: 'varchar', nullable: true })
    triggeredById: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'triggeredById' })
    triggeredBy: User;

    @Column({
        type: 'enum',
        enum: SyncLogDirection,
    })
    direction: SyncLogDirection;

    @Column({
        type: 'enum',
        enum: SyncStatus,
    })
    status: SyncStatus;

    @Column({ default: 0 })
    recordsCreated: number;

    @Column({ default: 0 })
    recordsUpdated: number;

    @Column({ default: 0 })
    recordsDeleted: number;

    @Column({ default: 0 })
    recordsSkipped: number;

    @Column({ default: 0 })
    conflictsResolved: number;

    @Column('jsonb', { nullable: true })
    conflictDetails: ConflictDetail[];

    @Column({ type: 'varchar', nullable: true })
    errorMessage: string;

    @Column({ default: 0 })
    durationMs: number; // How long the sync took

    @CreateDateColumn()
    syncedAt: Date;
}
