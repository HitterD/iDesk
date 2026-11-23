import { NotificationType } from '../../notifications/entities/notification.entity';
import { AgingNotifierListener } from './aging-notifier.listener';

const event = { requestId: 'hr-1', actorId: 'system', requesterId: 'req-1', occurredAt: new Date(), daysInStatus: 9, status: 'PROCUREMENT' };

function setup(opts: { flow?: boolean; ticket?: object | null } = {}) {
    const notif = { create: jest.fn(async () => ({})) };
    const center = { findStaffAtSite: jest.fn(async () => [{ id: 'ops-1' }, { id: 'ops-2' }]) };
    const query = { findById: jest.fn(async () => ({ id: 'hr-1', requestNumber: 'HR-2026-0042', siteId: 'site-1' })) };
    const flows = { has: jest.fn(async () => opts.flow ?? true) };
    const dataSource = { query: jest.fn(async () => (opts.ticket === null ? [] : [opts.ticket ?? { ticketId: 't-1', assignedToId: 'pic-1' }])) };
    const listener = new AgingNotifierListener(notif as never, center as never, query as never, flows as never, dataSource as never);
    return { listener, notif, center };
}

describe('AgingNotifierListener', () => {
    it('aging flag notifies the ticket PIC', async () => {
        const { listener, notif, center } = setup();

        await listener.onAgingFlagged(event);

        expect(notif.create).toHaveBeenCalledTimes(1);
        expect(notif.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'pic-1', type: NotificationType.HARDWARE_REQUEST_AGING, message: 'Request HR-2026-0042 belum bergerak 9 hari',
            link: '/tickets/t-1', ticketId: 't-1',
        }));
        expect(center.findStaffAtSite).not.toHaveBeenCalled();
    });

    it('is idempotent per request per day', async () => {
        const { listener, notif } = setup();

        await listener.onAgingFlagged(event);

        const { referenceId } = (notif.create.mock.calls[0] as unknown as [{ referenceId: string }])[0];
        expect(referenceId).toBe(`hr-1_aging_${new Date().toISOString().slice(0, 10)}`);
    });

    it('a flow ticket without a PIC goes to the ops-support agents of its site, linking the ticket', async () => {
        const { listener, notif, center } = setup({ ticket: { ticketId: 't-1', assignedToId: null } });

        await listener.onAgingFlagged(event);

        expect(center.findStaffAtSite).toHaveBeenCalledWith(expect.arrayContaining(['AGENT_OPERATIONAL_SUPPORT']), 'site-1');
        expect(notif.create.mock.calls.map((c) => (c as unknown as [{ userId: string }])[0].userId)).toEqual(['ops-1', 'ops-2']);
        expect(notif.create).toHaveBeenCalledWith(expect.objectContaining({ link: '/tickets/t-1', ticketId: 't-1' }));
    });

    it('a legacy request goes to the ops-support agents of its site', async () => {
        const { listener, notif, center } = setup({ flow: false });

        await listener.onAgingFlagged(event);

        expect(center.findStaffAtSite).toHaveBeenCalledWith(expect.arrayContaining(['AGENT_OPERATIONAL_SUPPORT']), 'site-1');
        expect(notif.create.mock.calls.map((c) => (c as unknown as [{ userId: string }])[0].userId)).toEqual(['ops-1', 'ops-2']);
        expect(notif.create).toHaveBeenCalledWith(expect.objectContaining({ link: '/hardware-requests/hr-1' }));
    });

    it('never throws into the cron', async () => {
        const { listener, notif } = setup();
        notif.create.mockRejectedValueOnce(new Error('db down'));

        await expect(listener.onAgingFlagged(event)).resolves.toBeUndefined();
    });
});
