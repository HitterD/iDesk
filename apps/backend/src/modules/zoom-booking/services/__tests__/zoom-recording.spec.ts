import { ZoomSyncService } from '../zoom-sync.service';

describe('ZoomSyncService.handleWebhookRecordingCompleted', () => {
    let syncService: ZoomSyncService;
    let mockMeetingRepo: any;
    let mockBookingRepo: any;
    let mockAccountRepo: any;
    let mockZoomApi: any;
    let mockEventEmitter: any;

    beforeEach(() => {
        mockMeetingRepo = {
            find: jest.fn(),
            save: jest.fn(),
        };
        mockBookingRepo = {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
        };
        mockAccountRepo = {
            find: jest.fn(),
            findOne: jest.fn(),
        };
        mockZoomApi = {
            isConfigured: jest.fn().mockReturnValue(true),
            isRecordingScopeAvailable: jest.fn().mockReturnValue(true),
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

    it('processes recording.completed payload and updates ZoomMeeting with share_url and passcode', async () => {
        const payload = {
            object: {
                id: 88372882780,
                start_time: '2026-09-08T08:00:00Z',
                duration: 540,
                share_url: 'https://us02web.zoom.us/rec/share/sample_token_123',
                recording_play_passcode: 'passcode123',
                recording_files: [
                    { id: 'rec-1', file_type: 'MP4', file_size: 50000000 },
                ],
            },
        };

        const existingMeeting: any = {
            id: 'meeting-uuid-1',
            zoomBookingId: 'booking-uuid-1',
            zoomMeetingId: '88372882780',
            recordingUrl: null,
            recordingPasscode: null,
            recordingDuration: null,
        };

        mockMeetingRepo.find.mockResolvedValue([existingMeeting]);
        mockMeetingRepo.save.mockImplementation(async (m: any) => m);

        await syncService.handleWebhookRecordingCompleted(payload);

        expect(mockMeetingRepo.find).toHaveBeenCalledWith({
            where: { zoomMeetingId: '88372882780' },
            relations: ['booking'],
        });

        expect(existingMeeting.recordingUrl).toBe('https://us02web.zoom.us/rec/share/sample_token_123');
        expect(existingMeeting.recordingPasscode).toBe('passcode123');
        expect(existingMeeting.recordingDuration).toBe(540);
        expect(mockMeetingRepo.save).toHaveBeenCalledWith(existingMeeting);
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('zoom.sync.completed', { updatedCount: 1 });
    });

    it('gracefully handles missing meeting or empty payload', async () => {
        await syncService.handleWebhookRecordingCompleted(null);
        expect(mockMeetingRepo.find).not.toHaveBeenCalled();

        await syncService.handleWebhookRecordingCompleted({ object: null });
        expect(mockMeetingRepo.find).not.toHaveBeenCalled();

        mockMeetingRepo.find.mockResolvedValue([]);
        await syncService.handleWebhookRecordingCompleted({ object: { id: 99999999 } });
        expect(mockMeetingRepo.save).not.toHaveBeenCalled();
    });

    it('syncRecentRecordings polls Zoom API and updates meetings with available recordings', async () => {
        const mockQueryBuilder: any = {
            innerJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([
                {
                    id: 'm1',
                    zoomMeetingId: '123456789',
                    zoomBookingId: 'b1',
                    recordingUrl: null,
                },
            ]),
        };
        mockMeetingRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

        mockZoomApi.getMeetingRecordings.mockResolvedValue({
            id: 123456789,
            share_url: 'https://zoom.us/rec/share/auto-sync-test',
            recording_play_passcode: 'pass123',
            duration: 30,
            recording_files: [],
            start_time: '2026-09-08T09:00:00Z',
        });

        const synced = await syncService.syncRecentRecordings();
        expect(synced).toBe(1);
        expect(mockZoomApi.getMeetingRecordings).toHaveBeenCalledWith('123456789');
        expect(mockMeetingRepo.save).toHaveBeenCalled();
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('zoom.sync.completed', { updatedCount: 1 });
    });

    it('syncRecentRecordings skips immediately when isRecordingScopeAvailable is false', async () => {
        mockZoomApi.isRecordingScopeAvailable.mockReturnValue(false);

        const synced = await syncService.syncRecentRecordings();
        expect(synced).toBe(0);
        expect(mockZoomApi.getMeetingRecordings).not.toHaveBeenCalled();
    });

    it('syncRecentRecordings stops loop immediately when scope becomes unavailable on first meeting', async () => {
        const mockQueryBuilder: any = {
            innerJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([
                { id: 'm1', zoomMeetingId: '111111', recordingUrl: null },
                { id: 'm2', zoomMeetingId: '222222', recordingUrl: null },
                { id: 'm3', zoomMeetingId: '333333', recordingUrl: null },
            ]),
        };
        mockMeetingRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

        // First call simulates Zoom API returning 4711 missing scope, which causes isRecordingScopeAvailable to become false
        mockZoomApi.getMeetingRecordings.mockImplementation(async () => {
            mockZoomApi.isRecordingScopeAvailable.mockReturnValue(false);
            return null;
        });

        const synced = await syncService.syncRecentRecordings();
        expect(synced).toBe(0);
        // Only 1 call was made; remaining meetings (222222 and 333333) were skipped!
        expect(mockZoomApi.getMeetingRecordings).toHaveBeenCalledTimes(1);
        expect(mockZoomApi.getMeetingRecordings).toHaveBeenCalledWith('111111');
    });

    it('syncRecentRecordings skips when ZOOM_RECORDING_SYNC_ENABLED is false', async () => {
        const mockConfigService: any = {
            get: jest.fn().mockReturnValue('false'),
        };
        const syncServiceWithConfig = new ZoomSyncService(
            mockBookingRepo,
            mockAccountRepo,
            mockMeetingRepo,
            mockZoomApi,
            mockEventEmitter,
            mockConfigService,
        );

        const synced = await syncServiceWithConfig.syncRecentRecordings();
        expect(synced).toBe(0);
        expect(mockZoomApi.getMeetingRecordings).not.toHaveBeenCalled();
    });
});
