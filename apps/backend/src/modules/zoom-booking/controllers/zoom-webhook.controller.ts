import {
    Controller,
    Post,
    Body,
    Headers,
    Logger,
    HttpCode,
    HttpStatus,
    UnauthorizedException,
    InternalServerErrorException,
} from '@nestjs/common';
import { timingSafeEqual, createHmac } from 'crypto';
import { ApiTags, ApiOperation, ApiExcludeController } from '@nestjs/swagger';
import { ZoomSyncService } from '../services/zoom-sync.service';

/**
 * Zoom Webhook Controller
 * Handles webhook events from Zoom when meetings end, participants join/leave, etc.
 * 
 * To use this controller:
 * 1. Create a Webhook-only App in Zoom Marketplace
 * 2. Set Event Notification Endpoint URL to: https://yourdomain.com/api/zoom-webhooks
 * 3. Enable events: meeting.ended, participant.joined, participant.left
 * 4. Copy the Secret Token and set ZOOM_WEBHOOK_SECRET in .env
 */
@ApiTags('Zoom Webhooks')
@ApiExcludeController() // Hide from Swagger docs (security)
@Controller('zoom-webhooks')
export class ZoomWebhookController {
    private readonly logger = new Logger(ZoomWebhookController.name);

    constructor(private readonly syncService: ZoomSyncService) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Handle Zoom webhook events' })
    async handleWebhook(
        @Body() body: any,
        @Headers('x-zm-signature') signature: string,
        @Headers('x-zm-request-timestamp') timestamp: string,
    ) {
        const webhookSecret = process.env.ZOOM_WEBHOOK_SECRET;
        if (!webhookSecret || !this.validateSignature(body, signature, timestamp, webhookSecret)) {
            this.logger.warn('Rejected Zoom webhook with invalid signature');
            throw new UnauthorizedException('Invalid webhook signature');
        }

        if (!body || typeof body !== 'object' || typeof body.event !== 'string') {
            throw new UnauthorizedException('Invalid webhook payload');
        }

        const event = body.event;
        const payload = body.payload;

        this.logger.log(`Received Zoom webhook event: ${event}`);

        try {
            switch (event) {
                case 'endpoint.url_validation':
                    // Zoom Challenge-Response during webhook setup
                    return this.handleUrlValidation(body);

                case 'meeting.created':
                    await this.syncService.handleWebhookMeetingCreated(payload);
                    break;

                case 'meeting.updated':
                    await this.syncService.handleWebhookMeetingUpdated(payload);
                    break;

                case 'meeting.deleted':
                    await this.syncService.handleWebhookMeetingDeleted(payload);
                    break;

                case 'meeting.ended':
                    await this.handleMeetingEnded(payload);
                    break;

                case 'meeting.participant_joined':
                    await this.handleParticipantJoined(payload);
                    break;

                case 'meeting.participant_left':
                    await this.handleParticipantLeft(payload);
                    break;

                case 'meeting.started':
                    await this.handleMeetingStarted(payload);
                    break;

                default:
                    this.logger.debug(`Unhandled webhook event: ${event}`);
            }

            return { status: 'success' };
        } catch (error) {
            if (error instanceof UnauthorizedException) throw error;
            this.logger.error(`Error handling webhook: ${error instanceof Error ? error.message : 'unknown error'}`);
            throw new InternalServerErrorException('Webhook processing failed');
        }
    }

    /**
     * URL validation for Zoom webhook setup
     * https://developers.zoom.us/docs/api/rest/webhook-reference/#validate-your-webhook-endpoint
     */
    private handleUrlValidation(body: any): any {
        const crypto = require('crypto');
        const plainToken = body.payload.plainToken;
        const encryptedToken = crypto
            .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET || '')
            .update(plainToken)
            .digest('hex');

        return {
            plainToken,
            encryptedToken,
        };
    }

    /**
     * Handle meeting.ended event
     */
    private async handleMeetingEnded(payload: any): Promise<void> {
        const { object } = payload;
        const meetingId = object.id;
        const duration = object.duration;
        const endTime = object.end_time;

        this.logger.log(`Meeting ${meetingId} ended. Duration: ${duration}min`);

        // TODO: Update booking status to 'COMPLETED'
        // TODO: Optionally send follow-up notification to organizer
    }

    /**
     * Handle participant.joined event
     */
    private async handleParticipantJoined(payload: any): Promise<void> {
        const { object } = payload;
        const meetingId = object.id;
        const participant = object.participant;

        this.logger.log(`Participant ${participant.user_name} joined meeting ${meetingId}`);

        // TODO: Update participant status in zoom_participants table
        // TODO: Optionally track attendance
    }

    /**
     * Handle participant.left event
     */
    private async handleParticipantLeft(payload: any): Promise<void> {
        const { object } = payload;
        const meetingId = object.id;
        const participant = object.participant;

        this.logger.log(`Participant ${participant.user_name} left meeting ${meetingId}`);

        // TODO: Update participant leave time
    }

    /**
     * Handle meeting.started event
     */
    private async handleMeetingStarted(payload: any): Promise<void> {
        const { object } = payload;
        const meetingId = object.id;

        this.logger.log(`Meeting ${meetingId} started`);

        // TODO: Update booking status to 'IN_PROGRESS' if not already
    }

    /**
     * Validate Zoom webhook signature
     * https://developers.zoom.us/docs/api/rest/webhook-reference/#verify-webhook-events
     */
    private validateSignature(
        body: unknown,
        signature: string,
        timestamp: string,
        secret: string,
    ): boolean {
        if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
        const timestampMs = Number(timestamp) * 1000;
        if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false;

        const message = `v0:${timestamp}:${JSON.stringify(body)}`;
        const hash = createHmac('sha256', secret).update(message).digest('hex');
        const expected = Buffer.from(`v0=${hash}`);
        const provided = Buffer.from(signature);
        return expected.length === provided.length && timingSafeEqual(expected, provided);
    }
}
