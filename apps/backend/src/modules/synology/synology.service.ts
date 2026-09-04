import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { BackupConfiguration, BackupType } from './entities/backup-configuration.entity';
import { BackupHistory, BackupStatus } from './entities/backup-history.entity';
import {
    CreateBackupConfigDto,
    UpdateBackupConfigDto,
    TestConnectionDto,
    ListFoldersDto,
    RestoreFromHistoryDto,
    RestoreFromNasDto,
    RestoreUploadDto,
} from './dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as https from 'https';
import * as querystring from 'querystring';

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

        if (dto.name !== undefined) config.name = dto.name;
        if (dto.backupType !== undefined) config.backupType = dto.backupType;
        if (dto.synologyHost !== undefined) config.synologyHost = dto.synologyHost;
        if (dto.synologyPort !== undefined) {
            config.synologyPort = dto.synologyPort;
            config.synologyProtocol = dto.synologyPort === 5000 || dto.synologyPort === 80 ? 'http' : 'https';
        }
        if (dto.synologyUsername !== undefined) config.synologyUsername = dto.synologyUsername;
        if (dto.synologyPassword) config.synologyPasswordEncrypted = this.encryptPassword(dto.synologyPassword);
        if (dto.destinationPath !== undefined) {
            config.destinationFolder = dto.destinationPath;
            config.destinationVolume = dto.destinationPath.split('/')[1] || 'volume1';
        }
        if (dto.scheduleTime !== undefined) {
            config.scheduleCron = dto.scheduleTime ? this.timeToScheduleCron(dto.scheduleTime) : null;
        }
        if (dto.retentionDays !== undefined) config.retentionDays = dto.retentionDays;
        if (dto.isActive !== undefined) config.isActive = dto.isActive;

        const saved = await this.configRepo.save(config);
        return { ...saved, synologyPasswordEncrypted: '[ENCRYPTED]' };
    }

    async deleteConfiguration(id: string): Promise<void> {
        const config = await this.configRepo.findOne({ where: { id } });
        if (!config) {
            throw new NotFoundException('Backup configuration not found');
        }
        await this.historyRepo.delete({ configId: id });
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

            if (!dto.synologyUsername || !dto.synologyPassword) {
                return { success: false, message: 'Username and password are required' };
            }

            // Determine protocol - try HTTPS first, fallback to HTTP for non-standard ports
            const protocol = dto.synologyPort === 5000 || dto.synologyPort === 80 ? 'http' : 'https';
            const baseUrl = `${protocol}://${dto.synologyHost}:${dto.synologyPort}`;

            this.logger.log(`Attempting DSM API authentication at ${baseUrl}`);

            // Call Synology DSM Auth API (SYNO.API.Auth v3)
            const authResult = await this.callDsmApi(
                baseUrl,
                '/webapi/auth.cgi',
                {
                    api: 'SYNO.API.Auth',
                    method: 'login',
                    version: '3',
                    account: dto.synologyUsername,
                    passwd: dto.synologyPassword,
                    session: 'FileStation',
                    format: 'cookie',
                }
            );

            if (authResult.success && authResult.data?.sid) {
                this.logger.log(`DSM authentication successful for user: ${dto.synologyUsername}`);

                // Optional: Logout to clean up the session
                try {
                    await this.callDsmApi(
                        baseUrl,
                        '/webapi/auth.cgi',
                        {
                            api: 'SYNO.API.Auth',
                            method: 'logout',
                            version: '3',
                            _sid: authResult.data.sid,
                        }
                    );
                } catch (logoutError) {
                    // Ignore logout errors
                    this.logger.debug('Logout after test completed (non-critical)');
                }

                return {
                    success: true,
                    message: `Connection successful. Authenticated to ${dto.synologyHost}:${dto.synologyPort} as ${dto.synologyUsername}`,
                };
            } else {
                const errorCode = authResult.error?.code;
                let errorMessage = 'Authentication failed';

                // Common DSM error codes
                switch (errorCode) {
                    case 400:
                        errorMessage = 'Invalid username or password';
                        break;
                    case 401:
                        errorMessage = 'Account disabled or expired';
                        break;
                    case 402:
                        errorMessage = 'Permission denied';
                        break;
                    case 403:
                        errorMessage = 'Two-factor authentication required';
                        break;
                    case 404:
                        errorMessage = 'Two-factor authentication failed';
                        break;
                    default:
                        errorMessage = `Authentication failed (error code: ${errorCode || 'unknown'})`;
                }

                this.logger.warn(`DSM auth failed: ${errorMessage}`);
                return { success: false, message: errorMessage };
            }
        } catch (error: any) {
            this.logger.error(`Connection test failed: ${error.message}`, error.stack);

            // Provide user-friendly error messages
            if (error.code === 'ECONNREFUSED') {
                return { success: false, message: `Cannot connect to ${dto.synologyHost}:${dto.synologyPort}. Is the NAS online and the port correct?` };
            }
            if (error.code === 'ENOTFOUND') {
                return { success: false, message: `Host not found: ${dto.synologyHost}. Check the hostname or IP address.` };
            }
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                return { success: false, message: `Connection timeout to ${dto.synologyHost}:${dto.synologyPort}. Check firewall or network connectivity.` };
            }
            if (error.message?.includes('certificate') || error.message?.includes('self signed')) {
                return { success: false, message: `SSL certificate error. The NAS may be using a self-signed certificate. Try using HTTP port (5000) instead of HTTPS, or configure proper SSL.` };
            }

            return { success: false, message: `Connection failed: ${error.message}` };
        }
    }

    /**
     * List folders on the Synology NAS using FileStation API.
     * After successful connection test, user can browse shares and folders to pick destination.
     */
    async listFolders(dto: ListFoldersDto): Promise<{
        success: boolean;
        folders?: Array<{ name: string; path: string; isDir: boolean }>;
        message?: string;
    }> {
        try {
            this.logger.log(`Listing folders on ${dto.synologyHost}:${dto.synologyPort} at path=${dto.path || '/'}`);

            if (!dto.synologyHost || !dto.synologyPort || !dto.synologyUsername || !dto.synologyPassword) {
                return { success: false, message: 'Host, port, username and password are required' };
            }

            const protocol = dto.synologyPort === 5000 || dto.synologyPort === 80 ? 'http' : 'https';
            const baseUrl = `${protocol}://${dto.synologyHost}:${dto.synologyPort}`;

            // 1. Authenticate (get session id)
            const loginResult = await this.callDsmApi(baseUrl, '/webapi/auth.cgi', {
                api: 'SYNO.API.Auth',
                method: 'login',
                version: '3',
                account: dto.synologyUsername,
                passwd: dto.synologyPassword,
                session: 'FileStation',
                format: 'cookie',
            });

            if (!loginResult.success || !loginResult.data?.sid) {
                const code = loginResult.error?.code;
                let msg = 'Authentication failed';
                if (code === 400) msg = 'Invalid username or password';
                return { success: false, message: msg };
            }

            const sid = loginResult.data.sid;

            // 2. Decide whether to list shares (volumes) or list inside a folder
            const targetPath = dto.path && dto.path !== '/' ? dto.path : null;

            let fsApi = 'SYNO.FileStation.List';
            let fsMethod = 'list';
            let extra: Record<string, string | number> = {};

            if (!targetPath) {
                // List shares (top level volumes like /volume1, /volume2)
                fsMethod = 'list_share';
                extra = {
                    additional: '["real_path","owner","time"]',
                };
            } else {
                extra = {
                    folder_path: targetPath,
                    additional: '["real_path"]',
                };
            }

            const listResult = await this.callDsmApi(baseUrl, '/webapi/entry.cgi', {
                api: fsApi,
                method: fsMethod,
                version: '2',
                _sid: sid,
                ...extra,
            });

            // 3. Best-effort logout (ignore errors)
            try {
                await this.callDsmApi(baseUrl, '/webapi/auth.cgi', {
                    api: 'SYNO.API.Auth',
                    method: 'logout',
                    version: '3',
                    _sid: sid,
                });
            } catch {
                // non-critical
            }

            if (!listResult.success) {
                return {
                    success: false,
                    message: `Failed to list folders (code: ${listResult.error?.code ?? 'unknown'})`,
                };
            }

            // 4. Normalize response
            let folders: Array<{ name: string; path: string; isDir: boolean; size?: number }> = [];

            if (fsMethod === 'list_share' && Array.isArray(listResult.data?.shares)) {
                folders = listResult.data.shares.map((s: any) => ({
                    name: s.name || s.path,
                    path: s.path || `/${s.name}`,
                    isDir: true,
                    size: 0,
                }));
            } else if (Array.isArray(listResult.data?.files)) {
                folders = listResult.data.files
                    .filter((f: any) => {
                        const isDirectory = f.isdir === true || f.isdir === 'true';
                        if (isDirectory) return true;
                        if (dto.includeFiles) {
                            const name = (f.name || '').toLowerCase();
                            return name.endsWith('.sql.gz') || name.endsWith('.sql') || name.endsWith('.tar.gz') || name.endsWith('.gz');
                        }
                        return false;
                    })
                    .map((f: any) => ({
                        name: f.name,
                        path: f.path,
                        isDir: f.isdir === true || f.isdir === 'true',
                        size: f.additional?.size || 0,
                    }));
            }

            return { success: true, folders };
        } catch (error: any) {
            this.logger.error('listFolders failed', error);
            if (error.code === 'ECONNREFUSED') {
                return { success: false, message: 'Cannot connect to NAS' };
            }
            return { success: false, message: error.message || 'Failed to list folders' };
        }
    }

    /**
     * Call Synology DSM WebAPI
     */
    private async callDsmApi(
        baseUrl: string,
        path: string,
        params: Record<string, string | number>
    ): Promise<{ success: boolean; data?: any; error?: { code: number } }> {
        const url = `${baseUrl}${path}`;
        const postData = querystring.stringify(params);

        // Create HTTPS agent that accepts self-signed certificates (common for NAS)
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
        });

        const isHttps = baseUrl.startsWith('https');
        const httpModule = isHttps ? https : require('http');

        return new Promise((resolve, reject) => {
            const options: https.RequestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                },
                timeout: 10000, // 10 second timeout
            };

            if (isHttps) {
                options.agent = httpsAgent;
            }

            const req = httpModule.request(url, options, (res: any) => {
                let data = '';

                res.on('data', (chunk: string) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(result);
                    } catch (parseError) {
                        reject(new Error(`Invalid response from DSM API: ${data.substring(0, 100)}`));
                    }
                });
            });

            req.on('error', (error: Error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(postData);
            req.end();
        });
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
        const localGzPath = `${localBackupDir}/${gzFileName}`;

        // Ensure backup directory exists
        const fs = await import('fs/promises');
        const fsSync = await import('fs');
        const path = await import('path');
        const zlib = await import('zlib');
        const { spawn, exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        await fs.mkdir(path.resolve(localBackupDir), { recursive: true });

        this.logger.log(`Creating database backup: ${gzFileName}`);

        // Get database connection info from environment
        const dbHost = this.configService.get('DB_HOST', 'localhost');
        const dbPort = this.configService.get('DB_PORT', '5432');
        const dbName = this.configService.get('DB_DATABASE') || this.configService.get('DB_NAME') || 'idesk_db';
        const dbUser = this.configService.get('DB_USERNAME', 'postgres');
        const dbPassword = this.configService.get('DB_PASSWORD', '');

        try {
            // Determine the pg_dump command and arguments
            let dumpCommand = 'pg_dump';
            let dumpArgs: string[] = [];

            const customPgDump = this.configService.get('PG_DUMP_PATH') || process.env.PG_DUMP_PATH;
            if (customPgDump && fsSync.existsSync(customPgDump)) {
                dumpCommand = customPgDump;
                dumpArgs = ['-h', dbHost, '-p', String(dbPort), '-U', dbUser, '-d', dbName, '-F', 'p'];
            } else {
                // Check if pg_dump is available in host PATH
                let pgDumpInPath = false;
                try {
                    const checkCmd = process.platform === 'win32' ? 'where pg_dump' : 'which pg_dump';
                    const { stdout } = await execAsync(checkCmd);
                    if (stdout && stdout.trim()) {
                        pgDumpInPath = true;
                    }
                } catch {
                    pgDumpInPath = false;
                }

                if (pgDumpInPath) {
                    dumpCommand = 'pg_dump';
                    dumpArgs = ['-h', dbHost, '-p', String(dbPort), '-U', dbUser, '-d', dbName, '-F', 'p'];
                } else {
                    // Check if Docker container idesk-postgres is running
                    const dockerContainer = this.configService.get('DB_DOCKER_CONTAINER') || process.env.DB_DOCKER_CONTAINER || 'idesk-postgres';
                    let dockerAvailable = false;
                    try {
                        const { stdout } = await execAsync(`docker ps --filter "name=${dockerContainer}" --format "{{.Names}}"`);
                        if (stdout && stdout.includes(dockerContainer)) {
                            dockerAvailable = true;
                        }
                    } catch {
                        dockerAvailable = false;
                    }

                    if (dockerAvailable) {
                        this.logger.log(`Using Docker container ${dockerContainer} for pg_dump`);
                        dumpCommand = 'docker';
                        dumpArgs = ['exec', '-i', dockerContainer, 'pg_dump', '-U', dbUser, '-d', dbName, '-F', 'p'];
                    } else {
                        // Scan standard Windows installation paths
                        const winPaths = [
                            'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
                            'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
                            'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
                            'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
                            'C:\\Program Files\\PostgreSQL\\13\\bin\\pg_dump.exe',
                            'C:\\Program Files (x86)\\PostgreSQL\\16\\bin\\pg_dump.exe',
                            'C:\\Program Files (x86)\\PostgreSQL\\15\\bin\\pg_dump.exe',
                        ];
                        const foundPath = winPaths.find(p => fsSync.existsSync(p));
                        if (foundPath) {
                            dumpCommand = foundPath;
                            dumpArgs = ['-h', dbHost, '-p', String(dbPort), '-U', dbUser, '-d', dbName, '-F', 'p'];
                        } else {
                            // Fallback attempt with docker exec
                            dumpCommand = 'docker';
                            dumpArgs = ['exec', '-i', 'idesk-postgres', 'pg_dump', '-U', dbUser, '-d', dbName, '-F', 'p'];
                        }
                    }
                }
            }

            this.logger.log(`Executing ${dumpCommand} ${dumpArgs.join(' ')} for ${dbName}`);

            const env = { ...process.env, PGPASSWORD: dbPassword };
            const gzipStream = zlib.createGzip({ level: 6 });
            const fileWriteStream = fsSync.createWriteStream(path.resolve(localGzPath));

            await new Promise<void>((resolve, reject) => {
                const child = spawn(dumpCommand, dumpArgs, {
                    env,
                    stdio: ['ignore', 'pipe', 'pipe'],
                });

                let stderrData = '';
                child.stderr.on('data', (chunk) => {
                    stderrData += chunk.toString();
                });

                child.on('error', (err) => {
                    reject(new Error(`Failed to execute ${dumpCommand}: ${err.message}`));
                });

                child.stdout.pipe(gzipStream).pipe(fileWriteStream);

                fileWriteStream.on('finish', () => {
                    resolve();
                });

                fileWriteStream.on('error', (err) => {
                    reject(err);
                });

                child.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`${dumpCommand} exited with code ${code}: ${stderrData.trim()}`));
                    }
                });
            });

            // Get file size
            const stats = await fs.stat(path.resolve(localGzPath));
            const fileSizeBytes = stats.size;

            this.logger.log(`Database backup created: ${gzFileName} (${this.formatBytes(fileSizeBytes)})`);

            // Upload to Synology if configured
            const destinationPath = `${config.destinationFolder}/database/${gzFileName}`;
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
        const fsSync = await import('fs');
        const path = await import('path');
        await fs.mkdir(path.resolve(localBackupDir), { recursive: true });

        this.logger.log(`Creating files backup: ${fileName}`);

        try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            // Directories to backup (uploads, attachments)
            const candidateDirs = ['uploads', 'attachments'];
            const existingDirs = candidateDirs.filter((dir) => fsSync.existsSync(path.resolve(dir)));

            if (existingDirs.length === 0) {
                await fs.mkdir(path.resolve('./uploads'), { recursive: true });
                existingDirs.push('uploads');
            }

            // Create tar.gz archive
            const tarCmd = process.platform === 'win32'
                ? `tar -czf "${path.resolve(localFilePath)}" ${existingDirs.join(' ')}`
                : `tar -czf "${path.resolve(localFilePath)}" ${existingDirs.join(' ')} 2>/dev/null || true`;

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
            const destinationPath = `${config.destinationFolder}/files/${fileName}`;
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
        const fs = await import('fs/promises');
        const path = await import('path');

        // Check if destination is a local Windows drive path (e.g. C:\... or D:\...) or Windows UNC share (\\server\...)
        if (config.destinationFolder.includes(':\\') || config.destinationFolder.startsWith('\\\\')) {
            await fs.mkdir(path.dirname(remotePath), { recursive: true });
            await fs.copyFile(path.resolve(localPath), remotePath);
            this.logger.log(`📤 Copied backup to local/UNC path: ${remotePath}`);
            return;
        }

        // Synology NAS DSM FileStation API Upload
        const protocol = config.synologyPort === 5000 || config.synologyPort === 80 ? 'http' : 'https';
        const baseUrl = `${protocol}://${config.synologyHost}:${config.synologyPort}`;
        const password = this.decryptPassword(config.synologyPasswordEncrypted);

        const remoteDir = path.dirname(remotePath).replace(/\\/g, '/');
        const fileName = path.basename(remotePath);

        this.logger.log(`📤 Uploading to Synology NAS (${baseUrl}) at path: ${remotePath}`);

        // 1. Authenticate to get session ID
        const loginResult = await this.callDsmApi(baseUrl, '/webapi/auth.cgi', {
            api: 'SYNO.API.Auth',
            method: 'login',
            version: '3',
            account: config.synologyUsername,
            passwd: password,
            session: 'FileStation',
            format: 'sid',
        });

        if (!loginResult.success || !loginResult.data?.sid) {
            const errCode = loginResult.error?.code;
            let errMsg = 'Authentication failed';
            if (errCode === 400) errMsg = 'Invalid username or password';
            if (errCode === 402) errMsg = 'Permission denied';
            throw new Error(`Synology NAS login failed: ${errMsg} (Error code: ${errCode || 'unknown'})`);
        }

        const sid = loginResult.data.sid;

        try {
            // 2. Query Synology API Info to discover exact FileStation.Upload path and version
            let uploadCgiPath = '/webapi/entry.cgi';
            let uploadVersion = '2';

            try {
                const infoResult = await this.callDsmApi(baseUrl, '/webapi/query.cgi', {
                    api: 'SYNO.API.Info',
                    version: '1',
                    method: 'query',
                    query: 'SYNO.FileStation.Upload',
                    _sid: sid,
                });
                if (infoResult.success && infoResult.data?.['SYNO.FileStation.Upload']) {
                    const info = infoResult.data['SYNO.FileStation.Upload'];
                    if (info.path) {
                        uploadCgiPath = info.path.startsWith('/') ? `/webapi${info.path}` : `/webapi/${info.path}`;
                    }
                    if (info.maxVersion) {
                        uploadVersion = String(info.maxVersion);
                    }
                }
            } catch (infoErr) {
                this.logger.debug(`SYNO.API.Info query fallback to default entry.cgi: ${infoErr.message}`);
            }

            // 3. Perform FileStation Upload via HTTP multipart request
            const fileBuffer = await fs.readFile(path.resolve(localPath));
            const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString('hex')}`;

            const crlf = '\r\n';
            let head = '';

            const fields: Record<string, string> = {
                api: 'SYNO.FileStation.Upload',
                version: uploadVersion,
                method: 'upload',
                _sid: sid,
                path: remoteDir,
                create_parents: 'true',
                overwrite: 'true',
            };

            for (const [key, val] of Object.entries(fields)) {
                head += `--${boundary}${crlf}`;
                head += `Content-Disposition: form-data; name="${key}"${crlf}${crlf}`;
                head += `${val}${crlf}`;
            }

            head += `--${boundary}${crlf}`;
            head += `Content-Disposition: form-data; name="file"; filename="${fileName}"${crlf}`;
            head += `Content-Type: application/octet-stream${crlf}${crlf}`;

            const tail = `${crlf}--${boundary}--${crlf}`;

            const headBuf = Buffer.from(head, 'utf8');
            const tailBuf = Buffer.from(tail, 'utf8');
            const fullBody = Buffer.concat([headBuf, fileBuffer, tailBuf]);

            const isHttps = baseUrl.startsWith('https');
            const httpModule = isHttps ? https : await import('http');

            // Pass _sid and api params in query string as required by DSM multipart handler
            const queryParams = querystring.stringify({
                api: 'SYNO.FileStation.Upload',
                version: uploadVersion,
                method: 'upload',
                _sid: sid,
            });

            const parsedBaseUrl = new URL(baseUrl);
            const requestPath = `${uploadCgiPath}?${queryParams}`;

            const uploadResult = await new Promise<{ success: boolean; data?: any; error?: { code: number } }>((resolve, reject) => {
                const options: https.RequestOptions = {
                    method: 'POST',
                    hostname: parsedBaseUrl.hostname,
                    port: parsedBaseUrl.port || (isHttps ? 5001 : 5000),
                    path: requestPath,
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Content-Length': fullBody.length,
                        'Cookie': `id=${sid}; smid=${sid}`,
                    },
                    timeout: 180000, // 3 minutes
                };

                if (isHttps) {
                    options.agent = new https.Agent({ rejectUnauthorized: false });
                }

                const req = (httpModule as any).request(options, (res: any) => {
                    let data = '';
                    res.on('data', (chunk: string) => { data += chunk; });
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(data);
                            resolve(parsed);
                        } catch {
                            reject(new Error(`Invalid response from Synology upload API: ${data.substring(0, 150)}`));
                        }
                    });
                });

                req.on('error', (err: Error) => reject(err));
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Upload to Synology NAS timed out'));
                });

                req.write(fullBody);
                req.end();
            });

            if (!uploadResult.success) {
                const code = uploadResult.error?.code;
                let errMsg = `Upload failed (Error code: ${code})`;
                if (code === 119) errMsg = 'Session expired or invalid SID';
                if (code === 408) errMsg = `Folder '${remoteDir}' tidak ditemukan di Synology NAS atau izin ditolak`;
                if (code === 414) errMsg = 'Ukuran file melebihi batas Synology';
                throw new Error(`Synology FileStation error: ${errMsg}`);
            }

            this.logger.log(`✅ File ${fileName} successfully uploaded to Synology NAS at ${remoteDir}/${fileName}`);
        } finally {
            // Logout session
            try {
                await this.callDsmApi(baseUrl, '/webapi/auth.cgi', {
                    api: 'SYNO.API.Auth',
                    method: 'logout',
                    version: '3',
                    _sid: sid,
                });
            } catch {
                // Ignore logout cleanup error
            }
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
    // Live File Mirroring & Sync Operations
    // ==========================================

    @OnEvent('file.uploaded', { async: true })
    async handleFileUploaded(payload: {
        filePath: string;
        relativePath?: string;
        folder?: string;
        filename?: string;
    }): Promise<void> {
        try {
            const config = await this.configRepo.findOne({ where: { isActive: true } });
            if (!config || !config.synologyHost || !config.synologyUsername) {
                return;
            }

            const localPath = payload.filePath;
            let subPath = payload.relativePath || '';
            if (subPath.startsWith('/uploads/')) {
                subPath = subPath.replace(/^\/uploads\//, '');
            } else if (!subPath && payload.folder && payload.filename) {
                subPath = `${payload.folder}/${payload.filename}`;
            }

            if (!subPath) {
                const path = await import('path');
                subPath = `attachments/${path.basename(localPath)}`;
            }

            const remotePath = `${config.destinationFolder}/${subPath}`;
            await this.uploadToSynology(config, localPath, remotePath);
            this.logger.log(`⚡ Live Synced file to Synology NAS: ${subPath}`);
        } catch (err: any) {
            this.logger.warn(`Live sync to Synology skipped/failed for ${payload.filePath}: ${err.message}`);
        }
    }

    /**
     * Sync all local uploads to Synology NAS
     */
    async syncUploadsToSynology(configId?: string): Promise<{
        success: boolean;
        totalFiles: number;
        uploadedFiles: number;
        failedFiles: number;
        totalBytes: number;
        message: string;
    }> {
        const config = configId
            ? await this.configRepo.findOne({ where: { id: configId } })
            : await this.configRepo.findOne({ where: { isActive: true } });

        if (!config) {
            throw new NotFoundException('Tidak ada konfigurasi backup Synology yang aktif');
        }

        const fs = await import('fs/promises');
        const fsSync = await import('fs');
        const path = await import('path');

        const uploadDir = path.resolve(this.configService.get('UPLOAD_DIR', './uploads'));
        if (!fsSync.existsSync(uploadDir)) {
            return {
                success: true,
                totalFiles: 0,
                uploadedFiles: 0,
                failedFiles: 0,
                totalBytes: 0,
                message: 'Folder uploads lokal tidak ditemukan atau masih kosong',
            };
        }

        const getAllFiles = async (dirPath: string): Promise<string[]> => {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const files: string[] = [];
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    files.push(...(await getAllFiles(fullPath)));
                } else if (entry.isFile() && !entry.name.startsWith('.')) {
                    files.push(fullPath);
                }
            }
            return files;
        };

        const allFilePaths = await getAllFiles(uploadDir);
        let uploadedFiles = 0;
        let failedFiles = 0;
        let totalBytes = 0;

        for (const localFilePath of allFilePaths) {
            try {
                const relPath = path.relative(uploadDir, localFilePath).replace(/\\/g, '/');
                const remotePath = `${config.destinationFolder}/${relPath}`;
                const stat = await fs.stat(localFilePath);
                totalBytes += stat.size;

                await this.uploadToSynology(config, localFilePath, remotePath);
                uploadedFiles++;
            } catch (err: any) {
                failedFiles++;
                this.logger.warn(`Failed to sync file to Synology (${localFilePath}): ${err.message}`);
            }
        }

        // Record history entry
        const history = this.historyRepo.create({
            configId: config.id,
            backupType: BackupType.FILES,
            status: failedFiles === 0 ? BackupStatus.SUCCESS : (uploadedFiles > 0 ? BackupStatus.SUCCESS : BackupStatus.FAILED),
            startedAt: new Date(),
            completedAt: new Date(),
            filePath: `${config.destinationFolder}/uploads`,
            fileSizeBytes: totalBytes,
            errorMessage: failedFiles > 0 ? `${failedFiles} file gagal disinkronkan dari total ${allFilePaths.length}` : null,
        } as Partial<BackupHistory>);
        await this.historyRepo.save(history);

        // Update config status
        config.lastBackupAt = new Date();
        config.lastBackupStatus = history.status;
        config.lastBackupSizeBytes = totalBytes;
        await this.configRepo.save(config);

        return {
            success: true,
            totalFiles: allFilePaths.length,
            uploadedFiles,
            failedFiles,
            totalBytes,
            message: `Sinkronisasi selesai: ${uploadedFiles}/${allFilePaths.length} file berhasil ditransfer (${this.formatBytes(totalBytes)})`,
        };
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

    // ==========================================
    // Restore Operations
    // ==========================================

    async downloadFromSynology(config: BackupConfiguration, remotePath: string, localDestinationPath: string): Promise<void> {
        const fs = await import('fs/promises');
        const fsSync = await import('fs');
        const path = await import('path');

        await fs.mkdir(path.dirname(path.resolve(localDestinationPath)), { recursive: true });

        // If local path on server host
        if (remotePath.includes(':\\') || remotePath.startsWith('\\\\')) {
            if (fsSync.existsSync(remotePath)) {
                await fs.copyFile(remotePath, path.resolve(localDestinationPath));
                return;
            }
        }

        const protocol = config.synologyPort === 5000 || config.synologyPort === 80 ? 'http' : 'https';
        const baseUrl = `${protocol}://${config.synologyHost}:${config.synologyPort}`;
        const password = this.decryptPassword(config.synologyPasswordEncrypted);

        // 1. Login
        const loginResult = await this.callDsmApi(baseUrl, '/webapi/auth.cgi', {
            api: 'SYNO.API.Auth',
            method: 'login',
            version: '3',
            account: config.synologyUsername,
            passwd: password,
            session: 'FileStation',
            format: 'sid',
        });

        if (!loginResult.success || !loginResult.data?.sid) {
            throw new Error(`Synology login failed when downloading backup file`);
        }

        const sid = loginResult.data.sid;

        try {
            const queryParams = querystring.stringify({
                api: 'SYNO.FileStation.Download',
                version: '2',
                method: 'download',
                path: remotePath,
                mode: 'download',
                _sid: sid,
            });

            const parsedBaseUrl = new URL(baseUrl);
            const downloadPath = `/webapi/entry.cgi?${queryParams}`;
            const isHttps = baseUrl.startsWith('https');
            const httpModule = isHttps ? https : await import('http');

            const fileWriteStream = fsSync.createWriteStream(path.resolve(localDestinationPath));

            await new Promise<void>((resolve, reject) => {
                const options: https.RequestOptions = {
                    method: 'GET',
                    hostname: parsedBaseUrl.hostname,
                    port: parsedBaseUrl.port || (isHttps ? 5001 : 5000),
                    path: downloadPath,
                    headers: {
                        'Cookie': `id=${sid}; smid=${sid}`,
                    },
                    timeout: 300000, // 5 minutes for download
                };

                if (isHttps) {
                    options.agent = new https.Agent({ rejectUnauthorized: false });
                }

                const req = (httpModule as any).request(options, (res: any) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`Synology download HTTP error ${res.statusCode}`));
                        return;
                    }
                    res.pipe(fileWriteStream);
                    fileWriteStream.on('finish', () => resolve());
                    fileWriteStream.on('error', (err) => reject(err));
                });

                req.on('error', (err: Error) => reject(err));
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Download from Synology timed out'));
                });

                req.end();
            });

            const stats = await fs.stat(path.resolve(localDestinationPath));
            if (stats.size === 0) {
                throw new Error('Downloaded backup file is empty (0 bytes)');
            }
        } finally {
            try {
                await this.callDsmApi(baseUrl, '/webapi/auth.cgi', {
                    api: 'SYNO.API.Auth',
                    method: 'logout',
                    version: '3',
                    _sid: sid,
                });
            } catch {
                // Ignore logout error
            }
        }
    }

    async restoreDatabase(sourceFilePath: string): Promise<{ success: boolean; message: string; durationMs: number }> {
        const startTime = Date.now();
        const fsSync = await import('fs');
        const path = await import('path');
        const zlib = await import('zlib');
        const { spawn, exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const resolvedPath = path.resolve(sourceFilePath);
        if (!fsSync.existsSync(resolvedPath)) {
            throw new NotFoundException(`File backup tidak ditemukan di: ${resolvedPath}`);
        }

        const isGz = resolvedPath.endsWith('.gz');

        this.logger.log(`Starting database restore from ${resolvedPath} (compressed: ${isGz})`);

        // Database connection info
        const dbHost = this.configService.get('DB_HOST', 'localhost');
        const dbPort = this.configService.get('DB_PORT', '5432');
        const dbName = this.configService.get('DB_DATABASE') || this.configService.get('DB_NAME') || 'idesk_db';
        const dbUser = this.configService.get('DB_USERNAME', 'postgres');
        const dbPassword = this.configService.get('DB_PASSWORD', '');

        // Determine command
        let psqlCommand = 'psql';
        let psqlArgs: string[] = [];

        // Check if Docker container idesk-postgres is running
        const dockerContainer = this.configService.get('DB_DOCKER_CONTAINER') || process.env.DB_DOCKER_CONTAINER || 'idesk-postgres';
        let dockerAvailable = false;
        try {
            const { stdout } = await execAsync(`docker ps --filter "name=${dockerContainer}" --format "{{.Names}}"`);
            if (stdout && stdout.includes(dockerContainer)) {
                dockerAvailable = true;
            }
        } catch {
            dockerAvailable = false;
        }

        if (dockerAvailable) {
            this.logger.log(`Using Docker container ${dockerContainer} for psql restore`);
            psqlCommand = 'docker';
            psqlArgs = ['exec', '-i', dockerContainer, 'psql', '-U', dbUser, '-d', dbName];
        } else {
            // Check host psql
            let psqlInPath = false;
            try {
                const checkCmd = process.platform === 'win32' ? 'where psql' : 'which psql';
                const { stdout } = await execAsync(checkCmd);
                if (stdout && stdout.trim()) psqlInPath = true;
            } catch {
                psqlInPath = false;
            }

            if (psqlInPath) {
                psqlCommand = 'psql';
                psqlArgs = ['-h', dbHost, '-p', String(dbPort), '-U', dbUser, '-d', dbName];
            } else {
                // Scan Windows Program Files
                const winPaths = [
                    'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
                    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
                    'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
                    'C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe',
                    'C:\\Program Files\\PostgreSQL\\13\\bin\\psql.exe',
                ];
                const found = winPaths.find(p => fsSync.existsSync(p));
                if (found) {
                    psqlCommand = found;
                    psqlArgs = ['-h', dbHost, '-p', String(dbPort), '-U', dbUser, '-d', dbName];
                } else {
                    psqlCommand = 'docker';
                    psqlArgs = ['exec', '-i', 'idesk-postgres', 'psql', '-U', dbUser, '-d', dbName];
                }
            }
        }

        const env = { ...process.env, PGPASSWORD: dbPassword };

        await new Promise<void>((resolve, reject) => {
            const child = spawn(psqlCommand, psqlArgs, {
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stderrData = '';
            child.stderr.on('data', (chunk) => {
                stderrData += chunk.toString();
            });

            child.on('error', (err) => {
                reject(new Error(`Failed to start ${psqlCommand}: ${err.message}`));
            });

            const readStream = fsSync.createReadStream(resolvedPath);

            if (isGz) {
                const gunzip = zlib.createGunzip();
                readStream.pipe(gunzip).pipe(child.stdin);
            } else {
                readStream.pipe(child.stdin);
            }

            child.on('close', (code) => {
                if (code !== 0) {
                    this.logger.warn(`psql exited with code ${code}: ${stderrData.slice(0, 300)}`);
                    if (stderrData.includes('FATAL:') || stderrData.includes('could not connect to server')) {
                        reject(new Error(`Database restore failed: ${stderrData}`));
                        return;
                    }
                }
                resolve();
            });
        });

        const durationMs = Date.now() - startTime;
        this.logger.log(`✅ Database successfully restored in ${durationMs}ms`);

        return {
            success: true,
            message: `Database berhasil di-restore dalam ${(durationMs / 1000).toFixed(1)} detik.`,
            durationMs,
        };
    }

    async restoreFromHistory(historyId: string, createSnapshot: boolean = true): Promise<{ success: boolean; message: string }> {
        const history = await this.historyRepo.findOne({
            where: { id: historyId },
            relations: ['config'],
        });

        if (!history) {
            throw new NotFoundException('Data riwayat backup tidak ditemukan');
        }

        const fsSync = await import('fs');
        const path = await import('path');

        // 1. Create pre-restore safety snapshot if requested
        if (createSnapshot && history.configId) {
            this.logger.log(`Creating pre-restore safety snapshot for config ${history.configId}...`);
            try {
                await this.executeBackup(history.configId, false);
            } catch (snapErr) {
                this.logger.warn(`Failed to create pre-restore snapshot: ${snapErr.message}`);
            }
        }

        // 2. Find local file or download from Synology NAS
        const fileName = path.basename(history.filePath || `backup_${history.id}.sql.gz`);
        const localCandidates = [
            `./backups/database/${fileName}`,
            `./backups/files/${fileName}`,
            history.filePath,
        ].filter(Boolean);

        let resolvedLocalFile = localCandidates.find(p => fsSync.existsSync(path.resolve(p!)));

        if (!resolvedLocalFile) {
            if (!history.config) {
                throw new BadRequestException('Konfigurasi Synology tidak ditemukan untuk mengunduh file backup');
            }

            const tempDir = './backups/temp';
            const tempFilePath = `${tempDir}/${fileName}`;
            this.logger.log(`Downloading backup from Synology NAS (${history.filePath}) to ${tempFilePath}...`);
            await this.downloadFromSynology(history.config, history.filePath, tempFilePath);
            resolvedLocalFile = tempFilePath;
        }

        // 3. Restore
        const result = await this.restoreDatabase(resolvedLocalFile);
        return result;
    }

    async restoreFromNas(dto: RestoreFromNasDto): Promise<{ success: boolean; message: string }> {
        const config = await this.configRepo.findOne({ where: { id: dto.configId } });
        if (!config) {
            throw new NotFoundException('Konfigurasi Synology tidak ditemukan');
        }

        const path = await import('path');
        const fileName = path.basename(dto.nasFilePath);
        const tempLocalPath = `./backups/temp/restore_nas_${Date.now()}_${fileName}`;

        // 1. Create snapshot
        if (dto.createSnapshot) {
            try {
                await this.executeBackup(config.id, false);
            } catch (err) {
                this.logger.warn(`Snapshot before restore failed: ${err.message}`);
            }
        }

        // 2. Download from NAS
        await this.downloadFromSynology(config, dto.nasFilePath, tempLocalPath);

        // 3. Restore
        const result = await this.restoreDatabase(tempLocalPath);

        // Clean up temp file
        try {
            const fs = await import('fs/promises');
            await fs.unlink(path.resolve(tempLocalPath));
        } catch {
            // Ignore unlink error
        }

        return result;
    }

    async restoreFromUploadedFile(file: Express.Multer.File, createSnapshot: boolean = true): Promise<{ success: boolean; message: string }> {
        if (!file) {
            throw new BadRequestException('File backup (.sql atau .sql.gz) wajib diunggah');
        }

        const fs = await import('fs/promises');
        const path = await import('path');

        const tempDir = './backups/temp';
        await fs.mkdir(path.resolve(tempDir), { recursive: true });
        const tempFilePath = `${tempDir}/upload_${Date.now()}_${file.originalname}`;

        await fs.writeFile(path.resolve(tempFilePath), file.buffer || (await fs.readFile(file.path)));

        // 1. Create snapshot if any active config exists
        if (createSnapshot) {
            const activeConfig = await this.configRepo.findOne({ where: { isActive: true } });
            if (activeConfig) {
                try {
                    await this.executeBackup(activeConfig.id, false);
                } catch (err) {
                    this.logger.warn(`Snapshot before restore failed: ${err.message}`);
                }
            }
        }

        // 2. Restore
        const result = await this.restoreDatabase(tempFilePath);

        // 3. Clean up
        try {
            await fs.unlink(path.resolve(tempFilePath));
            if (file.path) await fs.unlink(file.path);
        } catch {
            // Ignore cleanup error
        }

        return result;
    }
}
