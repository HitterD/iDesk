import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { BackupConfiguration } from './backup-configuration.entity';
import { BackupType, BackupStatus } from '../enums/backup.enum';

export { BackupStatus, BackupType };

@Entity('backup_history')
export class BackupHistory {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    configId: string;

    @ManyToOne(() => BackupConfiguration, (config) => config.histories, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'configId' })
    config: BackupConfiguration;

    @Column()
    startedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt: Date;

    @Column({
        type: 'enum',
        enum: BackupStatus,
        default: BackupStatus.RUNNING,
    })
    status: BackupStatus;

    @Column({
        type: 'enum',
        enum: BackupType,
    })
    backupType: BackupType;

    @Column({ type: 'varchar', nullable: true })
    filePath: string;

    @Column({ type: 'bigint', nullable: true })
    fileSizeBytes: number;

    @Column({ nullable: true, type: 'text' })
    errorMessage: string;

    @CreateDateColumn()
    createdAt: Date;
}
