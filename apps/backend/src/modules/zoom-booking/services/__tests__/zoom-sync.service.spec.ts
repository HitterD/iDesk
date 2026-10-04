import { ZoomSyncService } from '../zoom-sync.service';

describe('ZoomSyncService.syncAccount and syncAllAccounts', () => {
    let syncService: ZoomSyncService;
    let mockMeetingRepo: any;
    let mockBookingRepo: any;
    let mockAccountRepo: any;
    let mockZoomApi: any;
    let mockEventEmitter: any;

    const mockAccount = {
        id: 'account-uuid-1',
        email: 'zoom1@example.com',
        name: 'Zoom Admin 1',
        isActive: true,
        displayOrder: 1,
    };

    beforeEach(() => {
        const queryBuilderMock: any = {
            innerJoin: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
            getMany: jest.fn().mockResolvedValue([]),
        };

        mockMeetingRepo = {
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn(),
        };
        mockBookingRepo = {
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            create: jest.fn((dto) => ({ id: 'new-booking-uuid', ...dto })),
            save: jest.fn((entity) => Promise.resolve(entity)),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
        };
        mockAccountRepo = {
            find: jest.fn().mockResolvedValue([mockAccount]),
            findOne: jest.fn().mockResolvedValue(mockAccount),
        };
        mockZoomApi = {
            isConfigured: jest.fn().mockReturnValue(true),
            isRecordingScopeAvailable: jest.fn().mockReturnValue(true),
            listMeetings: jest.fn().mockResolvedValue({ meetings: [] }),
            getMeetingRecordings: jest.fn(),
        };
        mockEventEmitter = {
            emit: jest.fn(),
        };

        syncService = new ZoomSyncService(
            mockBookingRepo,
            mockAccountRepo,
            mockMeetingRepo,
            mockZoomApi,
            mockEventEmitter,
        );
    });

    it('does not emit zoom.sync.completed when all meetings are unchanged', async () => {
        const meetingDate = new Date('2026-09-22T09:00:00+07:00');
        const dateStr = meetingDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const timeStr = meetingDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit' }) + ':00';

        mockZoomApi.listMeetings.mockResolvedValue({
            meetings: [
                {
                    id: 12345678,
                    topic: 'Weekly Team Sync',
                    start_time: meetingDate.toISOString(),
                    duration: 60,
                    agenda: 'External meeting scheduled directly via Zoom',
                },
            ],
        });

        // Existing booking has identical attributes (loaded in one batch by occurrence key)
        mockBookingRepo.find.mockResolvedValue([{
            id: 'existing-id',
            title: 'Weekly Team Sync',
            description: 'External meeting scheduled directly via Zoom',
            bookingDate: dateStr,
            startTime: timeStr,
            endTime: '10:00:00',
            durationMinutes: 60,
            zoomAccountId: mockAccount.id,
            isExternal: true,
            externalZoomMeetingId: `12345678_${dateStr}_${timeStr.slice(0, 5)}`,
        }]);

        const updatedCount = await syncService.syncAllAccounts();

        expect(updatedCount).toBe(0);
        expect(mockBookingRepo.save).not.toHaveBeenCalled();
        expect(mockEventEmitter.emit).not.toHaveBeenCalledWith('zoom.sync.completed', expect.anything());
    });

    it('updates booking and emits zoom.sync.completed when meeting attributes have changed', async () => {
        const meetingDate = new Date('2026-09-22T09:00:00+07:00');
        const dateStr = meetingDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const timeStr = meetingDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit' }) + ':00';

        mockZoomApi.listMeetings.mockResolvedValue({
            meetings: [
                {
                    id: 12345678,
                    topic: 'Updated Topic Title',
                    start_time: meetingDate.toISOString(),
                    duration: 90,
                    agenda: 'Updated Agenda',
                },
            ],
        });

        // Existing booking has old attributes
        const existingRecord = {
            id: 'existing-id',
            title: 'Old Topic Title',
            description: 'Old Agenda',
            bookingDate: dateStr,
            startTime: timeStr,
            endTime: '10:00:00',
            durationMinutes: 60,
            zoomAccountId: mockAccount.id,
            isExternal: true,
            externalZoomMeetingId: `12345678_${dateStr}_${timeStr.slice(0, 5)}`,
        };
        mockBookingRepo.find.mockResolvedValue([existingRecord]);

        const updatedCount = await syncService.syncAllAccounts();

        expect(updatedCount).toBe(1);
        expect(mockBookingRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Updated Topic Title',
                durationMinutes: 90,
            }),
        );
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('zoom.sync.completed', { updatedCount: 1 });
    });

    it('creates new booking and emits zoom.sync.completed when a new external meeting is found', async () => {
        const meetingDate = new Date('2026-09-23T14:00:00+07:00');

        mockZoomApi.listMeetings.mockResolvedValue({
            meetings: [
                {
                    id: 99887766,
                    topic: 'Brand New Meeting',
                    start_time: meetingDate.toISOString(),
                    duration: 30,
                },
            ],
        });

        mockBookingRepo.find.mockResolvedValue([]);

        const updatedCount = await syncService.syncAllAccounts();

        expect(updatedCount).toBe(1);
        expect(mockBookingRepo.create).toHaveBeenCalled();
        expect(mockBookingRepo.save).toHaveBeenCalled();
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('zoom.sync.completed', { updatedCount: 1 });
    });

    it('counts stale meetings deletion in updatedCount and emits event', async () => {
        mockZoomApi.listMeetings.mockResolvedValue({
            meetings: [],
        });

        const qbMock: any = {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([
                { id: 'stale-1', title: 'Cancelled Zoom 1', externalZoomMeetingId: 'ext-1' },
                { id: 'stale-2', title: 'Cancelled Zoom 2', externalZoomMeetingId: 'ext-2' },
            ]),
        };
        mockBookingRepo.createQueryBuilder.mockReturnValue(qbMock);

        const updatedCount = await syncService.syncAllAccounts();

        expect(updatedCount).toBe(2);
        expect(mockBookingRepo.delete).toHaveBeenCalledTimes(2);
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('zoom.sync.completed', { updatedCount: 2 });
    });

    // Stored keys are `<id>_<date>_<HH:mm>`; the webhook used to look up the bare id and found nothing.
    it('removes every stored occurrence of a meeting deleted in Zoom', async () => {
        mockBookingRepo.find.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);

        await syncService.handleWebhookMeetingDeleted({ object: { id: 84154272370 } });

        const where = mockBookingRepo.find.mock.calls[0][0].where;
        expect(where[0]).toEqual({ externalZoomMeetingId: '84154272370' });
        expect(where[1].externalZoomMeetingId.value).toBe('84154272370\\_%'); // `_` escaped, not a LIKE wildcard
        expect(mockBookingRepo.delete).toHaveBeenCalledTimes(2);
    });

    it('skips a cron run while the previous one is still going', async () => {
        let release: () => void = () => undefined;
        const spy = jest.spyOn(syncService, 'syncAllAccounts').mockImplementation(() => new Promise((r) => { release = () => r(0); }));
        jest.spyOn(syncService, 'syncRecentRecordings').mockResolvedValue(0 as any);

        const first = syncService.handleCronSync();
        await syncService.handleCronSync();
        release();
        await first;

        expect(spy).toHaveBeenCalledTimes(1);
    });
});
