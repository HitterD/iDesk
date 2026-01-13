import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { SpreadsheetSheet } from '../entities/spreadsheet-sheet.entity';
import { SyncEngineService } from './sync-engine.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

interface SyncJobData {
    sheetId: string;
    triggeredById?: string;
}

/**
 * Scheduler service for automatic sync operations
 */
@Injectable()
export class SyncSchedulerService implements OnModuleInit {
    private readonly logger = new Logger(SyncSchedulerService.name);
    private isProcessing = false;

    constructor(
        @InjectRepository(SpreadsheetSheet)
        private readonly sheetRepo: Repository<SpreadsheetSheet>,
        private readonly syncEngine: SyncEngineService,
        @InjectQueue('google-sync')
        private readonly syncQueue: Queue<SyncJobData>,
    ) { }

    async onModuleInit() {
        this.logger.log('SyncSchedulerService initialized');
        // Clear any stale jobs on startup
        await this.syncQueue.clean(0, 'failed');
        await this.syncQueue.clean(0, 'completed');
    }

    /**
     * Check for sheets that need syncing every 30 seconds
     */
    @Cron(CronExpression.EVERY_30_SECONDS)
    async checkPendingSyncs() {
        if (this.isProcessing) {
            this.logger.debug('Sync check skipped - already processing');
            return;
        }

        try {
            this.isProcessing = true;

            const now = new Date();

            // Find sheets that need syncing based on their interval
            const sheets = await this.sheetRepo
                .createQueryBuilder('sheet')
                .innerJoinAndSelect('sheet.config', 'config')
                .where('sheet.syncEnabled = :enabled', { enabled: true })
                .andWhere('config.isActive = :active', { active: true })
                .andWhere(`(
                    sheet.lastSyncAt IS NULL 
                    OR sheet.lastSyncAt < NOW() - (sheet.syncIntervalSeconds * INTERVAL '1 second')
                )`)
                .andWhere('sheet.syncErrorCount < :maxErrors', { maxErrors: 5 })
                .orderBy('sheet.lastSyncAt', 'ASC', 'NULLS FIRST')
                .take(10) // Process max 10 sheets per cycle
                .getMany();

            if (sheets.length === 0) {
                return;
            }

            this.logger.log(`Found ${sheets.length} sheets pending sync`);

            // Queue sync jobs
            for (const sheet of sheets) {
                await this.queueSync(sheet.id);
            }

        } catch (error) {
            this.logger.error('Error checking pending syncs:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Queue a sync job for a specific sheet
     */
    async queueSync(sheetId: string, triggeredById?: string): Promise<void> {
        // Check if job already exists
        const existingJobs = await this.syncQueue.getJobs(['waiting', 'active']);
        const isDuplicate = existingJobs.some(job => job.data.sheetId === sheetId);

        if (isDuplicate) {
            this.logger.debug(`Sync job already queued for sheet ${sheetId}`);
            return;
        }

        await this.syncQueue.add(
            'sync',
            { sheetId, triggeredById },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000, // Start with 5 seconds
                },
                removeOnComplete: true,
                removeOnFail: false, // Keep failed jobs for debugging
            }
        );

        this.logger.log(`Queued sync job for sheet ${sheetId}`);
    }

    /**
     * Manual trigger for immediate sync
     */
    async triggerSync(sheetId: string, triggeredById?: string): Promise<void> {
        await this.queueSync(sheetId, triggeredById);
    }

    /**
     * Sync all enabled sheets immediately
     */
    async syncAll(triggeredById?: string): Promise<number> {
        const sheets = await this.sheetRepo.find({
            where: { syncEnabled: true },
            relations: ['config'],
        });

        const activeSheets = sheets.filter(s => s.config?.isActive);

        for (const sheet of activeSheets) {
            await this.queueSync(sheet.id, triggeredById);
        }

        return activeSheets.length;
    }

    /**
     * Reset error count for a sheet to re-enable syncing
     */
    async resetErrorCount(sheetId: string): Promise<void> {
        await this.sheetRepo.update(sheetId, {
            syncErrorCount: 0,
            lastSyncError: null,
        });
    }
}
