import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { randomUUID, createHash } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditSeverity } from '../audit/entities/audit-log.entity';
import {
    WIPE_CONFIRM_PHRASE,
    WipeExecuteResult,
    WipePreviewResult,
    WipeTablePreview,
} from './dto/data-wipe.dto';
import {
    WIPE_DOMAIN_LABELS,
    WipeDomain,
    assertWipeScopeIntegrity,
} from './constants/wipe-scope.constants';
import { PreWipeBackupService } from './services/pre-wipe-backup.service';
import { WipeExecutorService } from './services/wipe-executor.service';
import { WipeFileSweeperService } from './services/wipe-file-sweeper.service';
import { WipePreviewService } from './services/wipe-preview.service';

/** How long a preview stays valid before the operator must run it again. */
const PREVIEW_TTL_MS = 5 * 60 * 1000;

interface PreviewToken {
    token: string;
    domains: WipeDomain[];
    /** Fingerprint of the counted rows, used to detect drift before deleting. */
    fingerprint: string;
    totalRows: number;
    issuedAt: number;
    expiresAt: number;
    issuedByUserId: string;
}

@Injectable()
export class DataWipeService {
    private readonly logger = new Logger(DataWipeService.name);

    /**
     * In-process lock. Sufficient for the single-instance deployment this runs
     * on; if the backend is ever scaled horizontally this must become a
     * database advisory lock, because two instances would each hold their own.
     */
    private wipeInProgress = false;

    private previewTokens = new Map<string, PreviewToken>();

    constructor(
        private readonly previewService: WipePreviewService,
        private readonly executorService: WipeExecutorService,
        private readonly backupService: PreWipeBackupService,
        private readonly fileSweeper: WipeFileSweeperService,
        private readonly auditService: AuditService,
    ) {
        // Fails application boot rather than a production wipe if the allowlist
        // and the protected-table list ever overlap.
        assertWipeScopeIntegrity();
    }

    async preview(domains: WipeDomain[], userId: string): Promise<WipePreviewResult> {
        const uniqueDomains = [...new Set(domains)];

        const tables = await this.previewService.countTables(uniqueDomains);
        const counterResets = await this.previewService.countCounterResets();
        const files = await this.previewService.measureFiles(uniqueDomains);
        const totalRows = tables.reduce((sum, t) => sum + t.rows, 0);

        this.pruneExpiredTokens();

        const token: PreviewToken = {
            token: randomUUID(),
            domains: uniqueDomains,
            fingerprint: this.fingerprint(tables),
            totalRows,
            issuedAt: Date.now(),
            expiresAt: Date.now() + PREVIEW_TTL_MS,
            issuedByUserId: userId,
        };
        this.previewTokens.set(token.token, token);

        return {
            token: token.token,
            expiresAt: new Date(token.expiresAt).toISOString(),
            domains: uniqueDomains,
            tables,
            totalRows,
            files,
            counterResets,
            warnings: this.buildWarnings(uniqueDomains, tables),
        };
    }

