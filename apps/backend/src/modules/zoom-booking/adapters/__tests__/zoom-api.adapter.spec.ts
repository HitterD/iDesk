import { ZoomApiAdapter, ZoomRecurrenceRequest } from '../zoom-api.adapter';
import { ConfigService } from '@nestjs/config';

describe('ZoomApiAdapter', () => {
    let adapter: ZoomApiAdapter;
    let configService: ConfigService;

    beforeEach(() => {
        configService = {
            get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                    ZOOM_ACCOUNT_ID: 'test-account-id',
                    ZOOM_CLIENT_ID: 'test-client-id',
                    ZOOM_CLIENT_SECRET: 'test-client-secret',
                };
                return config[key];
            }),
        } as any;

        adapter = new ZoomApiAdapter(configService);
    });

    describe('createMeeting', () => {
        it('creates a non-recurring scheduled meeting with type 2', async () => {
            const requestSpy = jest.spyOn(adapter as any, 'request').mockResolvedValue({
                id: 123456789,
                join_url: 'https://zoom.us/j/123456789',
                type: 2,
            });

            const startTime = new Date('2026-09-10T14:00:00+07:00');
            await adapter.createMeeting('host@example.com', 'Test Single Meeting', startTime, 60);

            expect(requestSpy).toHaveBeenCalledWith(
                'POST',
                '/users/host@example.com/meetings',
                expect.objectContaining({
                    topic: 'Test Single Meeting',
                    type: 2,
                    duration: 60,
                    timezone: 'Asia/Jakarta',
                })
            );
        });

        it('creates a native recurring meeting with type 8 when recurrence is provided', async () => {
            const requestSpy = jest.spyOn(adapter as any, 'request').mockResolvedValue({
                id: 987654321,
                join_url: 'https://zoom.us/j/987654321',
                type: 8,
                occurrences: [
                    { occurrence_id: '101', start_time: '2026-09-10T07:00:00Z', duration: 60, status: 'available' },
                    { occurrence_id: '102', start_time: '2026-09-11T07:00:00Z', duration: 60, status: 'available' },
                ],
            });

            const startTime = new Date('2026-09-10T14:00:00+07:00');
            const recurrence: ZoomRecurrenceRequest = {
                type: 1, // Daily
                repeat_interval: 1,
                end_date_time: '2026-09-15T23:59:59Z',
            };

            await adapter.createMeeting('host@example.com', 'Daily Standup', startTime, 60, 'Agendas', recurrence);

            expect(requestSpy).toHaveBeenCalledWith(
                'POST',
                '/users/host@example.com/meetings',
                expect.objectContaining({
                    topic: 'Daily Standup',
                    type: 8,
                    duration: 60,
                    timezone: 'Asia/Jakarta',
                    recurrence: {
                        type: 1,
                        repeat_interval: 1,
                        end_date_time: '2026-09-15T23:59:59Z',
                    },
                })
            );
        });
    });

    describe('deleteMeeting', () => {
        it('deletes entire meeting when occurrenceId is not provided', async () => {
            const requestSpy = jest.spyOn(adapter as any, 'request').mockResolvedValue(undefined);

            await adapter.deleteMeeting('123456789');

            expect(requestSpy).toHaveBeenCalledWith('DELETE', '/meetings/123456789');
        });

        it('deletes specific occurrence when occurrenceId is provided', async () => {
            const requestSpy = jest.spyOn(adapter as any, 'request').mockResolvedValue(undefined);

            await adapter.deleteMeeting('123456789', '999888');

            expect(requestSpy).toHaveBeenCalledWith('DELETE', '/meetings/123456789?occurrence_id=999888');
        });
    });

    describe('updateMeeting', () => {
        it('updates entire meeting when occurrenceId is not provided', async () => {
            const requestSpy = jest.spyOn(adapter as any, 'request').mockResolvedValue(undefined);

            await adapter.updateMeeting('123456789', { duration: 90 });

            expect(requestSpy).toHaveBeenCalledWith('PATCH', '/meetings/123456789', { duration: 90 });
        });

        it('updates specific occurrence when occurrenceId is provided', async () => {
            const requestSpy = jest.spyOn(adapter as any, 'request').mockResolvedValue(undefined);

            await adapter.updateMeeting('123456789', { start_time: '2026-09-11T15:00:00' }, '999888');

            expect(requestSpy).toHaveBeenCalledWith(
                'PATCH',
                '/meetings/123456789?occurrence_id=999888',
                { start_time: '2026-09-11T15:00:00' }
            );
        });
    });

    describe('getMeetingRecordings', () => {
        it('returns recording data when found', async () => {
            const mockData = {
                id: 123456789,
                share_url: 'https://zoom.us/rec/share/abc123',
                recording_files: [],
            };
            const requestSpy = jest.spyOn(adapter as any, 'request').mockResolvedValue(mockData);

            const result = await adapter.getMeetingRecordings('123456789');
            expect(result).toEqual(mockData);
            expect(requestSpy).toHaveBeenCalledWith('GET', '/meetings/123456789/recordings', undefined, 3, { suppressErrorLog: true });
        });

        it('returns null on 404 without throwing', async () => {
            jest.spyOn(adapter as any, 'request').mockRejectedValue({
                response: { status: 404 },
            });

            const result = await adapter.getMeetingRecordings('123456789');
            expect(result).toBeNull();
            expect(adapter.isRecordingScopeAvailable()).toBe(true);
        });

        it('handles 4711 scope missing error gracefully and auto-pauses future calls', async () => {
            const scopeError = {
                response: {
                    status: 400,
                    data: {
                        code: 4711,
                        message: 'Invalid access token, does not contain scopes:[cloud_recording:read:list_recording_files]',
                    },
                },
            };
            const requestSpy = jest.spyOn(adapter as any, 'request').mockRejectedValue(scopeError);

            expect(adapter.isRecordingScopeAvailable()).toBe(true);

            // First call triggers scope error detection
            const result1 = await adapter.getMeetingRecordings('123456789');
            expect(result1).toBeNull();
            expect(adapter.isRecordingScopeAvailable()).toBe(false);
            expect(requestSpy).toHaveBeenCalledTimes(1);

            // Second call immediately returns null without making HTTP request
            const result2 = await adapter.getMeetingRecordings('987654321');
            expect(result2).toBeNull();
            expect(requestSpy).toHaveBeenCalledTimes(1);
        });
    });

    // A host with >100 upcoming meetings: page 2+ was dropped and the sync then deleted them as stale.
    describe('listMeetings', () => {
        it('follows next_page_token until every page is read', async () => {
            const requestSpy = jest.spyOn(adapter as any, 'request')
                .mockResolvedValueOnce({ meetings: [{ id: 1 }], next_page_token: 'p2' })
                .mockResolvedValueOnce({ meetings: [{ id: 2 }], next_page_token: '' });

            const result = await adapter.listMeetings('host@example.com', 'upcoming');

            expect(result.meetings.map((m: any) => m.id)).toEqual([1, 2]);
            expect(requestSpy.mock.calls[1][1]).toContain('next_page_token=p2');
        });
    });
});
