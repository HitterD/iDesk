import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum BackupType {
    DATABASE = 'DATABASE',
    FILES = 'FILES',
    FULL = 'FULL',
}

@Entity('backup_configurations')
export class BackupConfiguration {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 100 })
    name: string;

    // Synology Connection
    @Column()
    synologyHost: string;

    @Column({ default: 5001 })
    synologyPort: number;

    @Column({ default: 'https' })
    synologyProtocol: string;

    @Column({ length: 100 })
    synologyUsername: string;

    @Column('text')
    synologyPasswordEncrypted: string;

    // Destination
    @Column({ nullable: true })
    destinationVolume: string; // volume1, volume2

    @Column()
    destinationFolder: string; // /iDesk-Backups

    // Schedule
    @Column({
        type: 'enum',
        enum: BackupType,
        default: BackupType.DATABASE,
    })
    backupType: BackupType;

    @Column({ type: 'varchar', nullable: true })
    scheduleCron: string | null; // Cron expression

    @Column({ default: 30 })
    retentionDays: number;

    // Status
    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'timestamp', nullable: true })
    lastBackupAt: Date;

    @Column({ type: 'varchar', nullable: true })
    lastBackupStatus: string;

    @Column({ type: 'bigint', nullable: true })
    lastBackupSizeBytes: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
