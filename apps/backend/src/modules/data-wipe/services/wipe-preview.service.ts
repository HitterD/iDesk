import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import {
    COUNTER_RESETS,
    WIPE_UPLOAD_DIRS,
    WipeDomain,
    WipeTableSpec,
    buildWipePlan,
} from '../constants/wipe-scope.constants';
import { WipeFilePreview, WipeTablePreview } from '../dto/data-wipe.dto';

/**
 * Counts what a wipe would remove, without removing anything.
 *
 * The same counting routine backs both the preview shown to the operator and
 * the re-count performed at execute time, so a drift between "what you approved"
 * and "what is about to happen" is detectable rather than silent.
 */
@Injectable()
export class WipePreviewService {
    private readonly logger = new Logger(WipePreviewService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly configService: ConfigService,
    ) { }

    /** Row counts per table, in the plan's delete order. */
    async countTables(domains: WipeDomain[]): Promise<WipeTablePreview[]> {
        const plan = buildWipePlan(domains);
        const results: WipeTablePreview[] = [];

        for (const spec of plan) {
            results.push({
                table: spec.table,
                label: spec.label,
                rows: await this.countRows(spec),
                outOfScope: spec.outOfScope === true,
                reason: spec.reason,
            });
        }

        return results;
    }

    /**
     * Counts rows a spec would delete. Tickets carry a @DeleteDateColumn, so a
     * plain repository count would hide soft-deleted rows that a hard wipe still
     * removes; raw SQL sees every row.
     */
    private async countRows(spec: WipeTableSpec): Promise<number> {
        const where = spec.where ? ` WHERE ${spec.where}` : '';
        try {
            const rows = await this.dataSource.query(
                `SELECT COUNT(*)::int AS count FROM "${spec.table}"${where}`,
            );
            return Number(rows?.[0]?.count ?? 0);
        } catch (error: any) {
            // Fail closed: execute uses the same allowlist and would fail inside
            // its transaction if a scoped table is absent. Do not show a false
            // zero-count preview that looks safe to approve.
            this.logger.error(`Gagal menghitung baris tabel ${spec.table}: ${error.message}`);
            throw new Error(
                `Pratinjau tidak dapat dibuat karena tabel ${spec.table} tidak tersedia atau tidak dapat dibaca.`,
            );
        }
    }

    /** Counter columns that will be zeroed, with how many config rows are affected. */
    async countCounterResets(): Promise<{ table: string; column: string; label: string; rows: number }[]> {
        const results = [];
        for (const counter of COUNTER_RESETS) {
            let rows = 0;
            try {
                const res = await this.dataSource.query(
                    `SELECT COUNT(*)::int AS count FROM "${counter.table}" WHERE "${counter.column}" <> 0`,
                );
                rows = Number(res?.[0]?.count ?? 0);
            } catch (error: any) {
                this.logger.error(`Gagal menghitung counter ${counter.table}.${counter.column}: ${error.message}`);
                throw new Error(
                    `Pratinjau tidak dapat dibuat karena counter ${counter.table}.${counter.column} tidak tersedia atau tidak dapat dibaca.`,
                );
            }
            results.push({ ...counter, rows });
        }
        return results;
    }

    /** Absolute paths of upload folders in scope for the selected domains. */
    resolveUploadDirs(domains: WipeDomain[]): string[] {
        const uploadRoot = path.resolve(this.configService.get<string>('UPLOAD_DIR', './uploads'));
        return domains
            .flatMap((domain) => WIPE_UPLOAD_DIRS[domain])
            .map((sub) => path.join(uploadRoot, sub));
    }

    /** Disk usage of the id-partitioned upload folders that will be swept. */
    async measureFiles(domains: WipeDomain[]): Promise<WipeFilePreview> {
        const dirs = this.resolveUploadDirs(domains);
        let fileCount = 0;
        let bytes = 0;
        const present: string[] = [];

        for (const dir of dirs) {
            if (!fsSync.existsSync(dir)) continue;
            present.push(dir);
            const measured = await this.measureDir(dir);
            fileCount += measured.fileCount;
            bytes += measured.bytes;
        }

        return { folders: present, fileCount, bytes };
    }

    private async measureDir(dir: string): Promise<{ fileCount: number; bytes: number }> {
        let fileCount = 0;
        let bytes = 0;

        const walk = async (current: string): Promise<void> => {
            let entries: fsSync.Dirent[];
            try {
                entries = await fs.readdir(current, { withFileTypes: true });
            } catch (error: any) {
                this.logger.warn(`Gagal membaca folder ${current}: ${error.message}`);
                return;
            }

            for (const entry of entries) {
                const full = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    await walk(full);
                } else if (entry.isFile()) {
                    try {
                        const stat = await fs.stat(full);
                        fileCount += 1;
                        bytes += stat.size;
                    } catch {
                        // File vanished between readdir and stat — ignore.
                    }
                }
            }
        };

        await walk(dir);
        return { fileCount, bytes };
    }
}
