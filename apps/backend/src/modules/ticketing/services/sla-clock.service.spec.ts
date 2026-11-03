import { Ticket, TicketPriority } from '../entities/ticket.entity';
import { BusinessSchedule } from '../../sla-config/business-hours.calc';
import { createTestSlaClock } from './sla-clock.testing';

const WIB: BusinessSchedule = {
    workDays: [1, 2, 3, 4, 5],
    startTime: 480,
    endTime: 1020,
    timezone: 'Asia/Jakarta',
    holidays: [],
};

const CONFIGS = [
    { priority: 'MEDIUM', resolutionTimeMinutes: 540, responseTimeMinutes: 240, businessHoursOnly: true },
    { priority: 'HIGH', resolutionTimeMinutes: 240, responseTimeMinutes: 60, businessHoursOnly: true },
    { priority: 'CRITICAL', resolutionTimeMinutes: 120, responseTimeMinutes: 15, businessHoursOnly: false },
];

const wib = (iso: string) => new Date(`${iso}+07:00`);
const ticket = (overrides: Partial<Ticket> = {}): Ticket =>
    ({ id: 't1', priority: TicketPriority.MEDIUM, slaTarget: null, slaStartedAt: null, firstResponseAt: null,
        firstResponseTarget: null, slaRemainingMinutes: null, firstResponseRemainingMinutes: null, isOverdue: false,
        ...overrides } as Ticket);

