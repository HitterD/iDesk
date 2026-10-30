import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { forwardToDesktopNotifier, readableTicketNumber, senderOf } from '../desktopNotifier';

const TICKET_ID = 'bb4ed960-03e1-4428-8f64-136f60340381';

describe('readableTicketNumber', () => {
    it('uses the ticket number and never the ticket id', () => {
        expect(readableTicketNumber({ ticketNumber: '281026-ORD-0012' })).toBe('281026-ORD-0012');
        expect(readableTicketNumber({ referenceId: TICKET_ID })).toBeUndefined();
        expect(readableTicketNumber({})).toBeUndefined();
    });
});

describe('senderOf', () => {
    it('names the person when known', () => {
        expect(senderOf({ senderName: 'Rizky Ardiansyah' })).toBe('Rizky Ardiansyah');
        expect(senderOf({})).toBe('iDesk');
    });
});

describe('forwardToDesktopNotifier', () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        localStorage.clear();
        fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('sends the problem title, the readable number and the PIC, never a GUID', async () => {
        await forwardToDesktopNotifier({
            type: 'TICKET_UPDATED',
            title: 'Printer lantai 2 tidak bisa print',
            message: 'Ditutup otomatis: tidak dikonfirmasi dalam batas waktu · PIC Rizky Ardiansyah',
            ticketId: TICKET_ID,
            ticketNumber: '281026-ORD-0012',
            senderName: 'Rizky Ardiansyah',
        }, { name: 'Budi Santoso', role: 'USER' });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.title).toBe('Printer lantai 2 tidak bisa print');
        expect(body.ticketNumber).toBe('281026-ORD-0012');
        expect(body.metadata).toMatchObject({ from: 'Rizky Ardiansyah', ticketNumber: '281026-ORD-0012' });
        expect(body.metadata.from).not.toBe('iDesk System');
        expect(body.ticketNumber).not.toBe(TICKET_ID);
    });
});
