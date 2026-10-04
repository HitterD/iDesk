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
        const listener = new IpopTicketEventsListener({} as any, webhooks as any, outbox as any);
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
        const listener = new IpopTicketEventsListener(tickets as any, webhooks as any, outbox as any);

        const created = listener.onCreated({ ticketId: 't-1' });
        assigned = true;
        const autoAssigned = listener.onChanged({ ticketId: 't-1' });
        await Promise.all([created, autoAssigned]);

        expect(sent.map((s) => s.event)).toEqual(['ticket.created', 'ticket.assigned']);
    });

    it('ignores tickets that were not filed through iPop', async () => {
        const webhooks = { isEnabled: () => true, enqueue: jest.fn() };
        const tickets = { loadTicket: jest.fn(async () => ({ id: 't-2', externalSource: null })), toView: jest.fn() };
        const listener = new IpopTicketEventsListener(tickets as any, webhooks as any, { findOne: jest.fn() } as any);

        await listener.onCreated({ ticketId: 't-2' });

        expect(webhooks.enqueue).not.toHaveBeenCalled();
    });
});
