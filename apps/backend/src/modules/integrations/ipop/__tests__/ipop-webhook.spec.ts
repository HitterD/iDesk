import { IpopWebhookService, IPOP_RETRY_DELAYS_MS } from '../ipop-webhook.service';
import { IpopTicketEventsListener } from '../ipop-ticket-events.listener';
import { WebhookOutboxStatus } from '../entities/webhook-outbox.entity';
import { IPOP_HEADERS, isValidIpopSignature } from '../ipop-signature';

const SECRET = 's'.repeat(40);
const env: Record<string, string> = {
    IPOP_WEBHOOK_URL: 'https://ipop.santos.co.id/api/idesk/webhook',
    IPOP_CLIENT_ID: 'ipop',
    IPOP_CLIENT_SECRET: SECRET,
};
const config = { get: (k: string) => env[k] } as any;

/** Users by id for the NIK lookup of chat recipients. */
const USERS: Record<string, { id: string; employeeId: string | null; isActive: boolean }> = {
    'u-requester': { id: 'u-requester', employeeId: '00000024', isActive: true },
    'u-agent': { id: 'u-agent', employeeId: '00061058', isActive: true },
    'u-nonik': { id: 'u-nonik', employeeId: null, isActive: true },
};
const users = { find: jest.fn(async ({ where }: any) => (where.id._value as string[]).map((id) => USERS[id]).filter(Boolean)) };

const view = (over: Record<string, unknown> = {}) => ({
    ticketId: 't-1', ticketNumber: 'GEN-0001', externalRef: 'REF-1', status: 'TODO', priority: 'MEDIUM',
    module: 'it-support', category: 'NETWORK', title: 'Wifi', assignee: null, slaTarget: null,
    createdAt: '', updatedAt: '', resolvedAt: null, closedAt: null, url: '', ...over,
}) as any;

describe('IpopWebhookService.deliver', () => {
    const row = (attempts: number) => ({ id: 'o-1', event: 'ticket.created', ticketId: 't-1', attempts, payload: { event: 'ticket.created' } }) as any;
    let fetchMock: jest.Mock;
    beforeEach(() => {
        fetchMock = jest.fn();
        (global as any).fetch = fetchMock;
    });

    it('signs the callback so iPop can verify it came from iDesk', async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200 });
        const repo = { update: jest.fn() };
        const service = new IpopWebhookService(repo as any, config);

        await service.deliver(row(0), new Date());

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(env.IPOP_WEBHOOK_URL);
        const ok = isValidIpopSignature(SECRET, init.headers[IPOP_HEADERS.timestamp], init.body, init.headers[IPOP_HEADERS.signature]);
        expect(ok).toBe(true);
        expect(repo.update).toHaveBeenCalledWith('o-1', expect.objectContaining({ status: WebhookOutboxStatus.DELIVERED }));
    });

    it('retries after 1m, 5m, 30m, 2h and then gives up', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 503 });
        const repo = { update: jest.fn() };
        const service = new IpopWebhookService(repo as any, config);
        const now = new Date('2026-10-04T00:00:00Z');

        for (let attempts = 0; attempts < IPOP_RETRY_DELAYS_MS.length; attempts++) {
            await service.deliver(row(attempts), now);
            const update = repo.update.mock.lastCall[1];
            expect(update.status).toBe(WebhookOutboxStatus.PENDING);
            expect(update.nextAttemptAt.getTime() - now.getTime()).toBe(IPOP_RETRY_DELAYS_MS[attempts]);
        }
        await service.deliver(row(IPOP_RETRY_DELAYS_MS.length), now);
        expect(repo.update.mock.lastCall[1]).toMatchObject({ status: WebhookOutboxStatus.FAILED, lastError: 'HTTP 503' });
    });
});

