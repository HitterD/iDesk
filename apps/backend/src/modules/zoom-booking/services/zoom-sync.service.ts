import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ZoomBooking, ZoomAccount, ZoomMeeting } from '../entities';
import { ZoomApiAdapter, ZoomMeetingListItem } from '../adapters/zoom-api.adapter';
import { BookingStatus } from '../enums/booking-status.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ZoomSyncService {
    private readonly logger = new Logger(ZoomSyncService.name);

    constructor(
        @InjectRepository(ZoomBooking)
        private readonly bookingRepo: Repository<ZoomBooking>,
        @InjectRepository(ZoomAccount)
        private readonly accountRepo: Repository<ZoomAccount>,
        @InjectRepository(ZoomMeeting)
        private readonly meetingRepo: Repository<ZoomMeeting>,
        private readonly zoomApi: ZoomApiAdapter,
        private readonly eventEmitter: EventEmitter2,
        @Optional() private readonly configService?: ConfigService,
    ) { }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleCronSync() {
        this.logger.log('Starting automated 5-minute Zoom background sync...');
        try {
            await this.syncAllAccounts();
            await this.syncRecentRecordings();
        } catch (error) {
            this.logger.error('Error during scheduled Zoom sync', error);
        }
    }

    async syncAllAccounts() {
        if (!this.zoomApi.isConfigured()) {
            this.logger.warn('Zoom API is not configured. Skipping sync.');
            return 0;
        }

        const accounts = await this.accountRepo.find({ where: { isActive: true }, order: { displayOrder: 'ASC' } });
        let updatedCount = 0;

        for (const account of accounts) {
            try {
                const count = await this.syncAccount(account);
                updatedCount += count;
            } catch (error) {
                this.logger.error(`Failed to sync account ${account.email}: ${error.message}`);
            }
        }

        if (updatedCount > 0) {
            // Emit event so frontend can refresh calendar
            this.eventEmitter.emit('zoom.sync.completed', { updatedCount });
        }
        
        this.logger.log(`Zoom Sync completed. Total meetings synced/updated: ${updatedCount}`);
        return updatedCount;
    }

    async syncAccount(account: ZoomAccount): Promise<number> {
        let syncedCount = 0;

        try {
            // Pull upcoming scheduled meetings
            const response = await this.zoomApi.listMeetings(account.email, 'upcoming');
            const externalMeetingKeys: string[] = [];

            for (const meeting of (response.meetings || [])) {
                try {
                    const startDateTime = new Date(meeting.start_time);
                    const dateStr = startDateTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
                    const timeStr = startDateTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit' }) + ':00';
                    
                    // Distinct key per occurrence so recurring meetings appear on every scheduled day
                    const externalKey = `${meeting.id}_${dateStr}_${timeStr.slice(0, 5)}`;
                    externalMeetingKeys.push(externalKey);

                    const existingExternal = await this.bookingRepo.findOne({
                        where: { externalZoomMeetingId: externalKey },
                    });

                    if (existingExternal) {
                        const updated = await this.upsertExternalMeeting(existingExternal, meeting, account, externalKey, dateStr, timeStr);
                        if (updated) {
                            syncedCount++;
                        }
                        continue;
                    }

                    // Verify if it's an internal meeting that we created in iDesk
                    const isInternal = await this.bookingRepo.createQueryBuilder('booking')
                        .innerJoin('booking.meeting', 'meeting')
                        .where('meeting.zoomMeetingId = :zoomMeetingId', { zoomMeetingId: meeting.id.toString() })
                        .andWhere('booking.bookingDate = :dateStr', { dateStr })
                        .getOne();

                    if (!isInternal) {
                        // It's a brand new external meeting from Zoom
                        const created = await this.upsertExternalMeeting(null, meeting, account, externalKey, dateStr, timeStr);
                        if (created) {
                            syncedCount++;
                        }
                    }
                } catch (meetingErr) {
                    this.logger.warn(`Failed to process Zoom meeting ${meeting.id} for ${account.email}: ${meetingErr.message}`);
                }
            }

            // Remove stale external meetings for this account (meetings that were deleted in Zoom)
            const removedCount = await this.removeStaleExternalMeetings(account.id, externalMeetingKeys);
            syncedCount += removedCount;

        } catch (error) {
            this.logger.error(`Error syncing account ${account.email}`, error);
            throw error;
        }

        return syncedCount;
    }

    private calculateSafeEndTime(timeStr: string, durationMinutes: number): string {
        const [startHour, startMin] = timeStr.split(':').map(Number);
        const totalMinutes = startHour * 60 + startMin + (durationMinutes || 60);
        let endHour = Math.floor(totalMinutes / 60);
        const endMin = totalMinutes % 60;
        if (endHour >= 24) {
            return '23:59:00';
        }
        return `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`;
    }

    private async upsertExternalMeeting(
        existingBooking: ZoomBooking | null,
        zoomData: ZoomMeetingListItem,
        account: ZoomAccount,
        externalKey: string,
        dateStr: string,
        timeStr: string,
    ): Promise<boolean> {
        const durationMinutes = zoomData.duration || 60;
        const endStr = this.calculateSafeEndTime(timeStr, durationMinutes);
        const title = (zoomData.topic || 'Zoom Meeting').slice(0, 100);
        const description = zoomData.agenda || 'External meeting scheduled directly via Zoom';

        if (existingBooking) {
            const existingDate = typeof existingBooking.bookingDate === 'string'
                ? existingBooking.bookingDate
                : new Date(existingBooking.bookingDate).toISOString().split('T')[0];

            const isUnchanged =
                existingBooking.title === title &&
                existingDate === dateStr &&
                existingBooking.startTime === timeStr &&
                existingBooking.endTime === endStr &&
                existingBooking.durationMinutes === durationMinutes &&
                existingBooking.description === description &&
                existingBooking.zoomAccountId === account.id;

            if (isUnchanged) {
                return false;
            }

            // Update existing external meeting
            existingBooking.title = title;
            existingBooking.description = description;
            existingBooking.bookingDate = dateStr as any;
            existingBooking.startTime = timeStr;
            existingBooking.endTime = endStr;
            existingBooking.durationMinutes = durationMinutes;
            existingBooking.zoomAccountId = account.id;

            await this.bookingRepo.save(existingBooking);
            return true;
        } else {
            // Create new external booking
            const newBooking = this.bookingRepo.create({
                zoomAccountId: account.id,
                title,
                description,
                bookingDate: dateStr as any,
                startTime: timeStr,
                endTime: endStr,
                durationMinutes,
                status: BookingStatus.CONFIRMED,
                isExternal: true,
                externalZoomMeetingId: externalKey,
            });

            await this.bookingRepo.save(newBooking);
            return true;
        }
    }

    private async removeStaleExternalMeetings(accountId: string, activeExternalZoomKeys: string[]): Promise<number> {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        
        const qb = this.bookingRepo.createQueryBuilder('booking')
            .where('booking.zoomAccountId = :accountId', { accountId })
            .andWhere('booking.isExternal = :isExternal', { isExternal: true })
            .andWhere('booking.bookingDate >= :todayStr', { todayStr });

        if (activeExternalZoomKeys.length > 0) {
            qb.andWhere('booking.externalZoomMeetingId NOT IN (:...activeKeys)', { activeKeys: activeExternalZoomKeys });
        }

        const staleMeetings = await qb.getMany();

        if (staleMeetings.length > 0) {
            for (const meeting of staleMeetings) {
                await this.bookingRepo.delete(meeting.id);
                this.logger.log(`Removed stale external meeting: ${meeting.title} (${meeting.externalZoomMeetingId})`);
            }
            return staleMeetings.length;
        }
        return 0;
    }
    
    // Webhook Handlers (For feature completeness)
    async handleWebhookMeetingCreated(payload: any) {
        if (!payload || !payload.object) return;
        const meetingData = payload.object;
        
        const account = await this.accountRepo.findOne({ where: { email: meetingData.host_email } });
        if (!account) return;

        const startDateTime = new Date(meetingData.start_time);
        const dateStr = startDateTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const timeStr = startDateTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit' }) + ':00';
        const externalKey = `${meetingData.id}_${dateStr}_${timeStr.slice(0, 5)}`;

        const existingExternal = await this.bookingRepo.findOne({
            where: { externalZoomMeetingId: externalKey },
        });

        const isInternal = await this.bookingRepo.createQueryBuilder('booking')
            .innerJoin('booking.meeting', 'meeting')
            .where('meeting.zoomMeetingId = :zoomMeetingId', { zoomMeetingId: meetingData.id.toString() })
            .andWhere('booking.bookingDate = :dateStr', { dateStr })
            .getOne();

        if (!existingExternal && !isInternal) {
            await this.upsertExternalMeeting(null, meetingData as any, account, externalKey, dateStr, timeStr);
            this.eventEmitter.emit('zoom.sync.completed', { updatedCount: 1 });
        }
    }

    async handleWebhookMeetingUpdated(payload: any) {
        if (!payload || !payload.object) return;
        const meetingData = payload.object;
        
        const account = await this.accountRepo.findOne({ where: { email: meetingData.host_email } });
        if (!account) return;

        const startDateTime = new Date(meetingData.start_time);
        const dateStr = startDateTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const timeStr = startDateTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit' }) + ':00';
        const externalKey = `${meetingData.id}_${dateStr}_${timeStr.slice(0, 5)}`;

        const existingExternal = await this.bookingRepo.findOne({
            where: { externalZoomMeetingId: externalKey },
        });

        if (existingExternal) {
            const updated = await this.upsertExternalMeeting(existingExternal, meetingData as any, account, externalKey, dateStr, timeStr);
            if (updated) {
                this.eventEmitter.emit('zoom.sync.completed', { updatedCount: 1 });
            }
        }
    }

    async handleWebhookMeetingDeleted(payload: any) {
        if (!payload || !payload.object) return;
        const meetingData = payload.object;
        const zoomMeetingIdStr = meetingData.id.toString();
        
        const existingExternal = await this.bookingRepo.find({
            where: { externalZoomMeetingId: zoomMeetingIdStr },
        });

        if (existingExternal && existingExternal.length > 0) {
            for (const item of existingExternal) {
                await this.bookingRepo.delete(item.id);
            }
            this.logger.log(`Webhook: Removed external meeting instances for ID: ${zoomMeetingIdStr}`);
            this.eventEmitter.emit('zoom.sync.completed', { updatedCount: existingExternal.length });
        }
    }

    async handleWebhookRecordingCompleted(payload: any): Promise<void> {
        if (!payload || !payload.object) return;
        const recordingData = payload.object;
        const zoomMeetingId = recordingData.id?.toString();
        if (!zoomMeetingId) return;

        this.logger.log(`Webhook: Processing recording.completed for Zoom meeting ${zoomMeetingId}`);

        const shareUrl = recordingData.share_url;
        const passcode = recordingData.recording_play_passcode || null;
        const duration = recordingData.duration || null;
        const files = recordingData.recording_files || null;
        const recordedAt = recordingData.start_time ? new Date(recordingData.start_time) : new Date();

        const meetings = await this.meetingRepo.find({
            where: { zoomMeetingId },
            relations: ['booking'],
        });

        if (meetings && meetings.length > 0) {
            for (const meeting of meetings) {
                meeting.recordingUrl = shareUrl;
                meeting.recordingPasscode = passcode;
                meeting.recordingDuration = duration;
                meeting.recordingFiles = files;
                meeting.recordedAt = recordedAt;
                await this.meetingRepo.save(meeting);
                this.logger.log(`Webhook: Successfully saved recording for meeting ${meeting.id} (Booking: ${meeting.zoomBookingId})`);
            }
            this.eventEmitter.emit('zoom.sync.completed', { updatedCount: meetings.length });
        } else {
            this.logger.warn(`Webhook: No internal ZoomMeeting found with zoomMeetingId ${zoomMeetingId}`);
        }
    }

    /**
     * Periodically sync cloud recordings for recent completed/scheduled meetings
     * that do not have a recordingUrl yet. This works via outbound HTTPS even if
     * Zoom webhooks cannot reach an intranet or private IP address.
     */
    async syncRecentRecordings(daysBack: number = 14): Promise<number> {
        if (!this.zoomApi.isConfigured()) return 0;

        const isRecordingSyncEnabled = this.configService
            ? this.configService.get<string>('ZOOM_RECORDING_SYNC_ENABLED', 'true') !== 'false'
            : process.env.ZOOM_RECORDING_SYNC_ENABLED !== 'false';

        if (!isRecordingSyncEnabled) {
            this.logger.debug('Zoom recording sync is disabled via ZOOM_RECORDING_SYNC_ENABLED configuration.');
            return 0;
        }

        if (!this.zoomApi.isRecordingScopeAvailable()) {
            return 0;
        }

        try {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - daysBack);
            const dateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

            const pendingMeetings = await this.meetingRepo.createQueryBuilder('meeting')
                .innerJoinAndSelect('meeting.booking', 'booking')
                .where('meeting.recordingUrl IS NULL')
                .andWhere('booking.bookingDate >= :dateStr', { dateStr })
                .andWhere('booking.status != :cancelled', { cancelled: BookingStatus.CANCELLED })
                .getMany();

            let syncedCount = 0;
            for (const meeting of pendingMeetings) {
                if (!meeting.zoomMeetingId) continue;
                if (!this.zoomApi.isRecordingScopeAvailable()) {
                    break;
                }

                try {
                    const rec = await this.zoomApi.getMeetingRecordings(meeting.zoomMeetingId);
                    if (!this.zoomApi.isRecordingScopeAvailable()) {
                        // Scope error was caught during request, halt further meeting checks immediately
                        break;
                    }

                    if (rec && rec.share_url) {
                        meeting.recordingUrl = rec.share_url;
                        meeting.recordingPasscode = rec.recording_play_passcode || null;
                        meeting.recordingDuration = rec.duration || null;
                        meeting.recordingFiles = rec.recording_files || null;
                        meeting.recordedAt = rec.start_time ? new Date(rec.start_time) : new Date();
                        await this.meetingRepo.save(meeting);
                        syncedCount++;
                        this.logger.log(`Auto-synced recording for Zoom meeting ${meeting.zoomMeetingId} (Booking: ${meeting.zoomBookingId})`);
                    }
                } catch (err: any) {
                    // Ignore 404 (recording not created or not ready yet)
                    this.logger.debug(`No recording found yet for meeting ${meeting.zoomMeetingId}`);
                }
            }

            if (syncedCount > 0) {
                this.eventEmitter.emit('zoom.sync.completed', { updatedCount: syncedCount });
            }
            return syncedCount;
        } catch (error: any) {
            this.logger.error(`Failed to auto-sync recent recordings: ${error.message}`);
            return 0;
        }
    }
}
