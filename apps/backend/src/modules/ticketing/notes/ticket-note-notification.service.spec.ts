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
});
