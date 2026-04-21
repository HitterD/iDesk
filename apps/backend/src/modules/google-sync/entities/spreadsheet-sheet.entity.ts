import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { SpreadsheetConfig } from './spreadsheet-config.entity';
import { SyncLog } from './sync-log.entity';

/**
 * Sync direction options
 */
export enum SyncDirection {
    PUSH = 'PUSH',       // iDesk -> Spreadsheet only
    PULL = 'PULL',       // Spreadsheet -> iDesk only
    BOTH = 'BOTH',       // Two-way sync
}

/**
 * Data types that can be synced
 */
export enum SheetDataType {
    RENEWAL = 'RENEWAL',
    VPN = 'VPN',
    CUSTOM = 'CUSTOM',   // For future extensibility
}

/**
 * Column mapping structure
 */
export interface ColumnMapping {
    iDeskField: string;      // Field name in iDesk entity
    sheetColumn: string;     // Column letter (A, B, C...) or header name
    type: 'string' | 'number' | 'date' | 'boolean';
    required: boolean;
}

/**
 * Represents a sheet (tab) within a Google Spreadsheet and its mapping to iDesk data
 */
@Entity('spreadsheet_sheets')
@Index(['configId', 'sheetName'], { unique: true })
export class SpreadsheetSheet {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    configId: string;

    @ManyToOne(() => SpreadsheetConfig, config => config.sheets, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'configId' })
    config: SpreadsheetConfig;

    @Column()
    sheetName: string; // Tab name in the spreadsheet

    @Column({ nullable: true })
    sheetGid: string; // Google Sheet GID (for direct linking)

    @Column({
        type: 'enum',
        enum: SheetDataType,
        default: SheetDataType.RENEWAL,
    })
    dataType: SheetDataType;

    @Column({
        type: 'enum',
        enum: SyncDirection,
        default: SyncDirection.BOTH,
    })
    syncDirection: SyncDirection;

    @Column('jsonb', { default: [] })
    columnMapping: ColumnMapping[];

    @Column({ default: 1 })
    headerRow: number; // Which row contains headers

    @Column({ default: 2 })
    dataStartRow: number; // Which row to start reading/writing data

    @Column({ default: 30 })
    syncIntervalSeconds: number;

    @Column({ default: true })
    syncEnabled: boolean;

    @Column({ type: 'timestamp', nullable: true })
    lastSyncAt: Date | null;

    @Column({ type: 'varchar', nullable: true })
    lastSyncError: string | null;

    @Column({ default: 0 })
    syncErrorCount: number;

    @OneToMany(() => SyncLog, log => log.sheet)
    syncLogs: SyncLog[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
