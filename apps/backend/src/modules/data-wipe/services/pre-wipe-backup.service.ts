import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface PreWipeBackupResult {
    filePath: string;
    fileSizeBytes: number;
}

/**
 * Blocking local pg_dump taken immediately before a wipe.
 *
 * Deliberately standalone rather than reusing SynologyService.executeBackup():
 * that path always uploads to the NAS and throws when the NAS is unreachable,
 * which would let a network problem block a go-live even though the dump that
 * actually protects the data was already written. It also requires a
 * backup_configurations row to exist, and records the *remote* path in
 * backup_history — neither of which helps someone restoring in a hurry.
 *
 * Nothing here touches backup_configurations, backup_history, or the NAS, so
 * scheduled backups and their archives are entirely unaffected.
 */
@Injectable()
export class PreWipeBackupService {
    private readonly logger = new Logger(PreWipeBackupService.name);

    constructor(private readonly configService: ConfigService) { }

    async createBackup(): Promise<PreWipeBackupResult> {
        const dbHost = this.configService.get<string>('DB_HOST', 'localhost');
        const dbPort = Number(this.configService.get<string>('DB_PORT', '5432'));
        const dbUser = this.configService.get<string>('DB_USERNAME', 'postgres');
        const dbPassword = this.configService.get<string>('DB_PASSWORD', '');
        const dbName = this.configService.get<string>('DB_DATABASE', 'idesk');

        const backupDir = path.resolve('./backups/pre-wipe');
        await fs.mkdir(backupDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(backupDir, `idesk_pre_wipe_${timestamp}.sql.gz`);

        const { command, args, attempted } = this.resolvePgDump(dbHost, dbPort, dbUser, dbName);
        if (!command) {
            throw new ServiceUnavailableException(
                `Wipe dibatalkan: perintah pg_dump tidak ditemukan sehingga backup pengaman tidak dapat dibuat. ` +
                `Lokasi yang sudah dicoba: ${attempted.join(', ')}.`,
            );
        }

        this.logger.log(`Membuat backup pra-wipe: ${filePath}`);

        try {
            await this.runDump(command, args, dbPassword, filePath);
        } catch (error: any) {
            // Never leave a truncated dump behind that could be mistaken for a good one.
            await fs.rm(filePath, { force: true }).catch(() => undefined);
            throw new ServiceUnavailableException(
                `Wipe dibatalkan: pembuatan backup pengaman gagal. ${error.message}`,
            );
        }

        const stats = await fs.stat(filePath);
        if (stats.size === 0) {
            await fs.rm(filePath, { force: true }).catch(() => undefined);
            throw new ServiceUnavailableException(
                'Wipe dibatalkan: file backup pengaman kosong, isi database tidak berhasil dibaca.',
            );
        }

        this.logger.log(`Backup pra-wipe selesai (${stats.size} bytes): ${filePath}`);
        return { filePath, fileSizeBytes: stats.size };
    }

    /**
     * Locates pg_dump the same way SynologyService does — PATH first, then the
     * standard Windows install locations, then a docker exec fallback — so both
     * paths succeed and fail under the same conditions.
     */
    private resolvePgDump(
        host: string,
        port: number,
        user: string,
        database: string,
    ): { command: string | null; args: string[]; attempted: string[] } {
        const baseArgs = ['-h', host, '-p', String(port), '-U', user, '-d', database, '-F', 'p'];
        const attempted: string[] = [];

        // An explicit override wins, exactly as in SynologyService: an operator who
        // pinned a binary there did so because PATH resolution was wrong for them.
        const configured = this.configService.get<string>('PG_DUMP_PATH') || process.env.PG_DUMP_PATH;
        if (configured) {
            attempted.push(configured);
            if (fsSync.existsSync(configured)) {
                return { command: configured, args: baseArgs, attempted };
            }
        }

        attempted.push('PATH');
        if (this.isOnPath('pg_dump')) {
            return { command: 'pg_dump', args: baseArgs, attempted };
        }

        for (const version of ['17', '16', '15', '14', '13']) {
            const candidate = `C:\\Program Files\\PostgreSQL\\${version}\\bin\\pg_dump.exe`;
            attempted.push(candidate);
            if (fsSync.existsSync(candidate)) {
                return { command: candidate, args: baseArgs, attempted };
            }
        }

        attempted.push('docker exec idesk-postgres');
        if (this.isOnPath('docker')) {
            return {
                command: 'docker',
                args: ['exec', '-i', 'idesk-postgres', 'pg_dump', '-U', user, '-d', database, '-F', 'p'],
                attempted,
            };
        }

        return { command: null, args: [], attempted };
    }

    private isOnPath(binary: string): boolean {
        const pathVar = process.env.PATH || '';
        const separator = process.platform === 'win32' ? ';' : ':';
        const extensions = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];

        return pathVar
            .split(separator)
            .filter((dir) => dir.length > 0)
            .some((dir) =>
                extensions.some((ext) => {
                    try {
                        return fsSync.existsSync(path.join(dir, `${binary}${ext}`));
                    } catch {
                        return false;
                    }
                }),
            );
    }

    private runDump(
        command: string,
        args: string[],
        password: string,
        destination: string,
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const gzip = zlib.createGzip({ level: 6 });
            const output = fsSync.createWriteStream(destination);
            let settled = false;
            let processExited = false;
            let outputFinished = false;
            let exitCode: number | null = null;

            const fail = (error: Error) => {
                if (settled) return;
                settled = true;
                output.destroy();
                reject(error);
            };

            const resolveWhenComplete = () => {
                if (settled || !processExited || !outputFinished) return;
                settled = true;
                resolve();
            };

            const child = spawn(command, args, {
                env: { ...process.env, PGPASSWORD: password },
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            let stderr = '';
            child.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });

            child.on('error', (err) => fail(new Error(`Gagal menjalankan ${command}: ${err.message}`)));
            gzip.on('error', fail);
            child.stdout.pipe(gzip).pipe(output);
            output.on('error', fail);
            output.on('finish', () => {
                outputFinished = true;
                resolveWhenComplete();
            });

            child.on('close', (code) => {
                exitCode = code;
                processExited = true;
                if (exitCode !== 0) {
                    fail(new Error(`${command} keluar dengan kode ${exitCode}: ${stderr.trim()}`));
                    return;
                }
                // Both signals are observed independently: either one may arrive
                // first, but the dump is safe only after both have completed.
                resolveWhenComplete();
            });
        });
    }
}