describe('IpopTicketEventsListener.reportChanges', () => {
    const build = (lastSent: any) => {
        const webhooks = { enqueue: jest.fn(), isEnabled: () => true };
        const outbox = { findOne: jest.fn().mockResolvedValue(lastSent ? { payload: { ticket: lastSent } } : null) };
        const listener = new IpopTicketEventsListener({} as any, webhooks as any, outbox as any, users as any);
        return { listener, webhooks };
    };

    it('reports an assignment once', async () => {
        const { listener, webhooks } = build(view());
        await listener.reportChanges(view({ assignee: { name: 'Agent A' } }));
        expect(webhooks.enqueue).toHaveBeenCalledWith('ticket.assigned', expect.anything(), { previousAssignee: null });

        const again = build(view({ assignee: { name: 'Agent A' } }));
        await again.listener.reportChanges(view({ assignee: { name: 'Agent A' } }));
        expect(again.webhooks.enqueue).not.toHaveBeenCalled();
    });

    it.each([
        ['IN_PROGRESS', 'ticket.status_changed'],
        ['RESOLVED', 'ticket.resolved'],
        ['CLOSED', 'ticket.closed'],
        ['CANCELLED', 'ticket.status_changed'],
    ])('maps a status change to %s -> %s', async (status, event) => {
        const { listener, webhooks } = build(view({ status: 'TODO' }));
        await listener.reportChanges(view({ status }));
        expect(webhooks.enqueue).toHaveBeenCalledWith(event, expect.objectContaining({ status }), { previousStatus: 'TODO' });
    });

    it('reports a moved installation visit', async () => {
        const before = { start: '2026-10-13T02:00:00.000Z', end: '2026-10-13T03:00:00.000Z', hardwareType: 'PC' };
        const after = { ...before, start: '2026-10-14T02:00:00.000Z', end: '2026-10-14T03:00:00.000Z' };
        const { listener, webhooks } = build(view({ visit: before }));
        await listener.reportChanges(view({ visit: after }));
        expect(webhooks.enqueue).toHaveBeenCalledWith('ticket.visit_changed', expect.objectContaining({ visit: after }), { previousVisit: before });
    });

    it('does not treat snapshots from before visits existed as a move', async () => {
        const { listener, webhooks } = build(view());
        await listener.reportChanges(view({ visit: { start: 'a', end: 'b', hardwareType: null } }));
        expect(webhooks.enqueue).not.toHaveBeenCalled();
    });

    it('stays silent when nothing iPop tracks has changed (e.g. a priority edit)', async () => {
        const { listener, webhooks } = build(view());
        await listener.reportChanges(view({ priority: 'HIGH' }));
        expect(webhooks.enqueue).not.toHaveBeenCalled();
    });
});

describe('IpopTicketEventsListener ordering', () => {
    // created and auto-assigned fire back to back; "assigned" must be diffed against the "created" snapshot.
    it('sends created then assigned for a ticket auto-assigned right after creation', async () => {
        const sent: any[] = [];
        const webhooks = {
            isEnabled: () => true,
            enqueue: jest.fn(async (event: string, v: any) => {
                await new Promise((r) => setTimeout(r, 5)); // slow DB insert
                sent.push({ event, ticket: v });
            }),
        };
        const outbox = { findOne: jest.fn(async () => (sent.length ? { payload: { ticket: sent[sent.length - 1].ticket } } : null)) };
        let assigned = false;
        const tickets = {
            loadTicket: jest.fn(async () => ({ id: 't-1', externalSource: 'IPOP' })),
            toView: jest.fn(() => view({ assignee: assigned ? { name: 'Agent A' } : null })),
        };
        const listener = new IpopTicketEventsListener(tickets as any, webhooks as any, outbox as any, users as any);

        const created = listener.onCreated({ ticketId: 't-1' });
        assigned = true;
        const autoAssigned = listener.onChanged({ ticketId: 't-1' });
        await Promise.all([created, autoAssigned]);

        expect(sent.map((s) => s.event)).toEqual(['ticket.created', 'ticket.assigned']);
    });

    it('ignores iDesk tickets whose requester has no NIK (no iPop user to link)', async () => {
        const webhooks = { isEnabled: () => true, enqueue: jest.fn() };
        const tickets = { loadTicket: jest.fn(async () => ({ id: 't-2', externalSource: null, ticketType: 'SERVICE', user: { employeeId: null } })), toView: jest.fn() };
        const listener = new IpopTicketEventsListener(tickets as any, webhooks as any, { findOne: jest.fn() } as any, users as any);

        await listener.onCreated({ ticketId: 't-2' });

        expect(webhooks.enqueue).not.toHaveBeenCalled();
    });

    it('notifies iPop about a ticket filed directly in iDesk by a user with a NIK', async () => {
        const webhooks = { isEnabled: () => true, enqueue: jest.fn() };
        const tickets = {
            loadTicket: jest.fn(async () => ({ id: 't-3', externalSource: null, ticketType: 'SERVICE', user: { employeeId: '00000024' } })),
            toView: jest.fn(() => view({ ticketId: 't-3', origin: 'IDESK', externalRef: null })),
        };
        const listener = new IpopTicketEventsListener(tickets as any, webhooks as any, { findOne: jest.fn(async () => null) } as any, users as any);

        await listener.onCreated({ ticketId: 't-3' });

        expect(webhooks.enqueue).toHaveBeenCalledWith('ticket.created', expect.objectContaining({ origin: 'IDESK' }));
    });
});

