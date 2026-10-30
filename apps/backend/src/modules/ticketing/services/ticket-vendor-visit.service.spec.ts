import { BadRequestException } from '@nestjs/common';
import { TicketReminder } from '../entities/ticket-reminder.entity';
import {
    TicketVendorVisitService,
    VENDOR_VISIT_REMIND_BEFORE_MS,
    defaultVendorVisit,
    formatVendorVisit,
    normalizeVendorNote,
} from './ticket-vendor-visit.service';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('defaultVendorVisit', () => {
    it('is next Thursday 09:00 WIB (02:00 UTC) whatever the server timezone', () => {
        // Monday 20 Oct 2026, 10:00 WIB
        const visit = defaultVendorVisit(new Date('2026-10-20T03:00:00Z'));
        expect(visit.toISOString()).toBe('2026-10-22T02:00:00.000Z');
        expect(formatVendorVisit(visit)).toMatch(/Kamis, 22 Oktober 2026.*09[.:]00 WIB/);
    });

    it('moves to the following week when it is already Thursday in WIB', () => {
        // Wednesday 18:00 UTC is Thursday 01:00 WIB
        expect(defaultVendorVisit(new Date('2026-10-21T18:00:00Z')).toISOString()).toBe('2026-10-29T02:00:00.000Z');
    });
});

describe('TicketVendorVisitService', () => {
    const service = new TicketVendorVisitService({} as any, {} as any, {} as any);
    const now = new Date('2026-10-20T03:00:00Z');

    describe('resolveVisit', () => {
        it('falls back to the default visit day when nothing is requested', () => {
            expect(service.resolveVisit(undefined, now)).toEqual(defaultVendorVisit(now));
        });

        it.each([
            ['in the past', '2026-10-19T03:00:00Z'],
            ['more than 90 days ahead', '2027-02-01T03:00:00Z'],
            ['not a date', 'besok'],
        ])('rejects a time %s', (_label, value) => {
            expect(() => service.resolveVisit(value, now)).toThrow(BadRequestException);
        });
    });

    describe('schedule / clear', () => {
        let manager: any;
        beforeEach(() => {
            manager = {
                create: jest.fn((_e: any, x: any) => x),
                save: jest.fn(async (_e: any, x: any) => ({ ...x, id: 'rem-new' })),
                delete: jest.fn(),
            };
        });

        it('reminds the PIC 30 minutes before and cancels the reminder it replaces', async () => {
            const ticket: any = { id: 't1', vendorVisitReminderId: 'rem-old' };
            const visitAt = new Date(Date.now() + 2 * DAY);

            await service.schedule(manager, ticket, visitAt, 'agent-1');

            expect(manager.delete).toHaveBeenCalledWith(TicketReminder, { id: 'rem-old', isSent: false });
            const reminder = manager.save.mock.calls[0][1];
            expect(reminder.remindAt.getTime()).toBe(visitAt.getTime() - VENDOR_VISIT_REMIND_BEFORE_MS);
            expect(reminder.note).toContain('Janji kunjungan vendor');
            expect(ticket).toMatchObject({ vendorVisitAt: visitAt, vendorVisitReminderId: 'rem-new' });
        });

        it('skips the reminder when the appointment is less than 30 minutes away', async () => {
            const ticket: any = { id: 't1', vendorVisitReminderId: null };

            await service.schedule(manager, ticket, new Date(Date.now() + 10 * 60 * 1000), 'agent-1');

            expect(manager.save).not.toHaveBeenCalled();
            expect(ticket.vendorVisitReminderId).toBeNull();
        });

        it('clears the appointment and its pending reminder when the wait ends', async () => {
            const ticket: any = { id: 't1', vendorVisitAt: new Date(), vendorVisitReminderId: 'rem-1' };

            await service.clear(manager, ticket);

            expect(manager.delete).toHaveBeenCalledWith(TicketReminder, { id: 'rem-1', isSent: false });
            expect(ticket).toMatchObject({ vendorVisitAt: null, vendorVisitReminderId: null });
        });
    });
});

describe('normalizeVendorNote', () => {
    it('trims the note and treats blanks as no note', () => {
        expect(normalizeVendorNote('  Menunggu spare part ')).toBe('Menunggu spare part');
        expect(normalizeVendorNote('   ')).toBeNull();
        expect(normalizeVendorNote(undefined)).toBeNull();
    });
});

describe('vendor note in the system message', () => {
    it('lists the note above the appointment', () => {
        const service = new TicketVendorVisitService({} as any, {} as any, {} as any);
        const text = service.note(new Date('2026-10-29T02:00:00Z'), 'Yudi', true, 'Menunggu spare part');
        expect(text).toContain('📝 Keterangan: Menunggu spare part');
        expect(text.indexOf('Keterangan')).toBeLessThan(text.indexOf('Janji vendor'));
    });
});