    async execute(
        tokenValue: string,
        confirmPhrase: string,
        userId: string,
        request?: Request,
    ): Promise<WipeExecuteResult> {
        if (confirmPhrase !== WIPE_CONFIRM_PHRASE) {
            throw new BadRequestException(
                `Frasa konfirmasi tidak sesuai. Ketik persis: ${WIPE_CONFIRM_PHRASE}`,
            );
        }

        const token = this.previewTokens.get(tokenValue);
        if (!token) {
            throw new BadRequestException(
                'Token pratinjau tidak dikenali. Jalankan pratinjau terlebih dahulu.',
            );
        }
        if (Date.now() > token.expiresAt) {
            this.previewTokens.delete(tokenValue);
            throw new BadRequestException(
                'Token pratinjau sudah kedaluwarsa. Jalankan pratinjau ulang sebelum mengeksekusi.',
            );
        }
        if (token.issuedByUserId !== userId) {
            throw new BadRequestException(
                'Token pratinjau diterbitkan untuk akun lain. Jalankan pratinjau dengan akun Anda sendiri.',
            );
        }

        if (this.wipeInProgress) {
            throw new ConflictException(
                'Proses wipe data sedang berjalan. Tunggu hingga proses tersebut selesai.',
            );
        }
        this.wipeInProgress = true;

        const startedAt = Date.now();

        try {
            // Re-count and compare: what was approved must equal what will happen.
            const currentTables = await this.previewService.countTables(token.domains);
            if (this.fingerprint(currentTables) !== token.fingerprint) {
                const currentTotal = currentTables.reduce((sum, t) => sum + t.rows, 0);
                throw new ConflictException(
                    `Data berubah sejak pratinjau dibuat (${token.totalRows} baris menjadi ${currentTotal} baris). ` +
                    'Wipe dibatalkan demi keamanan. Jalankan pratinjau ulang untuk melihat kondisi terbaru.',
                );
            }

            // Audit first: audit_logs.userId is ON DELETE SET NULL and the row
            // must survive whatever happens next.
            const auditLog = await this.auditService.log({
                userId,
                action: AuditAction.SYSTEM_DATA_WIPE,
                entityType: 'system',
                entityId: 'data-wipe',
                severity: AuditSeverity.CRITICAL,
                newValue: {
                    domains: token.domains,
                    expectedRows: token.totalRows,
                    startedAt: new Date(startedAt).toISOString(),
                },
                description: `Wipe data transaksional untuk domain: ${token.domains
                    .map((d) => WIPE_DOMAIN_LABELS[d])
                    .join(', ')}`,
                request,
            });

            // Blocking safety backup. A failure here aborts before any delete.
            const backup = await this.backupService.createBackup();

            const outcome = await this.executorService.execute(token.domains);

            // Filesystem sweep only after the transaction has committed.
            const sweep = await this.fileSweeper.sweep(token.domains);

            const durationMs = Date.now() - startedAt;

            // The database and file operations have already completed at this point.
            // A logging outage must not make a successful destructive operation look
            // like a failed one, nor trigger a misleading retry from the operator.
            try {
                await this.auditService.log({
                    userId,
                    action: AuditAction.SYSTEM_DATA_WIPE,
                    entityType: 'system',
                    entityId: 'data-wipe',
                    severity: AuditSeverity.CRITICAL,
                    newValue: {
                        domains: token.domains,
                        backupPath: backup.filePath,
                        backupSizeBytes: backup.fileSizeBytes,
                        deleted: outcome.deleted,
                        totalRowsDeleted: outcome.totalRowsDeleted,
                        countersReset: outcome.countersReset,
                        filesDeleted: sweep.filesDeleted,
                        bytesFreed: sweep.bytesFreed,
                        durationMs,
                        result: 'SUCCESS',
                    },
                    description:
                        `Wipe data selesai: ${outcome.totalRowsDeleted} baris dihapus, ` +
                        `${sweep.filesDeleted} file dibersihkan. Backup: ${backup.filePath}`,
                    request,
                });
            } catch (auditError: any) {
                this.logger.error(`Wipe selesai tetapi audit SUCCESS gagal ditulis: ${auditError.message}`);
            }

            this.previewTokens.delete(tokenValue);

            return {
                backupPath: backup.filePath,
                backupSizeBytes: backup.fileSizeBytes,
                deleted: outcome.deleted,
                totalRowsDeleted: outcome.totalRowsDeleted,
                countersReset: outcome.countersReset,
                filesDeleted: sweep.filesDeleted,
                bytesFreed: sweep.bytesFreed,
                fileSweepWarning: sweep.warning,
                auditLogId: auditLog.id,
                durationMs,
            };
        } catch (error: any) {
            await this.auditService
                .log({
                    userId,
                    action: AuditAction.SYSTEM_DATA_WIPE,
                    entityType: 'system',
                    entityId: 'data-wipe',
                    severity: AuditSeverity.CRITICAL,
                    newValue: {
                        domains: token.domains,
                        result: 'FAILED',
                        error: error.message,
                        durationMs: Date.now() - startedAt,
                    },
                    description: `Wipe data gagal: ${error.message}`,
                    request,
                })
                .catch((auditError: any) =>
                    this.logger.error(`Wipe gagal dan audit FAILED tidak tertulis: ${auditError.message}`),
                );
            throw error;
        } finally {
            this.wipeInProgress = false;
        }
    }

    /** True while a wipe is running, surfaced so the UI can disable its button. */
    isWipeInProgress(): boolean {
        return this.wipeInProgress;
    }

    /**
     * Stable hash of table/row pairs. Any insert or delete between preview and
     * execute changes this, which is what triggers the drift abort.
     */
    private fingerprint(tables: WipeTablePreview[]): string {
        const canonical = [...tables]
            .sort((a, b) => a.table.localeCompare(b.table))
            .map((t) => `${t.table}:${t.rows}`)
            .join('|');
        return createHash('sha256').update(canonical).digest('hex');
    }

    private buildWarnings(domains: WipeDomain[], tables: WipeTablePreview[]): string[] {
        const warnings: string[] = [];

        const outOfScope = tables.filter((t) => t.outOfScope && t.rows > 0);
        if (outOfScope.length > 0) {
            warnings.push(
                `${outOfScope.length} tabel di luar domain yang dipilih ikut dibersihkan karena terikat pada data tersebut.`,
            );
        }

        const assets = tables.find((t) => t.table === 'hardware_assets');
        if (assets && assets.rows > 0) {
            warnings.push(
                `${assets.rows} aset hardware terpasang akan ikut dihapus. Pastikan tidak ada aset produksi asli pada daftar ini.`,
            );
        }

        const credentials = tables.find((t) => t.table === 'eform_credentials');
        if (credentials && credentials.rows > 0) {
            warnings.push(
                `${credentials.rows} kredensial E-Form terenkripsi akan dihapus permanen dan tidak dapat dipulihkan dari sistem.`,
            );
        }

        if (domains.includes(WipeDomain.TICKETING)) {
            warnings.push('Nomor tiket akan dimulai ulang dari urutan 0001.');
        }
        if (domains.includes(WipeDomain.HARDWARE)) {
            warnings.push('Nomor Hardware Request akan dimulai ulang dari HR-<tahun>-0001.');
        }

        return warnings;
    }

    private pruneExpiredTokens(): void {
        const now = Date.now();
        for (const [key, value] of this.previewTokens.entries()) {
            if (now > value.expiresAt) {
                this.previewTokens.delete(key);
            }
        }
    }
}
