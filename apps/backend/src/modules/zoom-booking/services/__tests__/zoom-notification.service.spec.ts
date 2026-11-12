import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZoomNotificationService, generateIcsCalendar } from '../zoom-notification.service';
import { ZoomBookingEventListener } from '../zoom-booking-event.listener';
import { ZoomBooking, ZoomParticipant } from '../../entities';
import { NotificationCategory, NotificationType } from '../../../notifications/entities/notification.entity';
import { NotificationService } from '../../../notifications/notification.service';
import { ZoomGateway } from '../../gateways/zoom.gateway';
import { MailDispatchService } from '../../../../shared/mail/mail-dispatch.service';

describe('ZoomNotificationService & EventListener', () => {
    let service: ZoomNotificationService;
    let listener: ZoomBookingEventListener;

    const mockNotificationService = {
        create: jest.fn().mockResolvedValue({ id: 'n1' }),
    };

    const claimQb = {
        update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const mockBookingRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        createQueryBuilder: jest.fn(() => claimQb),
    };

    const mockParticipantRepo = {
        save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };

    const mockZoomGateway = {
        emitBookingCreated: jest.fn(),
        emitBookingCancelled: jest.fn(),
        emitBookingUpdated: jest.fn(),
        emitSettingsChanged: jest.fn(),
        emitSyncCompleted: jest.fn(),
    };

    const mockMailDispatch = {
        send: jest.fn().mockResolvedValue({ success: true, queued: true }),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ZoomNotificationService,
                ZoomBookingEventListener,
                {
                    provide: NotificationService,
                    useValue: mockNotificationService,
                },
                {
                    provide: getRepositoryToken(ZoomBooking),
                    useValue: mockBookingRepo,
                },
                {
                    provide: getRepositoryToken(ZoomParticipant),
                    useValue: mockParticipantRepo,
                },
                {
                    provide: ZoomGateway,
                    useValue: mockZoomGateway,
                },
                {
                    provide: MailDispatchService,
                    useValue: mockMailDispatch,
                },
            ],
        }).compile();

        service = module.get<ZoomNotificationService>(ZoomNotificationService);
        listener = module.get<ZoomBookingEventListener>(ZoomBookingEventListener);
    });

    describe('generateIcsCalendar', () => {
        it('should generate valid RFC 5545 iCalendar content with meeting details', () => {
            const mockBooking = {
                id: 'booking-123',
                title: 'Sprint Planning Zoom',
                description: 'Agenda sprint 42',
                bookingDate: '2026-09-10',
                startTime: '10:00',
                endTime: '11:00',
                meeting: {
                    zoomMeetingId: '987654321',
                    password: 'secretpasscode',
                },
            } as any;

            const ics = generateIcsCalendar(mockBooking, 'https://zoom.us/j/987654321', 'secretpasscode');

            expect(ics).toContain('BEGIN:VCALENDAR');
            expect(ics).toContain('VERSION:2.0');
            expect(ics).toContain('BEGIN:VEVENT');
            expect(ics).toContain('SUMMARY:Sprint Planning Zoom');
            expect(ics).toContain('LOCATION:https://zoom.us/j/987654321');
            expect(ics).toContain('UID:zoom-booking-booking-123@idesk.internal');
            expect(ics).toContain('END:VEVENT');
            expect(ics).toContain('END:VCALENDAR');
        });
    });

    describe('sendBookingConfirmationEmail', () => {
        it('should send email with attached .ics calendar file', async () => {
            const mockBooking = {
                id: 'b1',
                title: 'Review Desain',
                bookingDate: '2026-09-15',
                startTime: '14:00',
                endTime: '15:00',
                durationMinutes: 60,
                zoomAccount: { name: 'Akun Zoom Pro 1' },
            } as any;

            await service.sendBookingConfirmationEmail(
                'user@example.com',
                'Bagas Pratama',
                mockBooking,
                'https://zoom.us/j/12345',
                '12345',
                'pass123',
            );

            expect(mockMailDispatch.send).toHaveBeenCalledTimes(1);
            const callArg = mockMailDispatch.send.mock.calls[0][0];
            expect(callArg.to).toBe('user@example.com');
            expect(callArg.attachments).toBeDefined();
            expect(callArg.attachments[0].filename).toContain('.ics');
            expect(callArg.attachments[0].contentType).toContain('text/calendar');
        });
    });

    describe('notifyBookingCreatedWithInvites', () => {
        it('should send emails with calendar invite to booker and all participants', async () => {
            const mockBooking = {
                id: 'booking-abc',
                title: 'Meeting Koordinasi Vendor',
                bookingDate: '2026-09-20',
                startTime: '09:00',
                endTime: '10:00',
                durationMinutes: 60,
                bookedByUser: {
                    fullName: 'Bagas Admin',
                    email: 'bagas@idesk.internal',
                },
                zoomAccount: { name: 'Zoom 1' },
                meeting: {
                    joinUrl: 'https://zoom.us/j/9999',
                    zoomMeetingId: '9999',
                    password: 'pwd',
                },
                participants: [
                    {
                        id: 'p1',
                        email: 'participant1@partner.com',
                        name: 'Vendor A',
                        emailSent: false,
                    },
                    {
                        id: 'p2',
                        email: 'participant2@idesk.internal',
                        name: 'Staff B',
                        emailSent: false,
                    },
                ],
            };

            mockBookingRepo.findOne.mockResolvedValue(mockBooking);

            await service.notifyBookingCreatedWithInvites('booking-abc');

            // 1 email to booker + 2 emails to participants = 3 total emails
            expect(mockMailDispatch.send).toHaveBeenCalledTimes(3);

            const recipients = mockMailDispatch.send.mock.calls.map((c) => c[0].to);
            expect(recipients).toContain('bagas@idesk.internal');
            expect(recipients).toContain('participant1@partner.com');
            expect(recipients).toContain('participant2@idesk.internal');

            // Verify participants emailSent flag was updated
            expect(mockParticipantRepo.save).toHaveBeenCalledTimes(2);
            expect(mockParticipantRepo.save.mock.calls.flatMap((c: any[]) => c[0]).every((p: any) => p.emailSent)).toBe(true);
        });

        it('announces a recurring series once: one email per person with every date in one .ics', async () => {
            const occurrence = (id: string, date: string) => ({
                id, seriesId: 's-1', title: 'Weekly', bookingDate: date, startTime: '09:00', endTime: '10:00', durationMinutes: 60,
                confirmationSentAt: null, meeting: { joinUrl: 'https://zoom.us/j/1' },
                participants: [{ id: `p-${id}`, email: 'guest@x.co', name: 'Guest', emailSent: false }],
            });
            const series = [occurrence('b1', '2026-11-16'), occurrence('b2', '2026-11-23'), occurrence('b3', '2026-11-30')];
            mockBookingRepo.findOne.mockResolvedValue({ ...series[0], bookedByUser: { fullName: 'Ani', email: 'ani@x.co' }, zoomAccount: { name: 'Z' } });
            mockBookingRepo.find.mockResolvedValue(series);

            await service.notifyBookingCreatedWithInvites('b1');

            expect(mockMailDispatch.send.mock.calls.map((c: any[]) => c[0].to).sort()).toEqual(['ani@x.co', 'guest@x.co']);
            const ics = mockMailDispatch.send.mock.calls[0][0].attachments[0].content;
            expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
            // All three participant rows are marked, so later occurrence events send nothing.
            expect(mockParticipantRepo.save.mock.calls[0][0]).toHaveLength(3);
        });

        it('sends nothing when the confirmation was already sent (retry, or another occurrence of the series)', async () => {
            mockBookingRepo.findOne.mockResolvedValue({ id: 'b1', confirmationSentAt: new Date(), bookedByUser: { email: 'ani@x.co' }, participants: [] });
            await service.notifyBookingCreatedWithInvites('b1');

            claimQb.execute.mockResolvedValueOnce({ affected: 0 });
            mockBookingRepo.findOne.mockResolvedValue({ id: 'b2', confirmationSentAt: null, bookedByUser: { email: 'ani@x.co' }, participants: [] });
            await service.notifyBookingCreatedWithInvites('b2');

            expect(mockMailDispatch.send).not.toHaveBeenCalled();
        });
    });

    describe('ZoomBookingEventListener', () => {
        it('should dispatch invites when zoom.meeting.created is received', async () => {
            const notifySpy = jest
                .spyOn(service, 'notifyBookingCreatedWithInvites')
                .mockResolvedValue(undefined);

            await listener.handleMeetingCreated({
                booking: { id: 'b-xyz' } as any,
                meeting: { joinUrl: 'https://zoom.us/j/888', zoomMeetingId: '888', password: 'abc' },
            });

            expect(notifySpy).toHaveBeenCalledWith('b-xyz', 'https://zoom.us/j/888', '888', 'abc');
        });
    });

    describe('in-app booking notifications', () => {
        const booking = { id: 'b-1', title: 'Weekly', bookingDate: '2026-11-20', startTime: '09:00', zoomAccountId: 'acc', meeting: { joinUrl: 'https://zoom.us/j/1' } } as any;

        it('goes through the core service (bell, toast, push) and links to the booking, not the join URL', async () => {
            await service.notifyBookingReminder('u-1', booking, 15);

            expect(mockNotificationService.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'u-1',
                type: NotificationType.ZOOM_BOOKING_REMINDER,
                category: NotificationCategory.CATEGORY_ZOOM,
                referenceId: 'b-1',
                link: '/zoom-calendar?booking=b-1',
            }));
        });

        it('tells the booker when someone else cancels, never the booker about their own cancel', async () => {
            const cancelSpy = jest.spyOn(service, 'notifyBookingCancelled').mockResolvedValue(undefined);
            const details = { id: 'b-1', bookedByUserId: 'owner', zoomAccountId: 'acc' };

            listener.handleBookingCancelled({ bookingDetails: details, cancelledBy: { id: 'admin', fullName: 'Admin A' }, reason: 'bentrok' });
            listener.handleBookingCancelled({ bookingDetails: details, cancelledBy: { id: 'owner' }, reason: 'x' });
            listener.handleBookingCancelled({ bookingDetails: details, cancelledBy: { id: 'admin' }, reason: 'x', cancelledByOwner: true });

            expect(cancelSpy).toHaveBeenCalledTimes(1);
            expect(cancelSpy).toHaveBeenCalledWith('owner', details, 'bentrok', 'Admin A');
        });
    });
});
