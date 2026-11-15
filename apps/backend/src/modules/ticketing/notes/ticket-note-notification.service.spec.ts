import { TicketNoteNotificationService } from './ticket-note-notification.service';
import { TicketNoteMember } from './entities/ticket-note-member.entity';
import { TicketNoteDelivery } from './entities/ticket-note-delivery.entity';

describe('TicketNoteNotificationService', () => {
    it('queues only other members and upgrades mention delivery without duplicate messages', async () => {
        const deliveries: any[] = [];
        const manager: any = {
            find: async (entity: any) => entity === TicketNoteMember ? [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }] : [],
            create: (_: any, value: any) => value,
            save: async (entity: any, value: any) => { if (entity === TicketNoteDelivery) deliveries.push(value); return value; },
        };
        const service = new TicketNoteNotificationService({} as any, {} as any, {} as any, {} as any);
        await service.enqueue(manager, { id: 'n', eventSequence: 3 } as any, 'a', 'MESSAGE', ['b']);
        expect(deliveries.map(row => [row.recipientId, row.kind])).toEqual([['b', 'MENTION'], ['c', 'MESSAGE']]);
        expect(JSON.stringify(deliveries)).not.toContain('content');
    });
    it('uses a stable notification id for retried delivery', async () => {
        const sent: any[] = [];
        const manager: any = { save: async (_: any, row: any) => row };
        const service = new TicketNoteNotificationService({ manager } as any,
            { assertMember: async () => ({ note: { id: 'n', ticketId: 't' } }) } as any,
            { send: async (payload: any) => { sent.push(payload); return { id: payload.id }; } } as any, undefined);
        const delivery: any = { id: 'stable-id', noteId: 'n', recipientId: 'b', kind: 'MESSAGE', attemptCount: 0 };
        await service.deliver(delivery);
        await service.deliver(delivery);
        expect(sent.map(payload => payload.id)).toEqual(['stable-id', 'stable-id']);
    });

    it('drops delivery when recipient is no longer eligible', async () => {
        const delivery: any = { id: 'd', noteId: 'n', recipientId: 'b', state: 'PENDING' };
        const manager: any = { save: async (_: any, value: any) => Object.assign(delivery, value) };
        const source: any = { manager };
        const access: any = { assertMember: async () => { const { NotFoundException } = await import('@nestjs/common'); throw new NotFoundException(); } };
        const center: any = { send: jest.fn() };
        const service = new TicketNoteNotificationService(source, access, center, {} as any);
        await service.deliver(delivery);
        expect(delivery.state).toBe('CANCELLED');
        expect(center.send).not.toHaveBeenCalled();
    });

    it('skips creating a notification when recipient is currently viewing the note', async () => {
        const deliveries: any[] = [];
        const manager: any = { save: async (_: any, row: any) => { deliveries.push(row); return row; } };
        const center: any = { send: jest.fn() };
        const emit = jest.fn();
        const gateway: any = { isViewingNote: jest.fn(async () => true), server: { to: jest.fn(() => ({ emit })) } };
        const service = new TicketNoteNotificationService(
            { manager } as any,
            { assertMember: async () => ({ note: { id: 'n1', ticketId: 't1', eventSequence: 2 }, member: { lastReadSequence: 0 } }) } as any,
            center,
            gateway,
        );

        await service.deliver({ id: 'd1', noteId: 'n1', recipientId: 'u2', sequence: 2, kind: 'MESSAGE', attemptCount: 0 } as any);

        expect(center.send).not.toHaveBeenCalled();
        expect(deliveries.at(-1)).toMatchObject({ state: 'SENT', notificationId: null });
        expect(emit).toHaveBeenCalledWith('ticket-note:changed', { ticketId: 't1', noteId: 'n1' });
    });

    it('suppresses MESSAGE/MENTION already read, keeps INVITE at initial sequence, and guards SOLUTION by strictly greater sequence', async () => {
        const saved: any[] = [];
        const manager: any = { save: async (_: any, row: any) => { saved.push(row); return row; } };
        const center: any = { send: jest.fn(async (p: any) => ({ id: p.id })) };
        const member = { lastReadSequence: 2 };
        const note = { id: 'n1', ticketId: 't1', eventSequence: 2 };
        const gateway: any = { isViewingNote: async () => false, server: { to: () => ({ emit: jest.fn() }) } };
        const service = new TicketNoteNotificationService(
            { manager } as any,
            { assertMember: async () => ({ note, member }) } as any,
            center,
            gateway,
        );

        await service.deliver({ id: 'd-msg', noteId: 'n1', recipientId: 'u2', sequence: 2, kind: 'MESSAGE', attemptCount: 0 } as any);
        await service.deliver({ id: 'd-men', noteId: 'n1', recipientId: 'u2', sequence: 2, kind: 'MENTION', attemptCount: 0 } as any);
        expect(center.send).not.toHaveBeenCalled();

        await service.deliver({ id: 'd-inv', noteId: 'n1', recipientId: 'u2', sequence: 2, kind: 'INVITE', attemptCount: 0 } as any);
        await service.deliver({ id: 'd-sol', noteId: 'n1', recipientId: 'u2', sequence: 2, kind: 'SOLUTION', attemptCount: 0 } as any);
        expect(center.send).toHaveBeenCalledTimes(2);
        expect(center.send.mock.calls[0][0]).toMatchObject({
            id: 'd-inv', groupUnread: true, viewingTicketId: 't1', bypassPushCooldown: true, pushTag: 'ticket-note:n1',
        });
        expect(center.send.mock.calls[1][0]).toMatchObject({
            id: 'd-sol', groupUnread: true, viewingTicketId: 't1', bypassPushCooldown: false, pushTag: 'ticket-note:n1',
        });

        member.lastReadSequence = 3;
        await service.deliver({ id: 'd-sol-old', noteId: 'n1', recipientId: 'u2', sequence: 2, kind: 'SOLUTION', attemptCount: 0 } as any);
        expect(center.send).toHaveBeenCalledTimes(2);
    });

    it('formats generic grouped unread count for unread MESSAGE and MENTION deliveries', async () => {
        const manager: any = { save: async (_: any, row: any) => row };
        const center: any = { send: jest.fn(async (p: any) => ({ id: p.id })) };
        const service = new TicketNoteNotificationService(
            { manager } as any,
            { assertMember: async () => ({ note: { id: 'n1', ticketId: 't1', eventSequence: 5 }, member: { lastReadSequence: 2 } }) } as any,
            center,
            { isViewingNote: async () => false, server: { to: () => ({ emit: jest.fn() }) } } as any,
        );

        await service.deliver({ id: 'd-m1', noteId: 'n1', recipientId: 'u2', sequence: 4, kind: 'MESSAGE', attemptCount: 0 } as any);
        await service.deliver({ id: 'd-m2', noteId: 'n1', recipientId: 'u2', sequence: 5, kind: 'MENTION', attemptCount: 0 } as any);

        expect(center.send.mock.calls[0][0]).toMatchObject({
            message: 'Ada 3 pembaruan catatan internal untuk Anda.',
            bypassPushCooldown: false,
        });
        expect(center.send.mock.calls[1][0]).toMatchObject({
            message: 'Anda disebut dalam catatan internal (3 pembaruan).',
            bypassPushCooldown: true,
        });
    });
});
