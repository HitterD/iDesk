import { CHAT_PUSH_CONCURRENCY, TicketChatPushListener } from './ticket-chat-push.listener';
import { TicketRepliedEvent } from '../events/ticket-replied.event';
import { UserRole } from '../../users/enums/user-role.enum';

const TICKET_ID = 't-1';

const reply = (overrides: {
    senderId?: string;
    assigneeId?: string;
    creatorId?: string;
    content?: string;
    isInternal?: boolean;
    isSystemMessage?: boolean;
    attachments?: string[];
} = {}) =>
    new TicketRepliedEvent(
        TICKET_ID,
        'TK-0001',
        'Printer macet',
        'IN_PROGRESS',
        'requester',
        'req@example.com',
        'Ani',
        'assigneeId' in overrides ? overrides.assigneeId : 'agent',
        {
            id: 'm-1',
            content: overrides.content ?? 'Sudah dicoba restart?',
            isInternal: overrides.isInternal ?? false,
            isSystemMessage: overrides.isSystemMessage ?? false,
            attachments: overrides.attachments ?? [],
        } as any,
        overrides.senderId ?? 'agent',
        overrides.senderId === 'requester' ? 'Ani' : 'Budi',
        UserRole.AGENT,
        [],
        overrides.creatorId,
    );

describe('TicketChatPushListener', () => {
    let push: { isAvailable: jest.Mock; send: jest.Mock };
    let participants: { find: jest.Mock };
    let users: { find: jest.Mock };
    let viewers: Set<string>;
    let listener: TicketChatPushListener;

    beforeEach(() => {
        push = { isAvailable: jest.fn(() => true), send: jest.fn().mockResolvedValue({ success: true }) };
        participants = { find: jest.fn().mockResolvedValue([]) };
        users = {
            find: jest.fn(async ({ where }: any) =>
                where.id._value.map((id: string) => ({ id, role: id.startsWith('agent') || id === 'staff' ? UserRole.AGENT : UserRole.USER })),
            ),
        };
        viewers = new Set();
        const gateway = { isViewingTicket: jest.fn(async (userId: string) => viewers.has(userId)) };
        listener = new TicketChatPushListener(push as any, gateway as any, participants as any, users as any);
    });

    const recipients = () => push.send.mock.calls.map(([payload]) => payload.recipient).sort();

    it('pushes an agent reply to the requester with a client deep link', async () => {
        await listener.onReplied(reply());

        expect(recipients()).toEqual(['requester']);
        expect(push.send).toHaveBeenCalledWith(expect.objectContaining({
            title: '[#TK-0001] Pesan baru dari Budi',
            body: 'Sudah dicoba restart?',
            data: expect.objectContaining({ link: `/client/tickets/${TICKET_ID}`, ticketId: TICKET_ID, tag: `ticket-chat:${TICKET_ID}` }),
        }));
    });

    it('pushes a requester reply to the assigned agent with the staff deep link', async () => {
        await listener.onReplied(reply({ senderId: 'requester' }));

        expect(recipients()).toEqual(['agent']);
        expect(push.send.mock.calls[0][0].data.link).toBe(`/tickets/${TICKET_ID}`);
    });

    it('includes participants and the staff member who filed the ticket, never the sender', async () => {
        participants.find.mockResolvedValue([{ userId: 'colleague' }, { userId: 'agent-2' }, { userId: 'agent' }]);
        await listener.onReplied(reply({ creatorId: 'staff' }));

        expect(recipients()).toEqual(['agent-2', 'colleague', 'requester', 'staff']);
    });

    it('sends internal notes to staff only', async () => {
        participants.find.mockResolvedValue([{ userId: 'colleague' }, { userId: 'agent-2' }]);
        await listener.onReplied(reply({ senderId: 'agent-2', isInternal: true }));

        expect(recipients()).toEqual(['agent']);
    });

    it('notifies no agent on an unassigned ticket', async () => {
        await listener.onReplied(reply({ senderId: 'requester', assigneeId: undefined }));

        expect(push.send).not.toHaveBeenCalled();
    });

    it('skips users who already have the ticket open', async () => {
        viewers.add('requester');
        await listener.onReplied(reply());

        expect(push.send).not.toHaveBeenCalled();
    });

    it('skips system messages', async () => {
        await listener.onReplied(reply({ isSystemMessage: true }));

        expect(push.send).not.toHaveBeenCalled();
    });

    it('describes attachment-only messages', async () => {
        await listener.onReplied(reply({ content: '', attachments: ['/a.mp4', '/b.png'] }));

        expect(push.send.mock.calls[0][0].body).toBe('📎 Mengirim 2 lampiran');
    });

    it('caps how many recipients are pushed at the same time on a busy ticket', async () => {
        participants.find.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ userId: `user-${i}` })));
        let running = 0;
        let peak = 0;
        push.send.mockImplementation(async () => {
            running += 1;
            peak = Math.max(peak, running);
            await new Promise((resolve) => setTimeout(resolve, 2));
            running -= 1;
            return { success: true };
        });

        await listener.onReplied(reply());

        expect(push.send).toHaveBeenCalledTimes(21); // 20 participants + the requester
        expect(peak).toBeLessThanOrEqual(CHAT_PUSH_CONCURRENCY);
    });

    it('still pushes the others when one recipient fails', async () => {
        participants.find.mockResolvedValue([{ userId: 'user-1' }]);
        push.send.mockImplementation(async ({ recipient }: any) => {
            if (recipient === 'requester') throw new Error('network');
            return { success: true };
        });

        await listener.onReplied(reply());

        expect(recipients()).toEqual(['requester', 'user-1']);
    });

    it('does nothing when push is not configured', async () => {
        push.isAvailable.mockReturnValue(false);
        await listener.onReplied(reply());

        expect(participants.find).not.toHaveBeenCalled();
        expect(push.send).not.toHaveBeenCalled();
    });
});
