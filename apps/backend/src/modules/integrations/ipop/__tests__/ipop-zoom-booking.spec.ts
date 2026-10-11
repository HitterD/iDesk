import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IpopZoomBookingService } from '../ipop-zoom-booking.service';
import { IpopZoomEventsListener } from '../ipop-zoom-events.listener';
import { BookingStatus } from '../../../zoom-booking/enums/booking-status.enum';

const booking = (over: Record<string, unknown> = {}) => ({
    id: 'b-1', seriesId: null, title: 'Weekly sync', description: 'Agenda Q4',
    bookingDate: '2026-10-12', startTime: '09:00:00', endTime: '10:30:00', durationMinutes: 90,
    status: BookingStatus.CONFIRMED,
    bookedByUserId: 'u-1', bookedByUser: { id: 'u-1', employeeId: '00000024', fullName: 'Budi', email: 'budi@santos.co.id' },
    zoomAccount: { name: 'Zoom 1' },
    meeting: {
        zoomMeetingId: '81234567890', joinUrl: 'https://zoom.us/j/81234567890?pwd=x', password: 'abc123',
        startUrl: 'https://zoom.us/s/secret', hostEmail: 'host@santos.co.id',
    },
    participants: [
        { email: 'Sari@santos.co.id', name: 'Sari', isExternal: false },
        { email: 'guest@vendor.com', name: 'Guest', isExternal: true },
    ],
    updatedAt: new Date('2026-10-11T01:00:00Z'),
    ...over,
});

function build(opts: { found?: any; list?: any[]; user?: any } = {}) {
    const qb: any = {
        leftJoinAndSelect: jest.fn(() => qb), leftJoin: jest.fn(() => qb), where: jest.fn(() => qb), andWhere: jest.fn(() => qb),
        orderBy: jest.fn(() => qb), addOrderBy: jest.fn(() => qb), take: jest.fn(() => qb),
        getMany: jest.fn(async () => opts.list ?? []),
    };
    const bookingRepo = {
        findOne: jest.fn(async () => ('found' in opts ? opts.found : booking())),
        createQueryBuilder: jest.fn(() => qb),
    };
    const userRepo = {
        findOne: jest.fn(async () => ('user' in opts ? opts.user : { id: 'u-1', email: 'budi@santos.co.id' })),
        find: jest.fn(async () => [{ email: 'sari@santos.co.id', employeeId: '00000031', fullName: 'Sari Dewi' }]),
    };
    const config = { get: (k: string) => (k === 'FRONTEND_URL' ? 'https://idesk.santos.co.id/' : undefined) } as any;
    return { service: new IpopZoomBookingService(bookingRepo as any, userRepo as any, config), bookingRepo, userRepo, qb };
}

describe('IpopZoomBookingService.loadView', () => {
    it('maps a confirmed booking to a calendar entry in UTC, with the Zoom join data', async () => {
        const { service } = build();
        const view = await service.loadView('b-1');
        expect(view).toEqual({
            bookingId: 'b-1',
            seriesId: null,
            title: 'Weekly sync',
            description: 'Agenda Q4',
            start: '2026-10-12T02:00:00.000Z',
            end: '2026-10-12T03:30:00.000Z',
            timezone: 'Asia/Jakarta',
            account: { name: 'Zoom 1' },
            zoom: { meetingId: '81234567890', joinUrl: 'https://zoom.us/j/81234567890?pwd=x', passcode: 'abc123' },
            attendees: [
                { nik: '00000024', name: 'Budi', role: 'BOOKER' },
                { nik: '00000031', name: 'Sari Dewi', role: 'PARTICIPANT' },
            ],
            updatedAt: '2026-10-11T01:00:00.000Z',
            url: 'https://idesk.santos.co.id/zoom-booking/b-1',
        });
    });

    it('never exposes the host start URL or host email', async () => {
        const { service } = build();
        const json = JSON.stringify(await service.loadView('b-1'));
        expect(json).not.toContain('zoom.us/s/secret');
        expect(json).not.toContain('host@santos.co.id');
    });

    it('reads a Date bookingDate as the local calendar day', async () => {
        const { service } = build({ found: booking({ bookingDate: new Date(2026, 9, 12) }) });
        expect((await service.loadView('b-1'))!.start).toBe('2026-10-12T02:00:00.000Z');
    });

    it.each([
        ['pending (Zoom link not created yet)', booking({ status: BookingStatus.PENDING })],
        ['without a join link', booking({ meeting: null })],
        ['with nobody iPop knows (no NIK anywhere)', booking({ bookedByUser: { employeeId: null }, participants: [] })],
        ['that no longer exists', null],
    ])('skips a booking %s', async (_label, found) => {
        const { service, userRepo } = build({ found });
        userRepo.find.mockResolvedValue([]);
        expect(await service.loadView('b-1')).toBeNull();
    });

    it('lists the booker once when also invited as a participant', async () => {
        const { service, userRepo } = build();
        userRepo.find.mockResolvedValue([{ email: 'budi@santos.co.id', employeeId: '00000024', fullName: 'Budi' }]);
        const view = await service.loadView('b-1');
        expect(view!.attendees).toEqual([{ nik: '00000024', name: 'Budi', role: 'BOOKER' }]);
    });
});

