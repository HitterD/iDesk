import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleCronSync() {
        this.logger.log('Starting automated 5-minute Zoom background sync...');
        try {
            await this.syncAllAccounts();
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
                        await this.upsertExternalMeeting(existingExternal, meeting, account, externalKey, dateStr, timeStr);
                        syncedCount++;
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
                        await this.upsertExternalMeeting(null, meeting, account, externalKey, dateStr, timeStr);
                        syncedCount++;
                    }
                } catch (meetingErr) {
                    this.logger.warn(`Failed to process Zoom meeting ${meeting.id} for ${account.email}: ${meetingErr.message}`);
                }
            }

            // Remove stale external meetings for this account (meetings that were deleted in Zoom)
            await this.removeStaleExternalMeetings(account.id, externalMeetingKeys);

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
    ) {
        const durationMinutes = zoomData.duration || 60;
        const endStr = this.calculateSafeEndTime(timeStr, durationMinutes);
        const title = (zoomData.topic || 'Zoom Meeting').slice(0, 100);

        if (existingBooking) {
            // Update existing external meeting
            existingBooking.title = title;
            existingBooking.bookingDate = dateStr as any;
            existingBooking.startTime = timeStr;
            existingBooking.endTime = endStr;
            existingBooking.durationMinutes = durationMinutes;

            await this.bookingRepo.save(existingBooking);
        } else {
            // Create new external booking
            const newBooking = this.bookingRepo.create({
                zoomAccountId: account.id,
                title,
                description: zoomData.agenda || 'External meeting scheduled directly via Zoom',
                bookingDate: dateStr as any,
                startTime: timeStr,
                endTime: endStr,
                durationMinutes,
                status: BookingStatus.CONFIRMED,
                isExternal: true,
                externalZoomMeetingId: externalKey,
            });

            await this.bookingRepo.save(newBooking);
        }
    }

    private async removeStaleExternalMeetings(accountId: string, activeExternalZoomKeys: string[]) {
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
        }
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
            await this.upsertExternalMeeting(existingExternal, meetingData as any, account, externalKey, dateStr, timeStr);
            this.eventEmitter.emit('zoom.sync.completed', { updatedCount: 1 });
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
}