describe('SlaClockService', () => {
    const clock = createTestSlaClock(CONFIGS, WIB);

    describe('firstResponseTarget', () => {
        it('starts counting at 08:00 for a ticket created at night', async () => {
            // Thu 2026-10-01 20:00 WIB + 240 business minutes -> Fri 12:00
            expect(await clock.firstResponseTarget('MEDIUM', wib('2026-10-01T20:00:00'))).toEqual(wib('2026-10-02T12:00:00'));
        });

        it('runs around the clock for CRITICAL', async () => {
            expect(await clock.firstResponseTarget('CRITICAL', wib('2026-10-03T22:00:00'))).toEqual(wib('2026-10-03T22:15:00'));
        });

        it('is null when the priority has no config', async () => {
            expect(await clock.firstResponseTarget('UNKNOWN', wib('2026-10-01T10:00:00'))).toBeNull();
        });
    });

    describe('startResolution', () => {
        it('skips the weekend', async () => {
            const t = ticket();
            await clock.startResolution(t, wib('2026-10-02T16:00:00')); // Fri
            // 60 minutes on Friday, 480 on Monday
            expect(t.slaTarget).toEqual(wib('2026-10-05T16:00:00'));
            expect(t.originalSlaTarget).toEqual(t.slaTarget);
            expect(t.slaStartedAt).toEqual(wib('2026-10-02T16:00:00'));
        });
    });

    describe('hold / release', () => {
        it('keeps the business minutes left and re-projects them on resume', async () => {
            const t = ticket({ slaTarget: wib('2026-10-02T12:00:00') });
            await clock.hold(t, wib('2026-10-02T10:00:00')); // 120 minutes left
            expect(t.slaRemainingMinutes).toBe(120);

            await clock.release(t, wib('2026-10-05T16:00:00')); // Mon 16:00
            expect(t.slaTarget).toEqual(wib('2026-10-06T09:00:00'));
            expect(t.slaRemainingMinutes).toBeNull();
        });

        it('also holds a pending first-response target', async () => {
            const t = ticket({ firstResponseTarget: wib('2026-10-01T11:00:00') });
            await clock.hold(t, wib('2026-10-01T10:00:00'));
            expect(t.firstResponseRemainingMinutes).toBe(60);

            await clock.release(t, wib('2026-10-01T20:00:00'));
            expect(t.firstResponseTarget).toEqual(wib('2026-10-02T09:00:00'));
        });

        it('does not overwrite an existing hold', async () => {
            const t = ticket({ slaTarget: wib('2026-10-02T12:00:00'), slaRemainingMinutes: 30 });
            await clock.hold(t, wib('2026-10-02T09:00:00'));
            expect(t.slaRemainingMinutes).toBe(30);
        });

        it('keeps zero when held after the target already passed', async () => {
            const t = ticket({ slaTarget: wib('2026-10-01T09:00:00') });
            await clock.hold(t, wib('2026-10-01T10:00:00'));
            expect(t.slaRemainingMinutes).toBe(0);
        });

        it('release clears isOverdue when resumed target is in the future', async () => {
            const now = wib('2026-10-05T10:00:00');
            const t = ticket({ slaRemainingMinutes: 300, isOverdue: true });

            await clock.release(t, now);

            expect(t.slaTarget).toEqual(wib('2026-10-05T15:00:00'));
            expect(t.isOverdue).toBe(false);
        });

        it('release keeps isOverdue when remaining is 0', async () => {
            const now = wib('2026-10-05T10:00:00');
            const t = ticket({ slaRemainingMinutes: 0, isOverdue: true });

            await clock.release(t, now);

            expect(t.slaTarget).toEqual(now);
            expect(t.isOverdue).toBe(true);
        });

        it('release is a no-op without a hold', async () => {
            const t = ticket({ slaTarget: wib('2026-10-02T12:00:00') });
            expect(await clock.release(t, wib('2026-10-05T10:00:00'))).toBe(false);
            expect(t.slaTarget).toEqual(wib('2026-10-02T12:00:00'));
        });
    });

    describe('changePriority', () => {
        it('keeps the minutes already used when moving MEDIUM -> HIGH', async () => {
            // Started Thu 08:00 with 540; at 10:00 120 used, 420 left. HIGH = 240 -> 120 left.
            const t = ticket({ slaStartedAt: wib('2026-10-01T08:00:00'), slaTarget: wib('2026-10-01T17:00:00') });
            await clock.changePriority(t, 'HIGH', wib('2026-10-01T10:00:00'));
            expect(t.slaTarget).toEqual(wib('2026-10-01T12:00:00'));
        });

        it('adjusts a held remainder instead of the target', async () => {
            const t = ticket({ slaStartedAt: wib('2026-10-01T08:00:00'), slaTarget: wib('2026-10-01T17:00:00'), slaRemainingMinutes: 400 });
            await clock.changePriority(t, 'HIGH', wib('2026-10-01T10:00:00'));
            expect(t.slaRemainingMinutes).toBe(100);
            expect(t.slaTarget).toEqual(wib('2026-10-01T17:00:00'));
        });

        it('switches to round-the-clock counting for CRITICAL', async () => {
            // 420 business minutes left on MEDIUM, CRITICAL budget 120 -> 0 left; target = now.
            const t = ticket({ slaStartedAt: wib('2026-10-01T08:00:00'), slaTarget: wib('2026-10-01T17:00:00') });
            await clock.changePriority(t, 'CRITICAL', wib('2026-10-01T10:00:00'));
            expect(t.slaTarget).toEqual(wib('2026-10-01T10:00:00'));
        });

        it('does nothing before the clock started', async () => {
            const t = ticket();
            expect(await clock.changePriority(t, 'HIGH', wib('2026-10-01T10:00:00'))).toBeNull();
            expect(t.slaTarget).toBeNull();
        });
    });

    describe('adoptUnstarted', () => {
        // A ticket that skipped IN_PROGRESS (TODO -> WAITING_VENDOR) never started its clock.
        // Adopting it counts from creation: the same target the ticket page already shows.
        const created = wib('2026-10-01T08:00:00'); // Thu

        it('starts the clock at creation with the projected target', async () => {
            const t = ticket({ createdAt: created } as Partial<Ticket>);
            expect(await clock.adoptUnstarted(t, wib('2026-10-01T10:00:00'))).toBe(true);
            expect(t.slaStartedAt).toEqual(created);
            expect(t.slaTarget).toEqual(wib('2026-10-01T17:00:00')); // MEDIUM 540 business minutes
            expect(t.originalSlaTarget).toEqual(t.slaTarget);
            expect(t.slaRemainingMinutes).toBeNull();
        });

        it('holds what is left when the ticket is paused', async () => {
            const t = ticket({ createdAt: created } as Partial<Ticket>);
            await clock.adoptUnstarted(t, wib('2026-10-01T15:00:00'), { paused: true });
            expect(t.slaRemainingMinutes).toBe(120);
        });

        it('holds zero once the projected target has passed', async () => {
            const t = ticket({ createdAt: created } as Partial<Ticket>);
            await clock.adoptUnstarted(t, wib('2026-10-08T10:00:00'), { paused: true });
            expect(t.slaRemainingMinutes).toBe(0);
        });

        it('leaves a started clock alone', async () => {
            const t = ticket({ createdAt: created, slaStartedAt: wib('2026-10-01T09:00:00'), slaTarget: wib('2026-10-01T18:00:00') } as Partial<Ticket>);
            expect(await clock.adoptUnstarted(t, wib('2026-10-01T10:00:00'))).toBe(false);
            expect(t.slaTarget).toEqual(wib('2026-10-01T18:00:00'));
        });

        it('does nothing when the priority has no config', async () => {
            const t = ticket({ createdAt: created, priority: 'UNKNOWN' } as unknown as Partial<Ticket>);
            expect(await clock.adoptUnstarted(t, wib('2026-10-01T10:00:00'))).toBe(false);
            expect(t.slaStartedAt).toBeNull();
        });
    });

    describe('hardwareTarget', () => {
        it('is 17:00 WIB on the first working day after the schedule', async () => {
            expect(await clock.hardwareTarget(wib('2026-10-02T09:00:00'))).toEqual(wib('2026-10-05T17:00:00'));
        });
    });
});
