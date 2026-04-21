import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
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
        private readonly zoomApi: ZoomApiAdapter,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    @Cron('0 */5 * * * *') // Run every 5 minutes
    async cronSyncAllAccounts() {
        this.logger.log('Starting automated Zoom Meeting Sync...');
        await this.syncAllAccounts();
    }

    async syncAllAccounts() {
        if (!this.zoomApi.isConfigured()) {
            this.logger.warn('Zoom API is not configured. Skipping sync.');
            return 0;
        }

        const accounts = await this.accountRepo.find({ where: { isActive: true } });
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
            const externalMeetingIds: string[] = [];

            for (const meeting of response.meetings) {
                // Determine if meeting already exists (external or internal)
                // First try to match by externalZoomMeetingId, then by ZoomMeeting entity
                const zoomMeetingIdStr = meeting.id.toString();
                externalMeetingIds.push(zoomMeetingIdStr);

                const existingExternal = await this.bookingRepo.findOne({
                    where: { externalZoomMeetingId: zoomMeetingIdStr },
                });

                if (existingExternal) {
                    await this.upsertExternalMeeting(existingExternal, meeting, account);
                    syncedCount++;
                    continue;
                }

                // Verify if it's an internal meeting that we created
                const isInternal = await this.bookingRepo.createQueryBuilder('booking')
                    .innerJoin('booking.meeting', 'meeting')
                    .where('meeting.zoomMeetingId = :zoomMeetingId', { zoomMeetingId: zoomMeetingIdStr })
                    .getOne();

                if (!isInternal) {
                    // It's a brand new external meeting
                    await this.upsertExternalMeeting(null, meeting, account);
                    syncedCount++;
                }
            }

            // Remove stale external meetings for this account (meetings that were deleted in Zoom)
            await this.removeStaleExternalMeetings(account.id, externalMeetingIds);

        } catch (error) {
            this.logger.error(`Error syncing account ${account.email}`, error);
            throw error;
        }

        return syncedCount;
    }

    private async upsertExternalMeeting(
        existingBooking: ZoomBooking | null,
        zoomData: ZoomMeetingListItem,
        account: ZoomAccount
    ) {
        // Parse start_time to date and time components
        const startDateTime = new Date(zoomData.start_time);
        
        // Convert to local YYYY-MM-DD and HH:mm based on Asia/Jakarta
        const dateStr = startDateTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
        const timeStr = startDateTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit' }); // HH:mm

        // Calculate end time
        const durationMinutes = zoomData.duration || 60;
        const [startHour, startMin] = timeStr.split(':').map(Number);
        const totalMinutes = startHour * 60 + startMin + durationMinutes;
        const endHour = Math.floor(totalMinutes / 60);
        const endMin = totalMinutes % 60;
        const endStr = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

        if (existingBooking) {
            // Update existing external meeting
            existingBooking.title = zoomData.topic;
            existingBooking.bookingDate = new Date(dateStr);
            existingBooking.startTime = timeStr;
            existingBooking.endTime = endStr;
            existingBooking.durationMinutes = durationMinutes;

            await this.bookingRepo.save(existingBooking);
        } else {
            // Create new external booking
            const newBooking = this.bookingRepo.create({
                zoomAccountId: account.id,
                title: zoomData.topic || 'Zoom Meeting',
                description: 'External meeting scheduled directly via Zoom',
                bookingDate: new Date(dateStr),
                startTime: timeStr,
                endTime: endStr,
                durationMinutes,
                status: BookingStatus.CONFIRMED,
                isExternal: true,
                externalZoomMeetingId: zoomData.id.toString(),
            });

            await this.bookingRepo.save(newBooking);
        }
    }

    private async removeStaleExternalMeetings(accountId: string, activeExternalZoomMeetingIds: string[]) {
        // Find external meetings that are in DB but NOT in the active list from Zoom
        // Only look for future meetings to delete, keep the past ones history? Or just clean up?
        // Usually list API returns 'upcoming' so we clean up pending/confirmed external meetings that no longer exist
        const todayStr = new Date().toLocaleDateString('en-CA');
        
        const qb = this.bookingRepo.createQueryBuilder('booking')
            .where('booking.zoomAccountId = :accountId', { accountId })
            .andWhere('booking.isExternal = :isExternal', { isExternal: true })
            .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
            .andWhere('booking.bookingDate >= :todayStr', { todayStr });

        if (activeExternalZoomMeetingIds.length > 0) {
            qb.andWhere('booking.externalZoomMeetingId NOT IN (:...activeIds)', { activeIds: activeExternalZoomMeetingIds });
        }

        const staleMeetings = await qb.getMany();

        if (staleMeetings.length > 0) {
            for (const meeting of staleMeetings) {
                await this.bookingRepo.delete(meeting.id);
                this.logger.log(`Removed stale external meeting: ${meeting.title} (${meeting.externalZoomMeetingId})`);
            }
        }
    }
    
    // Webhook Handlers (For feature completeness)
    async handleWebhookMeetingCreated(payload: any) {
        // Find account matching payload.host_email
        if (!payload || !payload.object) return;
        const meetingData = payload.object;
        
        const account = await this.accountRepo.findOne({ where: { email: meetingData.host_email } });
        if (!account) return;

        // Verify if we already have it
        const zoomMeetingIdStr = meetingData.id.toString();
        const existingExternal = await this.bookingRepo.findOne({
            where: { externalZoomMeetingId: zoomMeetingIdStr },
        });

        // Or if it's internal
        const isInternal = await this.bookingRepo.createQueryBuilder('booking')
            .innerJoin('booking.meeting', 'meeting')
            .where('meeting.zoomMeetingId = :zoomMeetingId', { zoomMeetingId: zoomMeetingIdStr })
            .getOne();

        if (!existingExternal && !isInternal) {
            await this.upsertExternalMeeting(null, meetingData as any, account);
            this.eventEmitter.emit('zoom.sync.completed', { updatedCount: 1 });
        }
    }

    async handleWebhookMeetingUpdated(payload: any) {
        if (!payload || !payload.object) return;
        const meetingData = payload.object;
        
        const account = await this.accountRepo.findOne({ where: { email: meetingData.host_email } });
        if (!account) return;

        const zoomMeetingIdStr = meetingData.id.toString();
        const existingExternal = await this.bookingRepo.findOne({
            where: { externalZoomMeetingId: zoomMeetingIdStr },
        });

        if (existingExternal) {
            await this.upsertExternalMeeting(existingExternal, meetingData as any, account);
            this.eventEmitter.emit('zoom.sync.completed', { updatedCount: 1 });
        }
    }

    async handleWebhookMeetingDeleted(payload: any) {
        if (!payload || !payload.object) return;
        const meetingData = payload.object;
        const zoomMeetingIdStr = meetingData.id.toString();
        
        const existingExternal = await this.bookingRepo.findOne({
            where: { externalZoomMeetingId: zoomMeetingIdStr },
        });

        if (existingExternal) {
            await this.bookingRepo.delete(existingExternal.id);
            this.logger.log(`Webhook: Removed external meeting: ${existingExternal.title}`);
            this.eventEmitter.emit('zoom.sync.completed', { updatedCount: 1 });
        }
    }
}
