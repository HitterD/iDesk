import { ZoomReminderService, ZOOM_REMINDER_MINUTES } from '../zoom-reminder.service';

describe('ZoomReminderService', () => {
    let bookingRepo: any;
    let userRepo: any;
    let notifications: any;
    let service: ZoomReminderService;

    beforeEach(() => {
        bookingRepo = {
            query: jest.fn().mockResolvedValue([[{ id: 'b1' }], 1]),
            findOne: jest.fn().mockResolvedValue({
                id: 'b1', bookedByUserId: 'owner', participants: [{ email: 'Staff@x.co' }, { email: 'guest@outside.com' }],
            }),
        };
        userRepo = { find: jest.fn().mockResolvedValue([{ id: 'staff' }]) };
        notifications = { notifyBookingReminder: jest.fn().mockResolvedValue(undefined) };
        service = new ZoomReminderService(bookingRepo, userRepo, notifications);
    });

    it('reminds the booker and participants with an iDesk account, once per claimed booking', async () => {
        expect(await service.run()).toBe(1);

        expect(bookingRepo.query.mock.calls[0][1]).toEqual(['CONFIRMED', ZOOM_REMINDER_MINUTES]);
        expect(bookingRepo.query.mock.calls[0][0]).toContain('"reminderSentAt" IS NULL');
        expect(notifications.notifyBookingReminder.mock.calls.map((c: any[]) => c[0]).sort()).toEqual(['owner', 'staff']);
    });

    it('does nothing when no booking is due (or another instance claimed it)', async () => {
        bookingRepo.query.mockResolvedValue([[], 0]);
        expect(await service.run()).toBe(0);
        expect(notifications.notifyBookingReminder).not.toHaveBeenCalled();
    });
});