describe('IpopTicketEventsListener.onReplied (chat notification)', () => {
    const replied = (over: Record<string, unknown> = {}, message: Record<string, unknown> = {}) => ({
        ticketId: 't-1',
        ticketOwnerId: 'u-requester',
        ticketAssignedToId: 'u-agent',
        senderId: 'u-agent',
        senderName: 'Agent A',
        message: {
            id: 'm-1', content: '<p>Sudah saya cek, <b>mohon</b> restart laptop&nbsp;Anda</p>',
            attachments: [], isInternal: false, isSystemMessage: false,
            createdAt: new Date('2026-10-11T03:00:00Z'), ...message,
        },
        ...over,
    }) as any;
    const build = () => {
        const webhooks = { isEnabled: () => true, enqueue: jest.fn() };
        const tickets = {
            loadTicket: jest.fn(async () => ({ id: 't-1', externalSource: 'IPOP' })),
            toView: jest.fn(() => view()),
        };
        const outbox = { findOne: jest.fn(async () => ({ payload: { ticket: view() } })) };
        return { listener: new IpopTicketEventsListener(tickets as any, webhooks as any, outbox as any, users as any), webhooks };
    };
    const chatCall = (webhooks: { enqueue: jest.Mock }) => webhooks.enqueue.mock.calls.find((c: any[]) => c[0] === 'ticket.message_created');

    it('sends an agent reply to the requester (by NIK) with a plain-text preview', async () => {
        const { listener, webhooks } = build();
        await listener.onReplied(replied());
        expect(webhooks.enqueue).toHaveBeenCalledWith('ticket.message_created', expect.anything(), {
            message: {
                id: 'm-1',
                sender: { name: 'Agent A' },
                fromRequester: false,
                preview: 'Sudah saya cek, mohon restart laptop Anda',
                attachmentCount: 0,
                attachments: [],
                createdAt: '2026-10-11T03:00:00.000Z',
            },
            recipients: [{ nik: '00000024' }],
        });
    });

    it('sends the requester reply to the assigned agent', async () => {
        const { listener, webhooks } = build();
        await listener.onReplied(replied({ senderId: 'u-requester', senderName: 'Christhin' }));
        expect(chatCall(webhooks)?.[2]).toMatchObject({ message: { fromRequester: true, sender: { name: 'Christhin' } }, recipients: [{ nik: '00061058' }] });
    });

    it('sends nothing for a requester reply on an unassigned ticket, or to people without a NIK', async () => {
        let ctx = build();
        await ctx.listener.onReplied(replied({ senderId: 'u-requester', ticketAssignedToId: undefined }));
        expect(chatCall(ctx.webhooks)).toBeUndefined();
        ctx = build();
        await ctx.listener.onReplied(replied({ ticketOwnerId: 'u-nonik' }));
        expect(chatCall(ctx.webhooks)).toBeUndefined();
    });

    it('cuts long messages to 100 characters', async () => {
        const { listener, webhooks } = build();
        await listener.onReplied(replied({}, { content: 'a'.repeat(150) }));
        expect(chatCall(webhooks)![2].message.preview).toBe(`${'a'.repeat(99)}…`);
    });

    it('describes attachments by kind so iPop can show a photo, video or file', async () => {
        const { listener, webhooks } = build();
        await listener.onReplied(replied({}, {
            content: '', attachments: ['/a.png', '/b.pdf'],
            attachmentInfo: [{ name: 'layar.png', mime: 'image/png' }, { name: 'laporan.pdf', mime: 'application/pdf' }],
        }));
        expect(chatCall(webhooks)![2].message).toMatchObject({
            preview: '📎 2 lampiran', attachmentCount: 2,
            attachments: [{ name: 'layar.png', kind: 'image' }, { name: 'laporan.pdf', kind: 'file' }],
        });
    });

    it.each([
        ['an internal note', replied({}, { isInternal: true })],
        ['a system message', replied({}, { isSystemMessage: true })],
    ])('never sends %s', async (_label, event) => {
        const { listener, webhooks } = build();
        await listener.onReplied(event);
        expect(chatCall(webhooks)).toBeUndefined();
    });

    it('reports the status change of the reply before the message', async () => {
        const { listener, webhooks } = build();
        const tickets = (listener as any).tickets;
        tickets.toView.mockReturnValue(view({ status: 'IN_PROGRESS' }));
        await listener.onReplied(replied());
        expect(webhooks.enqueue.mock.calls.map((c: any[]) => c[0])).toEqual(['ticket.status_changed', 'ticket.message_created']);
    });

    it('tells iPop who opened the ticket in iDesk', async () => {
        const { listener, webhooks } = build();
        await listener.onRead({ ticketId: 't-1', userId: 'u-agent' });
        expect(webhooks.enqueue).toHaveBeenCalledWith('ticket.read', expect.anything(), { reader: { nik: '00061058' } });
    });
});
