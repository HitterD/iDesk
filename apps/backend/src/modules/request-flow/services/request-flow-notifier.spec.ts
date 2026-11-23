import { RequestFlowNotifier } from './request-flow-notifier';
import type { FlowContext } from './request-flow-reader';

const ctx = (version = 3): FlowContext => ({
    flow: { id: 'flow-1', documentVersion: version } as never, ticket: { id: 't-1', ticketNumber: '221126-QC-0035' } as never,
    kind: 'EFORM', requesterId: 'req-1', requesterName: 'Leony', number: 'F/ICT/04/0120',
} as unknown as FlowContext);

function setup(alreadyStored = false) {
    const notifications = { send: jest.fn(async () => ({ id: 'n' })) };
    const mail = { send: jest.fn(async () => undefined) };
    const users = { findOne: jest.fn(async () => ({ id: 'u', email: 'a@b.c' })), manager: { exists: jest.fn(async () => alreadyStored) } };
    return { notifier: new RequestFlowNotifier(notifications as never, mail as never, users as never), notifications, mail };
}

describe('RequestFlowNotifier dedupe', () => {
    it('the same notice of the same document version has the same notification id, a new version a new one', async () => {
        const { notifier, notifications } = setup();
        await notifier.tellRequester(ctx(3), 'Akses siap dicoba', 'x');
        await notifier.tellRequester(ctx(3), 'Akses siap dicoba', 'x');
        await notifier.tellRequester(ctx(4), 'Akses siap dicoba', 'x');
        const ids = notifications.send.mock.calls.map((c: any[]) => c[0].id);
        expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
        expect(ids[0]).toBe(ids[1]);
        expect(ids[2]).not.toBe(ids[0]);
    });

    it('different recipients get different ids', async () => {
        const { notifier, notifications } = setup();
        await notifier.tellUser(ctx(), 'u-1', 'Kembali ke IT', 'x');
        await notifier.tellUser(ctx(), 'u-2', 'Kembali ke IT', 'x');
        const ids = notifications.send.mock.calls.map((c: any[]) => c[0].id);
        expect(ids[0]).not.toBe(ids[1]);
    });

    it('a retry of a notice already stored sends no second email', async () => {
        const { notifier, mail } = setup(true);
        await notifier.tellRequester(ctx(), 'Akses siap dicoba', 'x');
        expect(mail.send).not.toHaveBeenCalled();
    });

    it('a first notice sends the email once', async () => {
        const { notifier, mail } = setup(false);
        await notifier.tellRequester(ctx(), 'Akses siap dicoba', 'x');
        expect(mail.send).toHaveBeenCalledTimes(1);
    });
});

describe('RequestFlowNotifier reminders', () => {
    const ids = (notifications: { send: jest.Mock }) => notifications.send.mock.calls.map((c: any[]) => c[0].id);

    it('a second reminder on the same document version is a new notice, not swallowed as a repeat', async () => {
        const { notifier, notifications } = setup();
        let clock = Date.parse('2026-11-23T08:00:00Z');
        notifier.now = () => clock;
        await notifier.askApprover(ctx(), 'MANAGER', 'mgr-1', true);
        clock += 60 * 60 * 1000;
        await notifier.askApprover(ctx(), 'MANAGER', 'mgr-1', true);
        const sent = ids(notifications);
        expect(sent).toHaveLength(2);
        expect(sent[0]).not.toBe(sent[1]);
    });

    it('a retry of the same reminder moments later is still one notice', async () => {
        const { notifier, notifications } = setup();
        const clock = Date.parse('2026-11-23T08:00:00Z');
        notifier.now = () => clock;
        await notifier.askApprover(ctx(), 'MANAGER', 'mgr-1', true);
        await notifier.askApprover(ctx(), 'MANAGER', 'mgr-1', true);
        const sent = ids(notifications);
        expect(sent[0]).toBe(sent[1]);
    });

    it('the first (non-reminder) request for a signature is unaffected by time', async () => {
        const { notifier, notifications } = setup();
        notifier.now = () => 1;
        await notifier.askApprover(ctx(), 'MANAGER', 'mgr-1');
        notifier.now = () => 9_999_999_999;
        await notifier.askApprover(ctx(), 'MANAGER', 'mgr-1');
        const sent = ids(notifications);
        expect(sent[0]).toBe(sent[1]);
    });
});
