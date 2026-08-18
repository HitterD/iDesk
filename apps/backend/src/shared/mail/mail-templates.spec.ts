import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as Handlebars from 'handlebars';

/**
 * Contract test between each email template and the context its call sites send.
 *
 * MailerModule compiles Handlebars with `strict: true` (app.module.ts), so a
 * bare `{{var}}` that the caller never supplies throws at render time and the
 * email is silently lost. These cases mirror the real contexts; keep them in
 * sync whenever a call site changes.
 */
const TEMPLATE_DIR = join(__dirname, '..', '..', 'assets', 'templates');

const render = (template: string, context: Record<string, unknown>): string => {
    const source = readFileSync(join(TEMPLATE_DIR, `${template}.hbs`), 'utf8');
    return Handlebars.compile(source, { strict: true })(context);
};

const YEAR = 2026;

describe('email templates', () => {
    const cases: Array<[string, string, Record<string, unknown>]> = [
        ['ticket-assigned (manual)', 'ticket-assigned', {
            name: 'Agent A', ticketId: 't-1', ticketNumber: 'TK-1', status: 'OPEN', title: 'Printer rusak',
            assigneeName: 'Agent A', assignerName: 'Admin', message: 'assigned', link: 'http://app/tickets/t-1', year: YEAR,
        }],
        ['ticket-assigned (auto, no message)', 'ticket-assigned', {
            name: 'Agent A', ticketId: 't-1', ticketNumber: 'TK-1', status: 'OPEN', title: 'Printer rusak',
            assigneeName: 'Agent A', assignerName: 'Auto-assign', link: 'http://app/tickets/t-1', year: YEAR,
        }],
        ['eform-request (submitted, with site)', 'eform-request', {
            request: { id: 'e-1', formType: 'VPN', status: 'PENDING_MANAGER', requesterName: 'User R' },
            recipientName: 'Manager M', link: 'http://app/eform/e-1', siteLabel: '[SITE-1]', year: YEAR,
        }],
        ['eform-request (confirmed, no site)', 'eform-request', {
            request: { id: 'e-1', formType: 'VPN', status: 'CONFIRMED', requesterName: 'User R' },
            recipientName: 'User R', link: 'http://app/eform/e-1', year: YEAR,
        }],
        ['eform-request (rejected, with reason)', 'eform-request', {
            request: { id: 'e-1', formType: 'VPN', status: 'REJECTED', requesterName: 'User R', rejectionReason: 'Tidak sesuai' },
            recipientName: 'User R', link: 'http://app/eform/e-1', year: YEAR,
        }],
        ['mention-notification', 'mention-notification', {
            name: 'Agent A', ticketId: 't-1', mentionedBy: 'Admin', link: 'http://app/admin/tickets/t-1', year: YEAR,
        }],
        ['contract-reminder', 'contract-reminder', {
            recipientName: 'Admin', contractNumber: 'C-1', companyName: 'PT Kapal Api', expiryDate: '2026-09-01',
            daysUntilExpiry: 14, contractUrl: 'http://app/renewals/c-1', year: YEAR,
        }],
        ['notification (full)', 'notification', {
            title: 'Judul', message: 'Isi', link: 'http://app/x', ticketId: 't-1',
            notificationId: 'n-1', baseUrl: 'http://app', year: YEAR,
        }],
        ['notification (no link/ticket)', 'notification', {
            title: 'Judul', message: 'Isi', link: undefined, ticketId: undefined,
            notificationId: 'n-1', baseUrl: 'http://app', year: YEAR,
        }],
        ['ticket-update', 'ticket-update', {
            name: 'User R', ticketId: 't-1', status: 'RESOLVED', title: 'Printer rusak',
        }],
        ['welcome-user', 'welcome-user', {
            name: 'User R', email: 'r@x.com', password: 'secret',
        }],
        ['hardware-request-status', 'hardware-request-status', {
            requestNumber: 'HR-1', title: 'Permintaan Disetujui', status: 'Proses Procurement',
            message: 'Disetujui', link: 'http://app/hardware-requests/h-1',
        }],
        ['zoom-booking (confirmed)', 'zoom-booking', {
            headerTitle: 'Zoom Meeting Confirmed', actionBadge: 'CONFIRMED', actionClass: 'action-created',
            greeting: 'Hi', meetingTitle: 'Sync', meetingDate: '1 Sep 2026', meetingTime: '09:00 - 10:00 WIB',
            duration: 60, hostName: 'Host', joinUrl: 'http://zoom/j', meetingId: '123', passcode: 'pw',
            note: 'catatan', year: YEAR,
        }],
        ['zoom-booking (rescheduled)', 'zoom-booking', {
            headerTitle: 'Meeting Rescheduled', actionBadge: 'RESCHEDULED', actionClass: 'action-rescheduled',
            greeting: 'Hi', meetingTitle: 'Sync', meetingDate: '1 Sep 2026', meetingTime: '09:00 - 10:00 WIB',
            duration: 60, hostName: 'Host', oldDate: '31 Agu 2026', oldTime: '09:00 - 10:00 WIB',
            joinUrl: 'http://zoom/j', meetingId: '123', passcode: undefined, note: 'catatan', year: YEAR,
        }],
        ['zoom-booking (cancelled)', 'zoom-booking', {
            headerTitle: 'Meeting Cancelled', actionBadge: 'CANCELLED', actionClass: 'action-cancelled',
            greeting: 'Hi', meetingTitle: 'Sync', meetingDate: '1 Sep 2026', meetingTime: '09:00 - 10:00 WIB',
            duration: 60, hostName: 'Host', cancellationReason: 'Dibatalkan oleh: Admin', year: YEAR,
        }],
    ];

    it.each(cases)('%s renders in strict mode', (_label, template, context) => {
        const html = render(template, context);
        expect(html.length).toBeGreaterThan(0);
        expect(html).not.toContain('undefined');
    });

    it('every template referenced by code exists on disk', () => {
        const referenced = [
            'contract-reminder', 'eform-request', 'hardware-request-status', 'mention-notification',
            'notification', 'ticket-assigned', 'ticket-update', 'welcome-user', 'zoom-booking',
        ];
        const missing = referenced.filter((t) => !existsSync(join(TEMPLATE_DIR, `${t}.hbs`)));
        expect(missing).toEqual([]);
    });
});