describe('IpopZoomBookingService.find', () => {
    it('rejects a range longer than 92 days or reversed', async () => {
        const { service } = build();
        await expect(service.find({ nik: '1', from: '2026-01-01', to: '2026-06-01' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.find({ nik: '1', from: '2026-02-01', to: '2026-01-01' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns nothing for an unknown NIK', async () => {
        const { service, qb } = build({ user: null });
        expect(await service.find({ nik: '999', from: '2026-10-01', to: '2026-10-31' })).toEqual([]);
        expect(qb.getMany).not.toHaveBeenCalled();
    });

    it('returns the confirmed bookings the user booked or is invited to', async () => {
        const { service, qb } = build({ list: [booking()] });
        const result = await service.find({ nik: '00000024', from: '2026-10-01', to: '2026-10-31' });
        expect(result.map((b) => b.bookingId)).toEqual(['b-1']);
        expect(qb.where).toHaveBeenCalledWith(
            expect.stringContaining('bookedByUserId'),
            expect.objectContaining({ userId: 'u-1', email: 'budi@santos.co.id' }),
        );
    });
});

describe('IpopZoomBookingService.getById', () => {
    it('404s a booking iPop may not see', async () => {
        const { service } = build({ found: null });
        await expect(service.getById('b-x')).rejects.toBeInstanceOf(NotFoundException);
    });
});

describe('IpopZoomEventsListener', () => {
    const buildListener = (view: any = { bookingId: 'b-1' }) => {
        const webhooks = { isEnabled: () => true, enqueueZoomBooking: jest.fn() };
        const bookings = { loadView: jest.fn(async (id: string) => (view ? { ...view, bookingId: id } : null)) };
        return { listener: new IpopZoomEventsListener(bookings as any, webhooks as any), webhooks };
    };

    it('sends created once the Zoom meeting exists', async () => {
        const { listener, webhooks } = buildListener();
        await listener.onMeetingCreated({ booking: { id: 'b-1' } });
        expect(webhooks.enqueueZoomBooking).toHaveBeenCalledWith('zoom_booking.created', expect.objectContaining({ bookingId: 'b-1' }));
    });

    it('sends updated for every rescheduled occurrence', async () => {
        const { listener, webhooks } = buildListener();
        await listener.onRescheduled({ bookingId: 'b-1', bookingIds: ['b-1', 'b-2'] });
        expect(webhooks.enqueueZoomBooking.mock.calls.map((c: any[]) => [c[0], c[1].bookingId]))
            .toEqual([['zoom_booking.updated', 'b-1'], ['zoom_booking.updated', 'b-2']]);
    });

    it('sends cancelled with only ids, for every deleted occurrence', async () => {
        const { listener, webhooks } = buildListener();
        await listener.onCancelled({ bookingDetails: { id: 'b-1', title: 'x' }, bookingIds: ['b-1', 'b-2'], seriesId: 's-1' });
        expect(webhooks.enqueueZoomBooking.mock.calls).toEqual([
            ['zoom_booking.cancelled', { bookingId: 'b-1', seriesId: 's-1' }],
            ['zoom_booking.cancelled', { bookingId: 'b-2', seriesId: 's-1' }],
        ]);
    });

    it('stays silent for a booking iPop cannot see', async () => {
        const { listener, webhooks } = buildListener(null);
        await listener.onMeetingCreated({ booking: { id: 'b-1' } });
        expect(webhooks.enqueueZoomBooking).not.toHaveBeenCalled();
    });
});
