import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZoomNotificationService, generateIcsCalendar } from '../zoom-notification.service';
import { ZoomBookingEventListener } from '../zoom-booking-event.listener';
import { ZoomBooking, ZoomParticipant } from '../../entities';
import { Notification } from '../../../notifications/entities/notification.entity';
import { ZoomGateway } from '../../gateways/zoom.gateway';
import { MailDispatchService } from '../../../../shared/mail/mail-dispatch.service';

describe('ZoomNotificationService & EventListener', () => {
    let service: ZoomNotificationService;
    let listener: ZoomBookingEventListener;

    const mockNotificationRepo = {
        create: jest.fn().mockImplementation((dto) => dto),
        save: jest.fn().mockResolvedValue({ id: 'n1' }),
    };

    const mockBookingRepo = {
        findOne: jest.fn(),
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
                    provide: getRepositoryToken(Notification),
                    useValue: mockNotificationRepo,
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
            expect(mockBooking.participants[0].emailSent).toBe(true);
            expect(mockBooking.participants[1].emailSent).toBe(true);
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
});
