import { Process, Processor, OnQueueError, OnQueueFailed } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';

export interface CreateZoomMeetingJob {
    bookingId: string;
    zoomAccountId: string;
    title: string;
    description?: string;
    startTime: Date;
    duration: number; // minutes
    participants: { email: string; name?: string }[];
}

export interface CancelZoomMeetingJob {
    bookingId: string;
    zoomMeetingId: string;
    reason?: string;
    notifyParticipants?: boolean;
}

/**
 * Processor for Zoom meeting operations
 * Handles async meeting creation and cancellation via queue
 */
@Injectable()
@Processor('zoom-meetings')
export class ZoomMeetingProcessor {
    private readonly logger = new Logger(ZoomMeetingProcessor.name);

    @Process('create-meeting')
    async handleCreateMeeting(job: Job<CreateZoomMeetingJob>): Promise<any> {
        const { bookingId, zoomAccountId, title, startTime, duration } = job.data;

        this.logger.log(`Processing create-meeting job ${job.id} for booking ${bookingId}`);

        try {
            // Import service dynamically to avoid circular dependencies
            // This will be replaced by proper DI when integrated into module
            const result = await this.processCreateMeeting(job.data);

            this.logger.log(`Meeting created for booking ${bookingId}: ${result?.joinUrl || 'success'}`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to create meeting for booking ${bookingId}: ${error.message}`);
            throw error;
        }
    }

    @Process('cancel-meeting')
    async handleCancelMeeting(job: Job<CancelZoomMeetingJob>): Promise<any> {
        const { bookingId, zoomMeetingId, reason } = job.data;

        this.logger.log(`Processing cancel-meeting job ${job.id} for meeting ${zoomMeetingId}`);

        try {
            const result = await this.processCancelMeeting(job.data);

            this.logger.log(`Meeting ${zoomMeetingId} cancelled: ${reason || 'no reason'}`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to cancel meeting ${zoomMeetingId}: ${error.message}`);
            throw error;
        }
    }

    @Process('send-reminder')
    async handleSendReminder(job: Job<{ bookingId: string; minutesBefore: number }>): Promise<any> {
        const { bookingId, minutesBefore } = job.data;

        this.logger.log(`Processing reminder job for booking ${bookingId} (${minutesBefore}min before)`);

        try {
            // Process reminder logic here
            return { success: true, bookingId, minutesBefore };
        } catch (error) {
            this.logger.error(`Failed to send reminder for booking ${bookingId}: ${error.message}`);
            throw error;
        }
    }

    @OnQueueError()
    onError(error: Error) {
        this.logger.error(`Queue error: ${error.message}`, error.stack);
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(`Job ${job.id} failed: ${error.message}`, {
            jobId: job.id,
            jobName: job.name,
            data: job.data,
            error: error.stack,
        });
    }

    /**
     * Process meeting creation
     * This is a placeholder - actual implementation would call ZoomApiAdapter
     */
    private async processCreateMeeting(data: CreateZoomMeetingJob): Promise<any> {
        // TODO: Inject ZoomApiAdapter and call createMeeting
        // For now, return placeholder - actual integration in module
        return {
            success: true,
            bookingId: data.bookingId,
            message: 'Meeting creation queued - actual creation requires ZoomApiAdapter injection',
        };
    }

    /**
     * Process meeting cancellation
     */
    private async processCancelMeeting(data: CancelZoomMeetingJob): Promise<any> {
        // TODO: Inject ZoomApiAdapter and call deleteMeeting
        return {
            success: true,
            zoomMeetingId: data.zoomMeetingId,
            message: 'Meeting cancellation queued - actual deletion requires ZoomApiAdapter injection',
        };
    }
}
