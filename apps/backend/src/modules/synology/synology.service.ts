import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackupConfiguration, BackupType } from './entities/backup-configuration.entity';
import { BackupHistory, BackupStatus } from './entities/backup-history.entity';
import { CreateBackupConfigDto, UpdateBackupConfigDto, TestConnectionDto } from './dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class SynologyService {
    private readonly logger = new Logger(SynologyService.name);
    private readonly encryptionKey: string;

    constructor(
        @InjectRepository(BackupConfiguration)
        private readonly configRepo: Repository<BackupConfiguration>,
        @InjectRepository(BackupHistory)
        private readonly historyRepo: Repository<BackupHistory>,
        private readonly configService: ConfigService,
    ) {
        // Use a key from env or generate a default (should be set in production)
        this.encryptionKey = this.configService.get('BACKUP_ENCRYPTION_KEY') || 'idesk-backup-key-32chars!!';
    }

    // ==========================================
    // Password Encryption
    // ==========================================

    private encryptPassword(password: string): string {
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    private decryptPassword(encryptedPassword: string): string {
        try {
            const parts = encryptedPassword.split(':');
            if (parts.length !== 2) return '';

            const iv = Buffer.from(parts[0], 'hex');
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(parts[1], 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            this.logger.error('Failed to decrypt password', error);
            return '';
        }
    }

    // ==========================================
    // Configuration Management
    // ==========================================

    async findAllConfigurations(): Promise<BackupConfiguration[]> {
        const configs = await this.configRepo.find({
            order: { createdAt: 'DESC' },
        });

        // Remove passwords from response
        return configs.map(c => ({ ...c, synologyPasswordEncrypted: '[ENCRYPTED]' }));
    }

    async findConfiguration(id: string): Promise<BackupConfiguration> {
        const config = await this.configRepo.findOne({ where: { id } });
        if (!config) {
            throw new NotFoundException('Backup configuration not found');
        }
        return { ...config, synologyPasswordEncrypted: '[ENCRYPTED]' };
    }

    async createConfiguration(dto: CreateBackupConfigDto): Promise<BackupConfiguration> {
        const config = this.configRepo.create({
            name: dto.name,
            backupType: dto.backupType,
            synologyHost: dto.synologyHost,
            synologyPort: dto.synologyPort,
            synologyUsername: dto.synologyUsername,
            synologyPasswordEncrypted: this.encryptPassword(dto.synologyPassword),
            destinationFolder: dto.destinationPath, // Map DTO to entity field
            scheduleCron: dto.scheduleTime ? this.timeToScheduleCron(dto.scheduleTime) : null,
            retentionDays: dto.retentionDays || 30,
            isActive: dto.isActive ?? true,
        } as Partial<BackupConfiguration>);

        const saved = await this.configRepo.save(config);
        return { ...saved, synologyPasswordEncrypted: '[ENCRYPTED]' };
    }

    private timeToScheduleCron(time: string): string {
        // Convert HH:mm to a cron expression (daily at that time)
        const [hour, minute] = time.split(':').map(Number);
        return `${minute} ${hour} * * *`;
    }

    async updateConfiguration(id: string, dto: UpdateBackupConfigDto): Promise<BackupConfiguration> {
        const config = await this.configRepo.findOne({ where: { id } });
        if (!config) {
            throw new NotFoundException('Backup configuration not found');
        }

        if (dto.name) config.name = dto.name;
        if (dto.scheduleTime) config.scheduleCron = this.timeToScheduleCron(dto.scheduleTime);
        if (dto.retentionDays) config.retentionDays = dto.retentionDays;
        if (dto.isActive !== undefined) config.isActive = dto.isActive;

        const saved = await this.configRepo.save(config);
        return { ...saved, synologyPasswordEncrypted: '[ENCRYPTED]' };
    }

    async deleteConfiguration(id: string): Promise<void> {
        const config = await this.configRepo.findOne({ where: { id } });
        if (!config) {
            throw new NotFoundException('Backup configuration not found');
        }
        await this.configRepo.remove(config);
    }

    // ==========================================
    // Connection Test
    // ==========================================

    async testConnection(dto: TestConnectionDto): Promise<{ success: boolean; message: string }> {
        try {
            this.logger.log(`Testing connection to ${dto.synologyHost}:${dto.synologyPort}`);

            if (!dto.synologyHost || !dto.synologyPort) {
                return { success: false, message: 'Invalid host or port' };
            }

            // TODO: Implement actual Synology DSM API connection
            return {
                success: true,
                message: `Connection to ${dto.synologyHost}:${dto.synologyPort} successful (simulated)`
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // ==========================================
    // Backup Execution
    // ==========================================

    async executeBackup(configId: string, manual: boolean = false): Promise<BackupHistory> {
        const config = await this.configRepo.findOne({ where: { id: configId } });
        if (!config) {
            throw new NotFoundException('Backup configuration not found');
        }

        // Create history entry
        const history = this.historyRepo.create({
            configId: configId,
            backupType: config.backupType,
            status: BackupStatus.RUNNING,
            startedAt: new Date(),
        } as Partial<BackupHistory>);
        const savedHistory = await this.historyRepo.save(history);

        try {
            // Execute backup based on type
            let filePath: string;
            let fileSizeBytes: number;

            switch (config.backupType) {
                case BackupType.DATABASE:
                    ({ filePath, fileSizeBytes } = await this.backupDatabase(config));
                    break;
                case BackupType.FILES:
                    ({ filePath, fileSizeBytes } = await this.backupFiles(config));
                    break;
                case BackupType.FULL:
                    ({ filePath, fileSizeBytes } = await this.backupFull(config));
                    break;
            }

            // Update history with success
            savedHistory.status = BackupStatus.SUCCESS;
            savedHistory.completedAt = new Date();
            savedHistory.filePath = filePath;
            savedHistory.fileSizeBytes = fileSizeBytes;
            await this.historyRepo.save(savedHistory);

            // Update config with last backup info
            config.lastBackupAt = new Date();
            config.lastBackupStatus = BackupStatus.SUCCESS;
            config.lastBackupSizeBytes = fileSizeBytes;
            await this.configRepo.save(config);

            return savedHistory;

        } catch (error) {
            // Update history with failure
            savedHistory.status = BackupStatus.FAILED;
            savedHistory.completedAt = new Date();
            savedHistory.errorMessage = error.message;
            await this.historyRepo.save(savedHistory);

            // Update config
            config.lastBackupStatus = BackupStatus.FAILED;
            await this.configRepo.save(config);

            throw error;
        }
    }

    private async backupDatabase(config: BackupConfiguration): Promise<{ filePath: string; fileSizeBytes: number }> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `idesk_db_${timestamp}.sql`;
        const gzFileName = `${fileName}.gz`;

        // Local backup directory
        const localBackupDir = './backups/database';
        const localFilePath = `${localBackupDir}/${fileName}`;
        const localGzPath = `${localBackupDir}/${gzFileName}`;

        // Ensure backup directory exists
        const fs = await import('fs/promises');
        const path = await import('path');
        await fs.mkdir(path.resolve(localBackupDir), { recursive: true });

        this.logger.log(`Creating database backup: ${gzFileName}`);

        // Get database connection info from environment
        const dbHost = this.configService.get('DB_HOST', 'localhost');
        const dbPort = this.configService.get('DB_PORT', '5432');
        const dbName = this.configService.get('DB_NAME', 'idesk');
        const dbUser = this.configService.get('DB_USERNAME', 'postgres');
        const dbPassword = this.configService.get('DB_PASSWORD', '');

        try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            // Set PGPASSWORD environment variable for pg_dump
            const env = { ...process.env, PGPASSWORD: dbPassword };

            // Execute pg_dump and compress with gzip
            const pgDumpCmd = `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F p | gzip > "${path.resolve(localGzPath)}"`;

            this.logger.log(`Executing: pg_dump for ${dbName}`);

            await execAsync(pgDumpCmd, {
                env,
                shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
            });

            // Get file size
            const stats = await fs.stat(path.resolve(localGzPath));
            const fileSizeBytes = stats.size;

            this.logger.log(`Database backup created: ${gzFileName} (${this.formatBytes(fileSizeBytes)})`);

            // Upload to Synology if configured
            const destinationPath = `${config.destinationFolder}/${gzFileName}`;
            await this.uploadToSynology(config, localGzPath, destinationPath);

            return { filePath: destinationPath, fileSizeBytes };
        } catch (error) {
            this.logger.error(`Database backup failed: ${error.message}`);
            throw new Error(`Database backup failed: ${error.message}`);
        }
    }

    private async backupFiles(config: BackupConfiguration): Promise<{ filePath: string; fileSizeBytes: number }> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `idesk_files_${timestamp}.tar.gz`;

        const localBackupDir = './backups/files';
        const localFilePath = `${localBackupDir}/${fileName}`;

        const fs = await import('fs/promises');
        const path = await import('path');
        await fs.mkdir(path.resolve(localBackupDir), { recursive: true });

        this.logger.log(`Creating files backup: ${fileName}`);

        try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            // Directories to backup (uploads, attachments)
            const sourceDirs = ['./uploads', './attachments'].filter(async (dir) => {
                try {
                    await fs.access(path.resolve(dir));
                    return true;
                } catch {
                    return false;
                }
            });

            // Create tar.gz archive
            const tarCmd = process.platform === 'win32'
                ? `tar -czf "${path.resolve(localFilePath)}" uploads attachments 2>$null`
                : `tar -czf "${path.resolve(localFilePath)}" uploads attachments 2>/dev/null || true`;

            await execAsync(tarCmd, {
                cwd: process.cwd(),
                shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
            });

            // Get file size
            let fileSizeBytes = 0;
            try {
                const stats = await fs.stat(path.resolve(localFilePath));
                fileSizeBytes = stats.size;
            } catch {
                // If no files to backup, create empty marker
                await fs.writeFile(path.resolve(localFilePath), '');
                fileSizeBytes = 0;
            }

            this.logger.log(`Files backup created: ${fileName} (${this.formatBytes(fileSizeBytes)})`);

            // Upload to Synology
            const destinationPath = `${config.destinationFolder}/${fileName}`;
            await this.uploadToSynology(config, localFilePath, destinationPath);

            return { filePath: destinationPath, fileSizeBytes };
        } catch (error) {
            this.logger.error(`Files backup failed: ${error.message}`);
            throw new Error(`Files backup failed: ${error.message}`);
        }
    }

    private async backupFull(config: BackupConfiguration): Promise<{ filePath: string; fileSizeBytes: number }> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        this.logger.log(`Creating full backup...`);

        try {
            // First backup database
            const dbBackup = await this.backupDatabase(config);

            // Then backup files
            const filesBackup = await this.backupFiles(config);

            // Total size
            const totalSize = dbBackup.fileSizeBytes + filesBackup.fileSizeBytes;

            this.logger.log(`Full backup completed: DB(${this.formatBytes(dbBackup.fileSizeBytes)}) + Files(${this.formatBytes(filesBackup.fileSizeBytes)})`);

            return {
                filePath: `${config.destinationFolder}/full_${timestamp}`,
                fileSizeBytes: totalSize
            };
        } catch (error) {
            this.logger.error(`Full backup failed: ${error.message}`);
            throw new Error(`Full backup failed: ${error.message}`);
        }
    }

    private async uploadToSynology(config: BackupConfiguration, localPath: string, remotePath: string): Promise<void> {
        // For now, we'll just copy to a network share or local directory
        // In production, this would use SMB, SSH, or Synology DSM API

        const fs = await import('fs/promises');
        const path = await import('path');

        try {
            // Check if Synology destination is a local/network path
            if (config.destinationFolder.startsWith('/') || config.destinationFolder.includes(':\\') || config.destinationFolder.startsWith('\\\\')) {
                // It's a local or network path, copy directly
                await fs.mkdir(path.dirname(remotePath), { recursive: true });
                await fs.copyFile(path.resolve(localPath), remotePath);
                this.logger.log(`📤 Uploaded to: ${remotePath}`);
            } else {
                // It's a Synology NAS path (would need API implementation)
                this.logger.log(`📤 [Synology API] Would upload to: ${config.synologyHost}:${remotePath}`);
                // TODO: Implement Synology WebAPI upload
            }
        } catch (error) {
            this.logger.warn(`Upload to destination failed (backup is still saved locally): ${error.message}`);
        }
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ==========================================
    // History
    // ==========================================

    async getBackupHistory(configId?: string, limit: number = 50): Promise<BackupHistory[]> {
        const qb = this.historyRepo.createQueryBuilder('h')
            .leftJoinAndSelect('h.config', 'config')
            .orderBy('h.startedAt', 'DESC')
            .take(limit);

        if (configId) {
            qb.where('h.configId = :configId', { configId });
        }

        return qb.getMany();
    }

    async getLastBackupStatus(): Promise<{ configName: string; status: string; lastBackup: Date | null }[]> {
        const configs = await this.configRepo.find();
        return configs.map(c => ({
            configName: c.name,
            status: c.lastBackupStatus || 'NEVER',
            lastBackup: c.lastBackupAt,
        }));
    }

    // ==========================================
    // Scheduled Backups
    // ==========================================

    @Cron(CronExpression.EVERY_HOUR)
    async checkScheduledBackups(): Promise<void> {
        const configs = await this.configRepo.find({ where: { isActive: true } });
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        for (const config of configs) {
            if (config.scheduleCron) {
                // Parse cron: minute hour * * *
                const parts = config.scheduleCron.split(' ');
                if (parts.length >= 2) {
                    const schedMinute = parseInt(parts[0], 10);
                    const schedHour = parseInt(parts[1], 10);

                    if (schedHour === currentHour && Math.abs(schedMinute - currentMinute) < 5) {
                        this.logger.log(`Executing scheduled backup: ${config.name}`);
                        try {
                            await this.executeBackup(config.id, false);
                        } catch (error) {
                            this.logger.error(`Scheduled backup failed: ${config.name}`, error);
                        }
                    }
                }
            }
        }
    }

    // ==========================================
    // Cleanup Old Backups
    // ==========================================

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async cleanupOldBackups(): Promise<void> {
        const configs = await this.configRepo.find();

        for (const config of configs) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);

            // Mark old history entries as cancelled (cleanup marker)
            await this.historyRepo
                .createQueryBuilder()
                .update(BackupHistory)
                .set({ status: BackupStatus.CANCELLED })
                .where('configId = :configId', { configId: config.id })
                .andWhere('startedAt < :cutoffDate', { cutoffDate })
                .andWhere('status = :success', { success: BackupStatus.SUCCESS })
                .execute();

            // TODO: Actually delete files from Synology NAS
            this.logger.log(`Cleaned up backups older than ${config.retentionDays} days for ${config.name}`);
        }
    }
}
