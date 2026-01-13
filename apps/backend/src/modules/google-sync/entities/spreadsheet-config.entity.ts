import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { SpreadsheetSheet } from './spreadsheet-sheet.entity';

/**
 * Represents a connected Google Spreadsheet configuration
 */
@Entity('spreadsheet_configs')
export class SpreadsheetConfig {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string; // Display name

    @Column()
    spreadsheetId: string; // Google Spreadsheet ID (from URL)

    @Column({ nullable: true })
    spreadsheetUrl: string; // Full URL for reference

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'timestamp', nullable: true })
    lastSyncAt: Date;

    @Column({ default: 30 })
    defaultSyncIntervalSeconds: number;

    @OneToMany(() => SpreadsheetSheet, sheet => sheet.config)
    sheets: SpreadsheetSheet[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
