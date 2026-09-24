import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { WipeDomain } from '../constants/wipe-scope.constants';
import { WipePreviewService } from './wipe-preview.service';

export interface FileSweepResult {
    filesDeleted: number;
    bytesFreed: number;
    warning?: string;
}

/**
 * Removes the id-partitioned upload folders after the database transaction has
 * committed.
 *
 * Runs last and best-effort by design. Filesystem work cannot join a database
 * transaction, so deleting first would risk destroying attachments belonging to
 * rows that a rollback then restored. Orphaned files only cost disk space, and
 * StorageCleanupService already reclaims those by diffing disk against the
 * database.
 */
@Injectable()
export class WipeFileSweeperService {
    private readonly logger = new Logger(WipeFileSweeperService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly previewService: WipePreviewService,
    ) { }

    async sweep(domains: WipeDomain[]): Promise<FileSweepResult> {
        const uploadRoot = path.resolve(this.configService.get<string>('UPLOAD_DIR', './uploads'));
        const targets = this.previewService.resolveUploadDirs(domains);

        let filesDeleted = 0;
        let bytesFreed = 0;
        const failures: string[] = [];

        for (const target of targets) {
            // Never delete outside the configured upload root, whatever the
            // constants happen to say.
            const relative = path.relative(uploadRoot, target);
            if (relative.startsWith('..') || path.isAbsolute(relative) || relative.length === 0) {
                this.logger.error(`Melewati folder di luar UPLOAD_DIR: ${target}`);
                failures.push(target);
                continue;
            }

            if (!fsSync.existsSync(target)) continue;

            try {
                const stat = await fs.lstat(target);
                if (stat.isSymbolicLink()) {
                    throw new Error('target merupakan symbolic link dan ditolak demi keamanan');
                }

                const measured = await this.removeContents(target);
                filesDeleted += measured.filesDeleted;
                bytesFreed += measured.bytesFreed;
                failures.push(...measured.failures);
            } catch (error: any) {
                this.logger.warn(`Gagal membersihkan folder ${target}: ${error.message}`);
                failures.push(target);
            }
        }

        const warning =
            failures.length > 0
                ? `Sebagian file tidak dapat dihapus dari disk (${failures.join(', ')}). ` +
                `Data di database sudah terhapus; sisa file dapat dibersihkan melalui menu Storage Management.`
                : undefined;

        return { filesDeleted, bytesFreed, warning };
    }

    /**
     * Empties a folder but keeps the folder itself, since the application
     * creates these directories at boot and expects them to exist.
     */
    private async removeContents(dir: string): Promise<{
        filesDeleted: number;
        bytesFreed: number;
        failures: string[];
    }> {
        let filesDeleted = 0;
        let bytesFreed = 0;
        const failures: string[] = [];

        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            try {
                if (entry.isDirectory()) {
                    const measured = await this.measureDir(full);
                    await fs.rm(full, { recursive: true, force: true });
                    filesDeleted += measured.filesDeleted;
                    bytesFreed += measured.bytesFreed;
                } else if (entry.isFile()) {
                    const stat = await fs.stat(full);
                    await fs.rm(full, { force: true });
                    filesDeleted += 1;
                    bytesFreed += stat.size;
                } else if (entry.isSymbolicLink()) {
                    throw new Error('isi folder mengandung symbolic link dan ditolak demi keamanan');
                }
            } catch (error: any) {
                this.logger.warn(`Gagal menghapus ${full}: ${error.message}`);
                failures.push(full);
            }
        }

        return { filesDeleted, bytesFreed, failures };
    }

    private async measureDir(dir: string): Promise<{ filesDeleted: number; bytesFreed: number }> {
        let filesDeleted = 0;
        let bytesFreed = 0;

        const walk = async (current: string): Promise<void> => {
            let entries: fsSync.Dirent[];
            try {
                entries = await fs.readdir(current, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                const full = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    await walk(full);
                } else if (entry.isFile()) {
                    try {
                        const stat = await fs.stat(full);
                        filesDeleted += 1;
                        bytesFreed += stat.size;
                    } catch {
                        // Ignore files that disappear mid-walk.
                    }
                } else if (entry.isSymbolicLink()) {
                    throw new Error(`symbolic link ditolak: ${full}`);
                }
            }
        };

        await walk(dir);
        return { filesDeleted, bytesFreed };
    }
}
