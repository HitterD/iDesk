import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataWipeService } from './data-wipe.service';
import { WipeDomain } from './constants/wipe-scope.constants';
import { WIPE_CONFIRM_PHRASE } from './dto/data-wipe.dto';
import { AuditAction, AuditSeverity } from '../audit/entities/audit-log.entity';

describe('DataWipeService', () => {
    const USER_ID = 'admin-1';

    let previewService: any;
    let executorService: any;
    let backupService: any;
    let fileSweeper: any;
    let auditService: any;
    let service: DataWipeService;

    /** Counts returned by the preview; mutate to simulate concurrent activity. */
    let tableCounts: { table: string; label: string; rows: number; outOfScope: boolean }[];

    beforeEach(() => {
        tableCounts = [
            { table: 'tickets', label: 'Tiket', rows: 10, outOfScope: false },
            { table: 'ticket_messages', label: 'Pesan', rows: 25, outOfScope: false },
        ];

        previewService = {
            countTables: jest.fn(async () => tableCounts),
            countCounterResets: jest.fn(async () => []),
            measureFiles: jest.fn(async () => ({ folders: [], fileCount: 0, bytes: 0 })),
        };
        executorService = {
            execute: jest.fn(async () => ({
                deleted: { tickets: 10, ticket_messages: 25 },
                totalRowsDeleted: 35,
                countersReset: 0,
            })),
        };
        backupService = {
            createBackup: jest.fn(async () => ({
                filePath: '/backups/pre-wipe/dump.sql.gz',
                fileSizeBytes: 2048,
            })),
        };
        fileSweeper = {
            sweep: jest.fn(async () => ({ filesDeleted: 3, bytesFreed: 900 })),
        };
        auditService = {
            log: jest.fn(async () => ({ id: 'audit-1' })),
        };

        service = new DataWipeService(
            previewService,
            executorService,
            backupService,
            fileSweeper,
            auditService,
        );
    });

    const runPreview = async () => service.preview([WipeDomain.TICKETING], USER_ID);

    describe('preview', () => {
        it('issues a token with an expiry and the counted totals', async () => {
            const preview = await runPreview();
            expect(preview.token).toBeTruthy();
            expect(preview.totalRows).toBe(35);
            expect(new Date(preview.expiresAt).getTime()).toBeGreaterThan(Date.now());
        });

        it('deletes nothing', async () => {
            await runPreview();
            expect(executorService.execute).not.toHaveBeenCalled();
            expect(backupService.createBackup).not.toHaveBeenCalled();
            expect(fileSweeper.sweep).not.toHaveBeenCalled();
        });

        it('warns that ticket numbering restarts', async () => {
            const preview = await runPreview();
            expect(preview.warnings.join(' ')).toContain('0001');
        });

        it('warns about installed hardware assets that will be destroyed', async () => {
            tableCounts = [
                { table: 'hardware_assets', label: 'Aset', rows: 4, outOfScope: false },
            ];
            const preview = await service.preview([WipeDomain.HARDWARE], USER_ID);
            expect(preview.warnings.join(' ')).toContain('4 aset hardware');
        });

        it('does not warn about assets when none exist', async () => {
            tableCounts = [
                { table: 'hardware_assets', label: 'Aset', rows: 0, outOfScope: false },
            ];
            const preview = await service.preview([WipeDomain.HARDWARE], USER_ID);
            expect(preview.warnings.join(' ')).not.toContain('aset hardware');
        });
    });

    describe('confirmation and token validation', () => {
        it('rejects a wrong confirmation phrase', async () => {
            const preview = await runPreview();
            await expect(service.execute(preview.token, 'hapus semua data', USER_ID)).rejects.toThrow(
                BadRequestException,
            );
            expect(executorService.execute).not.toHaveBeenCalled();
        });

        it('rejects an unknown token', async () => {
            await expect(
                service.execute('not-a-token', WIPE_CONFIRM_PHRASE, USER_ID),
            ).rejects.toThrow(BadRequestException);
            expect(backupService.createBackup).not.toHaveBeenCalled();
        });

        it('rejects a token issued to a different admin', async () => {
            const preview = await runPreview();
            await expect(
                service.execute(preview.token, WIPE_CONFIRM_PHRASE, 'other-admin'),
            ).rejects.toThrow(BadRequestException);
            expect(executorService.execute).not.toHaveBeenCalled();
        });

        it('rejects an expired token', async () => {
            const preview = await runPreview();
            jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000);
            await expect(
                service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID),
            ).rejects.toThrow(BadRequestException);
            jest.spyOn(Date, 'now').mockRestore();
        });

        it('consumes the token so it cannot be replayed', async () => {
            const preview = await runPreview();
            await service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID);
            await expect(
                service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID),
            ).rejects.toThrow(BadRequestException);
            expect(executorService.execute).toHaveBeenCalledTimes(1);
        });
    });

    describe('drift detection', () => {
        it('aborts when row counts changed since the preview', async () => {
            const preview = await runPreview();
            tableCounts = [
                { table: 'tickets', label: 'Tiket', rows: 11, outOfScope: false },
                { table: 'ticket_messages', label: 'Pesan', rows: 25, outOfScope: false },
            ];
            await expect(
                service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID),
            ).rejects.toThrow(ConflictException);
            expect(backupService.createBackup).not.toHaveBeenCalled();
            expect(executorService.execute).not.toHaveBeenCalled();
        });

        it('proceeds when counts are unchanged', async () => {
            const preview = await runPreview();
            const result = await service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID);
            expect(result.totalRowsDeleted).toBe(35);
        });
    });

    describe('backup gate', () => {
        it('does not delete anything when the safety backup fails', async () => {
            backupService.createBackup.mockRejectedValue(new Error('pg_dump tidak ditemukan'));
            const preview = await runPreview();
            await expect(
                service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID),
            ).rejects.toThrow('pg_dump tidak ditemukan');
            expect(executorService.execute).not.toHaveBeenCalled();
            expect(fileSweeper.sweep).not.toHaveBeenCalled();
        });

        it('takes the backup before deleting', async () => {
            const order: string[] = [];
            backupService.createBackup.mockImplementation(async () => {
                order.push('backup');
                return { filePath: '/dump.gz', fileSizeBytes: 1 };
            });
            executorService.execute.mockImplementation(async () => {
                order.push('delete');
                return { deleted: {}, totalRowsDeleted: 0, countersReset: 0 };
            });
            const preview = await runPreview();
            await service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID);
            expect(order).toEqual(['backup', 'delete']);
        });

        it('sweeps files only after the database delete succeeds', async () => {
            executorService.execute.mockRejectedValue(new Error('constraint violation'));
            const preview = await runPreview();
            await expect(
                service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID),
            ).rejects.toThrow('constraint violation');
            expect(fileSweeper.sweep).not.toHaveBeenCalled();
        });
    });

    describe('concurrency', () => {
        it('rejects a second wipe while one is running', async () => {
            let release: () => void = () => undefined;
            executorService.execute.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        release = () =>
                            resolve({ deleted: {}, totalRowsDeleted: 0, countersReset: 0 });
                    }),
            );

            const first = await runPreview();
            const second = await runPreview();

            const running = service.execute(first.token, WIPE_CONFIRM_PHRASE, USER_ID);
            await new Promise((r) => setImmediate(r));

            await expect(
                service.execute(second.token, WIPE_CONFIRM_PHRASE, USER_ID),
            ).rejects.toThrow(ConflictException);

            release();
            await running;
            expect(service.isWipeInProgress()).toBe(false);
        });

        it('releases the lock after a failure', async () => {
            executorService.execute.mockRejectedValue(new Error('boom'));
            const preview = await runPreview();
            await expect(
                service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID),
            ).rejects.toThrow('boom');
            expect(service.isWipeInProgress()).toBe(false);
        });
    });

    describe('audit trail', () => {
        it('writes a CRITICAL audit entry before any data is destroyed', async () => {
            const order: string[] = [];
            auditService.log.mockImplementation(async () => {
                order.push('audit');
                return { id: 'audit-1' };
            });
            backupService.createBackup.mockImplementation(async () => {
                order.push('backup');
                return { filePath: '/dump.gz', fileSizeBytes: 1 };
            });

            const preview = await runPreview();
            await service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID);

            expect(order[0]).toBe('audit');
            expect(auditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: AuditAction.SYSTEM_DATA_WIPE,
                    severity: AuditSeverity.CRITICAL,
                }),
            );
        });

        it('records the backup path and deleted counts on success', async () => {
            const preview = await runPreview();
            const result = await service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID);

            expect(result.backupPath).toBe('/backups/pre-wipe/dump.sql.gz');
            expect(result.filesDeleted).toBe(3);
            expect(auditService.log).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    newValue: expect.objectContaining({ result: 'SUCCESS' }),
                }),
            );
        });

        it('records a failure entry when the wipe aborts', async () => {
            executorService.execute.mockRejectedValue(new Error('constraint violation'));
            const preview = await runPreview();
            await expect(
                service.execute(preview.token, WIPE_CONFIRM_PHRASE, USER_ID),
            ).rejects.toThrow();

            expect(auditService.log).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    newValue: expect.objectContaining({ result: 'FAILED' }),
                }),
            );
        });
    });
});
