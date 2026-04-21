import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import {
    CreateZoomMeetingJob,
    CancelZoomMeetingJob
} from '../../../shared/queue/processors/zoom-meeting.processor';

/**
 * Service for queueing Zoom meeting operations
 * Falls back to synchronous processing if Redis/Bull is not available
 */
@Injectable()
export class ZoomQueueService {
    private readonly logger = new Logger(ZoomQueueService.name);
    private readonly isQueueEnabled: boolean;

    constructor(
        @Optional()
        @InjectQueue('zoom-meetings')
        private readonly zoomQueue?: Queue,
    ) {
        this.isQueueEnabled = !!this.zoomQueue;

        if (this.isQueueEnabled) {
            this.logger.log('Zoom queue service initialized with Bull queue');
        } else {
            this.logger.warn('Bull queue not available - operations will be processed synchronously');
        }
    }

    /**
     * Queue a meeting creation job
     */
    async queueCreateMeeting(data: CreateZoomMeetingJob): Promise<Job<CreateZoomMeetingJob> | null> {
        if (!this.isQueueEnabled) {
            this.logger.debug(`Queue disabled - create meeting for ${data.bookingId} will be synchronous`);
            return null;
        }

        try {
            const job = await this.zoomQueue!.add('create-meeting', data, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: true,
            });

            this.logger.log(`Queued create-meeting job ${job.id} for booking ${data.bookingId}`);
            return job;
        } catch (error) {
            this.logger.error(`Failed to queue create-meeting: ${error.message}`);
            return null;
        }
    }

    /**
     * Queue a meeting cancellation job
     */
    async queueCancelMeeting(data: CancelZoomMeetingJob): Promise<Job<CancelZoomMeetingJob> | null> {
        if (!this.isQueueEnabled) {
            this.logger.debug(`Queue disabled - cancel meeting ${data.zoomMeetingId} will be synchronous`);
            return null;
        }

        try {
            const job = await this.zoomQueue!.add('cancel-meeting', data, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: true,
            });

            this.logger.log(`Queued cancel-meeting job ${job.id} for meeting ${data.zoomMeetingId}`);
            return job;
        } catch (error) {
            this.logger.error(`Failed to queue cancel-meeting: ${error.message}`);
            return null;
        }
    }

    /**
     * Queue a reminder job
     */
    async queueReminder(
        bookingId: string,
        minutesBefore: number,
        scheduledTime: Date,
    ): Promise<Job<any> | null> {
        if (!this.isQueueEnabled) {
            this.logger.debug(`Queue disabled - reminder for ${bookingId} skipped`);
            return null;
        }

        const delay = scheduledTime.getTime() - Date.now();
        if (delay < 0) {
            this.logger.warn(`Reminder time already passed for booking ${bookingId}`);
            return null;
        }

        try {
            const job = await this.zoomQueue!.add(
                'send-reminder',
                { bookingId, minutesBefore },
                {
                    delay,
                    removeOnComplete: true,
                },
            );

            this.logger.log(`Queued reminder job ${job.id} for booking ${bookingId} in ${Math.round(delay / 60000)} minutes`);
            return job;
        } catch (error) {
            this.logger.error(`Failed to queue reminder: ${error.message}`);
            return null;
        }
    }

    /**
     * Get queue status
     */
    async getQueueStatus(): Promise<{
        enabled: boolean;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
    }> {
        if (!this.isQueueEnabled) {
            return { enabled: false, waiting: 0, active: 0, completed: 0, failed: 0 };
        }

        const [waiting, active, completed, failed] = await Promise.all([
            this.zoomQueue!.getWaitingCount(),
            this.zoomQueue!.getActiveCount(),
            this.zoomQueue!.getCompletedCount(),
            this.zoomQueue!.getFailedCount(),
        ]);

        return { enabled: true, waiting, active, completed, failed };
    }

    /**
     * Clean old jobs
     */
    async cleanOldJobs(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<void> {
        if (!this.isQueueEnabled) return;

        await this.zoomQueue!.clean(olderThanMs, 'completed');
        await this.zoomQueue!.clean(olderThanMs, 'failed');
        this.logger.log('Cleaned old jobs from zoom-meetings queue');
    }
}
