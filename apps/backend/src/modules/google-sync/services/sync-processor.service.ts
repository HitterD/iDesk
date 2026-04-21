import { Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SyncEngineService } from './sync-engine.service';

interface SyncJobData {
    sheetId: string;
    triggeredById?: string;
}

/**
 * Bull queue processor for sync jobs
 */
@Processor('google-sync')
export class SyncProcessor {
    private readonly logger = new Logger(SyncProcessor.name);

    constructor(private readonly syncEngine: SyncEngineService) { }

    @Process('sync')
    async handleSync(job: Job<SyncJobData>) {
        this.logger.log(`Processing sync job ${job.id} for sheet ${job.data.sheetId}`);

        const result = await this.syncEngine.syncSheet(
            job.data.sheetId,
            job.data.triggeredById,
        );

        return result;
    }

    @OnQueueActive()
    onActive(job: Job) {
        this.logger.debug(`Job ${job.id} started`);
    }

    @OnQueueCompleted()
    onCompleted(job: Job, result: unknown) {
        this.logger.log(`Job ${job.id} completed`);
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(`Job ${job.id} failed: ${error.message}`);
    }
}
